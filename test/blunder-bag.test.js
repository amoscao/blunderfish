import { describe, expect, test } from 'vitest';
import { createBlunderDecisionBag } from '../src/blunder-bag.js';

describe('blunder decision bag', () => {
  test('produces exact rounded count per 20-turn window', () => {
    const bag = createBlunderDecisionBag(20, () => 0.1234);
    const decisions = Array.from({ length: 20 }, () => bag.next(25));
    const blunderCount = decisions.filter(Boolean).length;

    expect(blunderCount).toBe(5);
  });

  test('refills after 20 decisions with the same distribution', () => {
    const bag = createBlunderDecisionBag(20, () => 0.5678);
    const firstWindow = Array.from({ length: 20 }, () => bag.next(35));
    const secondWindow = Array.from({ length: 20 }, () => bag.next(35));

    expect(firstWindow.filter(Boolean).length).toBe(7);
    expect(secondWindow.filter(Boolean).length).toBe(7);
  });

  test('reset immediately applies new odds', () => {
    const bag = createBlunderDecisionBag(20, () => 0.42);
    bag.reset(10);
    const first = Array.from({ length: 20 }, () => bag.next(10));
    bag.reset(50);
    const second = Array.from({ length: 20 }, () => bag.next(50));

    expect(first.filter(Boolean).length).toBe(2);
    expect(second.filter(Boolean).length).toBe(10);
  });
});
