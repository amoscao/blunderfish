export const RAMP_DIRECTION = {
  UP: 'up',
  DOWN: 'down'
};

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

export function interpolateRampProfile({ direction, engineTurnIndex, finalMove }) {
  const progress = computeRampProgress(engineTurnIndex, finalMove);
  const isDown = direction === RAMP_DIRECTION.DOWN;
  const start = isDown ? RAMP_PROFILES.MAX : RAMP_PROFILES.MIN;
  const end = isDown ? RAMP_PROFILES.MIN : RAMP_PROFILES.MAX;

  return {
    skillLevel: lerpRounded(start.skillLevel, end.skillLevel, progress),
    depth: lerpRounded(start.depth, end.depth, progress),
    movetimeMs: lerpRounded(start.movetimeMs, end.movetimeMs, progress),
    progress
  };
}

export function computeTargetEvalCp({ direction, engineTurnIndex, finalMove }) {
  const progress = computeRampProgress(engineTurnIndex, finalMove);
  const isDown = direction === RAMP_DIRECTION.DOWN;
  const start = isDown ? RAMP_TARGET_CP_MAX : RAMP_TARGET_CP_MIN;
  const end = isDown ? RAMP_TARGET_CP_MIN : RAMP_TARGET_CP_MAX;
  return lerpRounded(start, end, progress);
}
