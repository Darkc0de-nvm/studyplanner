'use strict';
const accountService = require('../services/account');
const authService = require('../services/auth');
const { clearSessionCookie } = require('../utils/sessionCookie');
const AppError = require('../middleware/AppError');
const { verifyPasswordSchema, changePasswordSchema } = require('../schemas/account');

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.id, currentPassword, newPassword, req.session.id);
    res.status(204).end();
  } catch (err) { next(err); }
}

async function deleteAccount(req, res, next) {
  try {
    const { password } = verifyPasswordSchema.parse(req.body);
    if (!await authService.verifyUserPassword(req.user.id, password)) {
      throw new AppError(403, 'INVALID_CURRENT_PASSWORD', 'Невірний пароль.');
    }
    await accountService.deleteAccount(req.user.id);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) { next(err); }
}

module.exports = { deleteAccount, changePassword };
