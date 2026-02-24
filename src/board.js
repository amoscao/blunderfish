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

const SQUARE_IMAGE_BY_COLOR = {
  light: 'square_brown_light_png_128px.png',
  dark: 'square_brown_dark_png_128px.png'
};

function squareColor(square) {
  const fileIndex = FILES.indexOf(square[0]);
  const rankNumber = Number(square[1]);
  return (fileIndex + rankNumber) % 2 === 0 ? 'dark' : 'light';
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
      const squareEl = document.createElement('button');
      squareEl.type = 'button';
      squareEl.className = `square ${squareColor(square)}`;
      squareEl.dataset.square = square;
      squareEl.setAttribute('aria-label', `Square ${square}`);
      squareEl.style.backgroundImage = `url('${import.meta.env.BASE_URL}assets/chess/${
        SQUARE_IMAGE_BY_COLOR[squareColor(square)]
      }')`;

      squareEl.addEventListener('click', () => onSquareClick(square));
      squareEl.addEventListener('dragover', (event) => event.preventDefault());
      squareEl.addEventListener('drop', (event) => onSquareDrop(event, square));

      if (selectedSquare === square) {
        squareEl.classList.add('selected');
      }

      if (legalTargets.includes(square)) {
        const dot = document.createElement('span');
        dot.className = 'legal-dot';
        squareEl.appendChild(dot);
      }

      const piece = position[square];
      if (piece) {
        const pieceCode = `${piece.color}${piece.type}`;
        const pieceEl = document.createElement('img');
        pieceEl.className = 'piece';
        pieceEl.src = `${import.meta.env.BASE_URL}assets/chess/${PIECE_IMAGE_BY_CODE[pieceCode]}`;
        pieceEl.alt = `${piece.color === 'w' ? 'white' : 'black'} ${piece.type}`;
        pieceEl.draggable = true;
        pieceEl.addEventListener('dragstart', (event) => onPieceDragStart(event, square));
        squareEl.appendChild(pieceEl);
      }

      container.appendChild(squareEl);
    }
  }

  return {
    render,
    setInteractionEnabled,
    setMoveQueryHandlers,
    showLegalTargets,
    clearLegalTargets,
    clearSelection
  };
}
