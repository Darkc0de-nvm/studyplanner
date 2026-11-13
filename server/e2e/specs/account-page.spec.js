'use strict';

const { test, expect } = require('@playwright/test');
const { registerAndSignIn } = require('../helpers');

test.describe('account settings page', () => {
  test('renders security actions and opens both dialogs with safe focus behavior', async ({ page }) => {
    await registerAndSignIn(page, 'Profile Dialog User');
    await page.goto('/account.html');

    await expect(page.locator('h1')).toHaveText('Налаштування акаунта');
    await expect(page.locator('.account-page__cards > section')).toHaveCount(2);

    const passwordDialog = page.locator('#change-password-dialog');
    const passwordTrigger = page.locator('#btn-open-password-modal');
    await passwordTrigger.click();
    await expect(passwordDialog).toBeVisible();
    await expect(page.locator('#current-password')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(passwordDialog).toBeHidden();
    await expect(passwordTrigger).toBeFocused();

    const deleteDialog = page.locator('#delete-account-dialog');
    const deleteTrigger = page.locator('#btn-open-delete-modal');
    await deleteTrigger.click();
    await expect(deleteDialog).toBeVisible();
    await expect(page.locator('#del-password')).toBeFocused();
    await expect(page.locator('#del-confirm')).toBeDisabled();
    await page.locator('#del-password').fill('incorrect-password');
    await page.locator('#del-confirm').click();
    await expect(deleteDialog).toBeVisible();
    await expect(page.locator('#del-password-error')).toHaveText('Невірний пароль');
    await expect(page.locator('#del-password')).toBeFocused();

    await page.mouse.click(8, 8);
    await expect(deleteDialog).toBeHidden();
    await expect(deleteTrigger).toBeFocused();
  });

  test('shows a wrong current password and then changes the password', async ({ page }) => {
    const email = await registerAndSignIn(page, 'Password Change User');
    const originalPassword = 'Study2026!';
    const replacementPassword = 'Changed2026!';

    await page.goto('/account.html');
    await page.locator('#btn-open-password-modal').click();
    await page.locator('#current-password').fill('incorrect-password');
    await page.locator('#new-password').fill(replacementPassword);
    await page.locator('#repeat-new-password').fill(replacementPassword);
    await page.locator('#password-save').click();

    const dialog = page.locator('#change-password-dialog');
    const error = page.locator('#password-change-error');
    await expect(dialog).toBeVisible();
    await expect(error).toHaveText('Невірний поточний пароль');
    await expect(page.locator('#current-password')).toBeFocused();

    await page.locator('#current-password').fill(originalPassword);
    await page.locator('#password-save').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#delete-status')).toHaveText('Пароль змінено');

    await page.request.post('/api/auth/logout');
    await page.goto('/login.html');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(originalPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[data-auth-error]')).toBeVisible();

    await page.locator('#password').fill(replacementPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/tasks\.html$/);
  });

  test('keeps account cards and the delete dialog within a 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await registerAndSignIn(page, 'Mobile Profile User');
    await page.goto('/account.html');

    await expect(page.locator('.account-page__cards')).toBeVisible();
    await expect(page.locator('#account-data-card')).toBeVisible();
    await page.locator('#btn-open-delete-modal').click();

    const dialog = page.locator('#delete-account-dialog');
    await expect(dialog).toBeInViewport();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(360);
    await expect(page.locator('#del-cancel')).toBeVisible();
    await expect(page.locator('#del-confirm')).toBeVisible();
  });
});
