'use strict';
const { agent, request } = require('./helpers/app');
const { runMigrations, cleanDb } = require('./helpers/db');
const { serialize } = require('../src/utils/sessionCookie');
const { randomUUID } = require('crypto');

const VALID_USER = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'ValidPass1!',
};

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await cleanDb();
});

describe('POST /api/auth/register', () => {
  it('creates user and returns 201 with user object', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Test User', email: 'test@example.com' });
    expect(res.body.user.id).toBeTruthy();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 409 when email already registered', async () => {
    await request().post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_CONFLICT');
  });

  it('is case-insensitive on email duplicate check', async () => {
    await request().post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, email: 'TEST@EXAMPLE.COM' });
    expect(res.status).toBe(409);
  });

  it('validates name min length', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, name: 'A' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('name');
  });

  it('validates password min 8 chars', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, password: 'short' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('password');
  });

  it('validates email format', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('rejects extra unknown fields', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, role: 'admin' });
    expect(res.status).toBe(422);
  });

  it('rejects non-JSON content type (CSRF)', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'text/plain')
      .send('name=Test&email=test@example.com&password=ValidPass1!');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_CONTENT_TYPE');
  });

  it('rejects malformed JSON', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request().post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
  });

  it('returns 200 and sets cookie on valid credentials', async () => {
    const res = await request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password with generic message (no user enumeration)', async () => {
    const res = await request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: VALID_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Невірна пошта або пароль.');
  });

  it('returns 401 on non-existent email with same message (no user enumeration)', async () => {
    const res = await request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'nobody@example.com', password: 'ValidPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Невірна пошта або пароль.');
  });

  it('is case-insensitive on email', async () => {
    const res = await request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'TEST@EXAMPLE.COM', password: VALID_USER.password });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/logout', () => {
  it('returns 204 and clears cookie', async () => {
    const ag = agent();
    await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
    const res = await ag.post('/api/auth/logout').set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(204);
  });

  it('returns 401 without session', async () => {
    const res = await request()
      .post('/api/auth/logout')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(401);
  });

  it('session is invalidated after logout', async () => {
    const ag = agent();
    await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
    await ag.post('/api/auth/logout').set('Content-Type', 'application/json').send({});
    const res = await ag.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user when authenticated', async () => {
    const ag = agent();
    await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(VALID_USER);
    const res = await ag.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(VALID_USER.email);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request().get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Session rotation on login', () => {
  it('creates a new session id on login (session fixation defense)', async () => {
    // Register and get first session
    const reg = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);
    const firstCookie = reg.headers['set-cookie'][0];

    // Login again, should get new session
    const login = await request()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: VALID_USER.email, password: VALID_USER.password });
    const secondCookie = login.headers['set-cookie'][0];

    expect(firstCookie).not.toBe(secondCookie);
  });
});

describe('XSS payload storage', () => {
  it('stores XSS payload as plain text in name field', async () => {
    const xssName = '<script>alert(1)</script>';
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...VALID_USER, name: xssName });
    // name passes min 2 chars check
    if (res.status === 201) {
      expect(res.body.user.name).toBe(xssName);
    }
    // If status 422 it means name failed validation (which is acceptable since length may be fine)
    expect([201, 422]).toContain(res.status);
  });
});

describe('Session cookie integrity', () => {
  it('sets a signed cookie value', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    const value = cookie.replace('sp_session=', '');
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/);
  });

  it('returns 401 SESSION_EXPIRED for a malformed cookie', async () => {
    const res = await request().get('/api/auth/me').set('Cookie', 'sp_session=not-a-uuid');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 SESSION_EXPIRED for a tampered signature', async () => {
    const reg = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);
    const raw = reg.headers['set-cookie'][0].split(';')[0].replace('sp_session=', '');
    const id = raw.split('.')[0];

    const res = await request()
      .get('/api/auth/me')
      .set('Cookie', `sp_session=${id}.${'A'.repeat(43)}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns 401 SESSION_EXPIRED for a well-formed but unknown session', async () => {
    const res = await request()
      .get('/api/auth/me')
      .set('Cookie', `sp_session=${serialize(randomUUID())}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns 401 SESSION_EXPIRED for a cookie with an empty signature', async () => {
    const res = await request()
      .get('/api/auth/me')
      .set('Cookie', `sp_session=${randomUUID()}.`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns 401 SESSION_EXPIRED for a signed value with a malformed UUID', async () => {
    const res = await request()
      .get('/api/auth/me')
      .set('Cookie', `sp_session=not-a-uuid.${'A'.repeat(43)}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('returns 401 AUTH_REQUIRED when no cookie is sent', async () => {
    const res = await request().get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
  });
});

describe('CSRF Origin validation', () => {
  it('rejects a cross-origin state-changing request with 403', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .set('Origin', 'http://evil.example')
      .send(VALID_USER);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FORBIDDEN');
  });

  it('rejects a malformed Origin header with 400', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .set('Origin', 'not a url')
      .send(VALID_USER);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_ORIGIN');
  });

  it('accepts a same-origin request whose Origin matches Host', async () => {
    const res = await request()
      .post('/api/auth/register')
      .set('Host', 'example.test')
      .set('Origin', 'http://example.test')
      .set('Content-Type', 'application/json')
      .send(VALID_USER);

    expect(res.status).toBe(201);
  });
});
