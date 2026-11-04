'use strict';
const { agent } = require('./helpers/app');
const { runMigrations, cleanDb, pool } = require('./helpers/db');

const USER = { name: 'Account User', email: 'account@example.com', password: 'Password1!' };

beforeAll(async () => { await runMigrations(); });
beforeEach(async () => { await cleanDb(); });

describe('DELETE /api/account', () => {
  it('deletes account, cascades tasks/disciplines/sessions, returns 204', async () => {
    const ag = agent();
    await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(USER);

    // Create a discipline and task
    const { body: { discipline } } = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name: 'Test' });
    await ag.post('/api/tasks').set('Content-Type', 'application/json').send({ title: 'Task', disciplineId: discipline.id, deadline: '2027-01-01' });

    const res = await ag.delete('/api/account').set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(204);

    // Session should be invalidated
    const meRes = await ag.get('/api/auth/me');
    expect(meRes.status).toBe(401);

    // Verify cascade: tasks and disciplines should be gone
    const { rows: tasks } = await pool.query('SELECT id FROM tasks');
    const { rows: discs } = await pool.query('SELECT id FROM disciplines');
    const { rows: sessions } = await pool.query('SELECT id FROM sessions');
    expect(tasks).toHaveLength(0);
    expect(discs).toHaveLength(0);
    expect(sessions).toHaveLength(0);
  });

  it('returns 401 when not authenticated', async () => {
    const { request } = require('./helpers/app');
    const res = await request().delete('/api/account').set('Content-Type', 'application/json').send({});
    expect(res.status).toBe(401);
  });
});
