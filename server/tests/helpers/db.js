'use strict';
const fs = require('fs');
const path = require('path');
const pool = require('../../src/db/pool');

/**
 * Run all pending migrations on the test database.
 * Called once in globalSetup-like fashion from the first test.
 */
async function runMigrations() {
  // We can't directly call migrate() because it calls pool.end().
  // Instead, inline the migration logic using the pool.
  const MIGRATIONS_DIR = path.join(__dirname, '../../src/db/migrations');

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL       PRIMARY KEY,
        name       VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    const { rows: applied } = await client.query('SELECT name FROM migrations ORDER BY id');
    const appliedNames = new Set(applied.map((r) => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (appliedNames.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Test migration ${file} failed: ${err.message}`);
      }
    }
  } finally {
    client.release();
  }
}

/**
 * Delete all data from tables in correct FK order.
 * Keeps migrations table intact.
 */
async function cleanDb() {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM disciplines');
  await pool.query('DELETE FROM sessions');
  await pool.query('DELETE FROM users');
}

module.exports = { runMigrations, cleanDb, pool };
