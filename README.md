# Blunderfish
Can you beat max difficulty stockfish if it randomly blunders?

Play now: **https://amoscao.github.io/blunderfish/**

Blunderfish is an implementation of the "diluted stockfish" concept from the video **"30 Weird Chess Algorithms: Elo World"** by suckerpinch:  
https://www.youtube.com/watch?v=DpXy041BIlA

Stockfish still runs at max strength, but you control a configurable **Blunder Chance** that makes it play random legal moves some percentage of the time.  
Sometimes it calculates like a machine. Sometimes it forgets what game it's playing.

## Local Development

### Prerequisites

- [Volta](https://volta.sh/) for Node/npm version pinning

### Setup

1. Install the pinned toolchain:
   - `volta install node@20 npm@10`
2. Install dependencies:
   - `npm ci`

### Run and Validate

- Start dev server: `npm run dev`
- Run tests: `npm test`
- Build production bundle: `npm run build`
- Preview production bundle: `npm run preview`

### Troubleshooting

- If `node` or `npm` is missing, ensure Volta is installed and your shell profile is reloaded.
- If versions do not match, run `volta install node@20 npm@10` again.

## Credits

### Chess Engine

- **Stockfish** via `stockfish.js`
- License: **GPL-3.0**
- Package: https://www.npmjs.com/package/stockfish.js

### Board + Piece Graphics

- **Chess Pieces and Board Squares** by JohnPablok
- Source: https://opengameart.org/content/chess-pieces-and-board-squares
- License: **CC-BY-SA 3.0**

For full attribution details in-project, see: `public/CREDITS.md`.

This is just a project for fun, chess.com please don't sue me
