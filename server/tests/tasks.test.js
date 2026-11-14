'use strict';
const { agent } = require('./helpers/app');
const { runMigrations, cleanDb } = require('./helpers/db');

const USER_A = { name: 'User A', email: 'usera@example.com', password: 'PasswordA1!', acceptedTerms: true };
const USER_B = { name: 'User B', email: 'userb@example.com', password: 'PasswordB1!', acceptedTerms: true };

async function loginUser(userData) {
  const ag = agent();
  await ag.post('/api/auth/register').set('Content-Type', 'application/json').send(userData);
  return ag;
}

async function createDisc(ag, name = 'Test Discipline', colorIndex = 1) {
  const res = await ag.post('/api/disciplines').set('Content-Type', 'application/json').send({ name, colorIndex });
  return res.body.discipline;
}

async function createTask(ag, disciplineId, overrides = {}) {
  const data = {
    title: 'Test Task',
    description: 'Task description',
    disciplineId,
    deadline: '2027-01-15',
    ...overrides,
  };
  const res = await ag.post('/api/tasks').set('Content-Type', 'application/json').send(data);
  return res;
}

beforeAll(async () => {
  await runMigrations();
});

beforeEach(async () => {
  await cleanDb();
});

describe('GET /api/tasks', () => {
  it('returns empty list for new user', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    const { request } = require('./helpers/app');
    const res = await request().get('/api/tasks');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id);
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Test Task');
    expect(res.body.task.deadline).toBe('2027-01-15');
    expect(res.body.task.done).toBe(false);
    expect(res.body.task.discipline.id).toBe(disc.id);
  });

  it('validates title min 3 chars', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { title: 'AB' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('title');
  });

  it('validates title max 100 chars', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { title: 'A'.repeat(101) });
    expect(res.status).toBe(422);
  });

  it('validates description max 500 chars', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { description: 'D'.repeat(501) });
    expect(res.status).toBe(422);
  });

  it('rejects invalid deadline (31 Feb)', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { deadline: '2027-02-31' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('deadline');
  });

  it('rejects deadline with wrong format', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { deadline: '15.01.2027' });
    expect(res.status).toBe(422);
  });

  it('rejects extra unknown fields (mass assignment prevention)', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await ag.post('/api/tasks').set('Content-Type', 'application/json').send({
      title: 'Valid Task',
      disciplineId: disc.id,
      deadline: '2027-01-15',
      userId: 'hacked-id',
    });
    expect(res.status).toBe(422);
  });

  it('stores XSS payload as plain text', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const xss = '<img src=x onerror=alert(1)>';
    const res = await createTask(ag, disc.id, { title: xss });
    if (res.status === 201) {
      expect(res.body.task.title).toBe(xss);
    } else {
      // 422 if title failed some validation
      expect(res.status).toBe(422);
    }
  });

  it('SQL injection in title does not break query', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await createTask(ag, disc.id, { title: "'; DROP TABLE tasks; --" });
    // Either created safely or failed validation; must NOT cause 500
    expect(res.status).not.toBe(500);
  });
});

