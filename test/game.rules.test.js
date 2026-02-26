import { describe, expect, test } from 'vitest';
import { buildFenWithRemovedSquares, createGame, isBlindFenSearchSafe } from '../src/game.js';

describe('game rules', () => {
  test('starts at white turn', () => {
    const game = createGame();
    game.newGame('w');

    expect(game.getTurn()).toBe('w');
    expect(game.getLegalMoves('e2').length).toBeGreaterThan(0);
  });

  test('flags promotion when missing piece choice', () => {
    const game = createGame();
    game.newGame('w');
    game.loadFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');

    const result = game.applyMove({ from: 'a7', to: 'a8' });
    expect(result.ok).toBe(false);
    expect(result.needsPromotion).toBe(true);
  });

  test('accepts legal promotion choice', () => {
    const game = createGame();
    game.newGame('w');
    game.loadFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');

    const result = game.applyMove({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(result.ok).toBe(true);
  });

  test('checks move legality without mutating board', () => {
    const game = createGame();
    game.newGame('w');

    const beforeFen = game.getFen();
    expect(game.isLegalMove({ from: 'e2', to: 'e4' })).toBe(true);
    expect(game.isLegalMove({ from: 'e2', to: 'e5' })).toBe(false);
    expect(game.getFen()).toBe(beforeFen);
  });

  test('returns original FEN when source FEN is malformed', () => {
    expect(buildFenWithRemovedSquares('bad-fen', ['a2'])).toBe('bad-fen');
  });

  test('keeps kings and removes requested non-king pieces', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const updated = buildFenWithRemovedSquares(fen, ['a1', 'h8', 'e1', 'e8']);

    const game = createGame();
    game.newGame('w');
    game.loadFen(updated);
    const position = game.getPosition();

    expect(position.e1.type).toBe('k');
    expect(position.e8.type).toBe('k');
    expect(position.a1).toBeUndefined();
    expect(position.h8).toBeUndefined();
  });

  test('strips castling rights only when relevant rook/king is gone', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const updated = buildFenWithRemovedSquares(fen, ['a1', 'h8']);

    const castling = updated.split(' ')[2];
    expect(castling).toBe('Kq');
  });

  test('creates loadable FEN when en-passant square becomes invalid', () => {
    const fen = '4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1';
    const updated = buildFenWithRemovedSquares(fen, ['e4']);

    const game = createGame();
    game.newGame('w');
    game.loadFen(updated);
    expect(game.getFen()).toContain(' b ');
  });

  test('preserves piece case across remove/rebuild', () => {
    const fen = '4k3/8/8/3Q4/8/8/8/4K3 w - - 0 1';
    const updated = buildFenWithRemovedSquares(fen, []);

    const boardPart = updated.split(' ')[0];
    expect(boardPart).toContain('Q');
    expect(boardPart).toContain('k');
    expect(boardPart).toContain('K');
  });

  test('flags blind FEN as unsafe when non-side-to-move king is in check', () => {
    const safeFen = '2b1kbnr/p3pppp/2n5/1B6/8/2N1PN2/PP1P1PPP/R1B1K2R w KQ - 3 11';
    const unsafeFen = '2b1kb1r/p4ppp/8/1B6/8/2N2N2/PP3PPP/R1B1K2R w KQ - 3 11';

    expect(isBlindFenSearchSafe(safeFen)).toBe(true);
    expect(isBlindFenSearchSafe(unsafeFen)).toBe(false);
  });
});
