'use strict';

/* global window, Event */

const { test, expect } = require('@playwright/test');
const { Client } = require('pg');
const { registerAndSignIn } = require('../helpers');
const { E2E_DATABASE_URL } = require('../setup-db');

test.describe('expired session', () => {
  test('redirects to login and clears the cookie on the next revalidation', async ({ page }) => {
    await registerAndSignIn(page);
    await expect(page.locator('.app-empty')).toBeVisible();

    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    const { user } = await me.json();

    // Expire every active session of this user directly in the e2e database.
    const db = new Client({ connectionString: E2E_DATABASE_URL });
    await db.connect();
    try {
      await db.query(
        "UPDATE sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1",
        [user.id]
      );
    } finally {
      await db.end();
    }

    // The server rejects the stale session and clears its cookie.
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);

    // Focus revalidation performs a protected request, so the client must
    // leave the planner and preserve the return path.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page).toHaveURL(/\/login\.html\?next=%2Ftasks\.html$/);
    await expect(page.locator('[data-auth-form="login"]')).toBeVisible();

    const cookies = await page.context().cookies();
    expect(cookies.find(cookie => cookie.name === 'sp_session')).toBeUndefined();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  });
});
