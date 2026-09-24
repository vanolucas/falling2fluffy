import { describe, expect, it } from 'vitest';
import { defaultConfig, type GameConfig } from '../src/domain/config';
import type { GameEvent, GameEventType } from '../src/domain/events';
import { Game, type Controls } from '../src/domain/Game';

const WIDTH = 1600;
const DT = 1 / 60;
const idle: Controls = { targetX: null, direction: 0, jump: false, confirm: false };
const press: Controls = { ...idle, jump: true };

/** Single coin drops only, so a constant random source gives predictable spawns. */
const singleDrops: GameConfig = {
  ...defaultConfig,
  difficulty: { ...defaultConfig.difficulty, doubleDropChance: [0, 0] },
};

/** Constant random source: 0.5 spawns coins right above the centered creature, 0 at the far left edge. */
const makeGame = (random = 0.5, overrides: Partial<GameConfig> = {}, best = 0): Game =>
  new Game({ ...singleDrops, ...overrides }, () => random, best, WIDTH);

/** Steps the game until an event of the given type occurs (or the time limit is reached). */
function runUntil(game: Game, type: GameEventType, seconds = 10, controls: Controls = idle): GameEvent[] {
  const seen: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) {
    seen.push(...game.update(DT, controls));
    if (seen.some((e) => e.type === type)) return seen;
  }
  throw new Error(`No "${type}" event within ${seconds}s; saw ${seen.map((e) => e.type).join(', ')}`);
}

