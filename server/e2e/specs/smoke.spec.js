'use strict';

const { test, expect } = require('@playwright/test');

const PASSWORD = 'Study2026!';

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function collectErrors(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  return errors;
}

test.describe('client smoke', () => {
  test('public pages render without console errors', async ({ page }) => {
    const errors = collectErrors(page);
    const pages = [
      ['/', 'h1'],
      ['/login.html', '[data-auth-form="login"]'],
      ['/register.html', '[data-auth-form="register"]'],
      ['/states.html', '.user-menu'],
      ['/privacy.html', 'h1'],
      ['/terms.html', 'h1'],
    ];

    for (const [path, selector] of pages) {
      await page.goto(path);
      await expect(page.locator(selector)).toBeVisible();
    }
    await page.goto('/states.html');
    await expect(page.locator('.user-menu__panel > a.select__option')).toHaveText([
      'Налаштування',
      'Вийти',
    ]);
    await expect(page.locator('#account-data-card, #delete-account-dialog, #change-password-dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('planner pages load API data without console errors', async ({ page, request }) => {
    const email = uniqueEmail('smoke');
    const registered = await request.post('/api/auth/register', {
      data: { name: 'Smoke User', email, password: PASSWORD, acceptedTerms: true },
    });
    expect(registered.status()).toBe(201);

    await page.goto('/login.html');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/tasks\.html$/);

    const errors = collectErrors(page);

    await page.goto('/tasks.html');
    await expect(page.locator('.task-groups > *').first()).toBeVisible();
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.user-menu a[href="account.html"]')).toContainText('Налаштування');
    await expect(page.locator('.user-menu__panel > a.select__option')).toHaveText([
      'Налаштування',
      'Вийти',
    ]);

    await page.goto('/calendar.html');
    await expect(page.locator('[data-date]').first()).toBeVisible();
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.user-menu a[href="account.html"]')).toContainText('Налаштування');
    await expect(page.locator('.user-menu__panel > a.select__option')).toHaveText([
      'Налаштування',
      'Вийти',
    ]);

    await page.goto('/account.html');
    await expect(page.locator('h1')).toHaveText('Налаштування акаунта');
    await expect(page.locator('.user-menu strong')).toHaveText('Smoke User');
    await expect(page.locator('.user-menu a[href="account.html"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.account-page__cards > section')).toHaveCount(2);
    await expect(page.locator('.user-menu__panel > a.select__option')).toHaveText([
      'Налаштування',
      'Вийти',
    ]);

    await page.locator('.site-footer a[href="privacy.html"]').click();
    await expect(page).toHaveURL(/\/privacy\.html$/);
    await expect(page.locator('#account-data-card, #delete-account-dialog, #change-password-dialog')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
