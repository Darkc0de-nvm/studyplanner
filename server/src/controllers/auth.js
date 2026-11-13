'use strict';
const authService = require('../services/auth');
const { registerSchema, loginSchema } = require('../schemas/auth');
const { setSessionCookie, clearSessionCookie } = require('../utils/sessionCookie');

async function register(req, res, next) {
  try {
    const { name, email, password, acceptedTerms } = registerSchema.parse(req.body);
    const user = await authService.register(name, email, password, acceptedTerms);
    const { sessionId, expiresAt } = await authService.createSession(user.id);
    setSessionCookie(res, sessionId, expiresAt);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
}

async function login(req, res, next) {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await authService.login(email, password);
    const { sessionId, expiresAt } = await authService.createSession(user.id);
    setSessionCookie(res, sessionId, expiresAt);
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    if (req.session) await authService.deleteSession(req.session.id);
    clearSessionCookie(res);
    res.status(204).end();
  } catch (err) { next(err); }
}

function me(req, res) {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
}

module.exports = { register, login, logout, me };
