import { Container, Geometry, Mesh, Shader, Sprite, type Texture } from 'pixi.js';
import type { CoinState } from '../../domain/Coin';
import type { CreatureState } from '../../domain/Creature';
import type { GameEvent } from '../../domain/events';
import { clamp } from '../../domain/math';
import fragment from './shaders/creature.frag?raw';
import vertex from './shaders/creature.vert?raw';
import { Spring } from './Spring';

/** Half-size of the shader quad in body radii; leaves room for the fur fringe. */
const QUAD_EXTENT = 1.45;
/** Shader body radius relative to the collision radius; the fur fringe reaches ~1.15. */
const BODY_SCALE = 0.86;
/** Raise so fur tips just brush the floor. */
const LIFT = 0.08;
/** Mouth and eye centers in body-local space (y down), matching the shader. */
const MOUTH_Y = 0.02;
const EYE_Y = -0.5;

interface CreatureUniforms {
  uTime: number;
  uMouthOpen: number;
  uBlink: number;
  uSquint: number;
  uLook: Float32Array;
  uSway: Float32Array;
}

/** Renders the furry creature with a procedural shader and drives its facial and body animation. */
export class CreatureView {
  readonly body = new Container();
  readonly shadow: Sprite;

  private readonly mesh: Mesh<Geometry, Shader>;
  private readonly uniforms: CreatureUniforms;
  private time = 0;

  private readonly mouth = new Spring(0.5, 260, 14);
  private readonly stretch = new Spring(0, 320, 11);
  private readonly tilt = new Spring(0, 120, 12);
  private readonly swayX = new Spring(0, 90, 6);
  private readonly swayY = new Spring(0, 90, 6);
  private readonly lookX = new Spring(0, 160, 18);
  private readonly lookY = new Spring(0, 160, 18);
  private readonly squint = new Spring(0, 200, 20);
  private chompTimer = 0;
  private happyTimer = 0;
  private blinkTimer = 2;
  private blinkPhase = -1;

