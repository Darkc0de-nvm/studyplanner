'use strict';

/* global document */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { BASE_TIME, PAGES, STATES, signInAsDemo } = require('../page-fixtures');

const WIDTHS = [1440, 390];
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const INTENTIONAL_TAG_CONTRAST_SELECTOR = '.task-card .tag, .task-details .tag';

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
  const auditedViolations = [];
  for (const violation of results.violations) {
    let nodes = violation.nodes;

    // Discipline badges intentionally use --discipline-color with white
    // --primary-foreground labels. Keep the approved palette, while checking
    // every other node for contrast and running all axe rules on the badges.
    if (violation.id === 'color-contrast') {
      nodes = [];
      for (const node of violation.nodes) {
        const isApprovedBadge = await page.evaluate(({ targets, selector }) => (
          targets.some((target) => {
            try {
              return document.querySelector(target)?.matches(selector) ?? false;
            } catch {
              return false;
            }
          })
        ), {
          targets: node.target,
          selector: INTENTIONAL_TAG_CONTRAST_SELECTOR,
        });

        if (!isApprovedBadge) nodes.push(node);
      }
    }

    if (nodes.length > 0) auditedViolations.push({ ...violation, nodes });
  }

  const blocking = auditedViolations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );

  if (blocking.length > 0) {
    throw new Error(`axe serious/critical violations:\n${formatViolations(blocking)}`);
  }
  return auditedViolations.length;
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
