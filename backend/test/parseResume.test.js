
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const parseResumeRoute = require('../routes/parseResume');

async function withTestServer(callback) {
  const app = express();
  app.use(express.json());
  app.use('/api', parseResumeRoute);

  const server = app.listen(0, '127.0.0.1');

  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
    }

    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('POST /parse-resume rejects a request with no resume', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/parse-resume`, {
      method: 'POST'
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Provide a PDF file or resumeText.'
    });
  });
});

test('POST /parse-resume rejects a non-PDF upload', async () => {
  await withTestServer(async (baseUrl) => {
    const form = new FormData();

    form.append(
      'resume',
      new Blob(['This is not a PDF'], { type: 'text/plain' }),
      'resume.txt'
    );

    const response = await fetch(`${baseUrl}/api/parse-resume`, {
      method: 'POST',
      body: form
    });

    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      error: 'Please upload a PDF file.'
    });
  });
});

test('POST /parse-resume rejects a PDF larger than 5 MB', async () => {
  await withTestServer(async (baseUrl) => {
    const oversizedPdf = new Uint8Array(5 * 1024 * 1024 + 1);
    oversizedPdf.set(Buffer.from('%PDF-'));

    const form = new FormData();

    form.append(
      'resume',
      new Blob([oversizedPdf], { type: 'application/pdf' }),
      'large-resume.pdf'
    );

    const response = await fetch(`${baseUrl}/api/parse-resume`, {
      method: 'POST',
      body: form
    });

    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), {
      error: 'Resume PDF must be 5 MB or smaller.'
    });
  });
});

test('POST /parse-resume rejects a fake PDF file', async () => {
  await withTestServer(async (baseUrl) => {
    const form = new FormData();

    form.append(
      'resume',
      new Blob(
        ['This is actually a text file, not a PDF.'],
        { type: 'application/pdf' }
      ),
      'fake-resume.pdf'
    );

    const response = await fetch(`${baseUrl}/api/parse-resume`, {
      method: 'POST',
      body: form
    });

    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      error: 'The uploaded file does not appear to be a valid PDF.'
    });
  });
});

test('POST /parse-resume rejects an empty resume text', async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/parse-resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resumeText: '   '
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'The document contains no extractable text.'
    });
  });
});

test('POST /parse-resume returns 503 when Gemini API key is missing', async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  try {
    delete process.env.GEMINI_API_KEY;

    await withTestServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/parse-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resumeText: 'Amal S. Software developer. Skills: JavaScript, Node.js.'
        })
      });

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        error: 'AI service is not configured on the server.'
      });
    });
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});
