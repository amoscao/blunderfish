import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createEngine } from '../src/engine.js';

class MockWorker {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.messages = [];
    this.listeners = [];
    this.terminated = false;
    MockWorker.instances.push(this);
  }

  postMessage(command) {
    this.messages.push(command);
  }

  addEventListener(type, listener) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  emit(line) {
    for (const listener of this.listeners) {
      listener({ data: line });
    }
  }

  terminate() {
    this.terminated = true;
  }
}

describe('engine worker integration', () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal('Worker', MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('init sends uci then isready and waits for acknowledgements', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const initPromise = engine.init();
    expect(worker.messages).toEqual(['uci']);

    worker.emit('uciok');
    await Promise.resolve();
    expect(worker.messages).toEqual(['uci', 'isready']);

    worker.emit('readyok');
    await initPromise;
  });

  test('getBestMove sends position/go and parses response', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const movePromise = engine.getBestMove('test-fen', 321);
    expect(worker.messages).toEqual(['position fen test-fen', 'go movetime 321']);

    worker.emit('bestmove e2e4 ponder e7e5');
    await expect(movePromise).resolves.toEqual({ from: 'e2', to: 'e4', promotion: undefined });
  });

  test('getBestMove supports depth and movetime options object', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const movePromise = engine.getBestMove('test-fen', { movetimeMs: 250, depth: 9 });
    expect(worker.messages).toEqual(['position fen test-fen', 'go depth 9 movetime 250']);

    worker.emit('bestmove e2e4 ponder e7e5');
    await expect(movePromise).resolves.toEqual({ from: 'e2', to: 'e4', promotion: undefined });
  });

  test('getRankedMoves uses multipv lines and fallback bestmove rank-1', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const movesPromise = engine.getRankedMoves('blind-fen', { movetimeMs: 200, multiPv: 4 });

    expect(worker.messages).toEqual([
      'setoption name MultiPV value 4',
      'position fen blind-fen',
      'go movetime 200'
    ]);

    worker.emit('info depth 15 multipv 2 score cp 10 pv d2d4 d7d5');
    worker.emit('info depth 15 multipv 3 score cp 8 pv g1f3 g8f6');
    worker.emit('bestmove e2e4 ponder e7e5');

    await expect(movesPromise).resolves.toEqual([
      { from: 'e2', to: 'e4', promotion: undefined },
      { from: 'd2', to: 'd4', promotion: undefined },
      { from: 'g1', to: 'f3', promotion: undefined }
    ]);
  });

  test('getRankedMoves supports optional depth constraint', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const movesPromise = engine.getRankedMoves('deep-fen', { movetimeMs: 200, multiPv: 2, depth: 11 });

    expect(worker.messages).toEqual([
      'setoption name MultiPV value 2',
      'position fen deep-fen',
      'go depth 11 movetime 200'
    ]);

    worker.emit('info depth 11 multipv 1 score cp 20 pv e2e4 e7e5');
    worker.emit('bestmove e2e4 ponder e7e5');
    await expect(movesPromise).resolves.toEqual([{ from: 'e2', to: 'e4', promotion: undefined }]);
  });

  test('getRankedMovesWithScores returns rank and cp score metadata', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const entriesPromise = engine.getRankedMovesWithScores('scored-fen', {
      movetimeMs: 200,
      multiPv: 2
    });

    worker.emit('info depth 16 multipv 2 score cp -45 pv d2d4 d7d5');
    worker.emit('bestmove e2e4 ponder e7e5');

    await expect(entriesPromise).resolves.toEqual([
      {
        rank: 1,
        move: { from: 'e2', to: 'e4', promotion: undefined },
        score: null
      },
      {
        rank: 2,
        move: { from: 'd2', to: 'd4', promotion: undefined },
        score: { type: 'cp', value: -45 }
      }
    ]);
  });

  test('analyzePosition should use multipv-1 score when MultiPV is enabled', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const rankedPromise = engine.getRankedMovesWithScores('seed-fen', { movetimeMs: 200, multiPv: 3 });
    worker.emit('info depth 14 multipv 1 score cp 30 pv e2e4 e7e5');
    worker.emit('info depth 14 multipv 2 score cp -460 pv a2a3 a7a6');
    worker.emit('bestmove e2e4 ponder e7e5');
    await rankedPromise;

    const analyzePromise = engine.analyzePosition('target-fen', 200);
    expect(worker.messages.slice(-2)).toEqual(['position fen target-fen', 'go movetime 200']);

    worker.emit('info depth 14 multipv 1 score cp 35 pv d2d4 d7d5');
    worker.emit('info depth 14 multipv 2 score cp -460 pv a2a3 a7a6');
    worker.emit('bestmove d2d4 ponder d7d5');

    await expect(analyzePromise).resolves.toEqual({ type: 'cp', value: 35 });
  });

  test('times out when expected engine response does not arrive', async () => {
    vi.useFakeTimers();

    const engine = createEngine();
    const bestMovePromise = engine.getBestMove('slow-fen', 100);
    const timeoutExpectation = expect(bestMovePromise).rejects.toThrow('Stockfish response timeout');

    await vi.advanceTimersByTimeAsync(20001);
    await timeoutExpectation;
  });

  test('setSkillLevel clamps values to valid range', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const lowPromise = engine.setSkillLevel(-9);
    expect(worker.messages).toEqual(['setoption name Skill Level value 0', 'isready']);
    worker.emit('readyok');
    await lowPromise;

    const highPromise = engine.setSkillLevel(99);
    expect(worker.messages).toEqual([
      'setoption name Skill Level value 0',
      'isready',
      'setoption name Skill Level value 20',
      'isready'
    ]);
    worker.emit('readyok');
    await highPromise;
  });

  test('setSkillLevel skips duplicate values', async () => {
    const engine = createEngine();
    const worker = MockWorker.instances[0];

    const firstPromise = engine.setSkillLevel(10);
    expect(worker.messages).toEqual(['setoption name Skill Level value 10', 'isready']);
    worker.emit('readyok');
    await firstPromise;

    await engine.setSkillLevel(10);
    expect(worker.messages).toEqual(['setoption name Skill Level value 10', 'isready']);
  });
});
