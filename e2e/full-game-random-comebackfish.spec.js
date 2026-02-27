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

async function pickPromotionIfNeeded(page) {
  const promotionDialog = page.locator('#promotion-dialog');
  if (await promotionDialog.isVisible()) {
    await page.getByRole('button', { name: 'Queen' }).click();
  }
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
    await pickPromotionIfNeeded(page);
    return true;
  }

  return false;
}

test('plays a full random white clapbackfish game and reaches end-game modal', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/?engineMovetimeMs=50');
  await page.getByRole('button', { name: 'Clapbackfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();

  const resultDialog = page.locator('#game-result-dialog');
  const primaryBtn = page.locator('#new-game-btn');
  const moveRows = page.locator('#moves-body tr');

  await expect(page.locator('.topbar h1')).toHaveText('Clapbackfish');
  await expect(primaryBtn).toHaveText('Forfeit');
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);
  await expect(page.locator('#ramp-readonly-settings')).toBeVisible();

  let humanMoves = 0;
  const maxHumanMoves = 140;

  while (!(await resultDialog.isVisible()) && humanMoves < maxHumanMoves) {
    const played = await tryPlayRandomWhiteMove(page);
    if (!played) {
      await page.waitForTimeout(80);
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
  }

  if (!(await resultDialog.isVisible())) {
    await primaryBtn.click();
  }

  await expect(resultDialog).toBeVisible();
  await expect(page.locator('#game-result-title')).toHaveText(/You (won|lost :\()|Draw!/);
  await expect(page.locator('#game-result-graph')).toBeVisible();
  await expect(page.locator('#new-game-btn')).toHaveText('New Game');
  await expect(moveRows).not.toHaveCount(0);
  const playedPly = await page.$$eval('#moves-body tr', (rows) => {
    let count = 0;
    for (const row of rows) {
      const whiteMove = row.children[1]?.textContent?.trim() || '';
      const blackMove = row.children[2]?.textContent?.trim() || '';
      if (whiteMove) {
        count += 1;
      }
      if (blackMove) {
        count += 1;
      }
    }
    return count;
  });
  expect(playedPly).toBeGreaterThanOrEqual(40);
  await expect(page.locator('#game-result-target-line')).toHaveCount(1);
  await expect(page.locator('#game-result-target-legend')).toHaveCount(1);
});
