'use strict';
const originCheck = require('../src/middleware/originCheck');

function fakeRequest({ method, contentType, origin, host } = {}) {
  return {
    method,
    get(name) {
      if (name === 'Content-Type') return contentType;
      if (name === 'Origin') return origin;
      if (name === 'Host') return host;
      return undefined;
    },
  };
}

describe('originCheck middleware', () => {
  it('lets safe methods through without inspecting headers', () => {
    const next = vi.fn();
    originCheck(fakeRequest({ method: 'GET' }), {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a mutating request without JSON Content-Type', () => {
    const next = vi.fn();
    originCheck(fakeRequest({ method: 'POST' }), {}, next);

    expect(next.mock.calls[0][0]).toMatchObject({ status: 400, code: 'BAD_CONTENT_TYPE' });
  });

  it('rejects a mutating request from another host', () => {
    const next = vi.fn();
    originCheck(
      fakeRequest({ method: 'POST', contentType: 'application/json', origin: 'http://evil.test', host: 'app.test' }),
      {},
      next
    );

    expect(next.mock.calls[0][0]).toMatchObject({ status: 403, code: 'CSRF_FORBIDDEN' });
  });

  it('accepts a same-origin mutating request', () => {
    const next = vi.fn();
    originCheck(
      fakeRequest({ method: 'POST', contentType: 'application/json', origin: 'http://app.test', host: 'app.test' }),
      {},
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects an unparsable Origin header', () => {
    const next = vi.fn();
    originCheck(
      fakeRequest({ method: 'POST', contentType: 'application/json', origin: 'not a url' }),
      {},
      next
    );

    expect(next.mock.calls[0][0]).toMatchObject({ status: 400, code: 'BAD_ORIGIN' });
  });
});
