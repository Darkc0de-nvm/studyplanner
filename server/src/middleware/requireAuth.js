'use strict';
const pool = require('../db/pool');
const AppError = require('./AppError');

async function requireAuth(req, res, next) {
  const sessionId = req.cookies && req.cookies.sp_session;
  if (!sessionId) {
    return next(new AppError(401, 'AUTH_REQUIRED', 'Необхідна автентифікація.'));
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.user_id, s.expires_at,
              u.email, u.name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (rows.length === 0) {
      res.clearCookie('sp_session', { path: '/' });
      return next(new AppError(401, 'SESSION_EXPIRED', 'Сесія недійсна або прострочена.'));
    }

    req.session = { id: rows[0].id };
    req.user = {
      id: rows[0].user_id,
      email: rows[0].email,
      name: rows[0].name,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
