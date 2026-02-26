import { describe, expect, test } from 'vitest';
import { selectBlindSquares } from '../src/game.js';

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const COMPLEX_POSITION = {
  e1: { color: 'w', type: 'k' },
  e8: { color: 'b', type: 'k' },
  a2: { color: 'w', type: 'p' },
  b2: { color: 'w', type: 'p' },
  c2: { color: 'w', type: 'n' },
  d2: { color: 'w', type: 'b' },
  f2: { color: 'w', type: 'r' },
  g2: { color: 'w', type: 'q' },
  a7: { color: 'b', type: 'p' },
  b7: { color: 'b', type: 'p' },
  c7: { color: 'b', type: 'n' },
  d7: { color: 'b', type: 'b' },
  f7: { color: 'b', type: 'r' },
  g7: { color: 'b', type: 'q' }
};

describe('blindfish selection', () => {
  test('selects no pieces for non-positive count', () => {
    expect(selectBlindSquares(COMPLEX_POSITION, 0)).toEqual([]);
    expect(selectBlindSquares(COMPLEX_POSITION, -5)).toEqual([]);
  });

  test('clamps to available non-king pieces', () => {
    const selected = selectBlindSquares(COMPLEX_POSITION, 30, makeRng(123));
    expect(selected).toHaveLength(12);
  });

  test('never selects kings and never duplicates over many seeds', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const selected = selectBlindSquares(COMPLEX_POSITION, 9, makeRng(seed));
      const unique = new Set(selected);

      expect(unique.size).toBe(selected.length);
      expect(selected).not.toContain('e1');
      expect(selected).not.toContain('e8');
    }
  });

  test('can exclude white pieces from selection', () => {
    const selected = selectBlindSquares(COMPLEX_POSITION, 6, makeRng(7), {
      includeWhite: false,
      includeBlack: true
    });

    expect(selected.length).toBeGreaterThan(0);
    for (const square of selected) {
      expect(COMPLEX_POSITION[square].color).toBe('b');
    }
  });

  test('can exclude black pieces from selection', () => {
    const selected = selectBlindSquares(COMPLEX_POSITION, 6, makeRng(8), {
      includeWhite: true,
      includeBlack: false
    });

    expect(selected.length).toBeGreaterThan(0);
    for (const square of selected) {
      expect(COMPLEX_POSITION[square].color).toBe('w');
    }
  });

  test('returns empty when both sides are excluded', () => {
    const selected = selectBlindSquares(COMPLEX_POSITION, 6, makeRng(9), {
      includeWhite: false,
      includeBlack: false
    });
    expect(selected).toEqual([]);
  });

  test('excludes explicit squares from candidate pool', () => {
    const selected = selectBlindSquares(COMPLEX_POSITION, 10, makeRng(11), {
      includeWhite: true,
      includeBlack: true,
      excludeSquares: ['a2', 'b7']
    });

    expect(selected).not.toContain('a2');
    expect(selected).not.toContain('b7');
  });

  test('never blinds the most recently moved piece when excluded', () => {
    const mostRecentlyMovedSquare = 'g2';
    const selected = selectBlindSquares(COMPLEX_POSITION, 12, makeRng(12), {
      includeWhite: true,
      includeBlack: true,
      excludeSquares: [mostRecentlyMovedSquare]
    });

    expect(selected).not.toContain(mostRecentlyMovedSquare);
  });

  test('clamps to available side when one color has no non-king pieces', () => {
    const oneSided = {
      e1: { color: 'w', type: 'k' },
      e8: { color: 'b', type: 'k' },
      a2: { color: 'w', type: 'p' },
      b2: { color: 'w', type: 'q' }
    };

    const selected = selectBlindSquares(oneSided, 5, makeRng(5), {
      includeWhite: true,
      includeBlack: true
    });
    expect(selected.sort()).toEqual(['a2', 'b2']);
  });

  test('handles sparse endgame positions', () => {
    const sparse = {
      e1: { color: 'w', type: 'k' },
      e8: { color: 'b', type: 'k' },
      c6: { color: 'w', type: 'n' },
      h7: { color: 'b', type: 'p' }
    };

    const selected = selectBlindSquares(sparse, 2, makeRng(9));
    expect(selected).toHaveLength(2);
    expect(selected.sort()).toEqual(['c6', 'h7']);
  });
});
