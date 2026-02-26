import { describe, expect, test } from 'vitest';
import {
  buildAxisTicks,
  buildPolylinePoints,
  computeSymmetricYRange,
  sanitizeCpForGraph
} from '../src/eval-graph.js';

describe('eval graph helpers', () => {
  test('computeSymmetricYRange enforces min and max bounds', () => {
    expect(computeSymmetricYRange([])).toEqual({ minCp: -500, maxCp: 500 });
    expect(computeSymmetricYRange([100, -300])).toEqual({ minCp: -500, maxCp: 500 });
    expect(computeSymmetricYRange([2500, -50])).toEqual({ minCp: -2000, maxCp: 2000 });
  });

  test('sanitizeCpForGraph converts cp and mate scores with clamping', () => {
    expect(sanitizeCpForGraph({ type: 'cp', value: 234 })).toBe(234);
    expect(sanitizeCpForGraph({ type: 'cp', value: 9000 })).toBe(2000);
    expect(sanitizeCpForGraph({ type: 'mate', value: 3 })).toBe(2000);
    expect(sanitizeCpForGraph({ type: 'mate', value: -2 })).toBe(-2000);
  });

  test('buildPolylinePoints maps points deterministically for single and multi sample', () => {
    const single = buildPolylinePoints([{ ply: 0, cp: 0 }], { width: 100, height: 100 }, { minCp: -500, maxCp: 500 });
    expect(single).toBe('0.00,50.00');

    const multi = buildPolylinePoints(
      [
        { ply: 0, cp: -500 },
        { ply: 5, cp: 0 },
        { ply: 10, cp: 500 }
      ],
      { width: 100, height: 100 },
      { minCp: -500, maxCp: 500 }
    );
    expect(multi).toBe('0.00,100.00 50.00,50.00 100.00,0.00');
  });

  test('buildAxisTicks includes endpoints and symmetric y labels', () => {
    const ticks = buildAxisTicks(18, { minCp: -1200, maxCp: 1200 });
    expect(ticks.xTicks).toEqual([
      { value: 0, label: '0' },
      { value: 18, label: '18' }
    ]);
    expect(ticks.yTicks).toEqual([
      { value: -1200, label: '-12.00' },
      { value: 0, label: '0.00' },
      { value: 1200, label: '+12.00' }
    ]);
  });
});
