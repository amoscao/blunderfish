import { createBoard } from './board.js';
import { createEngine } from './engine.js';
import { createGame } from './game.js';

const statusTextEl = document.querySelector('#status-text');
const boardEl = document.querySelector('#board');
const newGameBtn = document.querySelector('#new-game-btn');
const flipBoardBtn = document.querySelector('#flip-board-btn');
const promotionDialog = document.querySelector('#promotion-dialog');
const promotionOptions = document.querySelector('#promotion-options');

const game = createGame();
const engine = createEngine();

let displayOrientation = 'w';
let searchToken = 0;
let thinking = false;
let pendingPromotion = null;

const board = createBoard({
  container: boardEl,
  onHumanMoveAttempt: handleHumanMoveAttempt
});

function randomColor() {
  return Math.random() < 0.5 ? 'w' : 'b';
}

function colorName(color) {
  return color === 'w' ? 'White' : 'Black';
}

function statusReasonText(reason) {
  if (!reason) return '';

  switch (reason) {
    case 'checkmate':
      return 'Checkmate';
    case 'stalemate':
      return 'Stalemate';
    case 'threefold_repetition':
      return 'Draw by repetition';
    case 'insufficient_material':
      return 'Draw by insufficient material';
    case 'fifty_move_rule':
      return 'Draw by fifty-move rule';
    default:
      return 'Draw';
  }
}

function updateStatus() {
  const status = game.getGameStatus();
  const humanColor = game.getHumanColor();

  if (thinking) {
    statusTextEl.textContent = `You are ${colorName(humanColor)}. Stockfish is thinking...`;
    return;
  }

  if (status.over) {
    if (status.result === 'draw') {
      statusTextEl.textContent = `${statusReasonText(status.reason)}.`;
      return;
    }

    const winnerName = colorName(status.result);
    const youWon = status.result === humanColor;
    statusTextEl.textContent = `${winnerName} wins by ${status.reason}. ${youWon ? 'You win.' : 'You lose.'}`;
    return;
  }

  const turnText = game.getTurn() === humanColor ? 'Your move' : 'Stockfish to move';
  const checkText = status.check ? ' Check.' : '';
  statusTextEl.textContent = `You are ${colorName(humanColor)}. ${turnText}.${checkText}`;
}

function updateBoard() {
  board.render(game.getPosition(), displayOrientation);
  updateStatus();
}

function isHumanTurn() {
  return game.getTurn() === game.getHumanColor();
}

function canInteract() {
  return !thinking && !game.getGameStatus().over && isHumanTurn();
}

function updateInteractionMode() {
  board.setInteractionEnabled(canInteract());
}

function refresh() {
  board.setMoveQueryHandlers({
    canSelectSquare: (_square, piece) => {
      return canInteract() && piece.color === game.getHumanColor();
    },
    getLegalTargets: (square) => {
      if (!canInteract()) {
        return [];
      }

      return game.getLegalMoves(square).map((move) => move.to);
    }
  });

  updateInteractionMode();
  updateBoard();
}

function showPromotionPicker(color) {
  promotionOptions.innerHTML = '';

  const options = [
    { piece: 'q', label: 'Queen' },
    { piece: 'r', label: 'Rook' },
    { piece: 'b', label: 'Bishop' },
    { piece: 'n', label: 'Knight' }
  ];

  for (const option of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'promotion-piece';
    btn.setAttribute('aria-label', option.label);

    const img = document.createElement('img');
    img.src = `${import.meta.env.BASE_URL}assets/chess/${color}_${
      option.label.toLowerCase()
    }_png_128px.png`;
    img.alt = option.label;

    btn.appendChild(img);
    btn.addEventListener('click', () => {
      promotionDialog.close(option.piece);
    });
    promotionOptions.appendChild(btn);
  }

  promotionDialog.showModal();
}

async function askPromotion(color) {
  showPromotionPicker(color);

  const choice = await new Promise((resolve) => {
    const listener = () => {
      promotionDialog.removeEventListener('close', listener);
      resolve(promotionDialog.returnValue || 'q');
    };
    promotionDialog.addEventListener('close', listener);
  });

  return choice;
}

async function requestEngineMove() {
  if (game.getGameStatus().over || isHumanTurn()) {
    refresh();
    return;
  }

  const tokenAtStart = ++searchToken;
  thinking = true;
  refresh();

  try {
    const bestMove = await engine.getBestMove(game.getFen(), 1500);

    if (tokenAtStart !== searchToken) {
      return;
    }

    game.applyMove(bestMove);
  } catch (error) {
    statusTextEl.textContent = `Engine error: ${error.message}`;
  } finally {
    if (tokenAtStart === searchToken) {
      thinking = false;
      refresh();
    }
  }
}

async function handleHumanMoveAttempt({ from, to }) {
  if (!canInteract()) {
    return;
  }

  const result = game.applyMove({ from, to });
  if (result.needsPromotion) {
    pendingPromotion = { from, to };
    const promotion = await askPromotion(game.getHumanColor());
    const finalResult = game.applyMove({ ...pendingPromotion, promotion });
    pendingPromotion = null;

    if (!finalResult.ok) {
      refresh();
      return;
    }
  } else if (!result.ok) {
    refresh();
    return;
  }

  refresh();
  await requestEngineMove();
}

async function startNewGame() {
  searchToken += 1;
  thinking = false;
  pendingPromotion = null;

  const humanColor = randomColor();
  game.newGame(humanColor);

  displayOrientation = humanColor;

  await engine.newGame();
  refresh();

  if (!isHumanTurn()) {
    await requestEngineMove();
  }
}

newGameBtn.addEventListener('click', () => {
  startNewGame();
});

flipBoardBtn.addEventListener('click', () => {
  displayOrientation = displayOrientation === 'w' ? 'b' : 'w';
  refresh();
});

async function boot() {
  statusTextEl.textContent = 'Initializing Stockfish...';

  await engine.init();
  await engine.setSkillLevel(20);
  await startNewGame();
}

boot().catch((error) => {
  statusTextEl.textContent = `Startup failed: ${error.message}`;
});
