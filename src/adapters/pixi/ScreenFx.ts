import { Sprite, Texture } from 'pixi.js';

/** Trauma-based screen shake and full-screen color flashes. */
export class ScreenFx {
  readonly flash = new Sprite({ texture: Texture.WHITE, alpha: 0 });
  private trauma = 0;
  private time = 0;

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  flashColor(color: number, alpha: number): void {
    this.flash.tint = color;
    this.flash.alpha = Math.max(this.flash.alpha, alpha);
  }

  /** Returns the shake offset in world units for this frame. */
  update(dt: number, width: number, height: number): { x: number; y: number; rotation: number } {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flash.alpha = Math.max(0, this.flash.alpha - dt * 3);
    this.flash.setSize(width, height);

    // Squared trauma feels natural: small hits barely shake, big ones rattle
    const s = this.trauma * this.trauma;
    const t = this.time * 38;
    return {
      x: s * 26 * Math.sin(t * 1.1 + Math.sin(t * 0.7)),
      y: s * 22 * Math.sin(t * 1.37 + 2 + Math.sin(t * 0.53)),
      rotation: s * 0.025 * Math.sin(t * 0.91 + 4),
    };
  }
}
