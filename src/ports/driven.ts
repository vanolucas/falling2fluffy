import type { GameEvent } from '../domain/events';
import type { GameState } from '../domain/Game';

/** Uniform random number in [0, 1). */
export type RandomSource = () => number;

/** Presents the game state; driven once per frame. */
export interface GameView {
  /** Viewport width / height, used to size the world. */
  readonly aspect: number;
  render(state: GameState, events: readonly GameEvent[], dt: number): void;
}

export interface SoundPlayer {
  play(events: readonly GameEvent[]): void;
}

export interface ScoreStore {
  loadBest(): number;
  saveBest(score: number): void;
}
