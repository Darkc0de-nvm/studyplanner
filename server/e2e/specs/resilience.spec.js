'use strict';

const { test, expect } = require('@playwright/test');
const {
  isoDate,
  displayDate,
  registerAndSignIn,
  createDiscipline,
  createTask,
  chooseDiscipline,
  failRequest,
} = require('../helpers');

test.describe('slow network', () => {
  test('shows a pending card and disables form controls while create is in flight', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, 'Мережі');
    await page.reload();

    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/tasks', async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await gate;
      await route.continue();
    });

    await page.locator('.app-empty a[href="#add-task"]').click();
    await chooseDiscipline(page, '#add-task', discipline.name);
    await page.fill('#add-task-name', 'Повільне завдання');
    await page.fill('#add-task-deadline', displayDate(isoDate()));
    await page.locator('#add-task button[type="submit"]').click();

    const card = page.locator('.task-card', { hasText: 'Повільне завдання' });
    await expect(card).toHaveAttribute('aria-busy', 'true');
    await expect(card).toHaveClass(/task-card--pending/);
    await expect(card.locator('[data-action="toggle"]')).toBeDisabled();
    const submit = page.locator('#add-task button[type="submit"]');
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText('Збереження...');

    release();
    await expect(card).toHaveAttribute('aria-busy', 'false');
    await expect(card.locator('[data-action="toggle"]')).toBeEnabled();
    await expect(page.locator('#add-task-title')).toBeHidden();

    await page.reload();
    await expect(page.locator('.task-card', { hasText: 'Повільне завдання' })).toBeVisible();
  });
});

test.describe('rollback', () => {
  test('removes the optimistic card when create fails', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, 'Бази даних');
    await page.reload();

    await page.route('**/api/tasks', route => (
      route.request().method() === 'POST' ? failRequest(route) : route.continue()
    ));

    await page.locator('.app-empty a[href="#add-task"]').click();
    await chooseDiscipline(page, '#add-task', discipline.name);
    await page.fill('#add-task-name', 'Завдання, яке не збережеться');
    await page.fill('#add-task-deadline', displayDate(isoDate()));
    await page.locator('#add-task button[type="submit"]').click();

    const card = page.locator('.task-card', { hasText: 'Завдання, яке не збережеться' });
    await expect(card).toHaveCount(0);
    await expect(page.locator('#add-task [data-form-status]')).toContainText('Тестова помилка сервера.');
    await expect(page.locator('#add-task-title')).toBeVisible();

    const submit = page.locator('#add-task button[type="submit"]');
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveText('Зберегти');
  });

  test('reverts a failed update, toggle and delete', async ({ page }) => {
    await registerAndSignIn(page);
    const discipline = await createDiscipline(page, 'Фізика');
    const original = await createTask(page, {
      title: 'Оригінальна назва',
      disciplineId: discipline.id,
      deadline: isoDate(),
    });

    await page.goto('/tasks.html');
    const card = page.locator(`.task-card[data-task-id="${original.id}"]`);
    await expect(card).toBeVisible();

    await page.route('**/api/tasks/*', route => {
      const method = route.request().method();
      if (method === 'PATCH' || method === 'DELETE') return failRequest(route);
      return route.continue();
    });

    // Update: the optimistic title must return to the server value.
    await card.locator('[data-action="edit"]').click();
    await page.fill('#edit-task-name', 'Нова назва');
    await page.locator('#edit-task button[type="submit"]').click();
    await expect(page.locator('#edit-task [data-form-status]')).toContainText('Тестова помилка сервера.');
    await expect(page.locator(`.task-card[data-task-id="${original.id}"]`)).toContainText('Оригінальна назва');
    await page.locator('#edit-task .modal__actions a[href="#main"]').click();

    // Toggle: a failed PATCH restores the previous done state.
    await page.locator('label[for="show-done"]').click();
    const check = page.locator(`.task-card[data-task-id="${original.id}"] [data-action="toggle"]`);
    await check.click();
    await expect(check).not.toBeChecked();
    await expect(check).toBeEnabled();

    // Delete: the card disappears optimistically and returns after the error.
    await page.locator(`.task-card[data-task-id="${original.id}"] [data-action="delete"]`).click();
    await page.locator('[data-confirm-delete]').click();
    await expect(page.locator(`.task-card[data-task-id="${original.id}"]`)).toBeVisible();
    await expect(page.locator(`.task-card[data-task-id="${original.id}"]`)).toContainText('Оригінальна назва');

    await page.reload();
    await expect(page.locator(`.task-card[data-task-id="${original.id}"]`)).toContainText('Оригінальна назва');
    await expect(page.locator(`.task-card[data-task-id="${original.id}"] [data-action="toggle"]`)).not.toBeChecked();
  });
});
