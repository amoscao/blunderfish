const DEFAULT_TIMEOUT_MS = 20000;

function parseUciMoveToken(token) {
  if (!token || token === '(none)' || token.length < 4) {
    return null;
  }

  const from = token.slice(0, 2);
  const to = token.slice(2, 4);
  const promotion = token.length > 4 ? token[4] : undefined;
  return { from, to, promotion };
}

export function parseBestMoveLine(line) {
  if (!line || !line.startsWith('bestmove ')) {
    return null;
  }

  const best = line.split(' ')[1];
  return parseUciMoveToken(best);
}

function parseInfoScoreLine(line) {
  if (!line || !line.startsWith('info ')) {
    return null;
  }

  const match = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)\b/);
  if (!match) {
    return null;
  }

  return {
    type: match[1],
    value: Number(match[2])
  };
}

function parseInfoMultiPvRank(line) {
  if (!line || !line.startsWith('info ')) {
    return null;
  }

  const match = line.match(/\bmultipv\s+(\d+)\b/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export function parseInfoMultiPvLine(line) {
  if (!line || !line.startsWith('info ')) {
    return null;
  }

  const rankMatch = line.match(/\bmultipv\s+(\d+)\b/);
  const pvMatch = line.match(/\bpv\s+([a-h][1-8][a-h][1-8][qrbn]?)\b/i);

  if (!rankMatch || !pvMatch) {
    return null;
  }

  const move = parseUciMoveToken(pvMatch[1]);
  if (!move) {
    return null;
  }

  return {
    rank: Number(rankMatch[1]),
    move,
    score: parseInfoScoreLine(line)
  };
}

function moveKey(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

export function rankAndDedupeMoves(entries) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const seen = new Set();
  const result = [];

  for (const entry of sorted) {
    const key = moveKey(entry.move);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry.move);
  }

  return result;
}

export function rankAndDedupeMoveEntries(entries) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const seen = new Set();
  const result = [];

  for (const entry of sorted) {
    const key = moveKey(entry.move);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }

  return result;
}

