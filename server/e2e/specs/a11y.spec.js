'use strict';

/* global document */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { BASE_TIME, PAGES, STATES, signInAsDemo } = require('../page-fixtures');

const WIDTHS = [1440, 390];
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Static error pages and the component gallery are not part of the visual
// baseline, but they must still be accessible.
const EXTRA_PAGES = [
  { name: '404', path: '/404.html', ready: 'h1' },
  { name: '500', path: '/500.html', ready: 'h1' },
  { name: 'offline', path: '/offline.html', ready: 'h1' },
  { name: 'states', path: '/states.html', ready: 'h1' },
];

function formatViolations(violations) {
  return violations
    .map((violation) => {
      const nodes = violation.nodes.map((node) => `${node.target.join(' ')}\n      ${node.html}`).slice(0, 5).join('\n    ');
      return `${violation.id} [${violation.impact}] ${violation.help} (${violation.nodes.length} nodes)\n    ${nodes}`;
    })
    .join('\n');
}

async function auditPage(page, item) {
  await page.clock.setFixedTime(BASE_TIME);
  if (item.auth) await signInAsDemo(page);

  await page.goto(item.path);
  await expect(page.locator(item.ready).first()).toBeVisible();
  if (item.prepare) await item.prepare(page);
  await page.evaluate(() => document.fonts.ready);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );

  if (blocking.length > 0) {
    throw new Error(`axe serious/critical violations:\n${formatViolations(blocking)}`);
  }
  return results.violations.length;
}

test.describe('accessibility audit (axe)', () => {
  test.beforeEach(async ({ browserName }) => {
    test.skip(browserName !== 'chromium', 'axe audit runs in Chromium; Firefox covers behaviour');
  });

  for (const width of WIDTHS) {
    const height = width >= 768 ? 900 : 844;

    for (const item of [...PAGES, ...EXTRA_PAGES]) {
      test(`${item.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await auditPage(page, item);
      });
    }

    for (const item of STATES) {
      test(`${item.name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await auditPage(page, item);
      });
    }
  }
});
