import { expect, test } from '@playwright/test';

// NOTE: This spec intentionally uses random human moves.
// It is expected to remain stable because random play is overwhelmingly likely
// to lose against Stockfish-strength play in this mode.

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

async function tryPlayRandomWhiteMoveByClick(page) {
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

async function tryPlayRandomWhiteMoveByDrag(page) {
  const fromSquares = shuffled(await whitePieceSquares(page));

  for (const from of fromSquares) {
    const piece = page.locator(`[data-square="${from}"] .piece`);
    const pieceBox = await piece.boundingBox();
    if (!pieceBox) {
      continue;
    }

    const startX = pieceBox.x + pieceBox.width / 2;
    const startY = pieceBox.y + pieceBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 12, startY, { steps: 4 });

    const targets = await legalTargetSquares(page);
    if (targets.length === 0) {
      await page.mouse.up();
      continue;
    }

    const to = targets[Math.floor(Math.random() * targets.length)];
    const targetSquare = page.locator(`[data-square="${to}"]`);
    const targetBox = await targetSquare.boundingBox();

    if (!targetBox) {
      await page.mouse.up();
      continue;
    }

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10
    });
    await page.mouse.up();
    return true;
  }

  return false;
}

async function startRandomWhiteBlunderfishGame(page) {
  await page.goto('/?engineMovetimeMs=50');
  await page.getByRole('button', { name: 'Blunderfish' }).click();
  await page.getByLabel('Play as').selectOption('w');
  await page.getByRole('button', { name: 'Start Game' }).click();
}

async function expectRandomWhiteLoss(page, tryPlayMove) {
  const resultDialog = page.locator('#game-result-dialog');
  const moveRows = page.locator('#moves-body tr');

  await expect(page.locator('#game-app')).toBeVisible();
  await expect(page.locator('#new-game-btn')).toHaveText('Forfeit');
  await expect(page.locator('#eval-bar-wrap')).toBeVisible();
  await expect(page.locator('#eval-bar-label')).toHaveText(EVAL_LABEL_PATTERN);

  let humanMoves = 0;
  const maxHumanMoves = 120;

  while (!(await resultDialog.isVisible()) && humanMoves < maxHumanMoves) {
    const played = await tryPlayMove(page);
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
}

test('plays a full random white game to a losing end-game modal using click input', async ({
  page
}) => {
  test.setTimeout(120000);

  await startRandomWhiteBlunderfishGame(page);
  await expectRandomWhiteLoss(page, tryPlayRandomWhiteMoveByClick);
});

test('plays a full random white game to a losing end-game modal using drag input', async ({
  page
}) => {
  test.setTimeout(120000);

  await startRandomWhiteBlunderfishGame(page);
  await expectRandomWhiteLoss(page, tryPlayRandomWhiteMoveByDrag);
});
