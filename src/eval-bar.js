export function scoreToComparableCp(score) {
  if (score.type === 'cp') {
    return score.value;
  }
  return score.value > 0 ? 10000 : -10000;
}

export function scoreToWhitePercent(score) {
  const cp = scoreToComparableCp(score);
  const whiteFraction = (Math.tanh(cp / 600) + 1) / 2;
  return Math.max(0, Math.min(100, whiteFraction * 100));
}

export function formatEvalLabel(score) {
  if (score.type === 'mate') {
    return `${score.value < 0 ? '-' : ''}M${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
