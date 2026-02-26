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

  test('times out when expected engine response does not arrive', async () => {
    vi.useFakeTimers();

    const engine = createEngine();
    const bestMovePromise = engine.getBestMove('slow-fen', 100);
    const timeoutExpectation = expect(bestMovePromise).rejects.toThrow('Stockfish response timeout');

    await vi.advanceTimersByTimeAsync(20001);
    await timeoutExpectation;
  });
});
