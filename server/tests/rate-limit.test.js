'use strict';
// Enable the real limiter for this file only. Rate limiters are disabled in
// test mode by default so the other suites stay deterministic.
process.env.RATE_LIMIT_TEST = '1';

const { agent, request } = require('./helpers/app');
const { runMigrations, cleanDb } = require('./helpers/db');
const { authLimiter } = require('../src/middleware/rateLimiters');

const USER = { name: 'Rate User', email: 'rate@example.com', password: 'Password1!', acceptedTerms: true };

// supertest connects from loopback; express-rate-limit keys the counter by that IP.
const LIMITER_KEY = '127.0.0.1';

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => {
  await cleanDb();
  await authLimiter.resetKey(LIMITER_KEY);
});

async function registerAgent() {
  const ag = agent();
  const res = await ag
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send(USER);
  expect(res.status).toBe(201);
  // Registration shares the strict credential limiter; start the endpoint
  // under test from a clean counter.
  await authLimiter.resetKey(LIMITER_KEY);
  return ag;
}

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

  it('returns 429 on POST /api/account/delete after 10 attempts', async () => {
    const ag = await registerAgent();

    for (let i = 0; i < 10; i++) {
      const res = await ag
        .post('/api/account/delete')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(422);
    }

    const res = await ag
      .post('/api/account/delete')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT');
    expect(res.body.error.message).toBe('Забагато спроб. Спробуйте пізніше.');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('returns 429 on POST /api/account/password after 10 attempts', async () => {
    const ag = await registerAgent();

    for (let i = 0; i < 10; i++) {
      const res = await ag
        .post('/api/account/password')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(422);
    }

    const res = await ag
      .post('/api/account/password')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMIT');
    expect(res.body.error.message).toBe('Забагато спроб. Спробуйте пізніше.');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
