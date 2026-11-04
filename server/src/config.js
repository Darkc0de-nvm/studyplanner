'use strict';
const { z } = require('zod');

// In test mode, DATABASE_URL may already be overridden by vitest env config.
// This module is loaded once; env vars set by vitest.config.mjs env property
// are available here as process.env.

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(0).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_MAX_AGE: z.coerce.number().int().positive().default(2592000),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  COOKIE_DOMAIN: z.string().optional(),
  // auto: Secure only in production; true/false force the flag (useful locally).
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),
  // auto: SSL for production or known cloud hosts; true/false force it.
  DATABASE_SSL: z.enum(['auto', 'true', 'false']).default('auto'),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true'),
});

let config;
try {
  config = schema.parse(process.env);
} catch (err) {
  console.error('❌ Configuration error — missing or invalid environment variables:');
  if (err.errors) {
    for (const e of err.errors) {
      console.error(`   ${e.path.join('.')}: ${e.message}`);
    }
  }
  process.exit(1);
}

module.exports = config;
