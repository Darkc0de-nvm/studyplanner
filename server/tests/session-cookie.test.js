'use strict';
const config = require('../src/config');
const {
  COOKIE_NAME,
  serialize,
  parse,
  setSessionCookie,
  clearSessionCookie,
  readSessionId,
} = require('../src/utils/sessionCookie');

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
const VALID_SIGNATURE_LENGTH = 43; // SHA-256 in base64url

describe('sessionCookie signing', () => {
  it('round-trips a signed value', () => {
    expect(parse(serialize(SESSION_ID))).toBe(SESSION_ID);
  });

  it.each([
    ['non-string input', null],
    ['missing separator', 'abcdef'],
    ['empty signature', `${SESSION_ID}.`],
    ['malformed uuid', `not-a-uuid.${'A'.repeat(VALID_SIGNATURE_LENGTH)}`],
    ['wrong signature length', `${SESSION_ID}.short`],
    ['wrong signature value', `${SESSION_ID}.${'A'.repeat(VALID_SIGNATURE_LENGTH)}`],
  ])('rejects %s', (_label, value) => {
    expect(parse(value)).toBeNull();
  });

  it('reads the session id from a cookie map', () => {
    expect(readSessionId({ [COOKIE_NAME]: serialize(SESSION_ID) })).toBe(SESSION_ID);
    expect(readSessionId(undefined)).toBeNull();
    expect(readSessionId({})).toBeNull();
  });

  it('applies the Secure flag according to COOKIE_SECURE', () => {
    const original = { secure: config.COOKIE_SECURE, env: config.NODE_ENV };
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const expires = new Date('2030-01-01T00:00:00.000Z');

    try {
      config.COOKIE_SECURE = 'true';
      setSessionCookie(res, SESSION_ID, expires);
      expect(res.cookie).toHaveBeenLastCalledWith(
        COOKIE_NAME,
        serialize(SESSION_ID),
        expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires })
      );

      config.COOKIE_SECURE = 'false';
      setSessionCookie(res, SESSION_ID, expires);
      expect(res.cookie.mock.calls.at(-1)[2].secure).toBe(false);

      config.COOKIE_SECURE = 'auto';
      config.NODE_ENV = 'production';
      setSessionCookie(res, SESSION_ID, expires);
      expect(res.cookie.mock.calls.at(-1)[2].secure).toBe(true);

      config.NODE_ENV = 'test';
      setSessionCookie(res, SESSION_ID, expires);
      expect(res.cookie.mock.calls.at(-1)[2].secure).toBe(false);

      clearSessionCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, secure: false, sameSite: 'lax', path: '/' })
      );
    } finally {
      config.COOKIE_SECURE = original.secure;
      config.NODE_ENV = original.env;
    }
  });
});
