import { Chess } from 'chess.js';

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
    applyMove,
    getGameStatus,
    getMoveHistory
  };
}
