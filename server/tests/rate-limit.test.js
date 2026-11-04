'use strict';
// Enable the real limiter for this file only. Rate limiters are disabled in
// test mode by default so the other suites stay deterministic.
process.env.RATE_LIMIT_TEST = '1';

const { request } = require('./helpers/app');
const { runMigrations } = require('./helpers/db');

beforeAll(async () => { await runMigrations(); });

describe('Rate limiting', () => {
  it('returns 429 on POST /api/auth/register after 10 attempts', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request()
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(422);
    }

    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT');
    expect(res.body.error.message).toBe('Забагато спроб. Спробуйте пізніше.');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('does not apply the strict credential limit to GET /api/auth/me', async () => {
    // Same IP, same minute: 12 requests must stay 401, never 429.
    for (let i = 0; i < 12; i++) {
      const res = await request().get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    }
  });
});
