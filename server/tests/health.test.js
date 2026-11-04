'use strict';
const { request } = require('./helpers/app');
const { runMigrations } = require('./helpers/db');

beforeAll(async () => { await runMigrations(); });

describe('GET /api/health', () => {
  it('returns status ok and db ok', async () => {
    const res = await request().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe('GET /api/unknown-route', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request().get('/api/not-a-real-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
