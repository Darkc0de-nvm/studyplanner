'use strict';

/* global document, window */

const { test, expect } = require('@playwright/test');
const { BASE_TIME, signInAsDemo } = require('../page-fixtures');
const {
  PASSWORD,
  uniqueEmail: makeEmail,
  registerAndSignIn,
  createDiscipline,
  createTask,
  isoDate,
} = require('../helpers');

async function tabTo(page, selector, maxTabs = 60) {
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(
      (target) => Boolean(document.activeElement && document.activeElement.matches(target)),
      selector
    );
    if (focused) return;
  }
  throw new Error(`Keyboard focus did not reach ${selector} within ${maxTabs} Tab presses.`);
}

test.describe('keyboard-only checks', () => {
  test('skip link is the first stop and targets the main content', async ({ page }) => {
    await page.goto('/login.html');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await expect(page.locator('.skip-link')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('login can be completed with the keyboard only', async ({ page }) => {
    const email = makeEmail('keyboard');
    const register = await page.request.post('/api/auth/register', {
      data: { name: 'Keyboard User', email, password: PASSWORD, acceptedTerms: true },
    });
    expect(register.status()).toBe(201);
    await page.context().clearCookies();

    await page.goto('/login.html');
    await tabTo(page, '#email');
    await page.keyboard.type(email);
    await tabTo(page, '#password');
    await page.keyboard.type(PASSWORD);
    await tabTo(page, 'button[type="submit"]');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/tasks\.html$/);
  });

  test('dialog opens from the keyboard and Escape restores focus', async ({ page }) => {
    await page.clock.setFixedTime(BASE_TIME);
    await signInAsDemo(page);
    await page.goto('/tasks.html');
    await expect(page.locator('.task-card').first()).toBeVisible();

    await tabTo(page, '.app-add');
    await page.keyboard.press('Enter');
    await expect(page.locator('.modal--open #add-task')).toBeVisible();
    await expect(page.locator('#add-task-name')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('.modal--open #add-task')).toHaveCount(0);
    await expect(page.locator('.app-add')).toBeFocused();
  });

  test('user menu opens with the keyboard', async ({ page }) => {
    await page.clock.setFixedTime(BASE_TIME);
    await signInAsDemo(page);
    await page.goto('/tasks.html');
    await expect(page.locator('.task-card').first()).toBeVisible();

    await tabTo(page, '.user-menu__trigger');
    await page.keyboard.press('Enter');
    await expect(page.locator('.user-menu')).toHaveAttribute('open', '');
  });

  test('calendar day opens with the keyboard', async ({ page }) => {
    await page.clock.setFixedTime(BASE_TIME);
    await signInAsDemo(page);
    await page.goto('/calendar.html');
    await expect(page.locator('.month-heading h1')).toBeVisible();

    await tabTo(page, '[data-date="2026-10-06"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#day.modal--open')).toBeVisible();
  });

  test('task edit can be completed with the keyboard only', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, `Клавіатура ${Date.now()}`);
    const title = 'Клавіатурне редагування';
    await createTask(page, { title, disciplineId: discipline.id, deadline: isoDate(2) });

    await page.goto('/tasks.html');
    await expect(page.locator('.task-card', { hasText: title })).toBeVisible();

    await tabTo(page, '.task-card [data-action="edit"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#edit-task.modal--open')).toBeVisible();
    await expect(page.locator('#edit-task-name')).toBeFocused();
    await expect(page.locator('#edit-task-name')).toHaveValue(title);

    const updated = `${title} (оновлено)`;
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    await page.keyboard.type(updated);
    await page.keyboard.press('Enter');

    await expect(page.locator('.task-card', { hasText: updated })).toBeVisible();
    await expect(page.locator('#edit-task.modal--open')).toHaveCount(0);
  });

  test('task delete can be confirmed with the keyboard only', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, `Клавіатура ${Date.now()}`);
    const title = 'Клавіатурне видалення';
    await createTask(page, { title, disciplineId: discipline.id, deadline: isoDate(2) });

    await page.goto('/tasks.html');
    const card = page.locator('.task-card', { hasText: title });
    await expect(card).toBeVisible();

    await tabTo(page, '.task-card [data-action="delete"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#delete-task.modal--open')).toBeVisible();
    await expect(page.locator('#task-delete')).toBeFocused();

    // Inside the alertdialog the backdrop, Cancel and Delete are the tab stops.
    await tabTo(page, '[data-confirm-delete]', 5);
    await expect(page.locator('[data-confirm-delete]')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(card).toHaveCount(0);
    await expect(page.locator('#delete-task.modal--open')).toHaveCount(0);
  });

  test('200% zoom proxy has no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.clock.setFixedTime(BASE_TIME);
    await signInAsDemo(page);
    await page.goto('/tasks.html');
    await expect(page.locator('.task-card').first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
