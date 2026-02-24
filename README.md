# stockfish-dilution

GitHub Pages chess app where the human plays against Stockfish at max configured difficulty.

## Local development

1. Install Node.js 20+
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Run tests: `npm test`
5. Build: `npm run build`

## GitHub Pages setup

1. Open repository `Settings -> Pages`
2. Set `Source` to `GitHub Actions`
3. Push to `main`

The workflow in `.github/workflows/deploy-pages.yml` will build and deploy automatically.
