import { Container, Sprite, type Texture } from 'pixi.js';
import { canvasTexture, verticalGradientTexture } from './textures';

interface Mote {
  sprite: Sprite;
  speed: number;
  phase: number;
}

/** Moody warm backdrop: sky gradient, spotlight, floor, drifting dust motes and vignette (world units). */
export class Backdrop {
  readonly back = new Container();
  readonly front = new Container();
  private readonly sky: Sprite;
  private readonly spotlight: Sprite;
  private readonly floor: Sprite;
  private readonly floorEdge: Sprite;
  private readonly vignette: Sprite;
  private readonly motes: Mote[] = [];
  private width = 0;
  private groundY = 0;
  private time = 0;

  constructor(dot: Texture, private readonly height: number) {
    this.sky = new Sprite(
      verticalGradientTexture([
        [0, '#3a2433'],
        [0.6, '#24161f'],
        [1, '#170e13'],
      ]),
    );
    this.spotlight = new Sprite({ texture: dot, anchor: 0.5, tint: 0xff9d4a, blendMode: 'add', alpha: 0.16 });
    this.floor = new Sprite(
      verticalGradientTexture([
        [0, '#3a2728'],
        [0.15, '#241819'],
        [1, '#0b0708'],
      ]),
    );
    this.floorEdge = new Sprite(
      verticalGradientTexture([
        [0, 'rgba(255,170,110,0)'],
        [0.5, 'rgba(255,170,110,0.22)'],
        [1, 'rgba(255,170,110,0)'],
      ]),
    );
    this.vignette = new Sprite(
      canvasTexture(256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.25, w / 2, h / 2, w * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }),
    );
    this.back.addChild(this.sky, this.spotlight, this.floor, this.floorEdge);

    for (let i = 0; i < 46; i++) {
      const sprite = new Sprite({ texture: dot, anchor: 0.5, tint: 0xffc890, blendMode: 'add' });
      sprite.width = sprite.height = 4 + Math.random() * 10;
      sprite.alpha = 0.08 + Math.random() * 0.2;
      sprite.position.set(Math.random(), Math.random() * height);
      this.back.addChild(sprite);
      this.motes.push({ sprite, speed: 6 + Math.random() * 18, phase: Math.random() * 10 });
    }
    this.front.addChild(this.vignette);
  }

  resize(width: number, groundY: number): void {
    if (width === this.width && groundY === this.groundY) return;
    const old = this.width || 1;
    this.width = width;
    this.groundY = groundY;
    const h = this.height;
    this.sky.setSize(width, this.groundY);
    this.spotlight.position.set(width / 2, h * 0.08);
    this.spotlight.setSize(Math.max(width, h) * 1.4, h * 1.3);
    this.floor.position.set(0, this.groundY);
    this.floor.setSize(width, h - this.groundY);
    this.floorEdge.position.set(0, this.groundY - 3);
    this.floorEdge.setSize(width, 6);
    this.vignette.setSize(width, h);
    // Motes start with x as a fraction of the width (old width 1)
    for (const m of this.motes) m.sprite.x = (m.sprite.x / old) * width;
  }

  update(dt: number): void {
    this.time += dt;
    for (const m of this.motes) {
      const s = m.sprite;
      s.y -= m.speed * dt;
      s.x += Math.sin(this.time * 0.6 + m.phase) * 8 * dt;
      if (s.y < -20) {
        s.y = this.groundY;
        s.x = Math.random() * this.width;
      }
    }
  }
}
