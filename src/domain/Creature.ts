import type { CreatureConfig } from './config';
import { clamp } from './math';

export type JumpKind = 'ground' | 'air';

/** Read-only view of the creature exposed to adapters. */
export interface CreatureState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  readonly grounded: boolean;
}

/** The furry player character: springs toward the pointer horizontally and jumps under gravity. */
export class Creature implements CreatureState {
  vx = 0;
  vy = 0;
  grounded = true;
  private airJumpsLeft: number;

  constructor(
    private readonly cfg: CreatureConfig,
    public x: number,
    public y: number,
  ) {
    this.airJumpsLeft = cfg.airJumps;
  }

  get radius(): number {
    return this.cfg.radius;
  }

  /** Jumps from the ground, or spends an air jump; returns null when no jump is available. */
  jump(): JumpKind | null {
    if (this.grounded) {
      this.vy = -this.cfg.jumpSpeed;
      this.grounded = false;
      return 'ground';
    }
    if (this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.vy = -this.cfg.airJumpSpeed;
      return 'air';
    }
    return null;
  }

  /** Advances physics; returns the impact speed when landing during this step. */
  step(dt: number, targetX: number | null, minX: number, maxX: number, groundY: number): number | null {
    const { followStiffness: k, followDamping: c } = this.cfg;

    // Damped spring toward the pointer gives a smooth, slightly bouncy follow
    const target = clamp(targetX ?? this.x, minX, maxX);
    this.vx += (k * (target - this.x) - c * this.vx) * dt;
    this.x += this.vx * dt;
    if (this.x < minX || this.x > maxX) {
      this.x = clamp(this.x, minX, maxX);
      this.vx *= -0.3;
    }

    if (this.grounded) return null;

    this.vy += this.cfg.gravity * dt;
    this.y += this.vy * dt;
    const restY = groundY - this.radius;
    if (this.y < restY) return null;

    const impact = this.vy;
    this.y = restY;
    this.vy = 0;
    this.grounded = true;
    this.airJumpsLeft = this.cfg.airJumps;
    return impact;
  }
}
