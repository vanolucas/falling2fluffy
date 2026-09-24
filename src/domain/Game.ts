import { Coin, type CoinState } from './Coin';
import { WORLD_HEIGHT, type GameConfig } from './config';
import { Creature, type CreatureState } from './Creature';
import type { GameEvent } from './events';
import { clamp, lerp } from './math';
import type { RandomSource } from '../ports/driven';

export type Phase = 'ready' | 'playing' | 'over';

/** Player intent for one frame, in world units. */
export interface Controls {
  targetX: number | null;
  jump: boolean;
  confirm: boolean;
}

/** Read-only game state exposed to adapters. */
export interface GameState {
  readonly phase: Phase;
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly groundY: number;
  readonly creature: CreatureState;
  readonly coins: readonly CoinState[];
  readonly score: number;
  readonly best: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly streak: number;
  readonly multiplier: number;
}

type CoinContact = 'eaten' | 'bounced' | null;

/** Game aggregate: coin spawning, physics, collisions with the creature, scoring and lives. */
export class Game implements GameState {
  phase: Phase = 'ready';
  score = 0;
  streak = 0;
  lives: number;
  best: number;
  readonly worldHeight = WORLD_HEIGHT;
  readonly creature: Creature;

  private readonly liveCoins: Coin[] = [];
  private events: GameEvent[] = [];
  private playTime = 0;
  private spawnTimer = 0;
  private overTime = 0;
  private nextCoinId = 1;

  constructor(
    private readonly cfg: GameConfig,
    private readonly random: RandomSource,
    best = 0,
    public worldWidth = WORLD_HEIGHT * (16 / 9),
  ) {
    this.best = best;
    this.lives = cfg.lives;
    this.creature = new Creature(cfg.creature, worldWidth / 2, cfg.groundY - cfg.creature.radius);
  }

  get coins(): readonly CoinState[] {
    return this.liveCoins;
  }

  get groundY(): number {
    return this.cfg.groundY;
  }

  get maxLives(): number {
    return this.cfg.lives;
  }

  get multiplier(): number {
    return Math.min(this.cfg.maxMultiplier, 1 + Math.floor(this.streak / this.cfg.coinsPerMultiplier));
  }

  /** Difficulty progress in [0, 1]. */
  get level(): number {
    return clamp(this.playTime / this.cfg.difficulty.rampSeconds, 0, 1);
  }

  resize(worldWidth: number): void {
    this.worldWidth = worldWidth;
  }

  /** Advances the simulation in fixed-size substeps and returns the events that occurred. */
  update(dt: number, controls: Controls): GameEvent[] {
    this.applyControls(controls);

    const steps = Math.max(1, Math.ceil(dt / this.cfg.maxStep));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, controls.targetX);

