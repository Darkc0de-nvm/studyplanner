'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..');

// Ambient app variables (CI job env, a developer shell or .env) must not leak
// into these child processes, otherwise "documented defaults" are not defaults.
const APP_ENV_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'E2E_DATABASE_URL',
  'SESSION_SECRET',
  'SESSION_MAX_AGE',
  'TRUST_PROXY',
  'COOKIE_DOMAIN',
  'COOKIE_SECURE',
  'DATABASE_SSL',
  'DATABASE_SSL_REJECT_UNAUTHORIZED',
];

const VALID_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/studyplanner_test',
  SESSION_SECRET: 'test-secret-that-is-at-least-32-bytes-long-for-tests!!',
};

/** Runs a snippet in a fresh Node process with a controlled environment. */
function runNode(env, code) {
  const childEnv = { ...process.env };
  for (const key of APP_ENV_KEYS) delete childEnv[key];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }
  return spawnSync(process.execPath, ['-e', code], {
    cwd: SERVER_DIR,
    env: childEnv,
    encoding: 'utf8',
    timeout: 15000,
  });
}

describe('configuration fail-fast', () => {
  it('exits with code 1 when DATABASE_URL is missing', () => {
    const res = runNode({ ...VALID_ENV, DATABASE_URL: undefined }, "require('./src/config')");

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Configuration error');
    expect(res.stderr).toContain('DATABASE_URL');
  });

  it('exits with code 1 when SESSION_SECRET is too short', () => {
    const res = runNode({ ...VALID_ENV, SESSION_SECRET: 'too-short' }, "require('./src/config')");

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('SESSION_SECRET');
  });

  it('loads a valid configuration with documented defaults', () => {
    const res = runNode(
      VALID_ENV,
      "const c = require('./src/config'); console.log([c.COOKIE_SECURE, c.DATABASE_SSL, c.DATABASE_SSL_REJECT_UNAUTHORIZED].join('|'));"
    );

    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe('auto|auto|true');
  });
});

describe('database pool error handling', () => {
  it('does not crash when the pool emits an error', () => {
    const res = runNode(
      { ...VALID_ENV, NODE_ENV: 'development' },
      "const pool = require('./src/db/pool'); pool.emit('error', new Error('simulated')); pool.end().then(() => console.log('survived'));"
    );

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('survived');
    expect(res.stderr).toContain('Unexpected DB pool error: simulated');
  });
});

describe('app configuration', () => {
  it('applies TRUST_PROXY when building the Express app', () => {
    const res = runNode(
      { ...VALID_ENV, TRUST_PROXY: '1' },
      "const app = require('./src/app'); const pool = require('./src/db/pool'); pool.end().then(() => console.log(app.get('trust proxy')));"
    );

    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe('1');
  });
});
