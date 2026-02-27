import { test, expect } from '@playwright/test';

test('eval bar is on by default and toggleable from settings (white)', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.locator('#game-app')).toBeVisible();
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#status-text')).toHaveText('You are White. Your Move.');
  await expect(page.locator('#eval-bar-label')).toHaveText('+0.00');

  // First engine reply should produce the first sampled eval point.
  await page.locator('[data-square="f2"]').click();
  await page.locator('[data-square="f3"]').click();
  await expect(page.locator('#status-text')).toContainText('Your move.');
  await expect(page.locator('#eval-bar-label')).toHaveText(/[+-]\d+\.\d{2}|-?M\d+/);
  await expect(page.locator('#eval-bar-label')).not.toHaveText('+0.00');

  await page.getByLabel('Show eval bar').uncheck();
  await expect(page.locator('#eval-bar-wrap')).toBeHidden();
  await page.getByLabel('Show eval bar').check();
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(/[+-]\d+\.\d{2}|-?M\d+/);
});

test('eval bar is on by default and toggleable from settings (black)', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('b');
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.locator('#game-app')).toBeVisible();
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(/[+-]\d+\.\d{2}|-?M\d+/);

  await page.getByLabel('Show eval bar').uncheck();
  await expect(page.locator('#eval-bar-wrap')).toBeHidden();
  await page.getByLabel('Show eval bar').check();
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(/[+-]\d+\.\d{2}|-?M\d+/);
});