describe('GET /api/tasks/:id', () => {
  it('returns task by id', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const created = await createTask(ag, disc.id);
    const id = created.body.task.id;
    const res = await ag.get(`/api/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.task.id).toBe(id);
  });

  it('returns 404 for non-existent task', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('updates title', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ title: 'Updated Title' });
    expect(res.status).toBe(200);
    expect(res.body.task.title).toBe('Updated Title');
  });

  it('toggles done and sets completedAt', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ done: true });
    expect(res.status).toBe(200);
    expect(res.body.task.done).toBe(true);
    expect(res.body.task.completedAt).not.toBeNull();
  });

  it('clears completedAt when done toggled back to false', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    await ag.patch(`/api/tasks/${task.id}`).set('Content-Type', 'application/json').send({ done: true });
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ done: false });
    expect(res.body.task.done).toBe(false);
    expect(res.body.task.completedAt).toBeNull();
  });

  it('returns 404 for non-existent task', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag
      .patch('/api/tasks/00000000-0000-0000-0000-000000000000')
      .set('Content-Type', 'application/json')
      .send({ done: true });
    expect(res.status).toBe(404);
  });

  it('updates description and deadline', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);

    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ description: 'Оновлений опис', deadline: '2027-02-01' });

    expect(res.status).toBe(200);
    expect(res.body.task.description).toBe('Оновлений опис');
    expect(res.body.task.deadline).toBe('2027-02-01');
  });

  it('moves a task to another discipline of the same user', async () => {
    const ag = await loginUser(USER_A);
    const disc1 = await createDisc(ag, 'Discipline One');
    const disc2 = await createDisc(ag, 'Discipline Two');
    const { body: { task } } = await createTask(ag, disc1.id);

    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ disciplineId: disc2.id });

    expect(res.status).toBe(200);
    expect(res.body.task.disciplineId).toBe(disc2.id);
    expect(res.body.task.discipline.name).toBe('Discipline Two');
  });

  it('rejects moving a task to another user discipline with 404', async () => {
    const agA = await loginUser(USER_A);
    const agB = await loginUser(USER_B);
    const discA = await createDisc(agA, 'User A Discipline');
    const discB = await createDisc(agB, 'User B Discipline');
    const { body: { task } } = await createTask(agA, discA.id);

    const res = await agA
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ disciplineId: discB.id });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Дисципліну не знайдено.');
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('deletes task and returns 204', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .delete(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(204);
    const check = await ag.get(`/api/tasks/${task.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 when deleting non-existent task', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag
      .delete('/api/tasks/00000000-0000-0000-0000-000000000000')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('Multi-tenancy: ownership isolation', () => {
  it('User B cannot read User A task (gets 404)', async () => {
    const agA = await loginUser(USER_A);
    const agB = await loginUser(USER_B);
    const disc = await createDisc(agA);
    const { body: { task } } = await createTask(agA, disc.id);

    const res = await agB.get(`/api/tasks/${task.id}`);
    expect(res.status).toBe(404);
  });

  it('User B cannot see User A task in list', async () => {
    const agA = await loginUser(USER_A);
    const agB = await loginUser(USER_B);
    const disc = await createDisc(agA);
    await createTask(agA, disc.id);

    const res = await agB.get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(0);
  });

  it('User B cannot delete User A task (gets 404)', async () => {
    const agA = await loginUser(USER_A);
    const agB = await loginUser(USER_B);
    const disc = await createDisc(agA);
    const { body: { task } } = await createTask(agA, disc.id);

    const res = await agB
      .delete(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('Filtering and search', () => {
  it('filters by discipline', async () => {
    const ag = await loginUser(USER_A);
    const disc1 = await createDisc(ag, 'Discipline One');
    const disc2 = await createDisc(ag, 'Discipline Two');
    await createTask(ag, disc1.id, { title: 'Task One' });
    await createTask(ag, disc2.id, { title: 'Task Two' });

    const res = await ag.get(`/api/tasks?discipline=${disc1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('Task One');
  });

  it('filters by done=true', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id, { title: 'Done Task' });
    await createTask(ag, disc.id, { title: 'Active Task' });
    await ag.patch(`/api/tasks/${task.id}`).set('Content-Type', 'application/json').send({ done: true });

    const res = await ag.get('/api/tasks?done=true');
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].done).toBe(true);
  });

  it('filters by done=false', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id, { title: 'Done Task' });
    await createTask(ag, disc.id, { title: 'Active Task' });
    await ag.patch(`/api/tasks/${task.id}`).set('Content-Type', 'application/json').send({ done: true });

    const res = await ag.get('/api/tasks?done=false');
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].done).toBe(false);
  });

  it('filters by q (search title)', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    await createTask(ag, disc.id, { title: 'Математичний аналіз', description: 'Щось інше' });
    await createTask(ag, disc.id, { title: 'Програмування' });

    const res = await ag.get('/api/tasks?q=математичний');
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toContain('Математичний');
  });

  it('filters by from and to date', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    await createTask(ag, disc.id, { title: 'Early',  deadline: '2026-01-10' });
    await createTask(ag, disc.id, { title: 'Middle', deadline: '2026-06-15' });
    await createTask(ag, disc.id, { title: 'Late',   deadline: '2026-12-20' });

    const res = await ag.get('/api/tasks?from=2026-05-01&to=2026-07-31');
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].title).toBe('Middle');
  });

  it('rejects unknown query params', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks?unknown=value');
    expect(res.status).toBe(422);
  });

  it('rejects a non-boolean done filter with a Ukrainian message', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks?done=yes');
    expect(res.status).toBe(422);
    expect(res.body.error.fields.done).toBe('Параметр done має бути true або false.');
  });

  it('SQL injection in q param does not break query', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get("/api/tasks?q='; DROP TABLE tasks; --");
    expect(res.status).not.toBe(500);
    expect(res.body).toHaveProperty('tasks');
  });
});

describe('Request size limits', () => {
  it('rejects oversized body (>16KB)', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const res = await ag
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send({ title: 'T'.repeat(3), description: 'D'.repeat(20000), disciplineId: disc.id, deadline: '2027-01-01' });
    // Either 413 (too large) or 422 (description too long for Zod)
    expect([413, 422]).toContain(res.status);
  });
});

describe('Malformed identifiers', () => {
  it('GET /api/tasks/:id returns 404 for a non-UUID id', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks/not-a-uuid');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /api/tasks/:id returns 404 for a non-UUID id', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag
      .patch('/api/tasks/not-a-uuid')
      .set('Content-Type', 'application/json')
      .send({ done: true });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/tasks/:id returns 404 for a non-UUID id', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag
      .delete('/api/tasks/not-a-uuid')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 404 when creating a task for another user discipline', async () => {
    const agA = await loginUser(USER_A);
    const agB = await loginUser(USER_B);
    const disc = await createDisc(agA);
    const res = await createTask(agB, disc.id);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Дисципліну не знайдено.');
  });
});

describe('Filter date validation', () => {
  it('rejects from with a non-existent date', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks?from=2027-02-31');
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('from');
  });

  it('rejects to with a wrong format', async () => {
    const ag = await loginUser(USER_A);
    const res = await ag.get('/api/tasks?to=31.02.2027');
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('to');
  });
});

describe('PATCH validation messages', () => {
  it('uses Ukrainian messages for a short title', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ title: 'ab' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.title).toBe('Назва має містити від 3 до 100 символів.');
  });

  it('uses a Ukrainian message for a non-boolean done', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({ done: 'yes' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.done).toBe('Поле done має бути true або false.');
  });

  it('rejects an empty update body', async () => {
    const ag = await loginUser(USER_A);
    const disc = await createDisc(ag);
    const { body: { task } } = await createTask(ag, disc.id);
    const res = await ag
      .patch(`/api/tasks/${task.id}`)
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(422);
    expect(res.body.error.fields._).toBe('Вкажіть хоча б одне поле для оновлення.');
  });
});
