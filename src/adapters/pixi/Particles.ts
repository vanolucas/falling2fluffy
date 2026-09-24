import { Container, Sprite, Texture } from 'pixi.js';

export interface ParticleSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: number;
  life: number;
  texture?: Texture;
  gravity?: number;
  /** Fraction of velocity lost per second. */
  drag?: number;
  /** Bounce restitution on the ground; undefined passes through. */
  bounce?: number;
  /** Final size relative to the initial size. */
  endScale?: number;
  spin?: number;
  additive?: boolean;
}

interface Particle extends Required<Omit<ParticleSpec, 'texture' | 'x' | 'y' | 'color' | 'additive' | 'bounce'>> {
  sprite: Sprite;
  age: number;
  bounce: number | undefined;
}

/** Pooled sprite particles with simple ballistic physics. */
export class Particles {
  readonly layer = new Container();
  private readonly alive: Particle[] = [];
  private readonly pool: Sprite[] = [];

  constructor(private readonly groundY: () => number) {}

  emit(spec: ParticleSpec): void {
    const sprite = this.pool.pop() ?? new Sprite({ anchor: 0.5 });
    sprite.texture = spec.texture ?? Texture.WHITE;
    sprite.tint = spec.color;
    sprite.blendMode = spec.additive ? 'add' : 'normal';
    sprite.position.set(spec.x, spec.y);
    sprite.rotation = 0;
    sprite.alpha = 1;
    sprite.visible = true;
    this.layer.addChild(sprite);
    this.alive.push({
      sprite,
      age: 0,
      vx: spec.vx,
      vy: spec.vy,
      size: spec.size,
      life: spec.life,
      gravity: spec.gravity ?? 0,
      drag: spec.drag ?? 0,
      bounce: spec.bounce,
      endScale: spec.endScale ?? 0,
      spin: spec.spin ?? 0,
    });
    this.resize(this.alive[this.alive.length - 1], 0);
  }

  update(dt: number): void {
    const ground = this.groundY();
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const p = this.alive[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.release(i);
        continue;
      }
      p.vy += p.gravity * dt;
      const keep = Math.max(0, 1 - p.drag * dt);
      p.vx *= keep;
      p.vy *= keep;
      const s = p.sprite;
      s.x += p.vx * dt;
      s.y += p.vy * dt;
      if (p.bounce !== undefined && s.y > ground - p.size / 2) {
        s.y = ground - p.size / 2;
        p.vy = -Math.abs(p.vy) * p.bounce;
        p.vx *= 0.7;
        p.spin *= 0.5;
      }
      s.rotation += p.spin * dt;
      s.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      this.resize(p, t);
    }
  }

  private resize(p: Particle, t: number): void {
    const size = p.size * (1 + (p.endScale - 1) * t);
    p.sprite.width = size;
    p.sprite.height = size;
  }

  private release(index: number): void {
    // Swap-remove: safe while iterating backwards
    const p = this.alive[index];
    this.alive[index] = this.alive[this.alive.length - 1];
    this.alive.pop();
    p.sprite.visible = false;
    this.layer.removeChild(p.sprite);
    this.pool.push(p.sprite);
  }
}
