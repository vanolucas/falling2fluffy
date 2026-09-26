# Falling 2 Fluffy

A fast-paced 2D browser game. Big pixel-art coins fall from the sky, and you steer a furry blue and purple creature to catch them in its wide-open mouth before they hit the ground.

[▶️ **Click here to play** ▶️](https://falling2fluffy.vanolucas.com/)

[![In-game screenshot of the fluffy creature jumping and trying to catch a coin before it hits the ground](/in-game-screenshot.jpg)](https://falling2fluffy.vanolucas.com/)

Built with [PixiJS 8](https://pixijs.com/) (WebGL), TypeScript and Vite.

## How to play

| Action | Control |
| --- | --- |
| Move left / right | Mouse, touch anywhere (tap or drag), `←` `→`, `A` `D` (QWERTY) or `Q` `D` (AZERTY) |
| Jump | Left click, `Space`, `↑`, `W` (QWERTY) or `Z` (AZERTY), or touch anywhere above the creature. Press again in mid-air for a double jump |
| Start / retry | Click, tap or any jump key |

The last device you steer with takes over: pressing an arrow key overrides the mouse until you move the mouse again.

- Coins only count when they land **in the mouth**. Coins that hit the creature's shoulders bounce off its fur.
- A coin that touches the ground costs a life. You have **5 lives**.
- Every 5 catches in a row raise the score **multiplier** by one (up to **x8**). A miss resets it.
- Over about 2½ minutes, coins spawn faster, fall harder, and sometimes drop two at a time.
- Your best score is saved in the browser (`localStorage`).

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- [pnpm](https://pnpm.io/) 9 or newer
- A browser with WebGL 2

## Getting started

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite dev server with hot reload |
| `pnpm test` | Run the unit tests once (Vitest) |
| `pnpm typecheck` | Type-check the project with `tsc` |
| `pnpm build` | Type-check, then build a production bundle into `dist/` |
| `pnpm preview` | Serve the production build locally (run `pnpm build` first) |

## Testing

```bash
pnpm test
```

The tests in `tests/` cover the game rules in `src/domain`. They run without a browser: the random source is a stub, and time is stepped by hand. They check starting, jumping and double jumping, eating coins, the multiplier, losing lives, game over, best scores, the restart delay, bounces, following the pointer, steering with a held direction, and that the simulation behaves the same at any frame rate.

To re-run the tests on every change, use `pnpm exec vitest`.

## Building and deploying

```bash
pnpm build
pnpm preview   # optional: check the build at http://localhost:4173
```

`dist/` is a fully static site, so you can host it on any static file server (GitHub Pages, Netlify, S3, nginx, …).

## Project structure

The code follows a hexagonal (ports and adapters) architecture. The game rules don't depend on PixiJS or the browser.

```
src/
├── domain/        Game rules: Game, Creature, Coin, events, config, math helpers
├── ports/         Interfaces the domain and application depend on
│   ├── driving.ts   InputSource, FrameClock
│   └── driven.ts    GameView, SoundPlayer, ScoreStore, RandomSource
├── application/   GameSession: runs each frame (input → simulation → sound, rendering, saving)
├── adapters/
│   ├── pixi/        Rendering: fur shader, pixel-art coins, particles, HUD, screen effects
│   ├── input/       Mouse, touch and keyboard input
│   ├── audio/       Sound effects generated with the Web Audio API
│   ├── storage/     Best score stored in localStorage
│   └── clock/       requestAnimationFrame loop
└── main.ts        Entry point that wires everything together
tests/             Unit tests for the domain
scripts/shot.mjs   Dev tool for headless screenshots
```

Gameplay tuning (speeds, gravity, lives, difficulty ramp, …) lives in `src/domain/config.ts`.

## Headless screenshots (optional)

`scripts/shot.mjs` loads the running dev server in headless Chrome, plays a scripted list of actions, and saves screenshots. It needs Google Chrome at `/usr/bin/google-chrome`.

```bash
pnpm dev   # in another terminal
node scripts/shot.mjs http://localhost:5173 .shots/demo \
  '[{"click":[640,400]},{"track":5000},{"shot":true}]'
```

Supported actions:

- `move: [x, y]`: move the mouse
- `click: [x, y]`: click
- `key: "Space"`: press a key
- `wait: ms`: pause
- `track: ms`: play automatically by steering under the lowest coin
- `shot: true`: save a screenshot (add `clip` to capture part of the screen)
- `eval: "js"`: run JavaScript in the page and print the result

Set `DSF=2` to take high-DPI screenshots. Output goes to `.shots/`, which is git-ignored.
