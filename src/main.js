import { createBoard } from './board.js';
import { createEngine } from './engine.js';
import { createGame } from './game.js';
import { chooseBlindfishMoveWithRetries } from './blindfish.js';

const GAME_MODE = {
  BLUNDERFISH: 'blunderfish',
  BLINDFISH: 'blindfish'
};

const BLUNDER_CHANCE_DEFAULT = 20;
const PIECE_BLINDNESS_DEFAULT = 10;
const BLINDNESS_MAX = 20;
const BLUNDER_MAX = 100;
const MAX_BLIND_RETRIES = 3;

const statusTextEl = document.querySelector('#status-text');
const boardEl = document.querySelector('#board');
const gameAppEl = document.querySelector('#game-app');
const newGameBtn = document.querySelector('#new-game-btn');
const flipBoardBtn = document.querySelector('#flip-board-btn');
const promotionDialog = document.querySelector('#promotion-dialog');
const promotionOptions = document.querySelector('#promotion-options');
const movesBody = document.querySelector('#moves-body');
const blunderSlider = document.querySelector('#blunder-slider');
const blunderInput = document.querySelector('#blunder-input');
const revealBlundersCheckbox = document.querySelector('#reveal-blunders');
const blindToYourPiecesCheckbox = document.querySelector('#blind-to-your-pieces');
const blindToOwnPiecesCheckbox = document.querySelector('#blind-to-own-pieces');
const neverBlindLastMovedCheckbox = document.querySelector('#never-blind-last-moved');
const settingLabelEl = document.querySelector('#setting-label');
const revealSettingLabelEl = document.querySelector('#reveal-setting-label');
const settingPercentSymbolEl = document.querySelector('#setting-percent-symbol');
const opponentCapturesEl = document.querySelector('#opponent-captures');
const yourCapturesEl = document.querySelector('#your-captures');
const opponentCaptureScoreEl = document.querySelector('#opponent-capture-score');
const yourCaptureScoreEl = document.querySelector('#your-capture-score');
const modeSelectScreenEl = document.querySelector('#mode-select-screen');
const setupScreenEl = document.querySelector('#setup-screen');
const modeBlunderfishBtn = document.querySelector('#mode-blunderfish-btn');
const modeBlindfishBtn = document.querySelector('#mode-blindfish-btn');
const modeSelectNoteEl = document.querySelector('#mode-select-note');
const setupTitleEl = document.querySelector('#setup-title');
const setupSubtitleEl = document.querySelector('#setup-subtitle');
const setupFirstGameHintEl = document.querySelector('#setup-first-game-hint');
const setupBlunderSettingsEl = document.querySelector('#setup-blunder-settings');
const setupBlindSettingsEl = document.querySelector('#setup-blind-settings');
const setupBlunderSliderEl = document.querySelector('#setup-blunder-slider');
const setupBlunderValueEl = document.querySelector('#setup-blunder-value');
const setupBlindSliderEl = document.querySelector('#setup-blind-slider');
const setupBlindValueEl = document.querySelector('#setup-blind-value');
const setupRevealBlundersEl = document.querySelector('#setup-reveal-blunders');
const setupBlindToYourPiecesEl = document.querySelector('#setup-blind-to-your-pieces');
const setupBlindToOwnPiecesEl = document.querySelector('#setup-blind-to-own-pieces');
const setupNeverBlindLastMovedEl = document.querySelector('#setup-never-blind-last-moved');
const setupRevealBlindnessEl = document.querySelector('#setup-reveal-blindness');
const setupColorSelectEl = document.querySelector('#setup-color-select');
const setupBackBtn = document.querySelector('#setup-back-btn');
const setupStartBtn = document.querySelector('#setup-start-btn');
const topbarTitleEl = document.querySelector('.topbar h1');
const subtitleEl = document.querySelector('.subtitle');

const game = createGame();
const engine = createEngine();

let activeMode = GAME_MODE.BLUNDERFISH;
let displayOrientation = 'w';
let searchToken = 0;
let thinking = false;
let pendingPromotion = null;
let lastMove = null;
let blunderChancePercent = BLUNDER_CHANCE_DEFAULT;
let pieceBlindnessPercent = PIECE_BLINDNESS_DEFAULT;
let computerMoveKinds = new Map();
let randomMoveHurts = new Map();
let revealEngineHints = true;
let neverBlindLastMovedPiece = true;
let preferredHumanColor = 'random';
let lastBoardTouchEndTs = 0;
let gameStarted = false;
let currentBlindSquares = new Set();
let blindSelectionTurnToken = 0;

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

