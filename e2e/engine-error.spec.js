import { expect, test } from '@playwright/test';

async function installEngineFailureHarness(page) {
  await page.addInitScript(() => {
    window.__engineFailureHarness = {
      mode: null,
      remaining: 0,
      delayMs: 0
    };

    const NativeWorker = window.Worker;

    window.Worker = class EngineFailureWorker extends NativeWorker {
      postMessage(message, ...rest) {
        const command = typeof message === 'string' ? message : '';
        const harness = window.__engineFailureHarness;
        const shouldIntercept =
          command.startsWith('go ') && harness && harness.remaining > 0 && typeof harness.mode === 'string';

        if (!shouldIntercept) {
          return super.postMessage(message, ...rest);
        }

        harness.remaining -= 1;
        const delayMs = Math.max(0, Number(harness.delayMs) || 0);

        if (harness.mode === 'analysis_missing_score') {
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', { data: 'bestmove e2e4' }));
          }, delayMs);
          return;
        }

        if (harness.mode === 'bestmove_none') {
          setTimeout(() => {
            this.dispatchEvent(new MessageEvent('message', { data: 'bestmove (none)' }));
          }, delayMs);
          return;
        }

        return super.postMessage(message, ...rest);
      }
    };
  });
}

async function configureOneInjectedFailure(page, mode, delayMs = 600) {
  await page.evaluate(
    ({ nextMode, nextDelayMs }) => {
      window.__engineFailureHarness.mode = nextMode;
      window.__engineFailureHarness.remaining = 1;
      window.__engineFailureHarness.delayMs = nextDelayMs;
    },
    { nextMode: mode, nextDelayMs: delayMs }
  );
}

test('analysis failure shows engine error and app can recover via new game', async ({ page }) => {
  await installEngineFailureHarness(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.locator('#setup-blunder-slider').evaluate((el) => {
    el.value = '100';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('#status-text')).toHaveText('You are White. Your Move.');

  await configureOneInjectedFailure(page, 'analysis_missing_score');
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();

  await expect(page.locator('#status-text')).toContainText('thinking');
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#game-result-dialog')).toBeVisible();

  await expect(page.locator('#status-text')).toContainText('Engine error:');

  await page.locator('#game-result-rematch-btn').click();
  await expect(page.locator('#new-game-btn')).toHaveText('Forfeit');
  await expect(page.locator('#game-result-dialog')).toBeHidden();
});

test('move search failure shows engine error and app remains interactive', async ({ page }) => {
  await installEngineFailureHarness(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.locator('#setup-blunder-slider').evaluate((el) => {
    el.value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.locator('#status-text')).toHaveText('You are White. Your Move.');

  await configureOneInjectedFailure(page, 'bestmove_none');
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();

  await expect(page.locator('#status-text')).toContainText('thinking');
  await page.locator('#new-game-btn').click();
  await expect(page.locator('#game-result-dialog')).toBeVisible();

  await expect(page.locator('#status-text')).toContainText('Engine error:');

  await page.locator('#game-result-main-menu-btn').click();
  await expect(page.locator('#mode-select-screen')).toBeVisible();
});
