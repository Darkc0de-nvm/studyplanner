'use strict';
const { request } = require('./helpers/app');

// Regression tests for the Helmet configuration in src/app.js.
describe('Security response headers', () => {
  it('sets a restrictive Content-Security-Policy on HTML pages', async () => {
    const res = await request().get('/login.html');
    expect(res.status).toBe(200);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('sets anti-sniffing, referrer and framing headers', async () => {
    const res = await request().get('/login.html');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('sets HSTS for transport security', async () => {
    const res = await request().get('/login.html');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
  });

  it('sets the same security headers on API responses', async () => {
    const res = await request().get('/api/not-a-real-endpoint');
    expect(res.status).toBe(404);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
