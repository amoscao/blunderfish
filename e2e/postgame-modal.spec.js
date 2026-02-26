import { expect, test } from '@playwright/test';

test('forfeit opens modal, close works, rematch and main menu actions work', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();

  const primaryBtn = page.locator('#new-game-btn');
  await expect(primaryBtn).toHaveText('Forfeit');

  await primaryBtn.click();
  await expect(page.locator('#game-result-dialog')).toBeVisible();
  await expect(page.locator('#game-result-title')).toHaveText('You lost :(');
  await expect(page.locator('#game-result-graph')).toBeVisible();
  await expect(primaryBtn).toHaveText('New Game');

  await page.locator('#game-result-close-btn').click();
  await expect(page.locator('#game-result-dialog')).toBeHidden();

  await primaryBtn.click();
  await expect(primaryBtn).toHaveText('Forfeit');

  await primaryBtn.click();
  await expect(page.locator('#game-result-dialog')).toBeVisible();
  await page.locator('#game-result-main-menu-btn').click();
  await expect(page.locator('#mode-select-screen')).toBeVisible();
});