function getSettingMax() {
  return activeMode === GAME_MODE.BLINDFISH ? BLINDNESS_MAX : BLUNDER_MAX;
}

function getCurrentSettingValue() {
  return activeMode === GAME_MODE.BLINDFISH ? pieceBlindnessPercent : blunderChancePercent;
}

function clampSettingValue(value) {
  if (Number.isNaN(value)) {
    return getCurrentSettingValue();
  }

  return Math.min(getSettingMax(), Math.max(0, Math.round(value)));
}

function setSettingControls(nextValue) {
  const value = clampSettingValue(nextValue);
  if (activeMode === GAME_MODE.BLINDFISH) {
    pieceBlindnessPercent = value;
  } else {
    blunderChancePercent = value;
  }

  blunderSlider.value = String(value);
  blunderInput.value = String(value);
}

function applyModeSettingsUi() {
  const isBlindfish = activeMode === GAME_MODE.BLINDFISH;

  settingLabelEl.textContent = isBlindfish
    ? 'Percentage of invisible pieces per turn'
    : 'Blunder Chance';
  revealSettingLabelEl.textContent = isBlindfish ? 'Reveal Blindness' : 'Reveal Blunders';
  settingPercentSymbolEl.hidden = false;
  blindToYourPiecesCheckbox.parentElement.hidden = !isBlindfish;
  blindToOwnPiecesCheckbox.parentElement.hidden = !isBlindfish;
  neverBlindLastMovedCheckbox.parentElement.hidden = !isBlindfish;
  topbarTitleEl.textContent = isBlindfish ? 'Blindfish' : 'Blunderfish';
  subtitleEl.textContent = isBlindfish
    ? 'Blindfish is max difficulty stockfish, but it evaluates positions while blind to selected pieces.'
    : 'Max difficulty stockfish but it is forced to randomly play blunders';

  blunderSlider.max = String(getSettingMax());
  blunderInput.max = String(getSettingMax());
  setSettingControls(isBlindfish ? pieceBlindnessPercent : blunderChancePercent);
}

function updateSetupPreviewValues() {
  setupBlunderValueEl.textContent = `${setupBlunderSliderEl.value}%`;
  setupBlindValueEl.textContent = `${setupBlindSliderEl.value}%`;
}

function showModeSelectionScreen() {
  modeSelectScreenEl.hidden = false;
  setupScreenEl.hidden = true;
}

function showSetupScreen(mode) {
  activeMode = mode;
  const isBlindfish = mode === GAME_MODE.BLINDFISH;

  setupTitleEl.textContent = isBlindfish ? 'Blindfish Settings' : 'Blunderfish Settings';
  setupSubtitleEl.textContent = isBlindfish
    ? 'Choose how Blindfish should forget pieces before the game starts.'
    : 'Choose how often Blunderfish should blunder before the game starts.';

  setupBlunderSettingsEl.hidden = isBlindfish;
  setupBlindSettingsEl.hidden = !isBlindfish;
  setupFirstGameHintEl.hidden = !isBlindfish;

  setupBlunderSliderEl.value = String(blunderChancePercent);
  setupBlindSliderEl.value = String(pieceBlindnessPercent);
  setupRevealBlundersEl.checked = revealEngineHints;
  setupBlindToYourPiecesEl.checked = blindToYourPiecesCheckbox.checked;
  setupBlindToOwnPiecesEl.checked = blindToOwnPiecesCheckbox.checked;
  setupNeverBlindLastMovedEl.checked = neverBlindLastMovedPiece;
  setupRevealBlindnessEl.checked = revealEngineHints;
  setupColorSelectEl.value = preferredHumanColor;
  updateSetupPreviewValues();

  modeSelectScreenEl.hidden = true;
  setupScreenEl.hidden = false;
}

