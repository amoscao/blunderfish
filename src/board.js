const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const PIECE_IMAGE_BY_CODE = {
  wp: 'w_pawn_png_128px.png',
  wn: 'w_knight_png_128px.png',
  wb: 'w_bishop_png_128px.png',
  wr: 'w_rook_png_128px.png',
  wq: 'w_queen_png_128px.png',
  wk: 'w_king_png_128px.png',
  bp: 'b_pawn_png_128px.png',
  bn: 'b_knight_png_128px.png',
  bb: 'b_bishop_png_128px.png',
  br: 'b_rook_png_128px.png',
  bq: 'b_queen_png_128px.png',
  bk: 'b_king_png_128px.png'
};

function squareColor(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankNumber = Number(square[1]);
  return (fileIndex + rankNumber) % 2 === 1 ? 'dark' : 'light';
}

function squaresForOrientation(orientation) {
  const files = orientation === 'w' ? FILES : [...FILES].reverse();
  const ranks = orientation === 'w' ? [...RANKS].reverse() : RANKS;

  const squares = [];
  for (const rank of ranks) {
    for (const file of files) {
      squares.push(`${file}${rank}`);
    }
  }

  return squares;
}

export function createBoard({ container, onHumanMoveAttempt }) {
  let orientation = 'w';
  let position = {};
  let interactionEnabled = false;
  let selectedSquare = null;
  let legalTargets = [];
  let getLegalTargets = () => [];
  let canSelectSquare = () => false;
  let lastMove = null;
  let kingOutcomeByColor = { w: null, b: null };
  let blindSquares = new Set();
  let showBlindMarkers = false;

  function setMoveQueryHandlers(handlers) {
    getLegalTargets = handlers.getLegalTargets;
    canSelectSquare = handlers.canSelectSquare;
  }

  function clearSelection() {
    selectedSquare = null;
    legalTargets = [];
  }

  function showLegalTargets(square, targets) {
    selectedSquare = square;
    legalTargets = targets;
    render(position, orientation);
  }

  function clearLegalTargets() {
    clearSelection();
    render(position, orientation);
  }

  function setInteractionEnabled(enabled) {
    interactionEnabled = enabled;
  }

  function setLastMove(move) {
    lastMove = move;
  }

  function setKingOutcome(nextOutcomeByColor) {
    kingOutcomeByColor = nextOutcomeByColor;
  }

  function setBlindMarkers({ squares = [], visible = false }) {
    blindSquares = new Set(squares);
    showBlindMarkers = visible;
  }

  function onSquareClick(square) {
    if (!interactionEnabled) {
      return;
    }

    if (selectedSquare) {
      if (square === selectedSquare) {
        clearLegalTargets();
        return;
      }

      if (legalTargets.includes(square)) {
        const from = selectedSquare;
        clearSelection();
        render(position, orientation);
        onHumanMoveAttempt({ from, to: square });
        return;
      }
    }

    const piece = position[square];
    if (!piece || !canSelectSquare(square, piece)) {
      clearLegalTargets();
      return;
    }

    const targets = getLegalTargets(square);
    showLegalTargets(square, targets);
  }

  function onPieceDragStart(event, fromSquare) {
    if (!interactionEnabled) {
      event.preventDefault();
      return;
    }

    const piece = position[fromSquare];
    if (!piece || !canSelectSquare(fromSquare, piece)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', fromSquare);
    showLegalTargets(fromSquare, getLegalTargets(fromSquare));
  }

  function onSquareDrop(event, toSquare) {
    event.preventDefault();
    if (!interactionEnabled) {
      return;
    }

    const fromSquare = event.dataTransfer.getData('text/plain');
    if (!fromSquare || !legalTargets.includes(toSquare)) {
      clearLegalTargets();
      return;
    }

    clearSelection();
    render(position, orientation);
    onHumanMoveAttempt({ from: fromSquare, to: toSquare });
  }

  function render(nextPosition, nextOrientation = orientation) {
    position = nextPosition;
    orientation = nextOrientation;

    container.innerHTML = '';
    const squares = squaresForOrientation(orientation);

    for (const square of squares) {
      const squareShade = squareColor(square);
      const file = square[0];
      const rank = square[1];
      const piece = position[square];

      const squareEl = document.createElement('button');
      squareEl.type = 'button';
      squareEl.className = `square ${squareShade}`;
      squareEl.dataset.square = square;
      squareEl.setAttribute('aria-label', `Square ${square}`);

      squareEl.addEventListener('click', () => onSquareClick(square));
      squareEl.addEventListener('dragover', (event) => event.preventDefault());
      squareEl.addEventListener('drop', (event) => onSquareDrop(event, square));

      if (lastMove && (square === lastMove.from || square === lastMove.to)) {
        squareEl.classList.add('last-move');
      }

      if (selectedSquare === square) {
        squareEl.classList.add('selected');
      }

      if (piece?.type === 'k' && kingOutcomeByColor[piece.color]) {
        squareEl.classList.add(`king-${kingOutcomeByColor[piece.color]}`);
      }

      const coordTextClass = squareShade === 'dark' ? 'light-text' : 'dark-text';
      const leftFile = orientation === 'w' ? 'a' : 'h';
      const bottomRank = orientation === 'w' ? '1' : '8';
      const showRankLabel = file === leftFile;
      const showFileLabel = rank === bottomRank;

      if (showRankLabel) {
        const rankLabel = document.createElement('span');
        rankLabel.className = `coord coord-rank ${coordTextClass}`;
        rankLabel.textContent = rank;
        squareEl.appendChild(rankLabel);
      }

      if (showFileLabel) {
        const fileLabel = document.createElement('span');
        fileLabel.className = `coord coord-file ${coordTextClass}`;
        fileLabel.textContent = file;
        squareEl.appendChild(fileLabel);
      }

      if (legalTargets.includes(square)) {
        const dot = document.createElement('span');
        dot.className = 'legal-dot';
        squareEl.appendChild(dot);
      }

      if (piece) {
        const pieceCode = `${piece.color}${piece.type}`;
        const pieceEl = document.createElement('img');
        pieceEl.className = 'piece';
        pieceEl.src = `${import.meta.env.BASE_URL}assets/chess/${PIECE_IMAGE_BY_CODE[pieceCode]}`;
        pieceEl.alt = `${piece.color === 'w' ? 'white' : 'black'} ${piece.type}`;
        pieceEl.draggable = true;
        pieceEl.addEventListener('dragstart', (event) => onPieceDragStart(event, square));
        squareEl.appendChild(pieceEl);

        if (showBlindMarkers && blindSquares.has(square)) {
          const blindMarker = document.createElement('span');
          blindMarker.className = 'blind-marker';

          const blindIcon = document.createElement('img');
          blindIcon.className = 'blind-marker-icon';
          blindIcon.src = `${import.meta.env.BASE_URL}assets/blindfish/blind.png`;
          blindIcon.alt = '';
          blindIcon.setAttribute('aria-hidden', 'true');

          blindMarker.appendChild(blindIcon);
          squareEl.appendChild(blindMarker);
        }
      }

      container.appendChild(squareEl);
    }
  }

  return {
    render,
    setInteractionEnabled,
    setLastMove,
    setKingOutcome,
    setBlindMarkers,
    setMoveQueryHandlers,
    showLegalTargets,
    clearLegalTargets,
    clearSelection
  };
}
