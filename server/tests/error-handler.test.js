'use strict';
const errorHandler = require('../src/middleware/errorHandler');
const AppError = require('../src/middleware/AppError');
const config = require('../src/config');

function fakeResponse() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('errorHandler diagnostics', () => {
  let originalEnv;

  beforeEach(() => { originalEnv = config.NODE_ENV; });
  afterEach(() => { config.NODE_ENV = originalEnv; vi.restoreAllMocks(); });

  it('logs unknown errors outside test mode but hides the stack from the client', () => {
    config.NODE_ENV = 'development';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeResponse();

    errorHandler(new Error('boom'), {}, res, vi.fn());

    expect(log).toHaveBeenCalledWith('[ERROR]', 'boom', expect.any(String));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'boom' },
    });
  });

  it('does not log unknown errors in test mode', () => {
    config.NODE_ENV = 'test';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeResponse();

    errorHandler(new Error('silent'), {}, res, vi.fn());

    expect(log).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'silent' },
    });
  });

  it('does not leak internal error details in production', () => {
    config.NODE_ENV = 'production';
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeResponse();

    errorHandler(new Error('relation "users" does not exist'), {}, res, vi.fn());

    expect(log).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера.' },
    });
  });

  it('serializes AppError field-level messages', () => {
    config.NODE_ENV = 'test';
    const res = fakeResponse();

    errorHandler(
      new AppError(422, 'VALIDATION_ERROR', 'Помилка валідації.', { title: 'Занадто коротко.' }),
      {},
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Помилка валідації.',
        fields: { title: 'Занадто коротко.' },
      },
    });
  });

  it('falls back to a generic message when an unknown error has no text', () => {
    config.NODE_ENV = 'development';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = fakeResponse();

    errorHandler(new Error(''), {}, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'INTERNAL_ERROR', message: 'Внутрішня помилка сервера.' },
    });
  });

  it('translates a PostgreSQL constraint error to 409', () => {
    config.NODE_ENV = 'test';
    const res = fakeResponse();
    const err = Object.assign(new Error('constraint'), { code: '23503' });

    errorHandler(err, {}, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'Операція порушує цілісність даних.' },
    });
  });
});
