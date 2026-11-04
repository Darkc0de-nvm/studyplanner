'use strict';
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function getApplied(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         SERIAL       PRIMARY KEY,
      name       VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await client.query('SELECT name FROM migrations ORDER BY id');
  return new Set(rows.map((r) => r.name));
}

async function migrate(statusOnly = false) {
  const client = await pool.connect();
  try {
    const applied = await getApplied(client);
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (statusOnly) {
      console.log('\nMigration status:');
      for (const file of files) {
        console.log(`  [${applied.has(file) ? 'applied' : 'pending'}] ${file}`);
      }
      return;
    }

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  [skip]  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  [done]  ${file}`);
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration "${file}" failed: ${err.message}`);
      }
    }
    console.log(`\nMigrations complete (${count} applied, ${files.length - count} skipped).`);
  } finally {
    client.release();
    await pool.end();
  }
}

const statusOnly = process.argv.includes('--status');
migrate(statusOnly).catch((err) => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