  constructor(shadowTexture: Texture) {
    const e = QUAD_EXTENT;
    const geometry = new Geometry({
      attributes: { aPosition: [-e, -e, e, -e, e, e, -e, e] },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const shader = Shader.from({
      gl: { vertex, fragment },
      resources: {
        creatureUniforms: {
          uTime: { value: 0, type: 'f32' },
          uMouthOpen: { value: 0.5, type: 'f32' },
          uBlink: { value: 0, type: 'f32' },
          uSquint: { value: 0, type: 'f32' },
          uLook: { value: new Float32Array(2), type: 'vec2<f32>' },
          uSway: { value: new Float32Array(2), type: 'vec2<f32>' },
        },
      },
    });
    this.uniforms = shader.resources.creatureUniforms.uniforms as CreatureUniforms;
    this.mesh = new Mesh({ geometry, shader });
    this.body.addChild(this.mesh);

    this.shadow = new Sprite({ texture: shadowTexture, anchor: 0.5, tint: 0x000000 });
  }

  /** World position of the mouth, where swallowed coins are pulled to. */
  mouthPosition(creature: CreatureState): { x: number; y: number } {
    return { x: creature.x, y: creature.y + creature.radius * (MOUTH_Y * BODY_SCALE - LIFT) };
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'jumped':
        this.stretch.kick(event.kind === 'ground' ? 5 : 4);
        this.mouth.kick(-3);
        break;
      case 'landed':
        this.stretch.kick(-clamp(event.impact * 0.0045, 1, 7));
        break;
      case 'coinEaten':
        this.chompTimer = 0.085;
        this.happyTimer = 0.45;
        this.stretch.kick(-2.5);
        break;
      case 'coinMissed':
        this.blinkPhase = 0;
        break;
      case 'coinBounced':
        this.stretch.kick(-1.5);
        this.blinkPhase = 0;
        break;
    }
  }

  update(dt: number, creature: CreatureState, coins: readonly CoinState[], groundY: number): void {
    this.time += dt;
    const r = creature.radius;
    const target = this.nearestIncoming(creature, coins);

    this.animateMouth(dt, creature, target);
    this.animateEyes(dt, creature, target);

    // Squash & stretch preserves volume and keeps the feet planted
    const s = this.stretch.update(dt) + Math.sin(this.time * 2.4) * 0.012;
    const sy = 1 + clamp(s, -0.35, 0.35);
    const sx = 1 / Math.sqrt(sy);
    this.tilt.target = clamp(creature.vx * 0.00022, -0.28, 0.28);
    this.body.position.set(creature.x, creature.y + r * (1 - sy - LIFT));
    this.body.rotation = this.tilt.update(dt);
    this.mesh.scale.set(r * BODY_SCALE * sx, r * BODY_SCALE * sy);

    // Fur trails behind motion (local space is y-up)
    this.swayX.target = clamp(-creature.vx * 0.00011, -0.14, 0.14);
    this.swayY.target = clamp(creature.vy * 0.00007, -0.1, 0.1);
    this.uniforms.uSway[0] = this.swayX.update(dt);
    this.uniforms.uSway[1] = this.swayY.update(dt);
    this.uniforms.uTime = this.time;

    const height = clamp((groundY - (creature.y + r)) / 400, 0, 1);
    this.shadow.position.set(creature.x, groundY + 4);
    this.shadow.width = r * 2.6 * sx * (1 - height * 0.4);
    this.shadow.height = r * 0.42 * (1 - height * 0.4);
    this.shadow.alpha = 0.6 * (1 - height * 0.7);
  }

  private nearestIncoming(creature: CreatureState, coins: readonly CoinState[]): CoinState | null {
    let best: CoinState | null = null;
    let bestDist = Infinity;
    for (const coin of coins) {
      const d = Math.hypot(coin.x - creature.x, coin.y - creature.y);
      if (d < bestDist) {
        bestDist = d;
        best = coin;
      }
    }
    return best;
  }

  private animateMouth(dt: number, creature: CreatureState, target: CoinState | null): void {
    // Opens wide in anticipation as a coin approaches, snaps shut on a catch
    let open = 0.42 + Math.sin(this.time * 2.4) * 0.05;
    if (target) {
      const d = Math.hypot(target.x - creature.x, target.y - creature.y) / creature.radius;
      open = Math.max(open, clamp(1.25 - d * 0.18, 0, 1));
    }
    this.chompTimer -= dt;
    this.mouth.target = this.chompTimer > 0 ? -0.05 : open;
    this.uniforms.uMouthOpen = clamp(this.mouth.update(dt), 0, 1.1);
  }

  private animateEyes(dt: number, creature: CreatureState, target: CoinState | null): void {
    const eyeY = creature.y + creature.radius * (EYE_Y * BODY_SCALE - LIFT);
    if (target) {
      const dx = target.x - creature.x;
      const dy = eyeY - target.y;
      const len = Math.hypot(dx, dy) || 1;
      const reach = clamp(len / (creature.radius * 1.5), 0, 1);
      this.lookX.target = (dx / len) * reach;
      this.lookY.target = (dy / len) * reach;
    } else {
      this.lookX.target = Math.sin(this.time * 0.5) * 0.4 + clamp(creature.vx * 0.001, -0.5, 0.5);
      this.lookY.target = 0.1 + Math.sin(this.time * 0.37) * 0.2;
    }
    this.uniforms.uLook[0] = this.lookX.update(dt);
    this.uniforms.uLook[1] = this.lookY.update(dt);

    this.happyTimer -= dt;
    this.squint.target = this.happyTimer > 0 ? 0.75 : 0;
    this.uniforms.uSquint = clamp(this.squint.update(dt), 0, 1);

    // Blinks at random intervals, sometimes twice in a row
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.blinkTimer = Math.random() < 0.2 ? 0.25 : 1.8 + Math.random() * 3.5;
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.17;
      this.uniforms.uBlink = Math.sin(Math.min(this.blinkPhase, 1) * Math.PI);
      if (this.blinkPhase >= 1) this.blinkPhase = -1;
    }
  }
}
