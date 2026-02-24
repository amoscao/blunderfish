const DEFAULT_TIMEOUT_MS = 20000;

export function parseBestMoveLine(line) {
  if (!line || !line.startsWith('bestmove ')) {
    return null;
  }

  const best = line.split(' ')[1];
  if (!best || best === '(none)' || best.length < 4) {
    return null;
  }

  const from = best.slice(0, 2);
  const to = best.slice(2, 4);
  const promotion = best.length > 4 ? best[4] : undefined;

  return { from, to, promotion };
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
    analyzePosition,
    terminate
  };
}
