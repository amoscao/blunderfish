function clampPercent(percent) {
  if (Number.isNaN(percent)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function createBlunderDecisionBag(windowSize = 20, rng = Math.random) {
  let bag = [];

  function refill(percent) {
    const normalizedPercent = clampPercent(percent);
    const blunderCount = Math.round((windowSize * normalizedPercent) / 100);
    const safeCount = windowSize - blunderCount;

    bag = new Array(blunderCount).fill(true).concat(new Array(safeCount).fill(false));

    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
  }

  function next(percent) {
    if (bag.length === 0) {
      refill(percent);
    }
    return bag.pop();
  }

  function reset(percent) {
    refill(percent);
  }

  function remaining() {
    return bag.length;
  }

  return {
    next,
    reset,
    remaining
  };
}
