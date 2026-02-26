import { createBoard } from './board.js';
import { createEngine } from './engine.js';
import { createGame } from './game.js';
import { chooseBlindfishMoveWithRetries } from './blindfish.js';
import { createBlunderDecisionSmoother } from './blunder-smoother.js';
import { formatEvalLabel, scoreToWhitePercent } from './eval-bar.js';
import {
  buildAxisTicks,
  buildPolylinePoints,
  computeSymmetricYRange,
  sanitizeCpForGraph
} from './eval-graph.js';
import {
  RAMP_DEFAULT_FINAL_MOVE,
  RAMP_TARGET_CP_MAX,
  RAMP_TARGET_CP_MIN,
  clampFinalMove,
  computeTargetEvalCp
} from './rampfish.js';

const GAME_MODE = {
  BLUNDERFISH: 'blunderfish',
  BLINDFISH: 'blindfish',
  RAMPFISH: 'rampfish'
};

const BLUNDER_CHANCE_DEFAULT = 20;
const PIECE_BLINDNESS_DEFAULT = 10;
const BLINDNESS_MAX = 20;
const BLUNDER_MAX = 100;
const MAX_BLIND_RETRIES = 3;
const RAMP_MAX_SKILL_LEVEL = 20;
const RAMP_MAX_MOVETIME_MS = 1500;

const statusTextEl = document.querySelector('#status-text');
const boardEl = document.querySelector('#board');
const boardWrapEl = document.querySelector('.board-wrap');
const rightColumnEl = document.querySelector('.right-column');
const gameAppEl = document.querySelector('#game-app');
const newGameBtn = document.querySelector('#new-game-btn');
const flipBoardBtn = document.querySelector('#flip-board-btn');
const exportFenBtn = document.querySelector('#export-fen-btn');
const promotionDialog = document.querySelector('#promotion-dialog');
const promotionOptions = document.querySelector('#promotion-options');
const movesBody = document.querySelector('#moves-body');
const movesTableWrapEl = document.querySelector('.moves-table-wrap');
const blunderSlider = document.querySelector('#blunder-slider');
const blunderInput = document.querySelector('#blunder-input');
const revealBlundersCheckbox = document.querySelector('#reveal-blunders');
const showEvalBarCheckbox = document.querySelector('#show-eval-bar');
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
const modeRampfishBtn = document.querySelector('#mode-rampfish-btn');
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
const settingRowEl = blunderSlider.parentElement;
const revealSettingCheckboxEl = revealBlundersCheckbox.parentElement;
const rampReadonlySettingsEl = document.querySelector('#ramp-readonly-settings');
const rampTargetCpValueEl = document.querySelector('#ramp-target-cp-value');
const evalBarWrapEl = document.querySelector('#eval-bar-wrap');
const evalBarWhiteFillEl = document.querySelector('#eval-bar-white-fill');
const evalBarLabelEl = document.querySelector('#eval-bar-label');
const gameResultDialogEl = document.querySelector('#game-result-dialog');
const gameResultTitleEl = document.querySelector('#game-result-title');
const gameResultCloseBtnEl = document.querySelector('#game-result-close-btn');
const gameResultGraphEl = document.querySelector('#game-result-graph');
const gameResultXLabelEl = document.querySelector('#game-result-graph-x-label');
const gameResultYLabelEl = document.querySelector('#game-result-graph-y-label');
const gameResultMainMenuBtnEl = document.querySelector('#game-result-main-menu-btn');
const gameResultRematchBtnEl = document.querySelector('#game-result-rematch-btn');

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
let showEvalBar = false;
let neverBlindLastMovedPiece = true;
let preferredHumanColor = 'random';
let rampFinalMove = RAMP_DEFAULT_FINAL_MOVE;
let computerEngineTurnCount = 0;
let lastRampTargetCp = computeTargetEvalCp({
  engineTurnIndex: 1,
  finalMove: rampFinalMove
});
let lastBoardTouchEndTs = 0;
let gameStarted = false;
let currentBlindSquares = new Set();
let blindSelectionTurnToken = 0;
let evalScoreForWhite = { type: 'cp', value: 0 };
let lastEvaluatedFen = null;
let evalAnalysisBusy = false;
let evalAnalysisToken = 0;
let postGameModalOpen = false;
let gameConcluded = false;
let forcedGameStatus = null;
let evalHistoryHuman = [];
let evalHistoryQueue = [];
let evalHistoryBusy = false;
let evalHistoryBusyToken = 0;
const blunderDecisionSmoother = createBlunderDecisionSmoother();

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

