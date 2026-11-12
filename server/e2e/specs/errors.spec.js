'use strict';

/* global navigator */

const { test, expect } = require('@playwright/test');
const {
  isoDate,
  displayDate,
  registerAndSignIn,
  createDiscipline,
  chooseDiscipline,
} = require('../helpers');

test.describe('offline cold start', () => {
  test('shows only the API banner and no fake data when the network is down', async ({ page }) => {
    const cspViolations = [];
    page.on('console', message => {
      if (/Content Security Policy/i.test(message.text())) cspViolations.push(message.text());
    });
    // Mark the browser offline before app.js runs so the network banner is
    // created, while aborting only API requests (the document still loads).
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    });
    await page.route('**/api/**', route => route.abort('failed'));

    await page.goto('/tasks.html');

    // A network failure is not an authentication failure: the shell stays put.
    await expect(page).toHaveURL(/\/tasks\.html$/);
    const banner = page.locator('[data-api-error]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Відсутнє підключення до мережі');

    // The banner markup must not require inline styles under `style-src 'self'`.
    const networkBanner = page.locator('#network-offline-banner');
    await expect(networkBanner).toHaveClass(/network-banner/);
    await expect(networkBanner).not.toHaveAttribute('style');
    expect(cspViolations).toEqual([]);

    // No localStorage fallback and no fake seed data are rendered.
    await expect(page.locator('.task-card')).toHaveCount(0);
  });
});

test.describe('API error banner', () => {
  test('reports a 429 on create and clears the banner after a successful retry', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, 'Веб-технології');
    await page.reload();

    await page.route('**/api/tasks', route => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'RATE_LIMIT', message: 'Забагато запитів. Спробуйте пізніше.' },
        }),
      });
    });

    await page.locator('.app-empty a[href="#add-task"]').click();
    await chooseDiscipline(page, '#add-task', discipline.name);
    await page.fill('#add-task-name', 'Завдання під лімітом');
    await page.fill('#add-task-deadline', displayDate(isoDate()));
    await page.locator('#add-task button[type="submit"]').click();

    const banner = page.locator('[data-api-error]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Забагато запитів. Спробуйте пізніше.');
    await expect(page.locator('.task-card')).toHaveCount(0);
    await expect(page.locator('#add-task-title')).toBeVisible();

    await page.unroute('**/api/tasks');
    await page.locator('#add-task button[type="submit"]').click();

    await expect(
      page.locator('.task-card', { hasText: 'Завдання під лімітом' })
    ).toBeVisible();
    await expect(banner).toBeHidden();
  });
});

test.describe('account deletion', () => {
  test('deletes the account from the privacy page and ends the session', async ({ page }) => {
    await registerAndSignIn(page);

    await page.goto('/privacy.html');
    await page.locator('#btn-open-delete-modal').click();
    await expect(page.locator('#delete-account-dialog')).toBeVisible();
    await page.locator('#del-confirm').click();

    await expect(page).toHaveURL(/\/index\.html\?deleted=1$/);
    await expect(page.locator('#deleted-alert')).toBeVisible();

    // The session cookie is cleared and the account is gone.
    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(401);

    await page.goto('/tasks.html');
    await expect(page).toHaveURL(/\/login\.html\?next=/);
  });
});
