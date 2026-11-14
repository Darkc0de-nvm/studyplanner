'use strict';
const { agent, request } = require('./helpers/app');
const { runMigrations, cleanDb, pool } = require('./helpers/db');

const USER = { name: 'Account User', email: 'account@example.com', password: 'Password1!', acceptedTerms: true };

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await cleanDb(); });

async function registerUser() {
  const current = agent();
  const { body } = await current.post('/api/auth/register').set('Content-Type', 'application/json').send(USER);
  return { current, userId: body.user.id };
}

describe('POST /api/account/delete', () => {
  it('keeps account data and session when current password is wrong', async () => {
    const { current, userId } = await registerUser();
    const res = await current.post('/api/account/delete').set('Content-Type', 'application/json').send({ password: 'WrongPass1!' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect((await current.get('/api/auth/me')).status).toBe(200);
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    expect(rows).toHaveLength(1);
  });

  it('deletes account, cascades all data and sessions, and clears the cookie', async () => {
    const { current, userId } = await registerUser();
    const { body: { discipline } } = await current.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Test' });
    await current.post('/api/tasks').set('Content-Type', 'application/json').send({ title: 'Task', disciplineId: discipline.id, deadline: '2027-01-01' });
    const other = agent();
    await other.post('/api/auth/login').set('Content-Type', 'application/json').send({ email: USER.email, password: USER.password });

    const res = await current.post('/api/account/delete').set('Content-Type', 'application/json').send({ password: USER.password });
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/sp_session=;/);
    expect((await current.get('/api/auth/me')).status).toBe(401);
    const { rows: users } = await pool.query('SELECT id FROM users');
    const { rows: sessions } = await pool.query('SELECT id FROM sessions WHERE user_id = $1', [userId]);
    const { rows: tasks } = await pool.query('SELECT id FROM tasks');
    const { rows: disciplines } = await pool.query('SELECT id FROM disciplines');
    expect(users).toHaveLength(0);
    expect(sessions).toHaveLength(0);
    expect(tasks).toHaveLength(0);
    expect(disciplines).toHaveLength(0);
    expect((await other.get('/api/auth/me')).status).toBe(401);
  });

  it('requires authentication and a password', async () => {
    expect((await request().post('/api/account/delete').send({ password: USER.password })).status).toBe(401);
    const { current } = await registerUser();
    expect((await current.post('/api/account/delete').send({})).status).toBe(422);
  });
});

describe('POST /api/account/password', () => {
  it('rejects a wrong current password without changing the hash', async () => {
    const { current, userId } = await registerUser();
    const { rows: [before] } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const res = await current.post('/api/account/password').set('Content-Type', 'application/json').send({ currentPassword: 'WrongPass1!', newPassword: 'NewPass123!' });
    expect(res.status).toBe(403);
    expect((await current.get('/api/auth/me')).status).toBe(200);
    const { rows: [after] } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    expect(after.password_hash).toBe(before.password_hash);
  });

  it('changes password, invalidates other sessions, and preserves the current session', async () => {
    const { current } = await registerUser();
    const other = agent();
    await other.post('/api/auth/login').set('Content-Type', 'application/json').send({ email: USER.email, password: USER.password });
    const res = await current.post('/api/account/password').set('Content-Type', 'application/json').send({ currentPassword: USER.password, newPassword: 'NewPass123!' });
    expect(res.status).toBe(204);
    expect((await current.get('/api/auth/me')).status).toBe(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await request().post('/api/auth/login').send({ email: USER.email, password: USER.password })).status).toBe(401);
    expect((await request().post('/api/auth/login').send({ email: USER.email, password: 'NewPass123!' })).status).toBe(200);
  });

  it('requires a session, rejects weak passwords, and requires a different password', async () => {
    expect((await request().post('/api/account/password').send({ currentPassword: USER.password, newPassword: 'NewPass123!' })).status).toBe(401);
    const { current } = await registerUser();
    expect((await current.post('/api/account/password').send({ currentPassword: USER.password, newPassword: 'short' })).status).toBe(422);
    expect((await current.post('/api/account/password').send({ currentPassword: USER.password, newPassword: USER.password })).status).toBe(422);
  });

  it('rejects missing fields', async () => {
    const { current } = await registerUser();
    expect((await current.post('/api/account/password').set('Content-Type', 'application/json').send({})).status).toBe(422);
    expect((await current.post('/api/account/password').set('Content-Type', 'application/json').send({ currentPassword: USER.password })).status).toBe(422);
    expect((await current.post('/api/account/password').set('Content-Type', 'application/json').send({ newPassword: 'NewPass123!' })).status).toBe(422);
  });

  it('rejects fields of the wrong type', async () => {
    const { current } = await registerUser();
    expect((await current.post('/api/account/password').set('Content-Type', 'application/json').send({ currentPassword: 123, newPassword: 'NewPass123!' })).status).toBe(422);
    expect((await current.post('/api/account/password').set('Content-Type', 'application/json').send({ currentPassword: USER.password, newPassword: 123 })).status).toBe(422);
  });

  it('rejects unknown fields', async () => {
    const { current } = await registerUser();
    const res = await current
      .post('/api/account/password')
      .set('Content-Type', 'application/json')
      .send({ currentPassword: USER.password, newPassword: 'NewPass123!', extra: 'value' });
    expect(res.status).toBe(422);
  });
});
