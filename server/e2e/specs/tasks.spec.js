'use strict';

/* global window, Event */

const { test, expect } = require('@playwright/test');
const {
  isoDate,
  displayDate,
  registerAndSignIn,
  createDiscipline,
  createTask,
  chooseDiscipline,
} = require('../helpers');

test.describe('task CRUD', () => {
  test('creates, edits, completes and deletes a task against the API', async ({ page }) => {
    await registerAndSignIn(page);
    await expect(page.locator('.app-empty')).toBeVisible();

    const discipline = await createDiscipline(page, 'Комп’ютерні мережі');
    await page.reload();

    await page.locator('.app-empty a[href="#add-task"]').click();
    await expect(page.locator('#add-task-title')).toBeVisible();

    await chooseDiscipline(page, '#add-task', discipline.name);
    const deadline = isoDate(2);
    await page.fill('#add-task-name', 'Лабораторна робота №5');
    await page.fill('#add-task-deadline', displayDate(deadline));
    await page.fill('#add-task-description', 'Описати протокол TCP.');
    await page.locator('#add-task button[type="submit"]').click();

    const card = page.locator('.task-card', { hasText: 'Лабораторна робота №5' });
    await expect(card).toBeVisible();
    await expect(card.locator('.task-card__discipline')).toHaveText('Комп’ютерні мережі');
    await expect(card.locator('time')).toHaveAttribute('datetime', deadline);

    // The server is the only source of truth, so a reload must keep the task.
    await page.reload();
    await expect(card).toBeVisible();

    await card.locator('[data-action="edit"]').click();
    await expect(page.locator('#edit-task-title')).toBeVisible();
    await page.fill('#edit-task-name', 'Лабораторна робота №5 (оновлено)');
    await page.locator('#edit-task button[type="submit"]').click();

    const updated = page.locator('.task-card', { hasText: 'Лабораторна робота №5 (оновлено)' });
    await expect(updated).toBeVisible();

    // Completed tasks are filtered out by default, so opt in before toggling.
    await page.locator('label[for="show-done"]').click();
    await updated.locator('[data-action="toggle"]').click();
    await expect(updated).toHaveClass(/task-card--done/);
    await expect(updated.locator('[data-action="toggle"]')).toBeChecked();

    await page.reload();
    const completed = page.locator('.task-card', { hasText: 'Лабораторна робота №5 (оновлено)' });
    await expect(completed).toBeVisible();
    await expect(completed.locator('[data-action="toggle"]')).toBeChecked();

    await completed.locator('[data-action="delete"]').click();
    await expect(page.locator('#delete-task-title')).toBeVisible();
    await page.locator('[data-confirm-delete]').click();
    await expect(completed).toHaveCount(0);

    await page.reload();
    await expect(page.locator('.task-card', { hasText: 'Лабораторна робота №5 (оновлено)' })).toHaveCount(0);
  });
});

test.describe('dynamic disciplines', () => {
  test('replaces demo options and maps colour 4 to the available palette', async ({ page }) => {
    await registerAndSignIn(page);
    await expect(page.locator('.app-empty')).toBeVisible();

    // A user without disciplines must not see the static no-JS demo options.
    await page.locator('.app-empty a[href="#add-task"]').click();
    await page.locator('#add-task .select__trigger').click();
    await expect(page.locator('#add-task .select__options label')).toHaveCount(0);
    await expect(page.locator('#add-task .select__options a[href="#new-discipline"]')).toBeVisible();
    await page.locator('section.modal:has(#add-task-title) .modal__header a[aria-label="Закрити"]').click();

    const discipline = await createDiscipline(page, 'Квантова фізика', 4);
    await page.reload();

    await page.locator('.app-empty a[href="#add-task"]').click();
    await page.locator('#add-task .select__trigger').click();
    const option = page.locator('#add-task .select__options label', { hasText: discipline.name });
    await expect(option).toBeVisible();
    const radioId = await option.getAttribute('for');
    const radioValue = await page.locator(`#${radioId}`).getAttribute('value');
    expect(radioValue).toBe(discipline.id);

    await page.goto('/calendar.html');
    const legendItem = page.locator(`.calendar-legend [data-discipline-id="${discipline.id}"]`);
    await expect(legendItem).toBeVisible();
    await expect(legendItem).toContainText('Квантова фізика');
    // The client currently supports colours 1..3, so 4 cycles back to 1.
    await expect(legendItem.locator('.calendar-cell__dot')).toHaveClass(/calendar-cell__dot--1/);
  });
});

test.describe('filters and revalidation', () => {
  test('keeps list and calendar in sync and refreshes on window focus', async ({ page }) => {
    await registerAndSignIn(page);
    const first = await createDiscipline(page, 'Алгоритми');
    const second = await createDiscipline(page, 'Операційні системи');
    const today = isoDate();

    await createTask(page, {
      title: 'Завдання з алгоритмів',
      disciplineId: first.id,
      deadline: today,
    });
    await createTask(page, {
      title: 'Завдання з операційних систем',
      disciplineId: second.id,
      deadline: today,
    });

    await page.goto('/tasks.html');
    await expect(page.locator('.task-card', { hasText: 'Завдання з алгоритмів' })).toBeVisible();
    await expect(page.locator('.task-card', { hasText: 'Завдання з операційних систем' })).toBeVisible();

    // A task created outside this tab appears after the focus revalidation.
    await createTask(page, {
      title: 'Завдання з іншої вкладки',
      disciplineId: first.id,
      deadline: today,
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('.task-card', { hasText: 'Завдання з іншої вкладки' })).toBeVisible();

    await page.locator('.app-filter .select__trigger').click();
    await page.locator('.app-filter .select__options label', { hasText: first.name }).click();

    await expect(page.locator('.task-card', { hasText: 'Завдання з алгоритмів' })).toBeVisible();
    await expect(page.locator('.task-card', { hasText: 'Завдання з операційних систем' })).toHaveCount(0);
    await expect(page.locator('.task-card', { hasText: 'Завдання з іншої вкладки' })).toBeVisible();
    await expect(page.locator('.filter-count')).toHaveText('Показано: 2 з 3');

    await page.goto(`/calendar.html?date=${today}`);
    await expect(page.locator('.day-view__cards .task-card')).toHaveCount(3);

    await page.locator('.app-filter .select__trigger').click();
    await page.locator('.app-filter .select__options label', { hasText: first.name }).click();

    await expect(page.locator('.day-view__cards .task-card')).toHaveCount(2);
    await expect(page.locator('.calendar-legend [data-discipline-id]')).toHaveCount(2);
    await expect(page.locator(`.calendar-legend [data-discipline-id="${first.id}"]`)).toBeVisible();
    await expect(page.locator(`.calendar-legend [data-discipline-id="${second.id}"]`)).toBeHidden();

    await createTask(page, {
      title: 'Ще одне зовнішнє завдання',
      disciplineId: first.id,
      deadline: today,
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    // The day view modal itself is closed, so assert on its rendered content.
    await expect(page.locator('.day-view__cards .task-card')).toHaveCount(3);
    await expect(
      page.locator('.day-view__cards .task-card', { hasText: 'Ще одне зовнішнє завдання' })
    ).toHaveCount(1);
  });
});
