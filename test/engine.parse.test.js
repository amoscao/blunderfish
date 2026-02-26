import { describe, expect, test } from 'vitest';
import { parseBestMoveLine, parseInfoMultiPvLine, rankAndDedupeMoves } from '../src/engine.js';

describe('engine parse helpers', () => {
  test('parses basic bestmove line', () => {
    expect(parseBestMoveLine('bestmove e2e4 ponder e7e5')).toEqual({
      from: 'e2',
      to: 'e4',
      promotion: undefined
    });
  });

  test('parses promotion bestmove line', () => {
    expect(parseBestMoveLine('bestmove a7a8q')).toEqual({
      from: 'a7',
      to: 'a8',
      promotion: 'q'
    });
  });

  test('returns null for malformed bestmove line', () => {
    expect(parseBestMoveLine('bestmove')).toBeNull();
    expect(parseBestMoveLine('info depth 10')).toBeNull();
    expect(parseBestMoveLine('bestmove (none)')).toBeNull();
  });

  test('parses multipv info lines', () => {
    expect(
      parseInfoMultiPvLine(
        'info depth 16 multipv 3 score cp 22 nodes 100 pv a7a8q e8e7'
      )
    ).toEqual({
      rank: 3,
      move: {
        from: 'a7',
        to: 'a8',
        promotion: 'q'
      }
    });
  });

  test('returns null for malformed multipv lines', () => {
    expect(parseInfoMultiPvLine('info depth 10 pv e2e4')).toBeNull();
    expect(parseInfoMultiPvLine('info depth 10 multipv 2 score cp 20')).toBeNull();
    expect(parseInfoMultiPvLine('bestmove e2e4')).toBeNull();
  });

  test('orders ranked moves and deduplicates', () => {
    expect(
      rankAndDedupeMoves([
        { rank: 2, move: { from: 'd2', to: 'd4' } },
        { rank: 1, move: { from: 'e2', to: 'e4' } },
        { rank: 3, move: { from: 'e2', to: 'e4' } },
        { rank: 4, move: { from: 'g1', to: 'f3' } }
      ])
    ).toEqual([
      { from: 'e2', to: 'e4' },
      { from: 'd2', to: 'd4' },
      { from: 'g1', to: 'f3' }
    ]);
  });
});
