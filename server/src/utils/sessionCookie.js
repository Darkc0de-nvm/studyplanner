'use strict';
const crypto = require('crypto');
const config = require('../config');
const { isUuid } = require('./uuid');

const COOKIE_NAME = 'sp_session';

function sign(id) {
  return crypto.createHmac('sha256', config.SESSION_SECRET).update(id).digest('base64url');
}

/** Cookie value format: "<uuid>.<hmac-sha256>" */
function serialize(id) {
  return `${id}.${sign(id)}`;
}

/** Returns the session id when the value and its signature are valid, otherwise null. */
function parse(value) {
  if (typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;

  const id = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  if (!isUuid(id) || !signature) return null;

  const expected = sign(id);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return null;

  return crypto.timingSafeEqual(actualBuf, expectedBuf) ? id : null;
}

function isSecure() {
  return config.COOKIE_SECURE === 'true'
    || (config.COOKIE_SECURE === 'auto' && config.NODE_ENV === 'production');
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'lax',
    path: '/',
    domain: config.COOKIE_DOMAIN || undefined,
  };
}

function setSessionCookie(res, sessionId, expiresAt) {
  res.cookie(COOKIE_NAME, serialize(sessionId), { ...cookieOptions(), expires: expiresAt });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function readSessionId(cookies) {
  return parse(cookies && cookies[COOKIE_NAME]);
}

module.exports = { COOKIE_NAME, serialize, parse, setSessionCookie, clearSessionCookie, readSessionId };
