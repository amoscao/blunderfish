import { Chess } from 'chess.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function toSquare(fileIdx, rankIdxFromTop) {
  return `${FILES[fileIdx]}${8 - rankIdxFromTop}`;
}

function sampleSquares(squares, count, rng) {
  const pool = [...squares];
  const result = [];
  const maxPicks = Math.min(count, pool.length);

  for (let i = 0; i < maxPicks; i += 1) {
    const index = Math.floor(rng() * pool.length);
    result.push(pool[index]);
    pool.splice(index, 1);
  }

  return result;
}

function sanitizeCastlingRights(boardBySquare, castling) {
  if (!castling || castling === '-') {
    return '-';
  }

  const rights = new Set(castling.split(''));
  const keep = [];

  if (
    rights.has('K') &&
    boardBySquare.e1 === 'K' &&
    boardBySquare.h1 === 'R'
  ) {
    keep.push('K');
  }

  if (
    rights.has('Q') &&
    boardBySquare.e1 === 'K' &&
    boardBySquare.a1 === 'R'
  ) {
    keep.push('Q');
  }

  if (
    rights.has('k') &&
    boardBySquare.e8 === 'k' &&
    boardBySquare.h8 === 'r'
  ) {
    keep.push('k');
  }

  if (
    rights.has('q') &&
    boardBySquare.e8 === 'k' &&
    boardBySquare.a8 === 'r'
  ) {
    keep.push('q');
  }

  return keep.length > 0 ? keep.join('') : '-';
}

export function selectBlindSquares(
  positionBySquare,
  count,
  rng = Math.random,
  options = { includeWhite: true, includeBlack: true }
) {
  const requested = Math.max(0, Math.floor(count));
  if (requested === 0) {
    return [];
  }

  const includeWhite = options.includeWhite !== false;
  const includeBlack = options.includeBlack !== false;
  const excludeSquares = new Set(options.excludeSquares || []);
  if (!includeWhite && !includeBlack) {
    return [];
  }

  const pool = [];

  for (const [square, piece] of Object.entries(positionBySquare)) {
    if (!piece || piece.type === 'k') {
      continue;
    }
    if (excludeSquares.has(square)) {
      continue;
    }
    if (piece.color === 'w' && includeWhite) {
      pool.push(square);
    } else if (piece.color === 'b' && includeBlack) {
      pool.push(square);
    }
  }

  const targetTotal = Math.min(requested, pool.length);
  if (targetTotal === 0) {
    return [];
  }

  return sampleSquares(pool, targetTotal, rng);
}

export function buildFenWithRemovedSquares(realFen, squaresToRemove) {
  const parts = realFen.trim().split(/\s+/);
  if (parts.length < 6) {
    return realFen;
  }

  const [boardPart, turn, castlingPart, enPassant, halfmove, fullmove] = parts;
  const rows = boardPart.split('/');
  if (rows.length !== 8) {
    return realFen;
  }

  const boardBySquare = {};

  for (let rankIdx = 0; rankIdx < rows.length; rankIdx += 1) {
    const row = rows[rankIdx];
    let fileIdx = 0;

    for (const char of row) {
      if (/\d/.test(char)) {
        fileIdx += Number(char);
      } else {
        const square = toSquare(fileIdx, rankIdx);
        boardBySquare[square] = char;
        fileIdx += 1;
      }
    }
  }

  for (const square of squaresToRemove) {
    const piece = boardBySquare[square];
    if (!piece || piece.toLowerCase() === 'k') {
      continue;
    }
    delete boardBySquare[square];
  }

  const rebuiltRows = [];
  for (let rankIdx = 0; rankIdx < 8; rankIdx += 1) {
    let row = '';
    let empty = 0;

    for (let fileIdx = 0; fileIdx < 8; fileIdx += 1) {
      const square = toSquare(fileIdx, rankIdx);
      const piece = boardBySquare[square];
      if (!piece) {
        empty += 1;
        continue;
      }

      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }
      row += piece;
    }

    if (empty > 0) {
      row += String(empty);
    }
    rebuiltRows.push(row);
  }

  const boardFen = rebuiltRows.join('/');
  const castling = sanitizeCastlingRights(boardBySquare, castlingPart);
  const candidateFen = `${boardFen} ${turn} ${castling} ${enPassant} ${halfmove} ${fullmove}`;

  const validator = new Chess();
  const canLoad = (fen) => {
    try {
      const loadResult = validator.load(fen);
      return loadResult !== false;
    } catch {
      return false;
    }
  };

  if (canLoad(candidateFen)) {
    return validator.fen();
  }

  const fallbackFen = `${boardFen} ${turn} - - ${halfmove} ${fullmove}`;
  if (canLoad(fallbackFen)) {
    return validator.fen();
  }

  return realFen;
}

