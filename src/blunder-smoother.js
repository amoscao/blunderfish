function clampPercent(percent) {
  if (Number.isNaN(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function createBlunderDecisionSmoother(rng = Math.random) {
  // Error diffusion tracks expected-vs-actual blunders over time.
  let error = 0;

  function clampProbability(value) {
    return Math.min(1, Math.max(0, value));
  }

  function next(percent) {
    const normalizedPercent = clampPercent(percent);
    const targetProbability = normalizedPercent / 100;
    const adjustedProbability = clampProbability(targetProbability + error);
    const isBlunder = rng() < adjustedProbability;

    error += targetProbability - (isBlunder ? 1 : 0);
    error = Math.min(1, Math.max(-1, error));
    return isBlunder;
  }

  function reset() {
    error = 0;
  }

  return {
    next,
    reset
  };
}
