import type { Texture } from 'pixi.js';
import { canvasTexture, sliceFrames } from './textures';

/** Limited vintage palette shared by coins, shards and HUD. */
export const COIN_PALETTE = {
  outline: '#3a1604',
  edgeDark: '#7a2f05',
  edge: '#b8520a',
  faceDark: '#d9730f',
  face: '#f7a21b',
  faceLight: '#ffd23f',
  shine: '#fff4b0',
} as const;

export const COIN_ART_SIZE = 16;
/** Visible coin diameter in art pixels (excluding transparent margin). */
export const COIN_ART_DIAMETER = 15;

const EMBLEM = ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'];

type Pixels = (string | null)[][];

function paint(ctx: CanvasRenderingContext2D, pixels: Pixels, offsetX = 0): void {
  pixels.forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x, y, 1, 1);
    }),
  );
}

/** One frame of a coin spinning around its vertical axis. */
function coinPixels(angle: number): Pixels {
  const P = COIN_PALETTE;
  const size = COIN_ART_SIZE;
  const width = Math.abs(Math.cos(angle));
  const rx = Math.max(0.6, 7 * width);
  const ry = 7;
  const faceCx = -Math.sin(angle) * 1.3;
  const edgeCx = -faceCx;
  const [minCx, maxCx] = [Math.min(faceCx, edgeCx), Math.max(faceCx, edgeCx)];

  const inEllipse = (x: number, y: number, cx: number): boolean => ((x - cx) / rx) ** 2 + (y / ry) ** 2 <= 1;
  const inBody = (x: number, y: number): boolean => inEllipse(x, y, Math.min(maxCx, Math.max(minCx, x)));
  const center = (i: number): number => i + 0.5 - size / 2;

  const emblemAt = (x: number, y: number): boolean => {
    if (width < 0.3) return false;
    const ex = Math.floor((x - faceCx) / width + 2.5);
    const ey = Math.floor(y + 3.5);
    return EMBLEM[ey]?.[ex] === '#';
  };

  const pixels: Pixels = [];
  for (let py = 0; py < size; py++) {
    const row: (string | null)[] = [];
    for (let px = 0; px < size; px++) {
      const x = center(px);
      const y = center(py);
      if (!inBody(x, y)) {
        const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inBody(x + dx, y + dy));
        row.push(touches ? P.outline : null);
        continue;
      }
      if (!inEllipse(x, y, faceCx)) {
        row.push(py % 2 === 0 ? P.edge : P.edgeDark);
        continue;
      }
      const u = (x - faceCx) / rx;
      const v = y / ry;
      const light = -(u + v) * 0.7;
      if (u * u + v * v > 0.62) {
        row.push(light > 0.25 ? P.faceLight : light < -0.25 ? P.faceDark : P.face);
      } else if (emblemAt(x, y)) {
        row.push(P.faceDark);
      } else if (emblemAt(x + 1, y + 1)) {
        row.push(P.shine);
      } else {
        // Checkerboard dithering between face tones, vintage style
        const dither = (px + py) % 2 === 0 ? 0.12 : -0.12;
        row.push(light + dither > -0.15 ? P.faceLight : P.face);
      }
    }
    pixels.push(row);
  }
  return pixels;
}

/** Spin animation frames covering a full turn. */
export function coinFrames(count = 12): Texture[] {
  const gap = 1;
  const stride = COIN_ART_SIZE + gap;
  const strip = canvasTexture(
    stride * count,
    COIN_ART_SIZE,
    (ctx) => {
      for (let i = 0; i < count; i++) paint(ctx, coinPixels((i / count) * Math.PI * 2), i * stride);
    },
    true,
  );
  return sliceFrames(strip.source, COIN_ART_SIZE, COIN_ART_SIZE, count, gap);
}

function fromRows(rows: readonly string[], colors: Record<string, string>): Texture {
  return canvasTexture(
    rows[0].length,
    rows.length,
    (ctx) => paint(ctx, rows.map((row) => [...row].map((ch) => colors[ch] ?? null))),
    true,
  );
}

export const heartTexture = (full: boolean): Texture =>
  fromRows(
    ['.oo.oo.', 'ohhrrro', 'ohrrrro', 'orrrrro', '.orrro.', '..oro..', '...o...'],
    full
      ? { o: '#2a0710', r: '#e8283c', h: '#ff9aa4' }
      : { o: '#2a0710', r: '#4a2630', h: '#4a2630' },
  );

export const glintTexture = (): Texture =>
  fromRows(['..w..', '..w..', 'wwWww', '..w..', '..w..'], { w: '#fff4b0', W: '#ffffff' });