function getEffectiveGameStatus() {
  return forcedGameStatus || game.getGameStatus();
}

function parseFenTurn(fen) {
  const tokens = String(fen || '').trim().split(/\s+/);
  return tokens[1] === 'b' ? 'b' : 'w';
}

function updatePrimaryTopRightButton() {
  const status = getEffectiveGameStatus();
  newGameBtn.textContent = gameStarted && !status.over && !gameConcluded ? 'Forfeit' : 'New Game';
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

function scoreToColorPerspective(score, scoreSideToMove, targetColor) {
  const multiplier = scoreSideToMove === targetColor ? 1 : -1;
  return {
    type: score.type,
    value: score.value * multiplier
  };
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

function scoreToComparableCp(score) {
  if (score.type === 'cp') {
    return score.value;
  }

  return score.value > 0 ? 100000 : -100000;
}

function outcomeTitleText(status) {
  if (status.result === 'draw') {
    return 'Draw!';
  }
  return status.result === game.getHumanColor() ? 'You won!' : 'You lost :(';
}

function mapPlotX(ply, maxPly, width) {
  if (maxPly <= 0) {
    return 0;
  }
  return (ply / maxPly) * width;
}

function mapPlotY(cp, minCp, maxCp, height) {
  const span = Math.max(1, maxCp - minCp);
  return ((maxCp - cp) / span) * height;
}

function renderGameResultGraph(history) {
  if (!gameResultGraphEl) {
    return;
  }

  const width = 680;
  const height = 280;
  const margin = { left: 62, right: 22, top: 18, bottom: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const samples = history.length > 0 ? history : [{ ply: 0, cp: 0 }];
  const yRange = computeSymmetricYRange(samples.map((sample) => sample.cp));
  const maxPly = Math.max(0, ...samples.map((sample) => sample.ply));
  const ticks = buildAxisTicks(maxPly, yRange);
  const polylinePoints = buildPolylinePoints(
    samples.map((sample) => ({ ply: sample.ply, cp: sample.cp })),
    { width: plotWidth, height: plotHeight },
    yRange
  );
  const yZero = mapPlotY(0, yRange.minCp, yRange.maxCp, plotHeight) + margin.top;

  const xTickMarkup = ticks.xTicks
    .map((tick) => {
      const x = mapPlotX(tick.value, maxPly, plotWidth) + margin.left;
      return `<g>
  <line x1="${x.toFixed(2)}" y1="${margin.top + plotHeight}" x2="${x.toFixed(
        2
      )}" y2="${(margin.top + plotHeight + 5).toFixed(2)}" stroke="#8d7460" />
  <text x="${x.toFixed(2)}" y="${(height - 12).toFixed(2)}" fill="#dbc7af" font-size="12" text-anchor="${
        tick.value === 0 ? 'start' : 'end'
      }">${tick.label}</text>
</g>`;
    })
    .join('');

  const yTickMarkup = ticks.yTicks
    .map((tick) => {
      const y = mapPlotY(tick.value, yRange.minCp, yRange.maxCp, plotHeight) + margin.top;
      return `<g>
  <line x1="${(margin.left - 5).toFixed(2)}" y1="${y.toFixed(2)}" x2="${margin.left.toFixed(
        2
      )}" y2="${y.toFixed(2)}" stroke="#8d7460" />
  <text x="${(margin.left - 9).toFixed(2)}" y="${(y + 4).toFixed(
        2
      )}" fill="#dbc7af" font-size="12" text-anchor="end">${tick.label}</text>
</g>`;
    })
    .join('');

  const shouldShowTargetLine = activeMode === GAME_MODE.RAMPFISH;
  let targetLineMarkup = '';
  let targetLegendMarkup = '';
  if (shouldShowTargetLine) {
    const startEngineCp = RAMP_TARGET_CP_MIN;
    const endEngineCp = RAMP_TARGET_CP_MAX;
    const startHumanCp = Math.max(yRange.minCp, Math.min(yRange.maxCp, -startEngineCp));
    const endHumanCp = Math.max(yRange.minCp, Math.min(yRange.maxCp, -endEngineCp));
    const y1 = mapPlotY(startHumanCp, yRange.minCp, yRange.maxCp, plotHeight) + margin.top;
    const y2 = mapPlotY(endHumanCp, yRange.minCp, yRange.maxCp, plotHeight) + margin.top;
    const x1 = margin.left;
    const x2 = margin.left + plotWidth;
    const legendX = margin.left + plotWidth - 130;
    const legendY = margin.top + 14;

    targetLineMarkup = `<line id="game-result-target-line" x1="${x1.toFixed(2)}" y1="${y1.toFixed(
      2
    )}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#e05252" stroke-width="2"></line>`;
    targetLegendMarkup = `<g id="game-result-target-legend">
  <line x1="${legendX.toFixed(2)}" y1="${legendY.toFixed(2)}" x2="${(legendX + 22).toFixed(
      2
    )}" y2="${legendY.toFixed(2)}" stroke="#e05252" stroke-width="2"></line>
  <text x="${(legendX + 28).toFixed(2)}" y="${(legendY + 4).toFixed(
      2
    )}" fill="#e8c1c1" font-size="12" text-anchor="start">Target Eval</text>
</g>`;
  }

  gameResultGraphEl.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#171310"></rect>
    <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${
      margin.top + plotHeight
    }" stroke="#8d7460" stroke-width="1"></line>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" stroke="#8d7460" stroke-width="1"></line>
    <line x1="${margin.left}" y1="${yZero.toFixed(2)}" x2="${margin.left + plotWidth}" y2="${yZero.toFixed(
      2
    )}" stroke="#4c677d" stroke-width="1" stroke-dasharray="4 4"></line>
    ${xTickMarkup}
    ${yTickMarkup}
    ${targetLineMarkup}
    ${targetLegendMarkup}
    <g transform="translate(${margin.left}, ${margin.top})">
      <polyline fill="none" stroke="#d7a86e" stroke-width="2" points="${polylinePoints}"></polyline>
    </g>
  `;
}

function openGameResultModal(status) {
  if (!gameResultDialogEl || !gameResultTitleEl) {
    return;
  }

  gameResultTitleEl.textContent = outcomeTitleText(status);
  if (gameResultXLabelEl) {
    gameResultXLabelEl.textContent = 'Half-move (ply)';
  }
  if (gameResultYLabelEl) {
    gameResultYLabelEl.textContent = 'Eval (pawns, human perspective)';
  }
  renderGameResultGraph(evalHistoryHuman);
  if (!gameResultDialogEl.open) {
    if (typeof gameResultDialogEl.showModal === 'function') {
      gameResultDialogEl.showModal();
    } else {
      gameResultDialogEl.setAttribute('open', '');
    }
  }
  postGameModalOpen = true;
}

function closeGameResultModal() {
  if (!gameResultDialogEl) {
    return;
  }
  if (gameResultDialogEl.open) {
    if (typeof gameResultDialogEl.close === 'function') {
      gameResultDialogEl.close();
    } else {
      gameResultDialogEl.removeAttribute('open');
    }
  }
  postGameModalOpen = false;
}

function queueEvalSampleForCurrentPosition() {
  const fen = game.getFen();
  const ply = game.getMoveHistory().length;
  const latestCommitted = evalHistoryHuman[evalHistoryHuman.length - 1];
  const latestQueued = evalHistoryQueue[evalHistoryQueue.length - 1];
  if (
    (latestCommitted && latestCommitted.ply === ply && latestCommitted.fen === fen) ||
    (latestQueued && latestQueued.ply === ply && latestQueued.fen === fen)
  ) {
    return;
  }

  evalHistoryQueue.push({ ply, fen });
}

function processEvalHistoryQueue() {
  if (
    thinking ||
    evalHistoryBusy ||
    evalAnalysisBusy ||
    evalHistoryQueue.length === 0 ||
    (!isHumanTurn() && !getEffectiveGameStatus().over)
  ) {
    return;
  }

  const next = evalHistoryQueue.shift();
  if (!next) {
    return;
  }

  const token = ++evalHistoryBusyToken;
  evalHistoryBusy = true;
  const humanColor = game.getHumanColor();

  engine
    .analyzePosition(next.fen, 180)
    .then((rawScore) => {
      if (token !== evalHistoryBusyToken) {
        return;
      }
      const scoreForHuman = scoreToColorPerspective(rawScore, parseFenTurn(next.fen), humanColor);
      const nextSample = { ply: next.ply, cp: sanitizeCpForGraph(scoreForHuman), fen: next.fen };
      const existingIndex = evalHistoryHuman.findIndex((sample) => sample.ply === next.ply);
      if (existingIndex >= 0) {
        evalHistoryHuman[existingIndex] = nextSample;
      } else {
        evalHistoryHuman.push(nextSample);
        evalHistoryHuman.sort((a, b) => a.ply - b.ply);
      }
      if (postGameModalOpen) {
        renderGameResultGraph(evalHistoryHuman);
      }
      if (showEvalBar && next.fen === game.getFen()) {
        evalScoreForWhite = scoreToColorPerspective(rawScore, parseFenTurn(next.fen), 'w');
        lastEvaluatedFen = next.fen;
        renderEvalBar();
      }
    })
    .catch(() => {})
    .finally(() => {
      if (token !== evalHistoryBusyToken) {
        return;
      }
      evalHistoryBusy = false;
      processEvalHistoryQueue();
    });
}

function renderEvalBar() {
  evalBarWrapEl.hidden = !showEvalBar;
  if (!showEvalBar) {
    return;
  }

  const whitePct = scoreToWhitePercent(evalScoreForWhite);
  evalBarWhiteFillEl.style.width = `${whitePct}%`;
  const scoreForHuman = scoreToColorPerspective(evalScoreForWhite, 'w', game.getHumanColor());
  evalBarLabelEl.textContent = formatEvalLabel(scoreForHuman);
}

function scheduleEvalBarAnalysis() {
  if (
    !showEvalBar ||
    thinking ||
    !isHumanTurn() ||
    getEffectiveGameStatus().over ||
    evalHistoryBusy ||
    evalHistoryQueue.length > 0
  ) {
    return;
  }

  const fen = game.getFen();
  if (evalAnalysisBusy || fen === lastEvaluatedFen) {
    return;
  }

  const analysisToken = ++evalAnalysisToken;
  evalAnalysisBusy = true;

  engine
    .analyzePosition(fen, 350)
    .then((rawScore) => {
      if (analysisToken !== evalAnalysisToken) {
        return;
      }
      evalScoreForWhite = scoreToColorPerspective(rawScore, game.getTurn(), 'w');
      lastEvaluatedFen = fen;
      renderEvalBar();
    })
    .catch(() => {})
    .finally(() => {
      if (analysisToken !== evalAnalysisToken) {
        return;
      }
      evalAnalysisBusy = false;
      if (showEvalBar && !thinking && isHumanTurn() && game.getFen() !== lastEvaluatedFen) {
        scheduleEvalBarAnalysis();
      }
    });
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
  if (activeMode === GAME_MODE.BLINDFISH) {
    return BLINDNESS_MAX;
  }
  if (activeMode === GAME_MODE.RAMPFISH) {
    return 0;
  }
  return BLUNDER_MAX;
}

function getCurrentSettingValue() {
  if (activeMode === GAME_MODE.BLINDFISH) {
    return pieceBlindnessPercent;
  }
  if (activeMode === GAME_MODE.RAMPFISH) {
    return 0;
  }
  return blunderChancePercent;
}

function clampSettingValue(value) {
  if (Number.isNaN(value)) {
    return getCurrentSettingValue();
  }

  return Math.min(getSettingMax(), Math.max(0, Math.round(value)));
}

function setSettingControls(nextValue) {
  if (activeMode === GAME_MODE.RAMPFISH) {
    return;
  }

  const value = clampSettingValue(nextValue);
  if (activeMode === GAME_MODE.BLINDFISH) {
    pieceBlindnessPercent = value;
  } else {
    blunderChancePercent = value;
    blunderDecisionSmoother.reset();
  }

  blunderSlider.value = String(value);
  blunderInput.value = String(value);
}

function colorLabel(color) {
  return color === 'w' ? 'White' : 'Black';
}

function formatTargetEvalWinnerCentric(cp) {
  const engineColor = oppositeColor(game.getHumanColor());
  const magnitude = (Math.abs(cp) / 100).toFixed(2);
  if (cp === 0) {
    return `Equal ${magnitude}`;
  }

  const winningColor = cp > 0 ? engineColor : oppositeColor(engineColor);
  return `${colorLabel(winningColor)} +${magnitude}`;
}

function updateRampReadonlyDisplay() {
  rampTargetCpValueEl.textContent = formatTargetEvalWinnerCentric(lastRampTargetCp);
}

function applyModeSettingsUi() {
  const isBlindfish = activeMode === GAME_MODE.BLINDFISH;
  const isRampfish = activeMode === GAME_MODE.RAMPFISH;

  settingLabelEl.textContent = isRampfish
    ? 'Clapbackfish controls'
    : isBlindfish
    ? 'Percentage of invisible pieces per turn'
    : 'Blunder Chance';
  revealSettingLabelEl.textContent = isBlindfish ? 'Reveal Blindness' : 'Reveal Blunders';
  settingPercentSymbolEl.hidden = isRampfish;
  settingLabelEl.hidden = isRampfish;
  settingRowEl.hidden = isRampfish;
  revealSettingCheckboxEl.hidden = isRampfish;
  blindToYourPiecesCheckbox.parentElement.hidden = !isBlindfish;
  blindToOwnPiecesCheckbox.parentElement.hidden = !isBlindfish;
  neverBlindLastMovedCheckbox.parentElement.hidden = !isBlindfish;
  rampReadonlySettingsEl.hidden = !isRampfish;
  topbarTitleEl.textContent = isRampfish ? 'Clapbackfish' : isBlindfish ? 'Blindfish' : 'Blunderfish';
  subtitleEl.textContent = isRampfish
    ? 'Makes the comeback of the century.'
    : isBlindfish
    ? 'Blindfish is max difficulty stockfish, but it evaluates positions while blind to selected pieces.'
    : 'Max difficulty stockfish but it is forced to randomly play blunders';

  if (!isRampfish) {
    blunderSlider.max = String(getSettingMax());
    blunderInput.max = String(getSettingMax());
    setSettingControls(isBlindfish ? pieceBlindnessPercent : blunderChancePercent);
  }

  updateRampReadonlyDisplay();
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
  const isRampfish = mode === GAME_MODE.RAMPFISH;

  setupTitleEl.textContent = isRampfish
    ? 'Clapbackfish Settings'
    : isBlindfish
      ? 'Blindfish Settings'
      : 'Blunderfish Settings';
  setupSubtitleEl.textContent = isRampfish
    ? 'Clapbackfish throws in the beginning then clap backs at the end.'
    : isBlindfish
    ? 'Choose how Blindfish should forget pieces before the game starts.'
    : 'Choose how often Blunderfish should blunder before the game starts.';

  setupBlunderSettingsEl.hidden = isBlindfish || isRampfish;
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

  if (activeMode === GAME_MODE.RAMPFISH) {
    rampFinalMove = RAMP_DEFAULT_FINAL_MOVE;
    revealEngineHints = false;
    revealBlundersCheckbox.checked = false;
    blindToYourPiecesCheckbox.checked = true;
    blindToOwnPiecesCheckbox.checked = true;
    neverBlindLastMovedPiece = true;
    neverBlindLastMovedCheckbox.checked = true;
    lastRampTargetCp = computeTargetEvalCp({
      engineTurnIndex: 1,
      finalMove: rampFinalMove
    });
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
    case 'forfeit':
      return 'Forfeit';
    default:
      return 'Draw';
  }
}

function updateStatus() {
  const status = getEffectiveGameStatus();
  const humanColor = game.getHumanColor();
  const history = game.getMoveHistory();

  if (status.over) {
    if (status.result === 'draw') {
      statusTextEl.textContent = `${statusReasonText(status.reason)}.`;
      return;
    }

    const winnerName = colorName(status.result);
    const youWon = status.result === humanColor;
    const reason = statusReasonText(status.reason).toLowerCase();
    statusTextEl.textContent = `${winnerName} wins by ${reason}. ${youWon ? 'You win.' : 'You lose.'}`;
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
      activeMode === GAME_MODE.BLINDFISH
        ? 'Blindfish is thinking...'
        : activeMode === GAME_MODE.RAMPFISH
          ? 'Clapbackfish is thinking...'
          : 'Blunderfish is thinking...';
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
  const status = getEffectiveGameStatus();
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

  if (movesTableWrapEl) {
    movesTableWrapEl.scrollTop = movesTableWrapEl.scrollHeight;
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

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document.execCommand === 'function') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }

  return false;
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
  return !thinking && !getEffectiveGameStatus().over && isHumanTurn();
}

function updateInteractionMode() {
  board.setInteractionEnabled(canInteract());
}

function syncDesktopColumnHeights() {
  if (!boardWrapEl || !rightColumnEl) {
    return;
  }

  if (window.matchMedia('(min-width: 641px)').matches) {
    rightColumnEl.style.height = `${Math.round(boardWrapEl.getBoundingClientRect().height)}px`;
  } else {
    rightColumnEl.style.removeProperty('height');
  }
}

function handleGameConclusionTransition() {
  const status = getEffectiveGameStatus();
  if (!status.over || gameConcluded) {
    return;
  }

  gameConcluded = true;
  updatePrimaryTopRightButton();
  openGameResultModal(status);
}

function forfeitCurrentGame() {
  if (getEffectiveGameStatus().over) {
    return;
  }

  searchToken += 1;
  thinking = false;
  pendingPromotion = null;
  if (promotionDialog.open) {
    promotionDialog.close();
  }

  forcedGameStatus = {
    over: true,
    result: oppositeColor(game.getHumanColor()),
    reason: 'forfeit',
    check: false
  };
  queueEvalSampleForCurrentPosition();
  processEvalHistoryQueue();
  refresh();
}

function returnToMainMenu() {
  closeGameResultModal();
  forcedGameStatus = null;
  gameConcluded = false;
  gameStarted = false;
  setModeSelectionDisabled(false);
  showModeSelectionScreen();
  gameAppEl.classList.add('app-hidden');
  updatePrimaryTopRightButton();
}

function refresh() {
  updatePrimaryTopRightButton();
  handleGameConclusionTransition();
  updateRampReadonlyDisplay();
  renderEvalBar();
  processEvalHistoryQueue();
  scheduleEvalBarAnalysis();

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
  syncDesktopColumnHeights();
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
    isBlindFenSearchSafe: (fen) => game.isBlindFenSearchSafe(fen),
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
  if (getEffectiveGameStatus().over || isHumanTurn()) {
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
    } else if (activeMode === GAME_MODE.RAMPFISH) {
      const legalMoves = game.getAllLegalMoves();
      if (legalMoves.length === 0) {
        refresh();
        return;
      }

      computerEngineTurnCount += 1;
      lastRampTargetCp = computeTargetEvalCp({
        engineTurnIndex: computerEngineTurnCount,
        finalMove: rampFinalMove
      });
      refresh();

      await engine.setSkillLevel(RAMP_MAX_SKILL_LEVEL);
      const rankedEntries = await engine.getRankedMovesWithScores(game.getFen(), {
        movetimeMs: RAMP_MAX_MOVETIME_MS,
        multiPv: legalMoves.length
      });
      const legalByKey = new Map(legalMoves.map((move) => [moveKey(move), move]));
      const orderedEntries = [];
      const seen = new Set();

      for (const entry of rankedEntries) {
        const key = moveKey(entry.move);
        if (!legalByKey.has(key) || seen.has(key)) {
          continue;
        }
        seen.add(key);
        orderedEntries.push({
          move: legalByKey.get(key),
          rank: entry.rank,
          score: entry.score
        });
      }

      for (const move of legalMoves) {
        const key = moveKey(move);
        if (seen.has(key)) {
          continue;
        }
        orderedEntries.push({
          move,
          rank: Number.MAX_SAFE_INTEGER,
          score: null
        });
      }

      let bestEntry = null;
      for (const entry of orderedEntries) {
        if (!entry.score) {
          continue;
        }
        const scoreForComputer = scoreToColorPerspective(entry.score, game.getTurn(), computerColor);
        const scoreCpComparable = scoreToComparableCp(scoreForComputer);
        const distance = Math.abs(scoreCpComparable - lastRampTargetCp);

        if (
          !bestEntry ||
          distance < bestEntry.distance ||
          (distance === bestEntry.distance && entry.rank < bestEntry.rank)
        ) {
          bestEntry = { ...entry, distance };
        }
      }

      selectedMove = bestEntry ? bestEntry.move : orderedEntries[0]?.move || legalMoves[0];
      computerMoveKinds.set(historyPlyIndex, 'ramp');
      randomMoveHurts.delete(historyPlyIndex);
    } else {
      const useRandomMove = blunderDecisionSmoother.next(blunderChancePercent);

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
      queueEvalSampleForCurrentPosition();
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

  queueEvalSampleForCurrentPosition();
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
  blunderDecisionSmoother.reset();
  evalAnalysisToken += 1;
  evalAnalysisBusy = false;
  evalScoreForWhite = { type: 'cp', value: 0 };
  lastEvaluatedFen = null;
  closeGameResultModal();
  postGameModalOpen = false;
  gameConcluded = false;
  forcedGameStatus = null;
  evalHistoryHuman = [];
  evalHistoryQueue = [];
  evalHistoryBusy = false;
  evalHistoryBusyToken += 1;
  computerEngineTurnCount = 0;
  lastRampTargetCp = computeTargetEvalCp({
    engineTurnIndex: 1,
    finalMove: rampFinalMove
  });

  const humanColor =
    preferredHumanColor === 'random' ? randomColor() : preferredHumanColor;
  game.newGame(humanColor);
  queueEvalSampleForCurrentPosition();

  displayOrientation = humanColor;

  await engine.newGame();
  refresh();

  if (!isHumanTurn()) {
    await requestEngineMove();
  }
}

newGameBtn.addEventListener('click', () => {
  if (gameStarted && !getEffectiveGameStatus().over && !gameConcluded) {
    forfeitCurrentGame();
    return;
  }
  startNewGame();
});

flipBoardBtn.addEventListener('click', () => {
  displayOrientation = displayOrientation === 'w' ? 'b' : 'w';
  refresh();
});

exportFenBtn.addEventListener('click', async () => {
  const fen = game.getFen();
  try {
    const copied = await copyTextToClipboard(fen);
    statusTextEl.textContent = copied ? 'FEN copied to clipboard.' : `FEN: ${fen}`;
  } catch {
    statusTextEl.textContent = `FEN: ${fen}`;
  }
});

gameResultCloseBtnEl?.addEventListener('click', () => {
  closeGameResultModal();
});

gameResultMainMenuBtnEl?.addEventListener('click', () => {
  returnToMainMenu();
});

gameResultRematchBtnEl?.addEventListener('click', async () => {
  closeGameResultModal();
  await startNewGame();
});

gameResultDialogEl?.addEventListener('close', () => {
  postGameModalOpen = false;
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

showEvalBarCheckbox.addEventListener('change', (event) => {
  showEvalBar = Boolean(event.target.checked);
  if (!showEvalBar) {
    evalAnalysisToken += 1;
    evalAnalysisBusy = false;
  } else {
    lastEvaluatedFen = null;
  }
  refresh();
});

neverBlindLastMovedCheckbox.addEventListener('change', (event) => {
  neverBlindLastMovedPiece = Boolean(event.target.checked);
});

async function boot() {
  statusTextEl.textContent =
    activeMode === GAME_MODE.BLINDFISH
      ? 'Initializing Blindfish...'
      : activeMode === GAME_MODE.RAMPFISH
        ? 'Initializing Clapbackfish...'
        : 'Initializing Blunderfish...';

  applyModeSettingsUi();
  revealEngineHints = Boolean(revealBlundersCheckbox.checked);
  showEvalBar = Boolean(showEvalBarCheckbox.checked);
  renderEvalBar();

  await engine.init();
  await engine.setSkillLevel(20);
  await startNewGame();
}

function setModeSelectionDisabled(disabled) {
  modeBlunderfishBtn.disabled = disabled;
  modeBlindfishBtn.disabled = disabled;
  modeRampfishBtn.disabled = disabled;
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

modeRampfishBtn.addEventListener('click', () => {
  showSetupScreen(GAME_MODE.RAMPFISH);
});

window.addEventListener('resize', () => {
  syncDesktopColumnHeights();
});
