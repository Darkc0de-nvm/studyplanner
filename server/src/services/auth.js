'use strict';
const argon2 = require('argon2');
const pool = require('../db/pool');
const config = require('../config');
const AppError = require('../middleware/AppError');

async function register(name, email, password) {
  const { rows: existing } = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.length > 0) {
    throw new AppError(409, 'EMAIL_CONFLICT', 'Користувач із такою електронною поштою вже зареєстрований.');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  });

  const { rows: [user] } = await pool.query(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email.toLowerCase(), name, passwordHash]
  );

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
  const valid = await argon2.verify(user.password_hash, password);
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

module.exports = { register, login, createSession, deleteSession };
