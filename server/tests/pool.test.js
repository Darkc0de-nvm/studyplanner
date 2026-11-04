'use strict';
const pool = require('../src/db/pool');
const config = require('../src/config');
const { buildPoolOptions } = require('../src/db/poolOptions');

const BASE_CONFIG = {
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/studyplanner',
  NODE_ENV: 'development',
  DATABASE_SSL: 'auto',
  DATABASE_SSL_REJECT_UNAUTHORIZED: 'true',
};

function options(overrides = {}) {
  return buildPoolOptions({ ...BASE_CONFIG, ...overrides });
}

describe('buildPoolOptions', () => {
  it('disables SSL for a local database outside production', () => {
    const opts = options();

    expect(opts.ssl).toBe(false);
    expect(opts.max).toBe(10);
    expect(opts.connectionString).toBe(BASE_CONFIG.DATABASE_URL);
    expect(opts.idleTimeoutMillis).toBe(30000);
    expect(opts.connectionTimeoutMillis).toBe(5000);
  });

  it('uses a smaller pool in test mode', () => {
    expect(options({ NODE_ENV: 'test' }).max).toBe(5);
  });

  it('enables verified SSL automatically in production', () => {
    expect(options({ NODE_ENV: 'production' }).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('enables SSL automatically for known cloud hosts', () => {
    expect(options({ DATABASE_URL: 'postgresql://u:p@db.neon.tech/app' }).ssl)
      .toEqual({ rejectUnauthorized: true });
    expect(options({ DATABASE_URL: 'postgresql://u:p@db.render.com/app' }).ssl)
      .toEqual({ rejectUnauthorized: true });
  });

  it('honours an explicit DATABASE_SSL=true on a local host', () => {
    expect(options({ DATABASE_SSL: 'true' }).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('honours DATABASE_SSL=false even in production', () => {
    expect(options({ NODE_ENV: 'production', DATABASE_SSL: 'false' }).ssl).toBe(false);
  });

  it('can explicitly allow self-signed certificates', () => {
    expect(options({ NODE_ENV: 'production', DATABASE_SSL_REJECT_UNAUTHORIZED: 'false' }).ssl)
      .toEqual({ rejectUnauthorized: false });
  });
});

describe('pool error listener', () => {
  let originalEnv;

  beforeEach(() => { originalEnv = config.NODE_ENV; });
  afterEach(() => { config.NODE_ENV = originalEnv; vi.restoreAllMocks(); });

  it('logs unexpected pool errors outside test mode', () => {
    config.NODE_ENV = 'development';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    pool.emit('error', new Error('simulated'));

    expect(log).toHaveBeenCalledWith('Unexpected DB pool error:', 'simulated');
  });

  it('stays silent in test mode', () => {
    config.NODE_ENV = 'test';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    pool.emit('error', new Error('silent'));

    expect(log).not.toHaveBeenCalled();
  });
});