    const events = this.events;
    this.events = [];
    return events;
  }

  private applyControls({ jump, confirm }: Controls): void {
    const wantsStart = jump || confirm;
    const canRestart = this.phase === 'over' && this.overTime >= this.cfg.restartDelay;
    if (wantsStart && (this.phase === 'ready' || canRestart)) this.start();

    if (jump) {
      const kind = this.creature.jump();
      if (kind) this.emit({ type: 'jumped', kind });
    }
  }

  private start(): void {
    this.phase = 'playing';
    this.score = 0;
    this.streak = 0;
    this.lives = this.cfg.lives;
    this.playTime = 0;
    this.spawnTimer = 0.6;
    this.liveCoins.length = 0;
    this.emit({ type: 'started' });
  }

  private step(h: number, targetX: number | null): void {
    const r = this.creature.radius;
    const impact = this.creature.step(h, targetX, r, this.worldWidth - r, this.cfg.groundY);
    if (impact !== null) this.emit({ type: 'landed', impact });

    if (this.phase === 'over') this.overTime += h;
    if (this.phase !== 'playing') return;

    this.playTime += h;
    this.spawnCoins(h);
    this.updateCoins(h);
  }

  private spawnCoins(h: number): void {
    this.spawnTimer -= h;
    if (this.spawnTimer > 0) return;

    const { spawnInterval, doubleDropChance } = this.cfg.difficulty;
    this.spawnCoin();
    if (this.random() < lerp(...doubleDropChance, this.level)) this.spawnCoin();
    this.spawnTimer = lerp(...spawnInterval, this.level) * (0.7 + 0.6 * this.random());
  }

  private spawnCoin(): void {
    const r = this.cfg.coin.radius;
    const rnd = this.random;
    const coin = new Coin(
      this.nextCoinId++,
      r,
      r + rnd() * (this.worldWidth - 2 * r),
      -r * 1.5,
      (rnd() - 0.5) * 120,
      40 + rnd() * 100,
      (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 5),
      rnd() * Math.PI * 2,
    );
    this.liveCoins.push(coin);
    this.emit({ type: 'coinSpawned', coinId: coin.id });
  }

  private updateCoins(h: number): void {
    const { gravity, airDrag } = this.cfg.coin;
    const g = gravity * lerp(...this.cfg.difficulty.gravityScale, this.level);

    for (let i = this.liveCoins.length - 1; i >= 0; i--) {
      const coin = this.liveCoins[i];
      coin.vy += g * h;
      coin.vx -= coin.vx * airDrag * h;
      this.applySuction(coin, h);
      coin.x += coin.vx * h;
      coin.y += coin.vy * h;
      coin.spin += coin.spinRate * h;
      this.bounceOffWalls(coin);

      if (this.contact(coin) === 'eaten') {
        this.liveCoins.splice(i, 1);
        this.eat(coin);
      } else if (coin.y + coin.radius >= this.cfg.groundY) {
        this.liveCoins.splice(i, 1);
        this.miss(coin);
        if (this.phase !== 'playing') return;
      }
    }
  }

  /** Gently steers coins falling right above the mouth into it. */
  private applySuction(coin: Coin, h: number): void {
    const c = this.creature;
    const dx = coin.x - c.x;
    const height = c.y - coin.y;
    const range = c.radius * 3.2;
    if (height <= 0 || height > range || Math.abs(dx) > c.radius * 1.5) return;
    coin.vx -= dx * this.cfg.coin.suction * (1 - height / range) * h;
  }

  private bounceOffWalls(coin: Coin): void {
    const r = coin.radius;
    if (coin.x < r) {
      coin.x = r;
      coin.vx = Math.abs(coin.vx) * 0.6;
    } else if (coin.x > this.worldWidth - r) {
      coin.x = this.worldWidth - r;
      coin.vx = -Math.abs(coin.vx) * 0.6;
    }
  }

  /** Coins hitting the mouth span are eaten; elsewhere they bounce off the fur. */
  private contact(coin: Coin): CoinContact {
    const c = this.creature;
    const dx = coin.x - c.x;
    const dy = coin.y - c.y;
    const dist = Math.hypot(dx, dy);
    const bodyReach = c.radius + coin.radius * 0.6;
    if (dist >= bodyReach || dist === 0) return null;

    if (Math.abs(dx) < c.radius * this.cfg.creature.mouthSpan) return 'eaten';

    const nx = dx / dist;
    const ny = dy / dist;
    coin.x = c.x + nx * bodyReach;
    coin.y = c.y + ny * bodyReach;

    const vn = (coin.vx - c.vx) * nx + (coin.vy - c.vy) * ny;
    if (vn >= 0) return null;
    const e = this.cfg.coin.restitution;
    coin.vx -= (1 + e) * vn * nx;
    coin.vy -= (1 + e) * vn * ny;
    coin.spinRate += vn * 0.02 * Math.sign(nx);
    if (-vn > 60) this.emit({ type: 'coinBounced', coinId: coin.id, x: coin.x, y: coin.y, strength: -vn });
    return 'bounced';
  }

  private eat(coin: Coin): void {
    this.streak++;
    const multiplier = this.multiplier;
    const points = this.cfg.pointsPerCoin * multiplier;
    this.score += points;
    this.emit({ type: 'coinEaten', coinId: coin.id, x: coin.x, y: coin.y, points, streak: this.streak, multiplier });
  }

  private miss(coin: Coin): void {
    this.streak = 0;
    this.lives--;
    this.emit({ type: 'coinMissed', coinId: coin.id, x: coin.x, y: coin.y, livesLeft: this.lives });
    if (this.lives <= 0) this.end();
  }

  private end(): void {
    const isNewBest = this.score > this.best;
    this.best = Math.max(this.best, this.score);
    this.phase = 'over';
    this.overTime = 0;
    this.liveCoins.length = 0;
    this.emit({ type: 'gameOver', score: this.score, best: this.best, isNewBest });
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
  }
}
