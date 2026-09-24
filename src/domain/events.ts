import type { JumpKind } from './Creature';

export type GameEvent =
  | { type: 'started' }
  | { type: 'jumped'; kind: JumpKind }
  | { type: 'landed'; impact: number }
  | { type: 'coinSpawned'; coinId: number }
  | { type: 'coinEaten'; coinId: number; x: number; y: number; points: number; streak: number; multiplier: number }
  | { type: 'coinBounced'; coinId: number; x: number; y: number; strength: number }
  | { type: 'coinMissed'; coinId: number; x: number; y: number; livesLeft: number }
  | { type: 'gameOver'; score: number; best: number; isNewBest: boolean };

export type GameEventType = GameEvent['type'];
