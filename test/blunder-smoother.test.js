import { describe, expect, test } from 'vitest';
import { createBlunderDecisionSmoother } from '../src/blunder-smoother.js';

describe('blunder decision smoother', () => {
  function createLcg(seed = 12345) {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  test('respects hard bounds at 0% and 100%', () => {
    const smoother = createBlunderDecisionSmoother(() => 0.42);
    const zeros = Array.from({ length: 50 }, () => smoother.next(0));
    const hundreds = Array.from({ length: 50 }, () => smoother.next(100));

    expect(zeros.every((v) => v === false)).toBe(true);
    expect(hundreds.every((v) => v === true)).toBe(true);
  });

  test('tracks target odds over long runs with smoothing', () => {
    const smoother = createBlunderDecisionSmoother(createLcg(7));
    const turns = 2000;
    const decisions = Array.from({ length: turns }, () => smoother.next(35));
    const blunderCount = decisions.filter(Boolean).length;
    const observed = blunderCount / turns;

    expect(observed).toBeGreaterThan(0.3);
    expect(observed).toBeLessThan(0.4);
  });

  test('reset immediately applies new odds', () => {
    const smoother = createBlunderDecisionSmoother(createLcg(9));
    const first = Array.from({ length: 400 }, () => smoother.next(10));
    smoother.reset();
    const second = Array.from({ length: 400 }, () => smoother.next(50));

    const firstRate = first.filter(Boolean).length / first.length;
    const secondRate = second.filter(Boolean).length / second.length;
    expect(firstRate).toBeLessThan(0.2);
    expect(secondRate).toBeGreaterThan(0.4);
  });

  test('compensates after a streak of misses by forcing a blunder', () => {
    const smoother = createBlunderDecisionSmoother(() => 0.99);
    const decisions = Array.from({ length: 4 }, () => smoother.next(30));

    expect(decisions).toEqual([false, false, false, true]);
  });

  test('compensates after early blunder with short-term damping', () => {
    const smoother = createBlunderDecisionSmoother(() => 0);
    const decisions = Array.from({ length: 4 }, () => smoother.next(30));

    expect(decisions[0]).toBe(true);
    expect(decisions[1]).toBe(false);
    expect(decisions[2]).toBe(false);
  });

  test('is deterministic for a fixed RNG sequence', () => {
    const rngA = createLcg(42);
    const rngB = createLcg(42);
    const bagA = createBlunderDecisionSmoother(rngA);
    const bagB = createBlunderDecisionSmoother(rngB);

    const seqA = Array.from({ length: 50 }, () => bagA.next(37));
    const seqB = Array.from({ length: 50 }, () => bagB.next(37));

    expect(seqA).toEqual(seqB);
  });
});
