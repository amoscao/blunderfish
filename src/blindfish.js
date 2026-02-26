export function pickFirstLegalMove(rankedMoves, isLegalMove) {
  for (const move of rankedMoves) {
    if (isLegalMove(move)) {
      return move;
    }
  }
  return null;
}

export function selectHumanBishopSquares(positionBySquare, humanColor) {
  return Object.entries(positionBySquare)
    .filter(([, piece]) => piece && piece.color === humanColor && piece.type === 'b')
    .map(([square]) => square);
}

export async function chooseBlindfishMoveWithRetries({
  pieceBlindnessCount,
  maxRetries,
  movetimeMs,
  multiPv,
  selectBlindSquares,
  buildBlindFen,
  isBlindFenSearchSafe = () => true,
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
    if (!isBlindFenSearchSafe(blindFen)) {
      continue;
    }
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

export async function chooseOrthodoxBlindfishMove({
  humanColor,
  getPosition,
  getBestMove,
  buildBlindFen,
  isBlindFenSearchSafe = () => true,
  getRankedMoves,
  isLegalMove,
  getAllLegalMoves,
  movetimeMs,
  multiPv,
  onBlindSelection = () => {},
  shouldContinue = () => true,
  rng = Math.random
}) {
  const openingLegalMoves = getAllLegalMoves();
  if (openingLegalMoves.length === 0) {
    return null;
  }

  if (!shouldContinue()) {
    return null;
  }

  const bishopSquares = selectHumanBishopSquares(getPosition(), humanColor);
  onBlindSelection(bishopSquares);

  if (bishopSquares.length === 0) {
    return getBestMove();
  }

  const blindFen = buildBlindFen(bishopSquares);
  if (!isBlindFenSearchSafe(blindFen)) {
    return getBestMove();
  }

  const rankedMoves = await getRankedMoves(blindFen, { movetimeMs, multiPv });
  if (!shouldContinue()) {
    return null;
  }

  const legalCandidate = pickFirstLegalMove(rankedMoves, isLegalMove);
  if (legalCandidate) {
    return legalCandidate;
  }

  const fallbackMoves = getAllLegalMoves();
  if (fallbackMoves.length === 0) {
    return null;
  }

  const choiceIndex = Math.floor(rng() * fallbackMoves.length);
  return fallbackMoves[choiceIndex];
}
