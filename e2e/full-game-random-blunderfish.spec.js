import { expect, test } from '@playwright/test';

const EVAL_LABEL_PATTERN = /[+-]\d+\.\d{2}|-?M\d+/;

function shuffled(list) {
  const values = [...list];
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = values[i];
    values[i] = values[j];
    values[j] = tmp;
  }
  return values;
}

async function whitePieceSquares(page) {
  return page.$$eval('#board .square', (squares) => {
    const result = [];
    for (const square of squares) {
      const piece = square.querySelector('img.piece');
      const alt = piece?.getAttribute('alt') || '';
      if (alt.startsWith('white ')) {
        const id = square.getAttribute('data-square');
        if (id) {
          result.push(id);
        }
      }
    }
    return result;
  });
}

async function legalTargetSquares(page) {
  return page.$$eval('#board .square .legal-dot', (dots) => {
    const result = [];
    for (const dot of dots) {
      const square = dot.parentElement?.getAttribute('data-square');
      if (square) {
        result.push(square);
      }
    }
    return result;
  });
}

async function tryPlayRandomWhiteMove(page) {
  const fromSquares = shuffled(await whitePieceSquares(page));

  for (const from of fromSquares) {
    await page.locator(`[data-square="${from}"]`).click();
    const targets = await legalTargetSquares(page);

    if (targets.length === 0) {
      continue;
    }

    const to = targets[Math.floor(Math.random() * targets.length)];
    await page.locator(`[data-square="${to}"]`).click();
    return true;
  }

  return false;
}

test('plays a full random white game at 10% blunder to a losing end-game modal', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/?engineMovetimeMs=50');
  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.locator('#setup-blunder-slider').evaluate((el) => {
    el.value = '10';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Start Game' }).click();

  const resultDialog = page.locator('#game-result-dialog');
  const moveRows = page.locator('#moves-body tr');

  await expect(page.locator('#game-app')).toBeVisible();
  await expect(page.locator('#new-game-btn')).toHaveText('Forfeit');
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);

  let humanMoves = 0;
  const maxHumanMoves = 120;

  while (!(await resultDialog.isVisible()) && humanMoves < maxHumanMoves) {
    const played = await tryPlayRandomWhiteMove(page);
    if (!played) {
      await page.waitForTimeout(100);
      continue;
    }

    humanMoves += 1;

    await expect(page.locator('#eval-bar-wrap')).toBeVisible();
    await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);

    await page.waitForFunction(() => {
      const dialog = document.querySelector('#game-result-dialog');
      if (dialog && dialog.hasAttribute('open')) {
        return true;
      }
      const status = (document.querySelector('#status-text')?.textContent || '').toLowerCase();
      return status.includes('your move');
    });

    await expect(moveRows).not.toHaveCount(0);
  }

  await expect(resultDialog).toBeVisible();
  await expect(page.locator('#game-result-title')).toHaveText('You lost :(');
  await expect(page.locator('#game-result-graph')).toBeVisible();
  await expect(page.locator('#new-game-btn')).toHaveText('New Game');
  await expect(moveRows).not.toHaveCount(0);
});
