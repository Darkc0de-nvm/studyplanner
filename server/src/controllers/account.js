'use strict';
const accountService = require('../services/account');
const authService = require('../services/auth');
const { clearSessionCookie } = require('../utils/sessionCookie');

async function deleteAccount(req, res, next) {
  try {
    // Delete session first (logout), then cascade-delete user
    if (req.session) await authService.deleteSession(req.session.id);
    await accountService.deleteAccount(req.user.id);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { deleteAccount };
