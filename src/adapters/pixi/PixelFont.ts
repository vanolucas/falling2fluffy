import type { Texture } from 'pixi.js';
import { canvasTexture } from './textures';

// 5x7 bitmap glyphs, rows separated by spaces
const GLYPHS: Record<string, string> = {
  A: '.###. #...# #...# ##### #...# #...# #...#',
  B: '####. #...# #...# ####. #...# #...# ####.',
  C: '.###. #...# #.... #.... #.... #...# .###.',
  D: '####. #...# #...# #...# #...# #...# ####.',
  E: '##### #.... #.... ####. #.... #.... #####',
  F: '##### #.... #.... ####. #.... #.... #....',
  G: '.###. #...# #.... #.### #...# #...# .####',
  H: '#...# #...# #...# ##### #...# #...# #...#',
  I: '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  J: '..### ...#. ...#. ...#. #..#. #..#. .##..',
  K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  L: '#.... #.... #.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  N: '#...# #...# ##..# #.#.# #..## #...# #...#',
  O: '.###. #...# #...# #...# #...# #...# .###.',
  P: '####. #...# #...# ####. #.... #.... #....',
  Q: '.###. #...# #...# #...# #.#.# #..#. .##.#',
  R: '####. #...# #...# ####. #.#.. #..#. #...#',
  S: '.#### #.... #.... .###. ....# ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# #...# #...# .###.',
  V: '#...# #...# #...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  Z: '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '.###. #.... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ....# .###.',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  x: '..... ..... #...# .#.#. ..#.. .#.#. #...#',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  ':': '..... ..#.. ..#.. ..... ..#.. ..#.. .....',
  '-': '..... ..... ..... ##### ..... ..... .....',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const ADVANCE = GLYPH_W + 1;

export interface PixelTextStyle {
  color: string;
  shadow?: string;
}

/** Renders text with the bitmap font into cached nearest-filtered textures (1 texel = 1 font pixel). */
export class PixelFont {
  private readonly cache = new Map<string, Texture>();

  texture(text: string, { color, shadow = '#1a0a04' }: PixelTextStyle): Texture {
    const key = `${text}|${color}|${shadow}`;
    let texture = this.cache.get(key);
    if (!texture) {
      texture = this.render(text, color, shadow);
      this.cache.set(key, texture);
    }
    return texture;
  }

  private render(text: string, color: string, shadow: string): Texture {
    const chars = [...text];
    const width = Math.max(1, chars.length * ADVANCE);
    return canvasTexture(
      width,
      GLYPH_H + 1,
      (ctx) => {
        for (const [dx, fill] of [[1, shadow], [0, color]] as const) {
          ctx.fillStyle = fill;
          chars.forEach((ch, i) => {
            const rows = (GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS[' ']).split(' ');
            rows.forEach((row, y) =>
              [...row].forEach((cell, x) => {
                if (cell === '#') ctx.fillRect(i * ADVANCE + x + dx, y + dx, 1, 1);
              }),
            );
          });
        }
      },
      true,
    );
  }
}
