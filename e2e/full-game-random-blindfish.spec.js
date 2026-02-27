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

async function blindMarkedBlackSquares(page) {
  return page.$$eval('#board .square', (squares) => {
    const result = [];
    for (const square of squares) {
      if (!square.querySelector('.blind-marker')) {
        continue;
      }
      const piece = square.querySelector('img.piece');
      const alt = piece?.getAttribute('alt') || '';
      if (!alt.startsWith('black ')) {
        continue;
      }
      const id = square.getAttribute('data-square');
      if (id) {
        result.push(id);
      }
    }
    return result;
  });
}

async function lastEngineMoveFromSquare(page) {
  return page.$$eval('#board .square.last-move', (squares) => {
    for (const square of squares) {
      const piece = square.querySelector('img.piece');
      const alt = piece?.getAttribute('alt') || '';
      if (!alt.startsWith('black ')) {
        return square.getAttribute('data-square');
      }
    }
    return null;
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
    await pickPromotionIfNeeded(page);
    return true;
  }

  return false;
}

test('plays a full random white blindfish game and reaches end-game modal', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/?engineMovetimeMs=50');
  await page.getByRole('button', { name: 'Blindfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();

  const resultDialog = page.locator('#game-result-dialog');
  const primaryBtn = page.locator('#new-game-btn');
  const moveRows = page.locator('#moves-body tr');

  await expect(page.locator('.topbar h1')).toHaveText('Blindfish');
  await expect(primaryBtn).toHaveText('Forfeit');
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);

  let humanMoves = 0;
  const maxHumanMoves = 140;
  let checkedEngineTurns = 0;

  while (!(await resultDialog.isVisible()) && humanMoves < maxHumanMoves) {
    const played = await tryPlayRandomWhiteMove(page);
    if (!played) {
      await page.waitForTimeout(80);
      continue;
    }

    humanMoves += 1;

    await expect(page.locator('#eval-bar-wrap')).toBeVisible();
    await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);

    let thisTurnBlindBlackSquares = [];
    for (let sample = 0; sample < 12; sample += 1) {
      const phase = await page.evaluate(() => {
        const status = (document.querySelector('#status-text')?.textContent || '').toLowerCase();
        const dialogOpen = Boolean(document.querySelector('#game-result-dialog')?.hasAttribute('open'));
        return {
          thinking: status.includes('blindfish is thinking'),
          humanTurn: status.includes('your move'),
          dialogOpen
        };
      });

      if (phase.dialogOpen || phase.humanTurn) {
        break;
      }
      if (phase.thinking) {
        thisTurnBlindBlackSquares = await blindMarkedBlackSquares(page);
        if (thisTurnBlindBlackSquares.length > 0) {
          break;
        }
      }
      await page.waitForTimeout(15);
    }

    await page.waitForFunction(() => {
      const dialog = document.querySelector('#game-result-dialog');
      if (dialog && dialog.hasAttribute('open')) {
        return true;
      }
      const status = (document.querySelector('#status-text')?.textContent || '').toLowerCase();
      return status.includes('your move');
    });

    if (!(await resultDialog.isVisible()) && thisTurnBlindBlackSquares.length > 0) {
      const engineFromSquare = await lastEngineMoveFromSquare(page);
      if (engineFromSquare) {
        expect(thisTurnBlindBlackSquares).not.toContain(engineFromSquare);
        checkedEngineTurns += 1;
      }
    }
  }

  if (!(await resultDialog.isVisible())) {
    await primaryBtn.click();
  }

  await expect(resultDialog).toBeVisible();
  await expect(page.locator('#game-result-title')).toHaveText(/You (won|lost :\()|Draw!/);
  await expect(page.locator('#game-result-graph')).toBeVisible();
  await expect(page.locator('#new-game-btn')).toHaveText('New Game');
  await expect(moveRows).not.toHaveCount(0);
  await expect(page.locator('#game-result-target-line')).toHaveCount(0);
  expect(checkedEngineTurns).toBeGreaterThan(0);
});
