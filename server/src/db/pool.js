'use strict';
const { Pool } = require('pg');
const config = require('../config');

// Enable SSL for production or when connecting to cloud Postgres (Neon, etc.)
const needsSsl = config.NODE_ENV === 'production'
  || (config.DATABASE_URL.includes('.neon.tech'))
  || (config.DATABASE_URL.includes('.render.com'));

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: config.NODE_ENV === 'test' ? 5 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  if (config.NODE_ENV !== 'test') {
    console.error('Unexpected DB pool error:', err.message);
  }
});

module.exports = pool;
