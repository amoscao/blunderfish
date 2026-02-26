import { describe, expect, test, vi } from 'vitest';
import { chooseBlindfishMoveWithRetries, pickFirstLegalMove } from '../src/blindfish.js';

describe('blindfish orchestration', () => {
  test('pickFirstLegalMove returns first legal candidate', () => {
    const moves = [
      { from: 'a2', to: 'a3' },
      { from: 'b2', to: 'b4' },
      { from: 'c2', to: 'c4' }
    ];

    const selected = pickFirstLegalMove(moves, (move) => move.from === 'b2');
    expect(selected).toEqual({ from: 'b2', to: 'b4' });
  });

  test('returns null when no legal moves exist at start', async () => {
    const result = await chooseBlindfishMoveWithRetries({
      pieceBlindnessCount: 5,
      maxRetries: 3,
      movetimeMs: 100,
      multiPv: 10,
      selectBlindSquares: () => [],
      buildBlindFen: () => 'fen',
      getRankedMoves: vi.fn(),
      isLegalMove: () => true,
      getAllLegalMoves: () => []
    });

    expect(result).toBeNull();
  });

  test('retries when first attempt has no legal ranked move', async () => {
    const getRankedMoves = vi
      .fn()
      .mockResolvedValueOnce([{ from: 'a2', to: 'a4' }])
      .mockResolvedValueOnce([{ from: 'b2', to: 'b3' }]);

    const result = await chooseBlindfishMoveWithRetries({
      pieceBlindnessCount: 6,
      maxRetries: 2,
      movetimeMs: 200,
      multiPv: 10,
      selectBlindSquares: vi.fn().mockReturnValue(['a2']),
      buildBlindFen: vi.fn().mockReturnValue('blind-fen'),
      getRankedMoves,
      isLegalMove: (move) => move.from === 'b2',
      getAllLegalMoves: () => [{ from: 'h2', to: 'h3' }]
    });

    expect(result).toEqual({ from: 'b2', to: 'b3' });
    expect(getRankedMoves).toHaveBeenCalledTimes(2);
  });

  test('uses random fallback after exhausting retries', async () => {
    const fallbackMoves = [
      { from: 'h2', to: 'h3' },
      { from: 'g2', to: 'g3' }
    ];

    const result = await chooseBlindfishMoveWithRetries({
      pieceBlindnessCount: 6,
      maxRetries: 1,
      movetimeMs: 200,
      multiPv: 10,
      selectBlindSquares: vi.fn().mockReturnValue(['a2']),
      buildBlindFen: vi.fn().mockReturnValue('blind-fen'),
      getRankedMoves: vi.fn().mockResolvedValue([{ from: 'a2', to: 'a4' }]),
      isLegalMove: () => false,
      getAllLegalMoves: () => fallbackMoves,
      rng: () => 0.9
    });

    expect(result).toEqual({ from: 'g2', to: 'g3' });
  });

  test('stops early when shouldContinue becomes false', async () => {
    let checks = 0;
    const result = await chooseBlindfishMoveWithRetries({
      pieceBlindnessCount: 6,
      maxRetries: 3,
      movetimeMs: 200,
      multiPv: 10,
      selectBlindSquares: vi.fn().mockReturnValue(['a2']),
      buildBlindFen: vi.fn().mockReturnValue('blind-fen'),
      getRankedMoves: vi.fn().mockResolvedValue([{ from: 'a2', to: 'a4' }]),
      isLegalMove: () => true,
      getAllLegalMoves: () => [{ from: 'h2', to: 'h3' }],
      shouldContinue: () => {
        checks += 1;
        return checks < 2;
      }
    });

    expect(result).toBeNull();
  });

  test('skips unsafe blind FENs before querying ranked moves', async () => {
    const buildBlindFen = vi
      .fn()
      .mockReturnValueOnce('unsafe-fen')
      .mockReturnValueOnce('safe-fen');
    const getRankedMoves = vi.fn().mockResolvedValue([{ from: 'b2', to: 'b3' }]);

    const result = await chooseBlindfishMoveWithRetries({
      pieceBlindnessCount: 5,
      maxRetries: 2,
      movetimeMs: 200,
      multiPv: 10,
      selectBlindSquares: vi.fn().mockReturnValue(['d2']),
      buildBlindFen,
      isBlindFenSearchSafe: (fen) => fen !== 'unsafe-fen',
      getRankedMoves,
      isLegalMove: (move) => move.from === 'b2',
      getAllLegalMoves: () => [{ from: 'h2', to: 'h3' }]
    });

    expect(result).toEqual({ from: 'b2', to: 'b3' });
    expect(getRankedMoves).toHaveBeenCalledTimes(1);
    expect(getRankedMoves).toHaveBeenCalledWith('safe-fen', { movetimeMs: 200, multiPv: 10 });
  });
});
