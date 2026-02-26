import { describe, expect, test } from 'vitest';
import {
  RAMP_DEFAULT_FINAL_MOVE,
  RAMP_DIRECTION,
  RAMP_PROFILES,
  RAMP_TARGET_CP_MAX,
  RAMP_TARGET_CP_MIN,
  clampFinalMove,
  computeTargetEvalCp,
  computeRampProgress,
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
      direction: RAMP_DIRECTION.UP,
      engineTurnIndex: 1,
      finalMove: 40
    });
    const mid = interpolateRampProfile({
      direction: RAMP_DIRECTION.UP,
      engineTurnIndex: 20.5,
      finalMove: 40
    });
    const last = interpolateRampProfile({
      direction: RAMP_DIRECTION.UP,
      engineTurnIndex: 40,
      finalMove: 40
    });

    expect(first).toEqual({ ...RAMP_PROFILES.MIN, progress: 0 });
    expect(mid).toEqual({ skillLevel: 10, depth: 21, movetimeMs: 775, progress: 0.5 });
    expect(last).toEqual({ ...RAMP_PROFILES.MAX, progress: 1 });
  });

  test('interpolateRampProfile ramp down first/mid/final and saturation', () => {
    const first = interpolateRampProfile({
      direction: RAMP_DIRECTION.DOWN,
      engineTurnIndex: 1,
      finalMove: 40
    });
    const mid = interpolateRampProfile({
      direction: RAMP_DIRECTION.DOWN,
      engineTurnIndex: 20.5,
      finalMove: 40
    });
    const last = interpolateRampProfile({
      direction: RAMP_DIRECTION.DOWN,
      engineTurnIndex: 40,
      finalMove: 40
    });
    const after = interpolateRampProfile({
      direction: RAMP_DIRECTION.DOWN,
      engineTurnIndex: 120,
      finalMove: 40
    });

    expect(first).toEqual({ ...RAMP_PROFILES.MAX, progress: 0 });
    expect(mid).toEqual({ skillLevel: 10, depth: 21, movetimeMs: 775, progress: 0.5 });
    expect(last).toEqual({ ...RAMP_PROFILES.MIN, progress: 1 });
    expect(after).toEqual({ ...RAMP_PROFILES.MIN, progress: 1 });
  });

  test('ramp values are monotonic across turns', () => {
    let lastUp = interpolateRampProfile({
      direction: RAMP_DIRECTION.UP,
      engineTurnIndex: 1,
      finalMove: 40
    });
    let lastDown = interpolateRampProfile({
      direction: RAMP_DIRECTION.DOWN,
      engineTurnIndex: 1,
      finalMove: 40
    });

    for (let turn = 2; turn <= 60; turn += 1) {
      const up = interpolateRampProfile({
        direction: RAMP_DIRECTION.UP,
        engineTurnIndex: turn,
        finalMove: 40
      });
      const down = interpolateRampProfile({
        direction: RAMP_DIRECTION.DOWN,
        engineTurnIndex: turn,
        finalMove: 40
      });

      expect(up.skillLevel).toBeGreaterThanOrEqual(lastUp.skillLevel);
      expect(up.depth).toBeGreaterThanOrEqual(lastUp.depth);
      expect(up.movetimeMs).toBeGreaterThanOrEqual(lastUp.movetimeMs);

      expect(down.skillLevel).toBeLessThanOrEqual(lastDown.skillLevel);
      expect(down.depth).toBeLessThanOrEqual(lastDown.depth);
      expect(down.movetimeMs).toBeLessThanOrEqual(lastDown.movetimeMs);

      lastUp = up;
      lastDown = down;
    }
  });

  test('target eval drifts from -2000cp to +2000cp for ramp up', () => {
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.UP, engineTurnIndex: 1, finalMove: 40 })
    ).toBe(RAMP_TARGET_CP_MIN);
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.UP, engineTurnIndex: 40, finalMove: 40 })
    ).toBe(RAMP_TARGET_CP_MAX);
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.UP, engineTurnIndex: 20.5, finalMove: 40 })
    ).toBe(0);
  });

  test('target eval drifts from +2000cp to -2000cp for ramp down', () => {
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.DOWN, engineTurnIndex: 1, finalMove: 40 })
    ).toBe(RAMP_TARGET_CP_MAX);
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.DOWN, engineTurnIndex: 40, finalMove: 40 })
    ).toBe(RAMP_TARGET_CP_MIN);
    expect(
      computeTargetEvalCp({ direction: RAMP_DIRECTION.DOWN, engineTurnIndex: 20.5, finalMove: 40 })
    ).toBe(0);
  });
});
