'use strict';
const { agent } = require('./helpers/app');
const { runMigrations, cleanDb, pool } = require('./helpers/db');

const USER = { name: 'Disc User', email: 'disc@example.com', password: 'Password1!', acceptedTerms: true };

async function setup() {
  const ag = agent();
  await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(USER);
  return ag;
}

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await cleanDb(); });

describe('GET /api/disciplines', () => {
  it('returns empty list for new user', async () => {
    const ag = await setup();
    const res = await ag.get('/api/disciplines');
    expect(res.status).toBe(200);
    expect(res.body.disciplines).toEqual([]);
  });
});

describe('POST /api/disciplines', () => {
  it('creates discipline and returns 201', async () => {
    const ag = await setup();
    const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Web-дизайн', colorIndex: 2 });
    expect(res.status).toBe(201);
    expect(res.body.discipline.name).toBe('Web-дизайн');
    expect(res.body.discipline.colorIndex).toBe(2);
  });

  it('перша дисципліна отримує colorIndex 1', async () => {
    const ag = await setup();
    const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Math' });
    expect(res.status).toBe(201);
    expect(res.body.discipline.colorIndex).toBe(1);
  });

  it('розподіляє colorIndex між 1, 2, 3 і повторює 1 для четвертої дисципліни', async () => {
    const ag = await setup();
    const colors = [];
    for (const name of ['Math', 'Physics', 'Chemistry', 'Biology']) {
      const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name });
      expect(res.status).toBe(201);
      colors.push(res.body.discipline.colorIndex);
    }
    expect(colors).toEqual([1, 2, 3, 1]);
  });

  it('returns 409 on duplicate name (case-insensitive)', async () => {
    const ag = await setup();
    await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Math' });
    const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'MATH' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCIPLINE_CONFLICT');

    // The rejected duplicate must not create a second row.
    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*)::int AS count FROM disciplines');
    expect(count).toBe(1);
  });

  it('validates colorIndex between 1 and 5', async () => {
    const ag = await setup();
    const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Math', colorIndex: 6 });
    expect(res.status).toBe(422);
  });

  it('validates name max 100 chars', async () => {
    const ag = await setup();
    const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'A'.repeat(101) });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/disciplines/:id', () => {
  it('deletes discipline without tasks', async () => {
    const ag = await setup();
    const { body: { discipline } } = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'ToDelete' });
    const res = await ag.delete(`/api/disciplines/${discipline.id}`).set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(204);
  });

  it('returns 409 when discipline has tasks', async () => {
    const ag = await setup();
    const { body: { discipline } } = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'WithTasks' });
    await ag.post('/api/tasks').set('Content-Type', 'application/json').send({
      title: 'Some Task', disciplineId: discipline.id, deadline: '2027-01-01',
    });
    const res = await ag.delete(`/api/disciplines/${discipline.id}`).set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DISCIPLINE_HAS_TASKS');
  });

  it('returns 404 for non-existent discipline', async () => {
    const ag = await setup();
    const res = await ag.delete('/api/disciplines/00000000-0000-0000-0000-000000000000').set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-UUID discipline id', async () => {
    const ag = await setup();
    const res = await ag.delete('/api/disciplines/not-a-uuid').set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
