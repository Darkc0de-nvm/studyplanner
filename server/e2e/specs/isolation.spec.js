'use strict';

const { test, expect } = require('@playwright/test');
const {
  PASSWORD,
  isoDate,
  registerAndSignIn,
  createDiscipline,
  createTask,
} = require('../helpers');

test.describe('two-user isolation', () => {
  test('keeps tasks and disciplines private to their owner', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const emailA = await registerAndSignIn(pageA, 'Користувач А');
      await expect(pageA.locator('.app-empty')).toBeVisible();

      const discipline = await createDiscipline(pageA, 'Приватна дисципліна А');
      const task = await createTask(pageA, {
        title: 'Приватне завдання А',
        disciplineId: discipline.id,
        deadline: isoDate(1),
      });

      await pageA.goto('/tasks.html');
      await expect(
        pageA.locator('.task-card', { hasText: 'Приватне завдання А' })
      ).toBeVisible();

      // A second account starts from a clean, empty planner.
      await registerAndSignIn(pageB, 'Користувач Б');
      await expect(pageB.locator('.app-empty')).toBeVisible();
      await expect(pageB.locator('.task-card')).toHaveCount(0);

      // Neither the list endpoint nor the filter dropdown exposes A's data.
      const listResponse = await pageB.request.get('/api/tasks');
      expect(listResponse.status()).toBe(200);
      expect((await listResponse.json()).tasks).toEqual([]);
      await expect(pageB.locator('.app-filter .select__options label')).toHaveCount(1);
      await expect(pageB.locator('.app-filter .select__options label')).toHaveText(
        'Усі дисципліни'
      );

      // The add form and the calendar legend are scoped to B's disciplines.
      await pageB.locator('.app-empty a[href="#add-task"]').click();
      await pageB.locator('#add-task .select__trigger').click();
      await expect(pageB.locator('#add-task .select__options label')).toHaveCount(0);

      await pageB.goto('/calendar.html');
      await expect(pageB.locator('.month-heading h1')).toBeVisible();
      await expect(pageB.locator('.calendar-legend [data-discipline-id]')).toHaveCount(0);

      // Direct access to A's task is indistinguishable from a missing task.
      expect((await pageB.request.get(`/api/tasks/${task.id}`)).status()).toBe(404);
      expect(
        (
          await pageB.request.patch(`/api/tasks/${task.id}`, {
            data: { title: 'Змінене користувачем Б' },
          })
        ).status()
      ).toBe(404);
      expect(
        (
          await pageB.request.delete(`/api/tasks/${task.id}`, {
            headers: { 'Content-Type': 'application/json' },
          })
        ).status()
      ).toBe(404);

      // A's data survives B's attempts and a fresh sign-in.
      await contextA.clearCookies();
      const login = await pageA.request.post('/api/auth/login', {
        data: { email: emailA, password: PASSWORD },
      });
      expect(login.status()).toBe(200);

      await pageA.goto('/tasks.html');
      const ownTask = pageA.locator('.task-card', { hasText: 'Приватне завдання А' });
      await expect(ownTask).toBeVisible();
      await expect(ownTask.locator('.task-card__title a')).toHaveText('Приватне завдання А');
      await expect(ownTask.locator('.task-card__discipline')).toHaveText(
        'Приватна дисципліна А'
      );
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
