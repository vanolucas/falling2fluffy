import { Container, Sprite, type Texture } from 'pixi.js';
import type { GameEvent } from '../../domain/events';
import type { GameState } from '../../domain/Game';
import type { PixelFont } from './PixelFont';
import { Spring } from './Spring';

const GOLD = '#ffd23f';
const CREAM = '#e8c9a8';
const MUTED = '#8a6a55';
const MULTIPLIER_COLORS = ['#ffd23f', '#ffd23f', '#ffb02a', '#ff8a2a', '#ff6a3a', '#ff4a6a', '#e05aff', '#8a7aff', '#5ad8ff'];

/** A bitmap-font text sprite that only re-renders when its text changes. */
class PixelLabel extends Sprite {
  private key = '';

  constructor(private readonly font: PixelFont, anchorX = 0) {
    super();
    this.anchor.set(anchorX, 0.5);
  }

  set(text: string, color: string, pixel: number): this {
    const key = `${text}|${color}`;
    if (key !== this.key) {
      this.key = key;
      this.texture = this.font.texture(text, { color });
    }
    this.scale.set(pixel);
    return this;
  }
}

interface Popup {
  label: PixelLabel;
  age: number;
}

/** Score, best, lives, multiplier, title and game-over screens, and floating score popups. */
export class Hud {
  readonly layer = new Container();
  private readonly scoreLabel: PixelLabel;
  private readonly score: PixelLabel;
  private readonly best: PixelLabel;
  private readonly multiplier: PixelLabel;
  private readonly hearts: Sprite[] = [];
  private readonly heartPops: Spring[] = [];
  private readonly lines: PixelLabel[];
  private readonly popups: Popup[] = [];
  private readonly scorePop = new Spring(1, 300, 14);
  private readonly multiplierPop = new Spring(1, 300, 12);
  private newBest = false;
  private time = 0;

  constructor(
    private readonly font: PixelFont,
    private readonly heartTextures: { full: Texture; empty: Texture },
  ) {
    this.scoreLabel = new PixelLabel(font);
    this.score = new PixelLabel(font);
    this.best = new PixelLabel(font);
    this.multiplier = new PixelLabel(font);
    this.lines = Array.from({ length: 4 }, () => new PixelLabel(font, 0.5));
    this.layer.addChild(this.scoreLabel, this.score, this.best, this.multiplier, ...this.lines);
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case 'coinEaten':
        this.scorePop.kick(6);
        if (event.streak > 1 && event.multiplier > 1 && event.streak % 5 === 0) this.multiplierPop.kick(14);
        this.popup(event.x, event.y - 60, `+${event.points}`, MULTIPLIER_COLORS[event.multiplier] ?? GOLD);
        break;
      case 'coinMissed':
        this.heartPops[event.livesLeft]?.kick(16);
        break;
      case 'gameOver':
        this.newBest = event.isNewBest;
        break;
      case 'started':
        this.newBest = false;
        break;
    }
  }

  update(dt: number, state: GameState): void {
    this.time += dt;
    const w = state.worldWidth;
    const margin = 32;

    this.scoreLabel.set('SCORE', MUTED, 4).position.set(margin, 34);
    const scorePx = 7 * this.scorePop.update(dt);
    this.score.set(String(state.score), GOLD, scorePx).position.set(margin, 78);
    this.best.set(`BEST ${state.best}`, MUTED, 4).position.set(margin, 124);

    const m = state.multiplier;
    this.multiplier.visible = state.phase === 'playing' && m > 1;
    this.multiplier
      .set(`x${m}`, MULTIPLIER_COLORS[m] ?? GOLD, 7 * this.multiplierPop.update(dt))
      .position.set(margin + this.score.width + 24, 78);

    this.updateHearts(dt, state, w, margin);
    this.updateScreens(state, w);
    this.updatePopups(dt);
  }

  private updateHearts(dt: number, state: GameState, width: number, margin: number): void {
    while (this.hearts.length < state.maxLives) {
      const heart = new Sprite({ anchor: 0.5 });
      this.hearts.push(heart);
      this.heartPops.push(new Spring(1, 260, 10));
      this.layer.addChild(heart);
    }
    this.hearts.forEach((heart, i) => {
      const full = i < state.lives || state.phase === 'ready';
      heart.texture = full ? this.heartTextures.full : this.heartTextures.empty;
      heart.scale.set(6 * this.heartPops[i].update(dt));
      heart.position.set(width - margin - 22 - (state.maxLives - 1 - i) * 52, 60);
    });
  }

  private updateScreens(state: GameState, width: number): void {
    const blink = Math.sin(this.time * 5) > -0.2;
    const fit = (text: string, pixel: number): number => Math.min(pixel, (width - 60) / (text.length * 6));
    const [a, b, c, d] = this.lines;
    const show = (label: PixelLabel, text: string, color: string, pixel: number, y: number, visible = true): void => {
      label.set(text, color, fit(text, pixel)).position.set(width / 2, y);
      label.visible = visible;
    };

    const bob = Math.sin(this.time * 2) * 8;
    if (state.phase === 'ready') {
      show(a, 'FALLING 2 FLUFFY', GOLD, 11, 250 + bob);
      show(b, 'MOVE: MOUSE OR ARROWS - JUMP: CLICK OR SPACE', CREAM, 4, 370);
      show(c, 'CLICK OR PRESS SPACE TO START', '#ffffff', 5, 430, blink);
      d.visible = false;
    } else if (state.phase === 'over') {
      show(a, 'GAME OVER', '#ff5a4a', 12, 240 + bob);
      show(b, `SCORE ${state.score}`, GOLD, 7, 360);
      show(c, 'NEW BEST!', '#5ad8ff', 5, 425, this.newBest && blink);
      show(d, 'CLICK OR PRESS SPACE TO RETRY', CREAM, 4, 490);
    } else {
      for (const label of this.lines) label.visible = false;
    }
  }

  private popup(x: number, y: number, text: string, color: string): void {
    const label = new PixelLabel(this.font, 0.5).set(text, color, 5);
    label.position.set(x, y);
    this.layer.addChild(label);
    this.popups.push({ label, age: 0 });
  }

  private updatePopups(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      const t = p.age / 0.9;
      p.label.y -= 110 * dt * (1 - t);
      p.label.scale.set(5 * (t < 0.12 ? 0.6 + (t / 0.12) * 0.8 : 1.4 - Math.min(0.4, (t - 0.12) * 2)));
      p.label.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      if (t >= 1) {
        p.label.destroy();
        this.popups.splice(i, 1);
      }
    }
  }
}
