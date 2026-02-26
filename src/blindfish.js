export function pickFirstLegalMove(rankedMoves, isLegalMove) {
  for (const move of rankedMoves) {
    if (isLegalMove(move)) {
      return move;
    }
  }
  return null;
}

export async function chooseBlindfishMoveWithRetries({
  pieceBlindnessCount,
  maxRetries,
  movetimeMs,
  multiPv,
  selectBlindSquares,
  buildBlindFen,
  getRankedMoves,
  isLegalMove,
  getAllLegalMoves,
  onBlindSelection = () => {},
  shouldContinue = () => true,
  rng = Math.random
}) {
  const openingLegalMoves = getAllLegalMoves();
  if (openingLegalMoves.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (!shouldContinue()) {
      return null;
    }

    const blindSquares = selectBlindSquares(pieceBlindnessCount);
    onBlindSelection(blindSquares);

    const blindFen = buildBlindFen(blindSquares);
    const rankedMoves = await getRankedMoves(blindFen, { movetimeMs, multiPv });

    if (!shouldContinue()) {
      return null;
    }

    const legalCandidate = pickFirstLegalMove(rankedMoves, isLegalMove);
    if (legalCandidate) {
      return legalCandidate;
    }
  }

  const fallbackMoves = getAllLegalMoves();
  if (fallbackMoves.length === 0) {
    return null;
  }

  const choiceIndex = Math.floor(rng() * fallbackMoves.length);
  return fallbackMoves[choiceIndex];
}
