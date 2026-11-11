'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:5433/studyplanner_e2e';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');

function adminUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  return parsed.toString();
}

function databaseName(url) {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw new Error(`Unsafe e2e database name: ${name}`);
  }
  return name;
}

/**
 * Recreates the dedicated e2e database and applies every migration.
 * Runs before the web server starts so a failed run cannot inherit state
 * from a previous one and the development/test databases stay untouched.
 */
async function resetDatabase() {
  const name = databaseName(E2E_DATABASE_URL);
  const admin = new Client({ connectionString: adminUrl(E2E_DATABASE_URL) });
  await admin.connect();
  try {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [name]
    );
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const db = new Client({ connectionString: E2E_DATABASE_URL });
  await db.connect();
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL       PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw new Error(`E2E migration "${file}" failed: ${err.message}`);
      }
    }
  } finally {
    await db.end();
  }
}

module.exports = { resetDatabase, E2E_DATABASE_URL };
