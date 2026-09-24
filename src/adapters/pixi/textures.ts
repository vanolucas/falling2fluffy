import { Rectangle, Texture, type TextureSource } from 'pixi.js';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Draws into an offscreen canvas and wraps it in a texture. */
export function canvasTexture(width: number, height: number, draw: Draw, pixelated = false): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = !pixelated;
  draw(ctx, width, height);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = pixelated ? 'nearest' : 'linear';
  return texture;
}

/** Splits a horizontal strip into equally sized frames. */
export function sliceFrames(source: TextureSource, frameWidth: number, frameHeight: number, count: number, gap = 0): Texture[] {
  return Array.from(
    { length: count },
    (_, i) => new Texture({ source, frame: new Rectangle(i * (frameWidth + gap), 0, frameWidth, frameHeight) }),
  );
}

/** Soft radial falloff, white on transparent; tint it for glows, shadows and dust. */
export function softDotTexture(size = 128): Texture {
  return canvasTexture(size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

export function verticalGradientTexture(stops: readonly [offset: number, color: string][], height = 256): Texture {
  return canvasTexture(1, height, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
