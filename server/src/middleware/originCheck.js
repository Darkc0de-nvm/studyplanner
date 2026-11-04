'use strict';
const AppError = require('./AppError');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense for state-changing requests:
 * 1. Require Content-Type: application/json (HTML forms cannot send JSON)
 * 2. If Origin header present, it must match Host (blocks cross-origin fetch)
 */
function originCheck(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const ct = req.get('Content-Type') || '';
  if (!ct.includes('application/json')) {
    return next(new AppError(400, 'BAD_CONTENT_TYPE', 'Content-Type повинен бути application/json.'));
  }

  const origin = req.get('Origin');
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const host = req.get('Host');
      if (originHost !== host) {
        return next(new AppError(403, 'CSRF_FORBIDDEN', 'Міждоменний запит відхилено.'));
      }
    } catch {
      return next(new AppError(400, 'BAD_ORIGIN', 'Невалідний заголовок Origin.'));
    }
  }

  next();
}

module.exports = originCheck;
