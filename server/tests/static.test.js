'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { mountClientStatic } = require('../src/static');

const tempDirs = [];

function makeClient(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-client-'));
  tempDirs.push(dir);
  for (const [relative, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('mountClientStatic', () => {
  it('does nothing when the client directory does not exist', () => {
    const app = express();
    const missingDir = path.join(os.tmpdir(), `sp-missing-${Date.now()}`);

    expect(mountClientStatic(app, missingDir)).toBe(false);
  });

  it('serves HTML, cached assets and the client 404 page', async () => {
    const dir = makeClient({
      'index.html': '<h1>Home</h1>',
      'assets/app.css': 'body { color: red; }',
      'css/app.css': 'a { color: blue; }',
      'js/app.js': 'console.log(1);',
      '404.html': '<h1>Not found</h1>',
    });
    const app = express();

    expect(mountClientStatic(app, dir)).toBe(true);

    let res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Home');
    expect(res.headers['cache-control']).toContain('no-cache');

    res = await request(app).get('/assets/app.css');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=31536000');

    expect((await request(app).get('/css/app.css')).status).toBe(200);
    expect((await request(app).get('/js/app.js')).status).toBe(200);

    res = await request(app).get('/missing-page');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Not found');
  });

  it('returns a JSON 404 when the client has no 404.html', async () => {
    const dir = makeClient({ 'index.html': '<h1>Home</h1>' });
    const app = express();
    mountClientStatic(app, dir);

    const res = await request(app).get('/missing-page');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
