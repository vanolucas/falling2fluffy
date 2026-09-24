import { AnimationFrameClock } from './adapters/clock/AnimationFrameClock';
import { WebAudioSound } from './adapters/audio/WebAudioSound';
import { DomInput } from './adapters/input/DomInput';
import { PixiGameView } from './adapters/pixi/PixiGameView';
import { LocalStorageScoreStore } from './adapters/storage/LocalStorageScoreStore';
import { GameSession } from './application/GameSession';
import { defaultConfig, WORLD_HEIGHT } from './domain/config';
import { Game } from './domain/Game';

/** Composition root: wires the domain to its adapters. */
async function main(): Promise<void> {
  const host = document.getElementById('game');
  if (!host) throw new Error('Missing #game container');

  const view = await PixiGameView.create(host);
  const scores = new LocalStorageScoreStore();
  const game = new Game(defaultConfig, Math.random, scores.loadBest(), WORLD_HEIGHT * view.aspect);
  const session = new GameSession(game, new DomInput(host), view, new WebAudioSound(), scores, new AnimationFrameClock());
  session.start();
  // Dev-only handle for automated screenshots
  if (import.meta.env.DEV) Object.assign(window, { game });
}

main().catch((err: unknown) => {
  console.error('Failed to start the game', err);
  document.body.textContent = 'Sorry, the game failed to start (WebGL required).';
});