const ofType = <T extends GameEventType>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('Game', () => {
  it('waits in the ready phase without spawning coins', () => {
    const game = makeGame();
    for (let i = 0; i < 300; i++) game.update(DT, idle);
    expect(game.phase).toBe('ready');
    expect(game.coins).toHaveLength(0);
  });

  it('starts and jumps on the first jump press', () => {
    const game = makeGame();
    const events = game.update(DT, press);
    expect(events.map((e) => e.type)).toEqual(['started', 'jumped']);
    expect(game.phase).toBe('playing');
    expect(game.creature.vy).toBeLessThan(0);
  });

  it('allows one air jump, restored after landing', () => {
    const game = makeGame();
    const kinds = () => ofType(game.update(DT, press), 'jumped').map((e) => e.kind);
    expect(kinds()).toEqual(['ground']);
    expect(kinds()).toEqual(['air']);
    expect(kinds()).toEqual([]);

    const landed = ofType(runUntil(game, 'landed'), 'landed');
    expect(landed[0].impact).toBeGreaterThan(0);
    expect(game.creature.grounded).toBe(true);
    expect(kinds()).toEqual(['ground']);
  });

  it('eats a coin falling into the mouth and scores it', () => {
    const game = makeGame(0.5);
    game.update(DT, { ...idle, confirm: true });

    const [eaten] = ofType(runUntil(game, 'coinEaten'), 'coinEaten');
    expect(eaten.points).toBe(defaultConfig.pointsPerCoin);
    expect(game.score).toBe(defaultConfig.pointsPerCoin);
    expect(game.streak).toBe(1);
    expect(game.lives).toBe(defaultConfig.lives);
  });

  it('raises the multiplier with the catch streak', () => {
    const game = makeGame(0.5);
    game.update(DT, { ...idle, confirm: true });
    const perMultiplier = defaultConfig.coinsPerMultiplier;
    let last: Extract<GameEvent, { type: 'coinEaten' }> | undefined;
    while (game.streak < perMultiplier) last = ofType(runUntil(game, 'coinEaten'), 'coinEaten').at(-1);

    expect(game.multiplier).toBe(2);
    expect(last?.multiplier).toBe(2);
    expect(last?.points).toBe(defaultConfig.pointsPerCoin * 2);
  });

  it('loses a life and resets the streak when a coin touches the ground', () => {
    const game = makeGame(0);
    game.update(DT, { ...idle, confirm: true });

    const [missed] = ofType(runUntil(game, 'coinMissed'), 'coinMissed');
    expect(missed.livesLeft).toBe(defaultConfig.lives - 1);
    expect(game.lives).toBe(defaultConfig.lives - 1);
    expect(game.streak).toBe(0);
  });

  it('ends the game when all lives are lost and reports a new best', () => {
    const game = makeGame(0, { lives: 1 }, -1);
    game.update(DT, { ...idle, confirm: true });

    const [over] = ofType(runUntil(game, 'gameOver'), 'gameOver');
    expect(game.phase).toBe('over');
    expect(game.coins).toHaveLength(0);
    expect(over).toMatchObject({ score: 0, best: 0, isNewBest: true });
  });

  it('keeps the previous best when the score is lower', () => {
    const game = makeGame(0, { lives: 1 }, 500);
    game.update(DT, { ...idle, confirm: true });
    const [over] = ofType(runUntil(game, 'gameOver'), 'gameOver');
    expect(over).toMatchObject({ best: 500, isNewBest: false });
  });

  it('only restarts after the restart delay', () => {
    const game = makeGame(0, { lives: 1 });
    game.update(DT, { ...idle, confirm: true });
    runUntil(game, 'gameOver');

    game.update(DT, { ...idle, confirm: true });
    expect(game.phase).toBe('over');

    for (let t = 0; t < defaultConfig.restartDelay; t += DT) game.update(DT, idle);
    expect(ofType(game.update(DT, { ...idle, confirm: true }), 'started')).toHaveLength(1);
    expect(game.phase).toBe('playing');
    expect(game.lives).toBe(1);
  });

  it('bounces coins off the side of the body', () => {
    const game = makeGame(0.5);
    game.update(DT, { ...idle, confirm: true });
    // Offset the creature so coins land on its shoulder, outside the mouth span
    const shoulder = WIDTH / 2 - game.creature.radius * 0.85;
    const events = runUntil(game, 'coinBounced', 10, { ...idle, targetX: shoulder });
    expect(ofType(events, 'coinBounced')[0].strength).toBeGreaterThan(0);
    // Coin is right of the creature: deflected rightward
    expect(game.coins[0].vx).toBeGreaterThan(0);
  });

  it('follows the pointer and stays inside the world', () => {
    const game = makeGame();
    for (let i = 0; i < 180; i++) game.update(DT, { ...idle, targetX: 300 });
    expect(game.creature.x).toBeCloseTo(300, 0);

    for (let i = 0; i < 180; i++) game.update(DT, { ...idle, targetX: -1000 });
    expect(game.creature.x).toBeCloseTo(game.creature.radius, 0);
  });

  it('moves at steering speed along a held direction, overriding the pointer', () => {
    const game = makeGame();
    const startX = game.creature.x;
    for (let i = 0; i < 15; i++) game.update(DT, { ...idle, targetX: 0, direction: 1 });
    expect(game.creature.x).toBeGreaterThan(startX);
    expect(game.creature.vx).toBeCloseTo(defaultConfig.creature.steerSpeed, -2);

    for (let i = 0; i < 180; i++) game.update(DT, { ...idle, direction: -1 });
    expect(game.creature.x).toBeCloseTo(game.creature.radius);
  });

  it('stops when the held direction is released', () => {
    const game = makeGame();
    for (let i = 0; i < 20; i++) game.update(DT, { ...idle, direction: 1 });
    for (let i = 0; i < 60; i++) game.update(DT, idle);
    const x = game.creature.x;
    game.update(DT, idle);
    expect(game.creature.x).toBeCloseTo(x, 1);
  });

  it('simulates identically regardless of frame rate', () => {
    const a = makeGame();
    const b = makeGame();
    a.update(DT, press);
    b.update(DT, press);
    for (let i = 0; i < 30; i++) a.update(1 / 30, { ...idle, targetX: 500 });
    for (let i = 0; i < 120; i++) b.update(1 / 120, { ...idle, targetX: 500 });
    expect(a.creature.x).toBeCloseTo(b.creature.x, 3);
    expect(a.creature.y).toBeCloseTo(b.creature.y, 3);
  });
});