export function createGame() {
  let chess = new Chess();
  let humanColor = 'w';

  function newGame(nextHumanColor) {
    chess = new Chess();
    humanColor = nextHumanColor;
  }

  function loadFen(fen) {
    chess.load(fen);
  }

  function getFen() {
    return chess.fen();
  }

  function getTurn() {
    return chess.turn();
  }

  function getHumanColor() {
    return humanColor;
  }

  function getPosition() {
    const board = chess.board();
    const position = {};

    for (let rankIdx = 0; rankIdx < 8; rankIdx += 1) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx += 1) {
        const piece = board[rankIdx][fileIdx];
        if (!piece) {
          continue;
        }

        const square = `${String.fromCharCode(97 + fileIdx)}${8 - rankIdx}`;
        position[square] = { color: piece.color, type: piece.type };
      }
    }

    return position;
  }

  function getLegalMoves(square) {
    const verboseMoves = chess.moves({ square, verbose: true });
    return verboseMoves.map((move) => ({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san
    }));
  }

  function getAllLegalMoves() {
    const verboseMoves = chess.moves({ verbose: true });
    return verboseMoves.map((move) => ({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      san: move.san
    }));
  }

  function applyMove({ from, to, promotion }) {
    const candidates = chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);

    if (candidates.length === 0) {
      return { ok: false, reason: 'illegal_move' };
    }

    const promotionCandidates = candidates.filter((move) => Boolean(move.promotion));

    if (promotionCandidates.length > 0 && !promotion) {
      return {
        ok: false,
        needsPromotion: true,
        promotionChoices: ['q', 'r', 'b', 'n']
      };
    }

    if (promotion) {
      const matchingPromotion = promotionCandidates.find((move) => move.promotion === promotion);
      if (!matchingPromotion) {
        return { ok: false, reason: 'illegal_promotion' };
      }
    }

    const result = chess.move({ from, to, promotion });
    if (!result) {
      return { ok: false, reason: 'illegal_move' };
    }

    return { ok: true };
  }

  function isLegalMove({ from, to, promotion }) {
    const candidates = chess
      .moves({ square: from, verbose: true })
      .filter((move) => move.to === to);

    if (candidates.length === 0) {
      return false;
    }

    const promotionCandidates = candidates.filter((move) => Boolean(move.promotion));
    if (promotionCandidates.length > 0) {
      return promotionCandidates.some((move) => move.promotion === promotion);
    }

    return !promotion;
  }

  function getGameStatus() {
    const over = chess.isGameOver();
    const check = chess.inCheck();

    if (!over) {
      return {
        over,
        result: null,
        reason: null,
        check
      };
    }

    if (chess.isCheckmate()) {
      const loser = chess.turn();
      const winner = loser === 'w' ? 'b' : 'w';
      return {
        over: true,
        result: winner,
        reason: 'checkmate',
        check
      };
    }

    if (chess.isStalemate()) {
      return {
        over: true,
        result: 'draw',
        reason: 'stalemate',
        check
      };
    }

    if (chess.isThreefoldRepetition()) {
      return {
        over: true,
        result: 'draw',
        reason: 'threefold_repetition',
        check
      };
    }

    if (chess.isInsufficientMaterial()) {
      return {
        over: true,
        result: 'draw',
        reason: 'insufficient_material',
        check
      };
    }

    if (typeof chess.isDrawByFiftyMoves === 'function' && chess.isDrawByFiftyMoves()) {
      return {
        over: true,
        result: 'draw',
        reason: 'fifty_move_rule',
        check
      };
    }

    if (chess.isDraw()) {
      return {
        over: true,
        result: 'draw',
        reason: 'draw',
        check
      };
    }

    return {
      over: true,
      result: 'draw',
      reason: 'game_over',
      check
    };
  }

  function getMoveHistory() {
    return chess.history();
  }

  return {
    newGame,
    loadFen,
    getFen,
    getTurn,
    getPosition,
    getHumanColor,
    getLegalMoves,
    getAllLegalMoves,
    applyMove,
    isLegalMove,
    selectBlindSquares: (count, rng = Math.random, options = undefined) =>
      selectBlindSquares(getPosition(), count, rng, options),
    buildBlindFen: (squaresToRemove) => buildFenWithRemovedSquares(chess.fen(), squaresToRemove),
    getGameStatus,
    getMoveHistory
  };
}
