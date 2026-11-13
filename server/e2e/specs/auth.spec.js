'use strict';

const { test, expect } = require('@playwright/test');

const PASSWORD = 'Study2026!';

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerViaApi(request, overrides = {}) {
  const email = overrides.email || uniqueEmail('api');
  const response = await request.post('/api/auth/register', {
    data: {
      name: overrides.name || 'API Користувач',
      email,
      password: PASSWORD,
      acceptedTerms: true,
    },
  });
  expect(response.status()).toBe(201);
  return email;
}

test.describe('authentication', () => {
  test('protected planner and account settings pages keep a safe return path', async ({ page }) => {
    await page.goto('/tasks.html');

    await expect(page).toHaveURL(/\/login\.html\?next=%2Ftasks\.html$/);
    await expect(page.locator('[data-auth-form="login"]')).toBeVisible();

    await page.goto('/account.html');

    await expect(page).toHaveURL(/\/login\.html\?next=%2Faccount\.html$/);
    await expect(page.locator('[data-auth-form="login"]')).toBeVisible();
  });

  test('successful login returns to the requested account settings page', async ({ page, request }) => {
    const email = await registerViaApi(request, { name: 'Profile User' });

    await page.goto('/account.html');
    await expect(page).toHaveURL(/\/login\.html\?next=%2Faccount\.html$/);
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/account\.html$/);
    await expect(page.locator('h1')).toHaveText('Налаштування акаунта');
    await expect(page.locator('.user-menu strong')).toHaveText('Profile User');
  });

  test('register, account settings and logout', async ({ page }) => {
    const email = uniqueEmail('register');

    await page.goto('/register.html');
    await page.fill('#name', 'Тестовий Користувач');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.fill('#password-repeat', PASSWORD);
    await page.check('#acceptedTerms');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tasks\.html$/);
    const menu = page.locator('.user-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('strong')).toHaveText('Тестовий Користувач');
    await expect(menu.locator('p.muted')).toHaveText(email);
    await expect(menu.locator('.avatar')).toHaveText('ТК');

    await menu.locator('summary').click();
    await menu.getByRole('link', { name: 'Вийти' }).click();
    await expect(page).toHaveURL(/\/index\.html$/);

    await page.goto('/tasks.html');
    await expect(page).toHaveURL(/\/login\.html\?next=%2Ftasks\.html$/);
  });

  test('wrong password shows an error and keeps the user on login', async ({ page, request }) => {
    const email = await registerViaApi(request, { name: 'Wrong Password' });

    await page.goto('/login.html');
    await page.fill('#email', email);
    await page.fill('#password', 'not-the-password');
    await page.click('button[type="submit"]');

    const banner = page.locator('[data-auth-error]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Невірна пошта або пароль');
    await expect(page).toHaveURL(/\/login\.html$/);
  });

  test('successful login honours a same-origin next path', async ({ page, request }) => {
    const email = await registerViaApi(request, { name: 'Calendar User' });

    await page.goto('/login.html?next=%2Fcalendar.html');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/calendar\.html$/);
    await expect(page.locator('.user-menu')).toBeVisible();
    await expect(page.locator('.user-menu strong')).toHaveText('Calendar User');
  });

  test('external next values are rejected instead of redirecting off-site', async ({ page, request }) => {
    const email = await registerViaApi(request, { name: 'Safe Next User' });

    await page.goto('/login.html?next=%2F%2Fevil.example%2Fsteal');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/tasks\.html$/);
    expect(new URL(page.url()).origin).toBe(
      new URL(test.info().project.use.baseURL).origin
    );
  });

  test('duplicate registration marks the email field', async ({ page, request }) => {
    const email = await registerViaApi(request, { name: 'Duplicate User' });

    await page.goto('/register.html');
    await page.fill('#name', 'Duplicate User');
    await page.fill('#email', email);
    await page.fill('#password', PASSWORD);
    await page.fill('#password-repeat', PASSWORD);
    await page.check('#acceptedTerms');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/register\.html$/);
    await expect(page.locator('#email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#email').locator('xpath=ancestor::div[contains(@class,"field")]'))
      .toHaveClass(/field--error/);
  });
});
