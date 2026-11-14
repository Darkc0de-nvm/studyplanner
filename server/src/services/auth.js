'use strict';
const argon2 = require('argon2');
const pool = require('../db/pool');
const config = require('../config');
const AppError = require('../middleware/AppError');
const { isUniqueViolation } = require('../db/pgErrors');
const INVALID_CURRENT_PASSWORD = 'Невірний пароль.';

function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

function verifyPasswordHash(passwordHash, password) {
  return argon2.verify(passwordHash, password);
}

async function register(name, email, password, acceptedTerms) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.length > 0) {
    throw new AppError(409, 'REGISTRATION_FAILED', 'Не вдалося створити акаунт. Перевірте введені дані або увійдіть, якщо вже маєте акаунт.');
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, name, password_hash, terms_accepted_at) VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() ELSE NULL END) RETURNING id, email, name',
      [email.toLowerCase(), name, passwordHash, acceptedTerms]
    );
    user = rows[0];
  } catch (err) {
    // Concurrent registration can slip past the SELECT above.
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'REGISTRATION_FAILED', 'Не вдалося створити акаунт. Перевірте введені дані або увійдіть, якщо вже маєте акаунт.');
    }
    throw err;
  }

  return user;
}

async function login(email, password) {
  const { rows } = await pool.query(
    'SELECT id, email, name, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (rows.length === 0) {
    // Perform dummy hash to prevent user enumeration via timing
    await argon2.hash(password, { type: argon2.argon2id });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Невірна пошта або пароль.');
  }

  const user = rows[0];
  const valid = await verifyPasswordHash(user.password_hash, password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Невірна пошта або пароль.');
  }

  return { id: user.id, email: user.email, name: user.name };
}

async function createSession(userId) {
  const expiresAt = new Date(Date.now() + config.SESSION_MAX_AGE * 1000);
  const { rows: [session] } = await pool.query(
    'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id',
    [userId, expiresAt]
  );
  return { sessionId: session.id, expiresAt };
}

async function deleteSession(sessionId) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

async function verifyUserPassword(userId, password) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows.length) return false;
  return verifyPasswordHash(rows[0].password_hash, password);
}

async function changePassword(userId, currentPassword, newPassword, currentSessionId) {
  const valid = await verifyUserPassword(userId, currentPassword);
  if (!valid) throw new AppError(403, 'INVALID_CURRENT_PASSWORD', INVALID_CURRENT_PASSWORD);

  const passwordHash = await hashPassword(newPassword);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await client.query('DELETE FROM sessions WHERE user_id = $1 AND id <> $2', [userId, currentSessionId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { register, login, createSession, deleteSession, verifyUserPassword, changePassword };
