import { createBoard } from './board.js';
import { createEngine } from './engine.js';
import { createGame } from './game.js';

const statusTextEl = document.querySelector('#status-text');
const boardEl = document.querySelector('#board');
const newGameBtn = document.querySelector('#new-game-btn');
const flipBoardBtn = document.querySelector('#flip-board-btn');
const promotionDialog = document.querySelector('#promotion-dialog');
const promotionOptions = document.querySelector('#promotion-options');
const movesBody = document.querySelector('#moves-body');
const blunderSlider = document.querySelector('#blunder-slider');
const blunderInput = document.querySelector('#blunder-input');
const revealBlundersCheckbox = document.querySelector('#reveal-blunders');
const opponentCapturesEl = document.querySelector('#opponent-captures');
const yourCapturesEl = document.querySelector('#your-captures');
const opponentCaptureScoreEl = document.querySelector('#opponent-capture-score');
const yourCaptureScoreEl = document.querySelector('#your-capture-score');

const game = createGame();
const engine = createEngine();

let displayOrientation = 'w';
let searchToken = 0;
let thinking = false;
let pendingPromotion = null;
let lastMove = null;
let blunderChancePercent = 20;
let computerMoveKinds = new Map();
let randomMoveHurts = new Map();
let revealBlunders = true;
let lastBoardTouchEndTs = 0;

const PIECE_ORDER = ['p', 'b', 'n', 'r', 'q'];
const PIECE_VALUES = { p: 1, b: 3, n: 3, r: 5, q: 9 };
const STARTING_COUNTS = { p: 8, b: 2, n: 2, r: 2, q: 1 };
const CONFUSION_HURT_THRESHOLD_CP = 300;

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

function oppositeColor(color) {
  return color === 'w' ? 'b' : 'w';
}

function scoreToColorPerspective(score, scoreSideToMove, targetColor) {
  const multiplier = scoreSideToMove === targetColor ? 1 : -1;
  return {
    type: score.type,
    value: score.value * multiplier
  };
}

function scoreToComparableCp(score) {
  if (score.type === 'cp') {
    return score.value;
  }

  // Mate scores dominate any centipawn estimate.
  return score.value > 0 ? 100000 : -100000;
}

function randomMoveHurtItself(preScoreForComputer, postScoreForComputer) {
  const preLosingMate = preScoreForComputer.type === 'mate' && preScoreForComputer.value < 0;
  const postLosingMate = postScoreForComputer.type === 'mate' && postScoreForComputer.value < 0;
  if (!preLosingMate && postLosingMate) {
    return true;
  }

  const preComparable = scoreToComparableCp(preScoreForComputer);
  const postComparable = scoreToComparableCp(postScoreForComputer);
  return preComparable - postComparable >= CONFUSION_HURT_THRESHOLD_CP;
}

function pieceImageName(color, type) {
  const nameByType = {
    p: 'pawn',
    b: 'bishop',
    n: 'knight',
    r: 'rook',
    q: 'queen'
  };
  return `${color}_${nameByType[type]}_png_128px.png`;
}

