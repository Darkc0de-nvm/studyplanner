'use strict';
const pool = require('../db/pool');
const AppError = require('../middleware/AppError');
const { isUniqueViolation, isForeignKeyViolation } = require('../db/pgErrors');

function format(row) {
  return { id: row.id, userId: row.user_id, name: row.name, colorIndex: row.color_index };
}

async function list(userId) {
  const { rows } = await pool.query(
    'SELECT id, user_id, name, color_index FROM disciplines WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );
  return rows.map(format);
}

async function create(userId, name, colorIndex) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM disciplines WHERE user_id = $1 AND lower(name) = lower($2)',
    [userId, name]
  );
  if (existing.length > 0) {
    throw new AppError(409, 'DISCIPLINE_CONFLICT', 'Дисципліна з такою назвою вже існує.');
  }

  if (colorIndex === undefined) {
    const { rows: usage } = await pool.query(
      'SELECT color_index, COUNT(*)::int AS count FROM disciplines WHERE user_id = $1 AND color_index BETWEEN 1 AND 3 GROUP BY color_index',
      [userId]
    );
    const counts = new Map(usage.map(row => [Number(row.color_index), Number(row.count)]));
    colorIndex = [1, 2, 3].reduce(
      (leastUsed, color) => (counts.get(color) || 0) < (counts.get(leastUsed) || 0) ? color : leastUsed,
      1
    );
  }

  let disc;
  try {
    const { rows } = await pool.query(
      'INSERT INTO disciplines (user_id, name, color_index) VALUES ($1, $2, $3) RETURNING id, user_id, name, color_index',
      [userId, name, colorIndex]
    );
    disc = rows[0];
  } catch (err) {
    // Concurrent create can slip past the SELECT above.
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'DISCIPLINE_CONFLICT', 'Дисципліна з такою назвою вже існує.');
    }
    throw err;
  }
  return format(disc);
}

async function remove(userId, id) {
  const { rows: withTasks } = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM tasks WHERE discipline_id = $1 AND user_id = $2',
    [id, userId]
  );
  if (withTasks[0].cnt > 0) {
    throw new AppError(409, 'DISCIPLINE_HAS_TASKS', 'Неможливо видалити дисципліну — є прив\'язані завдання.');
  }

  let rowCount;
  try {
    ({ rowCount } = await pool.query(
      'DELETE FROM disciplines WHERE id = $1 AND user_id = $2',
      [id, userId]
    ));
  } catch (err) {
    // A task created between the COUNT above and this DELETE is rejected by the
    // ON DELETE RESTRICT constraint; report it as a conflict, not a 500.
    if (isForeignKeyViolation(err)) {
      throw new AppError(409, 'DISCIPLINE_HAS_TASKS', 'Неможливо видалити дисципліну — є прив\'язані завдання.');
    }
    throw err;
  }
  if (rowCount === 0) throw new AppError(404, 'NOT_FOUND', 'Дисципліну не знайдено.');
}

module.exports = { list, create, remove };
