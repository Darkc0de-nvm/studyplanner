'use strict';
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');
const { isForeignKeyViolation } = require('../db/pgErrors');

const BASE_SELECT = `
  SELECT
    t.id, t.user_id, t.discipline_id,
    d.name AS discipline_name, d.color_index AS discipline_color_index,
    t.title, t.description,
    t.deadline::text AS deadline,
    t.done, t.completed_at,
    t.created_at, t.updated_at
  FROM tasks t
  JOIN disciplines d ON d.id = t.discipline_id
  WHERE t.user_id = $1
`;

function formatTask(row) {
  return {
    id: row.id,
    userId: row.user_id,
    disciplineId: row.discipline_id,
    discipline: {
      id: row.discipline_id,
      name: row.discipline_name,
      colorIndex: row.discipline_color_index,
    },
    title: row.title,
    description: row.description ?? null,
    deadline: row.deadline,
    done: row.done,
    completedAt: row.completed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list(userId, filters = {}) {
  const params = [userId];
  let sql = BASE_SELECT;
  let idx = 2;

  if (filters.discipline) {
    sql += ` AND t.discipline_id = $${idx++}`;
    params.push(filters.discipline);
  }
  if (filters.done !== undefined) {
    sql += ` AND t.done = $${idx++}`;
    params.push(filters.done === 'true');
  }
  if (filters.from) {
    sql += ` AND t.deadline >= $${idx++}`;
    params.push(filters.from);
  }
  if (filters.to) {
    sql += ` AND t.deadline <= $${idx++}`;
    params.push(filters.to);
  }
  if (filters.q) {
    sql += ` AND (t.title ILIKE $${idx} OR t.description ILIKE $${idx})`;
    params.push(`%${filters.q}%`);
    idx++;
  }

  sql += ' ORDER BY t.deadline ASC, t.created_at ASC';
  const { rows } = await pool.query(sql, params);
  return rows.map(formatTask);
}

async function getById(userId, id) {
  const { rows } = await pool.query(
    `${BASE_SELECT} AND t.id = $2`,
    [userId, id]
  );
  if (rows.length === 0) throw new AppError(404, 'NOT_FOUND', 'Завдання не знайдено.');
  return formatTask(rows[0]);
}

async function create(userId, data) {
  const { rows: disc } = await pool.query(
    'SELECT id FROM disciplines WHERE id = $1 AND user_id = $2',
    [data.disciplineId, userId]
  );
  if (disc.length === 0) throw new AppError(404, 'NOT_FOUND', 'Дисципліну не знайдено.');

  let task;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (user_id, discipline_id, title, description, deadline)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [userId, data.disciplineId, data.title, data.description || null, data.deadline]
    );
    task = rows[0];
  } catch (err) {
    // The discipline can disappear between the ownership check and the insert.
    if (isForeignKeyViolation(err)) {
      throw new AppError(404, 'NOT_FOUND', 'Дисципліну не знайдено.');
    }
    throw err;
  }
  return getById(userId, task.id);
}

async function update(userId, id, data) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (existing.length === 0) throw new AppError(404, 'NOT_FOUND', 'Завдання не знайдено.');

  const sets = [];
  const params = [];
  let idx = 1;

  if (data.title !== undefined)       { sets.push(`title = $${idx++}`);       params.push(data.title); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.disciplineId !== undefined) {
    const { rows: disc } = await pool.query(
      'SELECT id FROM disciplines WHERE id = $1 AND user_id = $2',
      [data.disciplineId, userId]
    );
    if (disc.length === 0) throw new AppError(404, 'NOT_FOUND', 'Дисципліну не знайдено.');
    sets.push(`discipline_id = $${idx++}`);
    params.push(data.disciplineId);
  }
  if (data.deadline !== undefined)    { sets.push(`deadline = $${idx++}`);    params.push(data.deadline); }
  if (data.done !== undefined) {
    sets.push(`done = $${idx++}`);           params.push(data.done);
    sets.push(`completed_at = $${idx++}`);   params.push(data.done ? new Date() : null);
  }
  sets.push('updated_at = NOW()');
  params.push(id, userId);

  try {
    await pool.query(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = $${idx++} AND user_id = $${idx++}`,
      params
    );
  } catch (err) {
    // A discipline moved/deleted concurrently.
    if (isForeignKeyViolation(err)) {
      throw new AppError(404, 'NOT_FOUND', 'Дисципліну не знайдено.');
    }
    throw err;
  }
  return getById(userId, id);
}

async function remove(userId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  if (rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Завдання не знайдено.');
}

module.exports = { list, getById, create, update, remove };
