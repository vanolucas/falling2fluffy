/** World height in world units; world width follows the viewport aspect ratio. */
export const WORLD_HEIGHT = 1000;

export interface CreatureConfig {
  radius: number;
  /** Horizontal spring pulling the creature toward the pointer. */
  followStiffness: number;
  followDamping: number;
  gravity: number;
  jumpSpeed: number;
  airJumpSpeed: number;
  airJumps: number;
  /** Half-width of the mouth catch span, relative to the radius. */
  mouthSpan: number;
}

export interface CoinConfig {
  radius: number;
  gravity: number;
  airDrag: number;
  restitution: number;
  /** Horizontal pull toward the mouth when a coin falls right above it. */
  suction: number;
}

export interface DifficultyConfig {
  /** Seconds of play until maximum difficulty. */
  rampSeconds: number;
  spawnInterval: readonly [easy: number, hard: number];
  gravityScale: readonly [easy: number, hard: number];
  doubleDropChance: readonly [easy: number, hard: number];
}

export interface GameConfig {
  groundY: number;
  lives: number;
  pointsPerCoin: number;
  coinsPerMultiplier: number;
  maxMultiplier: number;
  /** Delay before a finished game accepts a restart. */
  restartDelay: number;
  maxStep: number;
  creature: CreatureConfig;
  coin: CoinConfig;
  difficulty: DifficultyConfig;
}

export const defaultConfig: GameConfig = {
  groundY: 880,
  lives: 5,
  pointsPerCoin: 10,
  coinsPerMultiplier: 5,
  maxMultiplier: 8,
  restartDelay: 0.9,
  maxStep: 1 / 120,
  creature: {
    radius: 92,
    followStiffness: 110,
    followDamping: 17,
    gravity: 3400,
    jumpSpeed: 1450,
    airJumpSpeed: 1200,
    airJumps: 1,
    mouthSpan: 0.62,
  },
  coin: {
    radius: 46,
    gravity: 620,
    airDrag: 0.35,
    restitution: 0.55,
    suction: 5,
  },
  difficulty: {
    rampSeconds: 150,
    spawnInterval: [1.25, 0.38],
    gravityScale: [1, 1.65],
    doubleDropChance: [0, 0.3],
  },
};
