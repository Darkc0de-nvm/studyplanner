'use strict';
const { agent, request } = require('./helpers/app');
const { runMigrations, cleanDb, pool } = require('./helpers/db');

const USER = { name: 'Fault User', email: 'fault@example.com', password: 'Password1!' };

/**
 * Replaces pool.query with a wrapper that fails for statements containing
 * `match`, emulating a PostgreSQL error at that exact step.
 */
function injectFailure(match, pgCode) {
  const realQuery = pool.query.bind(pool);
  return vi.spyOn(pool, 'query').mockImplementation((sql, params) => {
    const text = typeof sql === 'string' ? sql : '';
    if (text.includes(match)) {
      const err = new Error('injected database failure');
      if (pgCode) err.code = pgCode;
      return Promise.reject(err);
    }
    return realQuery(sql, params);
  });
}

async function authenticatedAgent() {
  const ag = agent();
  const res = await ag
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send(USER);
  expect(res.status).toBe(201);
  return ag;
}

async function createDiscipline(ag, name = 'Fault Discipline') {
  const res = await ag
    .post('/api/disciplines')
    .set('Content-Type', 'application/json')
    .send({ name });
  expect(res.status).toBe(201);
  return res.body.discipline;
}

async function createTask(ag, disciplineId) {
  const res = await ag
    .post('/api/tasks')
    .set('Content-Type', 'application/json')
    .send({ title: 'Fault Task', disciplineId, deadline: '2027-01-15' });
  expect(res.status).toBe(201);
  return res.body.task;
}

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await cleanDb(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('Registration under a concurrent duplicate', () => {
  it('maps PostgreSQL 23505 on INSERT to a neutral 409 REGISTRATION_FAILED', async () => {
    injectFailure('INSERT INTO users', '23505');

    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...USER, email: 'race@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REGISTRATION_FAILED');
  });

  it('rethrows unexpected insert errors as 500, not 409', async () => {
    injectFailure('INSERT INTO users');

    const res = await request()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send({ ...USER, email: 'broken@example.com' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('Discipline conflicts under concurrent writes', () => {
  it('maps 23505 on INSERT to 409 DISCIPLINE_CONFLICT', async () => {
    const ag = await authenticatedAgent();
    injectFailure('INSERT INTO disciplines', '23505');

    const res = await ag
      .post('/api/disciplines')
      .set('Content-Type', 'application/json')
      .send({ name: 'Race Discipline' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCIPLINE_CONFLICT');
  });

  it('rethrows unexpected insert errors as 500', async () => {
    const ag = await authenticatedAgent();
    injectFailure('INSERT INTO disciplines');

    const res = await ag
      .post('/api/disciplines')
      .set('Content-Type', 'application/json')
      .send({ name: 'Broken Discipline' });

    expect(res.status).toBe(500);
  });

  it('maps 23503 on DELETE to 409 DISCIPLINE_HAS_TASKS', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    injectFailure('DELETE FROM disciplines', '23503');

    const res = await ag
      .delete(`/api/disciplines/${disc.id}`)
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCIPLINE_HAS_TASKS');
  });

  it('rethrows unexpected delete errors as 500', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    injectFailure('DELETE FROM disciplines');

    const res = await ag
      .delete(`/api/disciplines/${disc.id}`)
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(500);
  });
});

describe('Task writes when the discipline disappears', () => {
  it('maps 23503 on INSERT INTO tasks to 404', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    injectFailure('INSERT INTO tasks', '23503');

    const res = await ag
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send({ title: 'Race Task', disciplineId: disc.id, deadline: '2027-01-15' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Дисципліну не знайдено.');
  });

  it('rethrows unexpected insert errors as 500', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    injectFailure('INSERT INTO tasks');

    const res = await ag
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send({ title: 'Broken Task', disciplineId: disc.id, deadline: '2027-01-15' });

    expect(res.status).toBe(500);
  });

  it('maps 23503 on UPDATE tasks to 404', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    const task = await createTask(ag, disc.id);
    injectFailure('UPDATE tasks', '23503');

    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ title: 'Updated Race Task' });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Дисципліну не знайдено.');
  });

  it('rethrows unexpected update errors as 500', async () => {
    const ag = await authenticatedAgent();
    const disc = await createDiscipline(ag);
    const task = await createTask(ag, disc.id);
    injectFailure('UPDATE tasks');

    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ title: 'Broken Update' });

    expect(res.status).toBe(500);
  });
});

describe('Session, account and discipline endpoints when the database fails', () => {
  it('returns 500 when logout cannot delete the session', async () => {
    const ag = await authenticatedAgent();
    injectFailure('DELETE FROM sessions');

    const res = await ag
      .post('/api/auth/logout')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when account deletion fails', async () => {
    const ag = await authenticatedAgent();
    injectFailure('DELETE FROM users');

    const res = await ag
      .delete('/api/account')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when disciplines cannot be listed', async () => {
    const ag = await authenticatedAgent();
    injectFailure('FROM disciplines');

    const res = await ag.get('/api/disciplines');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('Central PostgreSQL error fallback', () => {
  it('maps an unhandled 22007 to 422 VALIDATION_ERROR', async () => {
    const ag = await authenticatedAgent();
    injectFailure('FROM tasks t', '22007');

    const res = await ag.get('/api/tasks');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Некоректне значення дати.');
  });

  it('returns 500 INTERNAL_ERROR for an unknown database failure', async () => {
    const ag = await authenticatedAgent();
    injectFailure('FROM tasks t');

    const res = await ag.get('/api/tasks');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns 500 when the session lookup itself fails', async () => {
    const ag = await authenticatedAgent();
    injectFailure('FROM sessions s');

    const res = await ag.get('/api/auth/me');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
