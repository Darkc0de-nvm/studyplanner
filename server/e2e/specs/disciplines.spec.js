'use strict';

const { test, expect } = require('@playwright/test');
const { registerAndSignIn, createDiscipline } = require('../helpers');

test.describe('discipline creation', () => {
  test('creates a discipline from the task form and reports duplicates', async ({ page }) => {
    await registerAndSignIn(page);
    const existing = await createDiscipline(page, 'Існуюча дисципліна');
    await page.reload();
    await expect(page.locator('.app-empty')).toBeVisible();

    await page.locator('.app-empty a[href="#add-task"]').click();
    await page.locator('#add-task .select__trigger').click();
    await page.locator('#add-task .select__options a[href="#new-discipline"]').click();
    await expect(page.locator('#new-discipline-title')).toBeVisible();

    await page.fill('#new-discipline-name', existing.name);
    await page.locator('[data-discipline-form] button[type="submit"]').click();

    await expect(page.locator('#new-discipline-name-error')).toBeVisible();
    await expect(page.locator('#new-discipline-name-error')).toHaveText(
      'Дисципліна з такою назвою вже існує.'
    );
    await expect(page.locator('#new-discipline-title')).toBeVisible();

    await page.fill('#new-discipline-name', 'Нова дисципліна');
    const createdResponse = page.waitForResponse(response => (
      response.url().endsWith('/api/disciplines') &&
      response.request().method() === 'POST'
    ));
    await page.locator('[data-discipline-form] button[type="submit"]').click();
    expect((await createdResponse).status()).toBe(201);

    // The task form is restored and the new discipline is preselected.
    await expect(page.locator('#add-task-title')).toBeVisible();
    await expect(page.locator('#add-task [data-select-value]')).toHaveText('Нова дисципліна');
    await expect(page.locator('#add-task input[name="disciplineId"]:checked')).toHaveCount(1);

    await page.reload();
    await page.locator('.app-empty a[href="#add-task"]').click();
    await page.locator('#add-task .select__trigger').click();
    await expect(
      page.locator('#add-task .select__options label', { hasText: 'Нова дисципліна' })
    ).toBeVisible();
  });
});