function applySetupSelections() {
  preferredHumanColor = setupColorSelectEl.value;

  if (activeMode === GAME_MODE.BLINDFISH) {
    pieceBlindnessPercent = clampSettingValue(Number(setupBlindSliderEl.value));
    revealEngineHints = Boolean(setupRevealBlindnessEl.checked);
    blindToYourPiecesCheckbox.checked = Boolean(setupBlindToYourPiecesEl.checked);
    blindToOwnPiecesCheckbox.checked = Boolean(setupBlindToOwnPiecesEl.checked);
    neverBlindLastMovedPiece = Boolean(setupNeverBlindLastMovedEl.checked);
    neverBlindLastMovedCheckbox.checked = neverBlindLastMovedPiece;
    revealBlundersCheckbox.checked = revealEngineHints;
  } else {
    blunderChancePercent = clampSettingValue(Number(setupBlunderSliderEl.value));
    revealEngineHints = Boolean(setupRevealBlundersEl.checked);
    revealBlundersCheckbox.checked = revealEngineHints;
    blindToYourPiecesCheckbox.checked = true;
    blindToOwnPiecesCheckbox.checked = true;
    neverBlindLastMovedPiece = true;
    neverBlindLastMovedCheckbox.checked = true;
  }
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
    statusTextEl.textContent =
      activeMode === GAME_MODE.BLINDFISH ? 'Blindfish is thinking...' : 'Blunderfish is thinking...';
    return;
  }

  if (activeMode === GAME_MODE.BLUNDERFISH) {
    const lastMoveIndex = history.length - 1;
    const lastMoveKind = computerMoveKinds.get(lastMoveIndex);
    if (revealEngineHints && lastMoveKind === 'random') {
      if (randomMoveHurts.get(lastMoveIndex)) {
        statusTextEl.textContent =
          'Your move. Blunderfish is confused! Blunderfish hurt itself in its confusion!';
      } else {
        statusTextEl.textContent = 'Your move. Blunderfish is confused!';
      }
      return;
    }
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
  board.setBlindMarkers({
    squares: Array.from(currentBlindSquares),
    visible: activeMode === GAME_MODE.BLINDFISH && revealEngineHints
  });
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

    if (!isComputerMove || activeMode !== GAME_MODE.BLUNDERFISH || !revealEngineHints) {
      return move;
    }

    const kind = computerMoveKinds.get(index);
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

async function chooseBlindfishMove(tokenAtStart) {
  const humanColor = game.getHumanColor();
  const computerColor = oppositeColor(humanColor);
  const includeHumanPieces = Boolean(blindToYourPiecesCheckbox.checked);
  const includeComputerPieces = Boolean(blindToOwnPiecesCheckbox.checked);

  if (!includeHumanPieces && !includeComputerPieces) {
    currentBlindSquares = new Set();
    refresh();
    return engine.getBestMove(game.getFen(), 1500);
  }

  const position = game.getPosition();
  const eligibleSquares = Object.entries(position)
    .filter(([, piece]) => {
      if (!piece || piece.type === 'k') {
        return false;
      }
      if (piece.color === humanColor) {
        return includeHumanPieces;
      }
      if (piece.color === computerColor) {
        return includeComputerPieces;
      }
      return false;
    })
    .map(([square]) => square);

  const excludedSquare = neverBlindLastMovedPiece ? lastMove?.to : null;
  const eligibleSquaresFiltered = excludedSquare
    ? eligibleSquares.filter((square) => square !== excludedSquare)
    : eligibleSquares;

  const blindnessCount = Math.min(
    eligibleSquaresFiltered.length,
    Math.round((pieceBlindnessPercent / 100) * eligibleSquaresFiltered.length)
  );

  if (blindnessCount <= 0) {
    currentBlindSquares = new Set();
    refresh();
    return engine.getBestMove(game.getFen(), 1500);
  }

  const legalMoves = game.getAllLegalMoves();
  const candidateCeiling = Math.min(60, Math.max(10, legalMoves.length * 2));

  return chooseBlindfishMoveWithRetries({
    pieceBlindnessCount: blindnessCount,
    maxRetries: MAX_BLIND_RETRIES,
    movetimeMs: 1500,
    multiPv: candidateCeiling,
    selectBlindSquares: (count) =>
      game.selectBlindSquares(count, Math.random, {
        includeWhite:
          (includeHumanPieces && humanColor === 'w') || (includeComputerPieces && computerColor === 'w'),
        includeBlack:
          (includeHumanPieces && humanColor === 'b') || (includeComputerPieces && computerColor === 'b'),
        excludeSquares: excludedSquare ? [excludedSquare] : []
      }),
    buildBlindFen: (blindSquares) => game.buildBlindFen(blindSquares),
    getRankedMoves: (fen, options) => engine.getRankedMoves(fen, options),
    isLegalMove: (move) => game.isLegalMove(move),
    getAllLegalMoves: () => game.getAllLegalMoves(),
    onBlindSelection: (blindSquares) => {
      if (tokenAtStart !== searchToken) {
        return;
      }
      blindSelectionTurnToken += 1;
      currentBlindSquares = new Set(blindSquares);
      refresh();
    },
    shouldContinue: () => tokenAtStart === searchToken,
    rng: Math.random
  });
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
    const historyPlyIndex = game.getMoveHistory().length;
    const humanColor = game.getHumanColor();
    const computerColor = oppositeColor(humanColor);
    let selectedMove;
    let preScoreForComputer = null;

    if (activeMode === GAME_MODE.BLINDFISH) {
      selectedMove = await chooseBlindfishMove(tokenAtStart);
      if (!selectedMove) {
        refresh();
        return;
      }
      computerMoveKinds.set(historyPlyIndex, 'blind');
      randomMoveHurts.delete(historyPlyIndex);
    } else {
      const useRandomMove = Math.random() < blunderChancePercent / 100;

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

    if (tokenAtStart !== searchToken) {
      return;
    }

    const result = game.applyMove(selectedMove);
    if (result.ok) {
      lastMove = { from: selectedMove.from, to: selectedMove.to };
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
  currentBlindSquares = new Set();

  const humanColor =
    preferredHumanColor === 'random' ? randomColor() : preferredHumanColor;
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
  setSettingControls(Number(event.target.value));
});

blunderInput.addEventListener('input', (event) => {
  setSettingControls(Number(event.target.value));
});

blunderInput.addEventListener('blur', () => {
  setSettingControls(Number(blunderInput.value));
});

revealBlundersCheckbox.addEventListener('change', (event) => {
  revealEngineHints = Boolean(event.target.checked);
  refresh();
});

neverBlindLastMovedCheckbox.addEventListener('change', (event) => {
  neverBlindLastMovedPiece = Boolean(event.target.checked);
});

async function boot() {
  statusTextEl.textContent =
    activeMode === GAME_MODE.BLINDFISH ? 'Initializing Blindfish...' : 'Initializing Blunderfish...';

  applyModeSettingsUi();
  revealEngineHints = Boolean(revealBlundersCheckbox.checked);

  await engine.init();
  await engine.setSkillLevel(20);
  await startNewGame();
}

function setModeSelectionDisabled(disabled) {
  modeBlunderfishBtn.disabled = disabled;
  modeBlindfishBtn.disabled = disabled;
  setupStartBtn.disabled = disabled;
  setupBackBtn.disabled = disabled;
}

function showGameApp() {
  modeSelectScreenEl.hidden = true;
  setupScreenEl.hidden = true;
  gameAppEl.classList.remove('app-hidden');
}

async function launchMode(mode) {
  if (gameStarted) {
    return;
  }

  gameStarted = true;
  modeSelectNoteEl.textContent = '';
  setModeSelectionDisabled(true);
  applySetupSelections();
  showGameApp();

  try {
    await boot();
  } catch (error) {
    gameStarted = false;
    showModeSelectionScreen();
    gameAppEl.classList.add('app-hidden');
    setModeSelectionDisabled(false);
    statusTextEl.textContent = `Startup failed: ${error.message}`;
  }
}

setupBlunderSliderEl.addEventListener('input', updateSetupPreviewValues);
setupBlindSliderEl.addEventListener('input', updateSetupPreviewValues);

setupBackBtn.addEventListener('click', () => {
  showModeSelectionScreen();
});

setupStartBtn.addEventListener('click', async () => {
  await launchMode(activeMode);
});

modeBlindfishBtn.addEventListener('click', () => {
  showSetupScreen(GAME_MODE.BLINDFISH);
});

modeBlunderfishBtn.addEventListener('click', () => {
  showSetupScreen(GAME_MODE.BLUNDERFISH);
});
