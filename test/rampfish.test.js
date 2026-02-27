import { describe, expect, test } from 'vitest';
import {
  RAMP_DEFAULT_FINAL_MOVE,
  RAMP_PROFILES,
  RAMP_TARGET_CP_MAX,
  RAMP_TARGET_CP_MIN,
  clampFinalMove,
  computeTargetEvalCp,
  computeRampProgress,
  isPostRampPhase,
  interpolateRampProfile
} from '../src/rampfish.js';

describe('rampfish helpers', () => {
  test('clampFinalMove uses default on invalid values', () => {
    expect(clampFinalMove(undefined)).toBe(RAMP_DEFAULT_FINAL_MOVE);
    expect(clampFinalMove('')).toBe(1);
    expect(clampFinalMove('abc')).toBe(RAMP_DEFAULT_FINAL_MOVE);
  });

  test('clampFinalMove enforces min and rounds', () => {
    expect(clampFinalMove(0)).toBe(1);
    expect(clampFinalMove(-2)).toBe(1);
    expect(clampFinalMove(7.7)).toBe(8);
  });

  test('computeRampProgress handles endpoints and midpoint', () => {
    expect(computeRampProgress(1, 40)).toBe(0);
    expect(computeRampProgress(40, 40)).toBe(1);
    expect(computeRampProgress(80, 40)).toBe(1);
    expect(computeRampProgress(20.5, 40)).toBeCloseTo(0.5, 6);
  });

  test('interpolateRampProfile ramp up first/mid/final', () => {
    const first = interpolateRampProfile({
      engineTurnIndex: 1,
      finalMove: 40
    });
    const mid = interpolateRampProfile({
      engineTurnIndex: 20.5,
      finalMove: 40
    });
    const last = interpolateRampProfile({
      engineTurnIndex: 40,
      finalMove: 40
    });

    expect(first).toEqual({ ...RAMP_PROFILES.MIN, progress: 0 });
    expect(mid).toEqual({ skillLevel: 10, depth: 21, movetimeMs: 775, progress: 0.5 });
    expect(last).toEqual({ ...RAMP_PROFILES.MAX, progress: 1 });
  });

  test('interpolateRampProfile saturation after final turn', () => {
    const after = interpolateRampProfile({
      engineTurnIndex: 120,
      finalMove: 40
    });

    expect(after).toEqual({ ...RAMP_PROFILES.MAX, progress: 1 });
  });

  test('ramp values are monotonic increasing across turns', () => {
    let lastUp = interpolateRampProfile({
      engineTurnIndex: 1,
      finalMove: 40
    });

    for (let turn = 2; turn <= 60; turn += 1) {
      const up = interpolateRampProfile({
        engineTurnIndex: turn,
        finalMove: 40
      });

      expect(up.skillLevel).toBeGreaterThanOrEqual(lastUp.skillLevel);
      expect(up.depth).toBeGreaterThanOrEqual(lastUp.depth);
      expect(up.movetimeMs).toBeGreaterThanOrEqual(lastUp.movetimeMs);

      lastUp = up;
    }
  });

  test('target eval drifts from -2000cp to +2000cp', () => {
    expect(computeTargetEvalCp({ engineTurnIndex: 1, finalMove: 40 })).toBe(RAMP_TARGET_CP_MIN);
    expect(computeTargetEvalCp({ engineTurnIndex: 40, finalMove: 40 })).toBe(RAMP_TARGET_CP_MAX);
    expect(computeTargetEvalCp({ engineTurnIndex: 20.5, finalMove: 40 })).toBe(0);
  });

  test('post-ramp phase starts strictly after final move', () => {
    expect(isPostRampPhase(40, 40)).toBe(false);
    expect(isPostRampPhase(41, 40)).toBe(true);
    expect(isPostRampPhase(2, 1)).toBe(true);
    expect(isPostRampPhase(1, 1)).toBe(false);
  });
});
