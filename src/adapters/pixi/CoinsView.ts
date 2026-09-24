import { Container, Sprite, type Texture } from 'pixi.js';
import type { CoinState } from '../../domain/Coin';
import type { GameEvent } from '../../domain/events';
import { clamp } from '../../domain/math';
import type { Particles } from './Particles';
import { COIN_ART_DIAMETER, COIN_PALETTE } from './pixelArt';

export interface CoinTextures {
  frames: Texture[];
  glow: Texture;
  glint: Texture;
}

interface CoinVisual {
  root: Container;
  coin: Sprite;
  glow: Sprite;
  glint: Sprite;
  shadow: Sprite;
  trailTimer: number;
  glintTimer: number;
}

interface Swallow {
  visual: CoinVisual;
  t: number;
}

const SWALLOW_TIME = 0.11;
const TAU = Math.PI * 2;
const hex = (color: string): number => parseInt(color.slice(1), 16);
const SHARD_COLORS = Object.values(COIN_PALETTE).map(hex);
const SPARK_COLORS = [COIN_PALETTE.shine, COIN_PALETTE.faceLight, COIN_PALETTE.face, '#ffffff'].map(hex);

/** Pixel-art coins with glow, trails, ground shadows, swallow and shatter effects. */
export class CoinsView {
  readonly shadows = new Container();
  readonly layer = new Container();
  private readonly visuals = new Map<number, CoinVisual>();
  private readonly swallows: Swallow[] = [];
  private readonly handled = new Set<number>();

  constructor(
    private readonly textures: CoinTextures,
    private readonly shadowTexture: Texture,
    private readonly particles: Particles,
  ) {}

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'coinEaten': {
        const visual = this.visuals.get(event.coinId);
        this.handled.add(event.coinId);
        this.burst(event.x, event.y, 18 + Math.min(event.multiplier, 8) * 3);
        if (visual) this.swallows.push({ visual, t: 0 });
        break;
      }
      case 'coinMissed':
        this.handled.add(event.coinId);
        this.shatter(event.x, event.y);
        break;
    }
  }

  update(dt: number, coins: readonly CoinState[], groundY: number, mouth: { x: number; y: number }): void {
    const seen = new Set<number>();
    for (const coin of coins) {
      seen.add(coin.id);
      const visual = this.visuals.get(coin.id) ?? this.create(coin);
      this.place(visual, coin, groundY, dt);
    }

    // Coins that left the game: eaten ones are swallowed, the rest vanish in a puff
    for (const [id, visual] of this.visuals) {
      if (seen.has(id)) continue;
      this.visuals.delete(id);
      if (this.handled.delete(id)) {
        visual.shadow.destroy();
        if (!this.swallows.some((s) => s.visual === visual)) visual.root.destroy({ children: true });
      } else {
        this.burst(visual.root.x, visual.root.y, 10);
        visual.shadow.destroy();
        visual.root.destroy({ children: true });
      }
    }

    this.updateSwallows(dt, mouth);
  }

  private create(coin: CoinState): CoinVisual {
    const { frames, glow: glowTexture, glint: glintTexture } = this.textures;
    const pixel = (coin.radius * 2) / COIN_ART_DIAMETER;
    const glow = new Sprite({ texture: glowTexture, anchor: 0.5, tint: 0xff9a2a, blendMode: 'add', alpha: 0.35 });
    glow.width = glow.height = coin.radius * 3.2;
    const sprite = new Sprite({ texture: frames[0], anchor: 0.5, scale: pixel });
    const glint = new Sprite({ texture: glintTexture, anchor: 0.5, scale: pixel, visible: false });
    const root = new Container({ children: [glow, sprite, glint] });
    const shadow = new Sprite({ texture: this.shadowTexture, anchor: 0.5, tint: 0x000000 });
    this.layer.addChild(root);
    this.shadows.addChild(shadow);

    const visual: CoinVisual = { root, coin: sprite, glow, glint, shadow, trailTimer: 0, glintTimer: Math.random() * 2 };
    this.visuals.set(coin.id, visual);
    return visual;
  }

  private place(v: CoinVisual, coin: CoinState, groundY: number, dt: number): void {
    const frames = this.textures.frames;
    const spin = ((coin.spin % TAU) + TAU) % TAU;
    v.coin.texture = frames[Math.floor((spin / TAU) * frames.length) % frames.length];
    v.root.position.set(coin.x, coin.y);
    v.glow.alpha = 0.3 + Math.sin(coin.spin * 0.5) * 0.08;

    // Ground shadow sharpens as the coin approaches: shows where it will land
    const height = groundY - coin.y;
    const near = clamp(1 - height / 900, 0, 1);
    v.shadow.position.set(coin.x, groundY + 3);
    v.shadow.width = coin.radius * (1.2 + near * 1.2);
    v.shadow.height = coin.radius * (0.25 + near * 0.25);
    v.shadow.alpha = near * near * 0.7;

    v.trailTimer -= dt;
    if (v.trailTimer <= 0 && coin.vy > 150) {
      v.trailTimer = 0.03;
      const pixel = (coin.radius * 2) / COIN_ART_DIAMETER;
      this.particles.emit({
        x: coin.x + (Math.random() - 0.5) * coin.radius,
        y: coin.y - coin.radius * 0.6,
        vx: (Math.random() - 0.5) * 30,
        vy: -20,
        size: pixel,
        color: SPARK_COLORS[1 + Math.floor(Math.random() * 2)],
        life: 0.35,
        endScale: 0.2,
        additive: true,
      });
    }

    // Occasional pixel glint across the coin face
    v.glintTimer -= dt;
    v.glint.visible = v.glintTimer < 0.24 && v.glintTimer > 0;
    if (v.glint.visible) {
      const k = Math.sin((v.glintTimer / 0.24) * Math.PI);
      v.glint.position.set(-coin.radius * 0.35, -coin.radius * 0.35);
      v.glint.alpha = k;
    }
    if (v.glintTimer <= 0) v.glintTimer = 0.8 + Math.random() * 1.6;
  }

  private updateSwallows(dt: number, mouth: { x: number; y: number }): void {
    for (let i = this.swallows.length - 1; i >= 0; i--) {
      const s = this.swallows[i];
      s.t += dt / SWALLOW_TIME;
      const root = s.visual.root;
      const k = Math.min(1, s.t);
      root.x += (mouth.x - root.x) * Math.min(1, k * 0.9 + 0.2);
      root.y += (mouth.y - root.y) * Math.min(1, k * 0.9 + 0.2);
      root.scale.set(1 - 0.8 * k);
      root.alpha = 1 - k * k;
      if (s.t >= 1) {
        root.destroy({ children: true });
        this.swallows.splice(i, 1);
      }
    }
  }

  private burst(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const speed = 250 + Math.random() * 550;
      this.particles.emit({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 150,
        size: 5 + Math.floor(Math.random() * 2) * 5,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        life: 0.35 + Math.random() * 0.4,
        gravity: 900,
        drag: 2.5,
        endScale: 0.2,
        additive: true,
      });
    }
  }

  private shatter(x: number, y: number): void {
    for (let i = 0; i < 22; i++) {
      this.particles.emit({
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 800,
        vy: -250 - Math.random() * 650,
        size: 5 * (1 + Math.floor(Math.random() * 2)),
        color: SHARD_COLORS[Math.floor(Math.random() * SHARD_COLORS.length)],
        life: 1 + Math.random() * 0.8,
        gravity: 2400,
        bounce: 0.4,
        endScale: 0.6,
        spin: (Math.random() - 0.5) * 20,
      });
    }
  }
}
