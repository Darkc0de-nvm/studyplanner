'use strict';
const rateLimit = require('express-rate-limit');
const config = require('../config');

// Rate limiters are off during automated tests to keep them deterministic.
// A dedicated test sets RATE_LIMIT_TEST=1 to verify the 429 behaviour itself.
function isTestRun() {
  return config.NODE_ENV === 'test' && process.env.RATE_LIMIT_TEST !== '1';
}

function makeLimiter(max, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message } },
    skip: isTestRun,
  });
}

// Strict limit for credential endpoints only.
const authLimiter = makeLimiter(10, 'Забагато спроб. Спробуйте пізніше.');
// General API budget, also used for /api/auth/me and /api/auth/logout.
const apiLimiter = makeLimiter(100, 'Забагато запитів. Спробуйте пізніше.');

module.exports = { authLimiter, apiLimiter };
