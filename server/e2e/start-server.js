'use strict';

const { resetDatabase, E2E_DATABASE_URL } = require('./setup-db');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3100';
process.env.DATABASE_URL = process.env.DATABASE_URL || E2E_DATABASE_URL;
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'e2e-secret-that-is-at-least-32-bytes-long!!';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';

// Fixed demo account for the visual baseline. The deadlines are seeded
// relative to 2026-10-06, the date used by the Lab 4 reference screenshots,
// and the browser clock is pinned to that day by the visual spec.
const DEMO = {
  email: 'demo.visual@studyplanner.test',
  password: 'Study2026!',
  name: 'Демо Користувач',
  baseDate: '2026-10-06',
};

resetDatabase()
  .then(() => require('../src/db/seed').seed(DEMO))
  .then(() => {
    require('../src/index');
  })
  .catch(err => {
    console.error('E2E server startup failed:', err);
    process.exit(1);
  });
