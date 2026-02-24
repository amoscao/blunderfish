import { describe, expect, test } from 'vitest';
import { createGame } from '../src/game.js';

describe('game wrapper', () => {
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
});
