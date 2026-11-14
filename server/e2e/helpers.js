'use strict';

const { expect } = require('@playwright/test');

const PASSWORD = 'Study2026!';

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function displayDate(iso) {
  return iso.split('-').reverse().join('.');
}

async function registerAndSignIn(page, name = 'E2E Користувач') {
  const email = uniqueEmail('e2e');

  await page.goto('/register.html');
  await page.fill('#name', name);
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await page.fill('#password-repeat', PASSWORD);
  await page.check('#acceptedTerms');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/tasks\.html$/);
  return email;
}

async function createDiscipline(page, name, colorIndex = 1) {
  const response = await page.request.post('/api/disciplines', {
    data: { name, colorIndex },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).discipline;
}

async function createTask(page, data) {
  const response = await page.request.post('/api/tasks', {
    data: {
      description: null,
      ...data,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).task;
}

async function chooseDiscipline(page, formSelector, name) {
  await page.locator(`${formSelector} .select__trigger`).click();
  await page
    .locator(`${formSelector} .select__options label`, { hasText: name })
    .click();
}

async function failRequest(route, message = 'Тестова помилка сервера.') {
  await route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ error: { code: 'INTERNAL', message } }),
  });
}

module.exports = {
  PASSWORD,
  uniqueEmail,
  isoDate,
  displayDate,
  registerAndSignIn,
  createDiscipline,
  createTask,
  chooseDiscipline,
  failRequest,
};
