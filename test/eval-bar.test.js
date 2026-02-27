import { describe, expect, test } from 'vitest';
import { formatEvalLabel, scoreToComparableCp, scoreToWhitePercent } from '../src/eval-bar.js';

describe('eval bar helpers', () => {
  test('formats cp scores in pawn units', () => {
    expect(formatEvalLabel({ type: 'cp', value: 0 })).toBe('+0.00');
    expect(formatEvalLabel({ type: 'cp', value: 135 })).toBe('+1.35');
    expect(formatEvalLabel({ type: 'cp', value: -42 })).toBe('-0.42');
  });

  test('formats mate scores as M#', () => {
    expect(formatEvalLabel({ type: 'mate', value: 3 })).toBe('M3');
    expect(formatEvalLabel({ type: 'mate', value: -5 })).toBe('-M5');
  });

  test('converts score to comparable cp', () => {
    expect(scoreToComparableCp({ type: 'cp', value: 123 })).toBe(123);
    expect(scoreToComparableCp({ type: 'mate', value: 1 })).toBe(10000);
    expect(scoreToComparableCp({ type: 'mate', value: -1 })).toBe(-10000);
  });

  test('maps cp scores to bounded white-side bar percent', () => {
    expect(scoreToWhitePercent({ type: 'cp', value: 0 })).toBeCloseTo(50, 6);
    expect(scoreToWhitePercent({ type: 'cp', value: 10000 })).toBeLessThanOrEqual(100);
    expect(scoreToWhitePercent({ type: 'cp', value: -10000 })).toBeGreaterThanOrEqual(0);
    expect(scoreToWhitePercent({ type: 'cp', value: 400 })).toBeGreaterThan(50);
    expect(scoreToWhitePercent({ type: 'cp', value: -400 })).toBeLessThan(50);
  });
});
