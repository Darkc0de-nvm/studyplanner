'use strict';

/**
 * Builds `pg` Pool options from the validated application configuration.
 * Kept pure so SSL and pool-size decisions can be verified without opening
 * a real connection.
 */
function buildPoolOptions(cfg) {
  const isCloudHost = /\.neon\.tech|\.render\.com/.test(cfg.DATABASE_URL);
  const needsSsl = cfg.DATABASE_SSL === 'true'
    || (cfg.DATABASE_SSL === 'auto' && (cfg.NODE_ENV === 'production' || isCloudHost));

  return {
    connectionString: cfg.DATABASE_URL,
    ssl: needsSsl ? { rejectUnauthorized: cfg.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    max: cfg.NODE_ENV === 'test' ? 5 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

module.exports = { buildPoolOptions };
