import { WORLD_HEIGHT } from '../domain/config';
import type { Game } from '../domain/Game';
import type { GameView, ScoreStore, SoundPlayer } from '../ports/driven';
import type { FrameClock, InputSource } from '../ports/driving';

/** Longest frame simulated at once, so a stalled tab does not teleport the game. */
const MAX_FRAME_DT = 1 / 20;

/** Runs the frame loop: input → simulation → persistence, sound and rendering. */
export class GameSession {
  constructor(
    private readonly game: Game,
    private readonly input: InputSource,
    private readonly view: GameView,
    private readonly sound: SoundPlayer,
    private readonly scores: ScoreStore,
    private readonly clock: FrameClock,
  ) {}

  start(): void {
    this.clock.start((dt) => this.frame(Math.min(dt, MAX_FRAME_DT)));
  }

  private frame(dt: number): void {
    const { game, input } = this;
    game.resize(WORLD_HEIGHT * this.view.aspect);

    const pointer = input.pointerX();
    const { creature } = game;
    const events = game.update(dt, {
      targetX: pointer === null ? null : pointer * game.worldWidth,
      direction: input.direction(),
      // Touches jump only above the creature
      jump: input.consumeJump((creature.y - creature.radius) / WORLD_HEIGHT),
      confirm: input.consumeConfirm(),
    });

    for (const event of events) {
      if (event.type === 'gameOver' && event.isNewBest) this.scores.saveBest(event.best);
    }
    this.sound.play(events);
    this.view.render(game, events, dt);
  }
}