export function createEngine() {
  const workerUrl = `${import.meta.env.BASE_URL}stockfish/stockfish.wasm.js`;
  const worker = new Worker(workerUrl);

  let pendingResolvers = [];
  let appliedSkillLevel = null;

  worker.addEventListener('message', (event) => {
    const line = String(event.data || '');

    const nextPendingResolvers = [];
    for (const entry of pendingResolvers) {
      if (entry.onLine) {
        entry.onLine(line);
      }
      if (entry.predicate(line)) {
        entry.resolve(line);
      } else {
        nextPendingResolvers.push(entry);
      }
    }

    pendingResolvers = nextPendingResolvers;
  });

  function send(command) {
    worker.postMessage(command);
  }

  function waitForLine(predicate, timeoutMs = DEFAULT_TIMEOUT_MS, onLine = null) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingResolvers = pendingResolvers.filter((entry) => entry !== resolverEntry);
        reject(new Error('Stockfish response timeout'));
      }, timeoutMs);

      const resolverEntry = {
        predicate,
        onLine,
        resolve: (line) => {
          clearTimeout(timeout);
          resolve(line);
        }
      };

      pendingResolvers.push(resolverEntry);
    });
  }

  async function init() {
    send('uci');
    await waitForLine((line) => line === 'uciok');

    send('isready');
    await waitForLine((line) => line === 'readyok');
  }

  function clampSkillLevel(level) {
    const parsed = Number(level);
    if (!Number.isFinite(parsed)) {
      return 20;
    }
    return Math.max(0, Math.min(20, Math.round(parsed)));
  }

  async function setSkillLevel(level = 20) {
    const clampedLevel = clampSkillLevel(level);
    if (appliedSkillLevel === clampedLevel) {
      return;
    }

    send(`setoption name Skill Level value ${clampedLevel}`);
    send('isready');
    await waitForLine((line) => line === 'readyok');
    appliedSkillLevel = clampedLevel;
  }

  async function newGame() {
    send('ucinewgame');
    send('isready');
    await waitForLine((line) => line === 'readyok');
  }

  function normalizeBestMoveSearchOptions(search) {
    if (typeof search === 'number') {
      return { movetimeMs: search, depth: null, legacyMovetime: true };
    }

    if (!search || typeof search !== 'object') {
      return { movetimeMs: 1500, depth: null, legacyMovetime: false };
    }

    const movetimeMs =
      Number.isFinite(Number(search.movetimeMs)) && Number(search.movetimeMs) > 0
        ? Math.round(Number(search.movetimeMs))
        : 1500;
    const depthRaw = Number(search.depth);
    const depth = Number.isFinite(depthRaw) && depthRaw > 0 ? Math.round(depthRaw) : null;

    return { movetimeMs, depth, legacyMovetime: false };
  }

  async function getBestMove(fen, search = 1500) {
    const options = normalizeBestMoveSearchOptions(search);
    send(`position fen ${fen}`);
    if (options.depth !== null && !options.legacyMovetime) {
      send(`go depth ${options.depth} movetime ${options.movetimeMs}`);
    } else {
      send(`go movetime ${options.movetimeMs}`);
    }

    const bestMoveLine = await waitForLine((line) => line.startsWith('bestmove '));
    const move = parseBestMoveLine(bestMoveLine);

    if (!move) {
      throw new Error(`Unable to parse engine best move: ${bestMoveLine}`);
    }

    return move;
  }

  async function getRankedMovesWithScores(fen, { movetimeMs = 1500, multiPv = 8, depth = null } = {}) {
    const requestedMultiPv = Math.max(1, Math.floor(multiPv));
    const requestedDepth =
      Number.isFinite(Number(depth)) && Number(depth) > 0 ? Math.floor(Number(depth)) : null;
    const rankedBySlot = new Map();

    send(`setoption name MultiPV value ${requestedMultiPv}`);
    send(`position fen ${fen}`);
    if (requestedDepth !== null) {
      send(`go depth ${requestedDepth} movetime ${movetimeMs}`);
    } else {
      send(`go movetime ${movetimeMs}`);
    }

    const bestMoveLine = await waitForLine(
      (line) => line.startsWith('bestmove '),
      DEFAULT_TIMEOUT_MS,
      (line) => {
        const parsed = parseInfoMultiPvLine(line);
        if (parsed) {
          rankedBySlot.set(parsed.rank, parsed);
        }
      }
    );

    const bestMove = parseBestMoveLine(bestMoveLine);
    if (bestMove && !rankedBySlot.has(1)) {
      rankedBySlot.set(1, {
        rank: 1,
        move: bestMove,
        score: null
      });
    }

    const entries = Array.from(rankedBySlot.values());
    return rankAndDedupeMoveEntries(entries);
  }

  async function getRankedMoves(fen, options = {}) {
    const entries = await getRankedMovesWithScores(fen, options);
    return entries.map((entry) => entry.move);
  }

  async function analyzePosition(fen, movetimeMs = 1500) {
    let latestScore = null;

    send(`position fen ${fen}`);
    send(`go movetime ${movetimeMs}`);
    await waitForLine(
      (line) => line.startsWith('bestmove '),
      DEFAULT_TIMEOUT_MS,
      (line) => {
        const score = parseInfoScoreLine(line);
        if (score) {
          const multipvRank = parseInfoMultiPvRank(line);
          if (multipvRank === null || multipvRank === 1) {
            latestScore = score;
          }
        }
      }
    );

    if (!latestScore) {
      throw new Error('Unable to parse engine score from analysis');
    }

    return latestScore;
  }

  function terminate() {
    worker.terminate();
  }

  return {
    init,
    setSkillLevel,
    newGame,
    getBestMove,
    getRankedMoves,
    getRankedMovesWithScores,
    analyzePosition,
    terminate
  };
}
