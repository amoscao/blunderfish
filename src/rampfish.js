export const RAMP_DEFAULT_FINAL_MOVE = 40;
export const RAMP_MIN_FINAL_MOVE = 1;
export const RAMP_TARGET_CP_MIN = -2000;
export const RAMP_TARGET_CP_MAX = 2000;

export const RAMP_PROFILES = {
  MIN: {
    skillLevel: 0,
    depth: 1,
    movetimeMs: 50
  },
  MAX: {
    skillLevel: 20,
    depth: 40,
    movetimeMs: 1500
  }
};

export function clampFinalMove(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return RAMP_DEFAULT_FINAL_MOVE;
  }
  return Math.max(RAMP_MIN_FINAL_MOVE, Math.round(parsed));
}

export function computeRampProgress(engineTurnIndex, finalMove) {
  const clampedFinalMove = clampFinalMove(finalMove);
  const turn = Number(engineTurnIndex);

  if (!Number.isFinite(turn) || turn <= 1 || clampedFinalMove <= 1) {
    return turn >= clampedFinalMove ? 1 : 0;
  }

  if (turn >= clampedFinalMove) {
    return 1;
  }

  return (turn - 1) / (clampedFinalMove - 1);
}

function lerpRounded(start, end, progress) {
  return Math.round(start + (end - start) * progress);
}

export function interpolateRampProfile({ engineTurnIndex, finalMove }) {
  const progress = computeRampProgress(engineTurnIndex, finalMove);

  return {
    skillLevel: lerpRounded(RAMP_PROFILES.MIN.skillLevel, RAMP_PROFILES.MAX.skillLevel, progress),
    depth: lerpRounded(RAMP_PROFILES.MIN.depth, RAMP_PROFILES.MAX.depth, progress),
    movetimeMs: lerpRounded(RAMP_PROFILES.MIN.movetimeMs, RAMP_PROFILES.MAX.movetimeMs, progress),
    progress
  };
}

export function computeTargetEvalCp({ engineTurnIndex, finalMove }) {
  const progress = computeRampProgress(engineTurnIndex, finalMove);
  return lerpRounded(RAMP_TARGET_CP_MIN, RAMP_TARGET_CP_MAX, progress);
}

export function isPostRampPhase(engineTurnIndex, finalMove) {
  const turn = Number(engineTurnIndex);
  if (!Number.isFinite(turn)) {
    return false;
  }
  return turn > clampFinalMove(finalMove);
}
