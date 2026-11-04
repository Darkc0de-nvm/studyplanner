'use strict';
const { request } = require('./helpers/app');
const { runMigrations } = require('./helpers/db');
const pool = require('../src/db/pool');

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

  it('returns 503 degraded when the database is unavailable', async () => {
    const spy = vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('db down'));
    try {
      const res = await request().get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.db).toBe('error');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET /api/unknown-route', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const res = await request().get('/api/not-a-real-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
