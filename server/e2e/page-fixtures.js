'use strict';

const { expect } = require('@playwright/test');

// The e2e server seeds this account with deadlines relative to 2026-10-06.
const DEMO = {
  email: 'demo.visual@studyplanner.test',
  password: 'Study2026!',
  name: 'Демо Користувач',
};
const BASE_TIME = new Date('2026-10-06T12:00:00');

const PAGES = [
  { name: 'tasks', path: '/tasks.html', auth: true, ready: '.task-card' },
  { name: 'calendar', path: '/calendar.html', auth: true, ready: '.month-heading h1' },
  { name: 'login', path: '/login.html', ready: '[data-auth-form="login"]' },
  { name: 'register', path: '/register.html', ready: '[data-auth-form="register"]' },
  { name: 'index', path: '/', ready: 'h1' },
  { name: 'privacy', path: '/privacy.html', ready: 'h1' },
  { name: 'terms', path: '/terms.html', ready: 'h1' },
];

// Key application states beyond the plain pages: dialogs, form validation,
// filters and the date picker. They are exercised on desktop and mobile only.
const STATES = [
  { name: 'tasks-search', path: '/tasks.html?state=search', auth: true, ready: '.task-card mark' },
  {
    name: 'tasks-no-results',
    path: '/tasks.html?state=no-results',
    auth: true,
    ready: '.app-empty h2',
  },
  {
    name: 'tasks-first-run',
    path: '/tasks.html?state=first-run',
    auth: true,
    ready: '.app-empty a[href="#add-task"]',
  },
  {
    name: 'tasks-filter',
    path: '/tasks.html?state=filter',
    auth: true,
    ready: '.filter-count--visible',
  },
  {
    name: 'tasks-filter-open',
    path: '/tasks.html?state=filter-open',
    auth: true,
    ready: '.app-filter[open]',
  },
  { name: 'tasks-done', path: '/tasks.html?state=done', auth: true, ready: '.task-card--done' },
  {
    name: 'tasks-user-menu',
    path: '/tasks.html?state=user-menu',
    auth: true,
    ready: '.user-menu[open]',
  },
  {
    name: 'tasks-details-empty',
    path: '/tasks.html?state=details-empty#task-details',
    auth: true,
    ready: '#task-details.modal__variant--active',
  },
  {
    name: 'tasks-add-dialog',
    path: '/tasks.html#add-task',
    auth: true,
    ready: '.modal--open #add-task',
  },
  {
    name: 'tasks-edit-dialog',
    path: '/tasks.html#edit-task',
    auth: true,
    ready: '#edit-task.modal--open',
  },
  {
    name: 'tasks-details-dialog',
    path: '/tasks.html#task-details',
    auth: true,
    ready: '.modal--open #task-details',
  },
  {
    name: 'tasks-delete-dialog',
    path: '/tasks.html#delete-task',
    auth: true,
    ready: '.modal--open #task-delete',
  },
  {
    name: 'tasks-datepicker',
    path: '/tasks.html#add-task-date',
    auth: true,
    ready: '.modal--open .datepicker:not([hidden])',
  },
  {
    name: 'tasks-add-errors',
    path: '/tasks.html#add-task',
    auth: true,
    ready: '.modal--open #add-task',
    async prepare(page) {
      await page.locator('#add-task button[type="submit"]').click();
      await expect(page.locator('#add-task .field--error')).toHaveCount(3);
    },
  },
  {
    name: 'login-error',
    path: '/login.html?state=error',
    ready: '[data-auth-error]:not([hidden])',
  },
  {
    name: 'register-error',
    path: '/register.html?state=error',
    ready: '.field--error',
  },
  {
    name: 'calendar-filter',
    path: '/calendar.html?state=filter',
    auth: true,
    ready: '.filter-reset:not([hidden])',
  },
  {
    name: 'calendar-filter-open',
    path: '/calendar.html?state=filter-open',
    auth: true,
    ready: '.app-filter[open]',
  },
  {
    name: 'calendar-details-empty',
    path: '/calendar.html?state=details-empty#task-details',
    auth: true,
    ready: '#task-details.modal__variant--active',
  },
];

async function signInAsDemo(page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: DEMO.email, password: DEMO.password },
  });
  expect(response.status()).toBe(200);
}

module.exports = { DEMO, BASE_TIME, PAGES, STATES, signInAsDemo };
