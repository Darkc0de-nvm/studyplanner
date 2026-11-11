'use strict';

const { resetDatabase, E2E_DATABASE_URL } = require('./setup-db');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3100';
process.env.DATABASE_URL = process.env.DATABASE_URL || E2E_DATABASE_URL;
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'e2e-secret-that-is-at-least-32-bytes-long!!';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';

resetDatabase()
  .then(() => {
    require('../src/index');
  })
  .catch(err => {
    console.error('E2E server startup failed:', err);
    process.exit(1);
  });