function clampBlunderChance(value) {
  if (Number.isNaN(value)) {
    return blunderChancePercent;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

function setBlunderControls(nextValue) {
  blunderChancePercent = clampBlunderChance(nextValue);
  blunderSlider.value = String(blunderChancePercent);
  blunderInput.value = String(blunderChancePercent);
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
  const history = game.getMoveHistory();

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

  const isHumanToMove = game.getTurn() === humanColor;
  const isOpeningWhiteTurn = humanColor === 'w' && isHumanToMove && history.length === 0;

  if (isOpeningWhiteTurn) {
    statusTextEl.textContent = 'You are White. Your Move.';
    return;
  }

  if (!isHumanToMove) {
    statusTextEl.textContent = 'Blunderfish is thinking...';
    return;
  }

  const lastMoveIndex = history.length - 1;
  const lastMoveKind = computerMoveKinds.get(lastMoveIndex);
  if (revealBlunders && lastMoveKind === 'random') {
    if (randomMoveHurts.get(lastMoveIndex)) {
      statusTextEl.textContent =
        'Your move. Blunderfish is confused! Blunderfish hurt itself in its confusion! 😖';
    } else {
      statusTextEl.textContent = 'Your move. Blunderfish is confused! 🎲';
    }
    return;
  }

  statusTextEl.textContent = 'Your move.';
}

function updateBoard() {
  const status = game.getGameStatus();
  const kingOutcome =
    status.over && status.reason === 'checkmate'
      ? {
          w: status.result === 'w' ? 'win' : 'loss',
          b: status.result === 'b' ? 'win' : 'loss'
        }
      : status.over && status.result === 'draw'
        ? { w: 'draw', b: 'draw' }
        : { w: null, b: null };

  board.setLastMove(lastMove);
  board.setKingOutcome(kingOutcome);
  board.render(game.getPosition(), displayOrientation);
  updateStatus();
}

function updateMovesTable() {
  const history = game.getMoveHistory();
  movesBody.innerHTML = '';
  const lastMoveIndex = history.length - 1;
  const computerColor = oppositeColor(game.getHumanColor());

  function formatMove(index) {
    const move = history[index] || '';
    const isComputerMove =
      (computerColor === 'w' && index % 2 === 0) || (computerColor === 'b' && index % 2 === 1);
    if (!isComputerMove) {
      return move;
    }

    const kind = computerMoveKinds.get(index);
    if (!revealBlunders) {
      return move;
    }
    if (kind === 'engine') {
      return `${move} 🧠`;
    }
    if (kind === 'random') {
      return `${move} 🎲`;
    }
    return move;
  }

  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement('tr');
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = formatMove(i);
    const blackMove = i + 1 < history.length ? formatMove(i + 1) : '';
    const whiteClass = i === lastMoveIndex ? ' class="latest-move-cell"' : '';
    const blackClass = i + 1 === lastMoveIndex ? ' class="latest-move-cell"' : '';

    row.innerHTML = `<td>${moveNumber}.</td><td${whiteClass}>${whiteMove}</td><td${blackClass}>${blackMove}</td>`;
    movesBody.appendChild(row);
  }
}

function calculateCapturedPiecesByColor(positionBySquare) {
  const counts = {
    w: { p: 0, b: 0, n: 0, r: 0, q: 0 },
    b: { p: 0, b: 0, n: 0, r: 0, q: 0 }
  };

  for (const piece of Object.values(positionBySquare)) {
    if (!counts[piece.color] || !(piece.type in counts[piece.color])) {
      continue;
    }
    counts[piece.color][piece.type] += 1;
  }

  return {
    w: {
      p: STARTING_COUNTS.p - counts.w.p,
      b: STARTING_COUNTS.b - counts.w.b,
      n: STARTING_COUNTS.n - counts.w.n,
      r: STARTING_COUNTS.r - counts.w.r,
      q: STARTING_COUNTS.q - counts.w.q
    },
    b: {
      p: STARTING_COUNTS.p - counts.b.p,
      b: STARTING_COUNTS.b - counts.b.b,
      n: STARTING_COUNTS.n - counts.b.n,
      r: STARTING_COUNTS.r - counts.b.r,
      q: STARTING_COUNTS.q - counts.b.q
    }
  };
}

function renderCaptureIcons(container, capturedCounts, capturedColor) {
  container.innerHTML = '';

  for (const type of PIECE_ORDER) {
    const count = capturedCounts[type];
    for (let i = 0; i < count; i += 1) {
      const img = document.createElement('img');
      img.className = 'capture-piece';
      img.src = `${import.meta.env.BASE_URL}assets/chess/${pieceImageName(capturedColor, type)}`;
      img.alt = `${capturedColor === 'w' ? 'white' : 'black'} ${type}`;
      container.appendChild(img);
    }
  }
}

function capturedValueSum(capturedCounts) {
  return PIECE_ORDER.reduce((total, type) => total + capturedCounts[type] * PIECE_VALUES[type], 0);
}

function formatSignedScore(score) {
  return score >= 0 ? `+${score}` : `${score}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateCapturesPanel() {
  const position = game.getPosition();
  const humanColor = game.getHumanColor();
  const opponentColor = oppositeColor(humanColor);
  const capturedByColor = calculateCapturedPiecesByColor(position);

  const opponentCaptures = capturedByColor[humanColor];
  const yourCaptures = capturedByColor[opponentColor];

  renderCaptureIcons(opponentCapturesEl, opponentCaptures, humanColor);
  renderCaptureIcons(yourCapturesEl, yourCaptures, opponentColor);

  const opponentValue = capturedValueSum(opponentCaptures);
  const yourValue = capturedValueSum(yourCaptures);
  const delta = yourValue - opponentValue;

  opponentCaptureScoreEl.textContent = formatSignedScore(-delta);
  yourCaptureScoreEl.textContent = formatSignedScore(delta);
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
  updateCapturesPanel();
  updateMovesTable();
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
    const useRandomMove = Math.random() < blunderChancePercent / 100;
    const historyPlyIndex = game.getMoveHistory().length;
    const humanColor = game.getHumanColor();
    const computerColor = oppositeColor(humanColor);
    let selectedMove;
    let preScoreForComputer = null;

    if (useRandomMove) {
      const preScoreRaw = await engine.analyzePosition(game.getFen(), 350);
      preScoreForComputer = scoreToColorPerspective(preScoreRaw, computerColor, computerColor);

      const legalMoves = game.getAllLegalMoves();
      if (legalMoves.length === 0) {
        refresh();
        return;
      }
      const choiceIndex = Math.floor(Math.random() * legalMoves.length);
      selectedMove = legalMoves[choiceIndex];
      await sleep(1500);
    } else {
      selectedMove = await engine.getBestMove(game.getFen(), 1500);
    }

    if (tokenAtStart !== searchToken) {
      return;
    }

    const result = game.applyMove(selectedMove);
    if (result.ok) {
      lastMove = { from: selectedMove.from, to: selectedMove.to };
      computerMoveKinds.set(historyPlyIndex, useRandomMove ? 'random' : 'engine');

      if (useRandomMove && preScoreForComputer) {
        const postScoreRaw = await engine.analyzePosition(game.getFen(), 350);
        const postScoreForComputer = scoreToColorPerspective(postScoreRaw, humanColor, computerColor);
        randomMoveHurts.set(
          historyPlyIndex,
          randomMoveHurtItself(preScoreForComputer, postScoreForComputer)
        );
      } else {
        randomMoveHurts.delete(historyPlyIndex);
      }
    }
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
    lastMove = { from, to };
  } else if (!result.ok) {
    refresh();
    return;
  } else {
    lastMove = { from, to };
  }

  refresh();
  await requestEngineMove();
}

async function startNewGame() {
  searchToken += 1;
  thinking = false;
  pendingPromotion = null;
  lastMove = null;
  computerMoveKinds = new Map();
  randomMoveHurts = new Map();

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

boardEl.addEventListener(
  'touchend',
  (event) => {
    if (event.touches.length > 0) {
      return;
    }

    const now = Date.now();
    if (now - lastBoardTouchEndTs < 300) {
      event.preventDefault();
    }
    lastBoardTouchEndTs = now;
  },
  { passive: false }
);

blunderSlider.addEventListener('input', (event) => {
  setBlunderControls(Number(event.target.value));
});

blunderInput.addEventListener('input', (event) => {
  setBlunderControls(Number(event.target.value));
});

blunderInput.addEventListener('blur', () => {
  setBlunderControls(Number(blunderInput.value));
});

revealBlundersCheckbox.addEventListener('change', (event) => {
  revealBlunders = Boolean(event.target.checked);
  updateMovesTable();
});

async function boot() {
  statusTextEl.textContent = 'Initializing Stockfish...';
  setBlunderControls(20);
  revealBlunders = Boolean(revealBlundersCheckbox.checked);

  await engine.init();
  await engine.setSkillLevel(20);
  await startNewGame();
}

boot().catch((error) => {
  statusTextEl.textContent = `Startup failed: ${error.message}`;
});
