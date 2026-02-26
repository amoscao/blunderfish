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
    move
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

export function createEngine() {
  const workerUrl = `${import.meta.env.BASE_URL}stockfish/stockfish.wasm.js`;
  const worker = new Worker(workerUrl);

  let pendingResolvers = [];

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

  async function setSkillLevel(level = 20) {
    send(`setoption name Skill Level value ${level}`);
    send('isready');
    await waitForLine((line) => line === 'readyok');
  }

  async function newGame() {
    send('ucinewgame');
    send('isready');
    await waitForLine((line) => line === 'readyok');
  }

  async function getBestMove(fen, movetimeMs = 1500) {
    send(`position fen ${fen}`);
    send(`go movetime ${movetimeMs}`);

    const bestMoveLine = await waitForLine((line) => line.startsWith('bestmove '));
    const move = parseBestMoveLine(bestMoveLine);

    if (!move) {
      throw new Error(`Unable to parse engine best move: ${bestMoveLine}`);
    }

    return move;
  }

  async function getRankedMoves(fen, { movetimeMs = 1500, multiPv = 8 } = {}) {
    const requestedMultiPv = Math.max(1, Math.floor(multiPv));
    const rankedBySlot = new Map();

    send(`setoption name MultiPV value ${requestedMultiPv}`);
    send(`position fen ${fen}`);
    send(`go movetime ${movetimeMs}`);

    const bestMoveLine = await waitForLine(
      (line) => line.startsWith('bestmove '),
      DEFAULT_TIMEOUT_MS,
      (line) => {
        const parsed = parseInfoMultiPvLine(line);
        if (parsed) {
          rankedBySlot.set(parsed.rank, parsed.move);
        }
      }
    );

    const bestMove = parseBestMoveLine(bestMoveLine);
    if (bestMove && !rankedBySlot.has(1)) {
      rankedBySlot.set(1, bestMove);
    }

    const entries = Array.from(rankedBySlot.entries()).map(([rank, move]) => ({ rank, move }));
    return rankAndDedupeMoves(entries);
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
          latestScore = score;
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
    analyzePosition,
    terminate
  };
}
