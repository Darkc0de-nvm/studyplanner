'use strict';

/* global document */

const { test, expect } = require('@playwright/test');
const { BASE_TIME, PAGES, STATES, signInAsDemo } = require('../page-fixtures');

const WIDTHS = [1440, 768, 390];
const STATE_WIDTHS = [1440, 390];

async function snapshot(page, name, width, fullPage = true) {
  await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
    fullPage,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
}

test.describe('visual baseline', () => {
  for (const width of WIDTHS) {
    for (const item of PAGES) {
      test(`${item.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
        // Pin the client clock: relative dates and calendar cells depend on it.
        await page.clock.setFixedTime(BASE_TIME);
        if (item.auth) await signInAsDemo(page);

        await page.goto(item.path);
        await expect(page.locator(item.ready).first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);

        await snapshot(page, item.name, width);
      });
    }
  }
});

test.describe('visual states', () => {
  for (const width of STATE_WIDTHS) {
    for (const item of STATES) {
      test(`${item.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: width >= 768 ? 900 : 844 });
        await page.clock.setFixedTime(BASE_TIME);
        if (item.auth) await signInAsDemo(page);

        await page.goto(item.path);
        await expect(page.locator(item.ready).first()).toBeVisible();
        if (item.prepare) await item.prepare(page);
        await page.evaluate(() => document.fonts.ready);

        // Dialogs and dropdowns are viewport overlays; capture just the viewport
        // so a fixed-position layer is not repeated over the full document.
        await snapshot(page, item.name, width, false);
      });
    }
  }
});
