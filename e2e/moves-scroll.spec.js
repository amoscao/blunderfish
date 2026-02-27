import { test, expect } from '@playwright/test';

test('moves list uses vertical scrollbar when many rows are present (desktop)', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.locator('#game-app')).toBeVisible();
  await expect(page.locator('#status-text')).toHaveText('You are White. Your Move.');

  const injectedRows = await page.evaluate(() => {
    const tbody = document.querySelector('#moves-body');
    if (!tbody) throw new Error('moves body not found');

    tbody.innerHTML = '';
    for (let i = 0; i < 200; i += 1) {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${i + 1}.</td><td>e4</td><td>e5</td>`;
      tbody.appendChild(row);
    }
    return tbody.querySelectorAll('tr').length;
  });
  expect(injectedRows).toBe(200);

  const metrics = await page.locator('.moves-table-wrap').evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    overflowY: getComputedStyle(el).overflowY
  }));

  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});
