import { Application, Container } from 'pixi.js';
import type { CreatureState } from '../../domain/Creature';
import { WORLD_HEIGHT } from '../../domain/config';
import type { GameEvent } from '../../domain/events';
import type { GameState } from '../../domain/Game';
import type { GameView } from '../../ports/driven';
import { Backdrop } from './Backdrop';
import { CoinsView } from './CoinsView';
import { CreatureView } from './CreatureView';
import { Hud } from './Hud';
import { Particles } from './Particles';
import { PixelFont } from './PixelFont';
import { coinFrames, glintTexture, heartTexture } from './pixelArt';
import { ScreenFx } from './ScreenFx';
import { softDotTexture } from './textures';

const FUR_COLORS = [0x3a52ff, 0x5a3ae0, 0x7a5aff, 0x2a3ab8];

/** PixiJS (WebGL) renderer for the game; the world is drawn in world units scaled to the viewport height. */
export class PixiGameView implements GameView {
  private readonly world = new Container();
  private readonly hudRoot = new Container();
  private readonly dot = softDotTexture();
  private readonly particles: Particles;
  private readonly backdrop: Backdrop;
  private readonly creature: CreatureView;
  private readonly coins: CoinsView;
  private readonly hud: Hud;
  private readonly fx = new ScreenFx();
  private groundY = 0;

  static async create(host: HTMLElement): Promise<PixiGameView> {
    const app = new Application();
    await app.init({
      resizeTo: window,
      preference: 'webgl',
      powerPreference: 'high-performance',
      background: 0x120b0f,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      autoStart: false,
    });
    host.appendChild(app.canvas);
    return new PixiGameView(app);
  }

  private constructor(private readonly app: Application) {
    this.particles = new Particles(() => this.groundY);
    this.backdrop = new Backdrop(this.dot, WORLD_HEIGHT);
    this.creature = new CreatureView(this.dot);
    this.coins = new CoinsView({ frames: coinFrames(), glow: this.dot, glint: glintTexture() }, this.dot, this.particles);
    this.hud = new Hud(new PixelFont(), { full: heartTexture(true), empty: heartTexture(false) });

    this.world.addChild(
      this.backdrop.back,
      this.creature.shadow,
      this.coins.shadows,
      this.creature.body,
      this.coins.layer,
      this.particles.layer,
      this.backdrop.front,
    );
    this.hudRoot.addChild(this.hud.layer);
    app.stage.addChild(this.world, this.hudRoot, this.fx.flash);
  }

  get aspect(): number {
    const { width, height } = this.app.screen;
    return height > 0 ? width / height : 1;
  }

  render(state: GameState, events: readonly GameEvent[], dt: number): void {
    this.groundY = state.groundY;
    for (const event of events) this.handle(event, state.creature);

    const { width, height } = this.app.screen;
    const scale = height / WORLD_HEIGHT;
    const shake = this.fx.update(dt, width, height);
    this.world.scale.set(scale);
    this.world.pivot.set(state.worldWidth / 2, WORLD_HEIGHT / 2);
    this.world.position.set(width / 2 + shake.x * scale, height / 2 + shake.y * scale);
    this.world.rotation = shake.rotation;
    this.hudRoot.scale.set(scale);

    this.backdrop.resize(state.worldWidth, state.groundY);
    this.backdrop.update(dt);
    this.creature.update(dt, state.creature, state.coins, state.groundY);
    this.coins.update(dt, state.coins, state.groundY, this.creature.mouthPosition(state.creature));
    this.particles.update(dt);
    this.hud.update(dt, state);

    this.app.render();
  }

  private handle(event: GameEvent, creature: CreatureState): void {
    this.creature.handle(event);
    this.coins.handle(event);
    this.hud.handle(event);

    switch (event.type) {
      case 'coinEaten':
        this.fx.addTrauma(0.18);
        this.fx.flashColor(0xffd23f, 0.06 + Math.min(event.multiplier, 8) * 0.01);
        break;
      case 'coinMissed':
        this.fx.addTrauma(0.55);
        this.fx.flashColor(0xff2030, 0.22);
        break;
      case 'coinBounced':
        this.fx.addTrauma(0.1);
        this.fluff(event.x, event.y, 5);
        break;
      case 'landed':
        this.fx.addTrauma(Math.min(0.35, event.impact / 5000));
        this.dust(creature, Math.min(1, event.impact / 1600));
        this.fluff(creature.x, creature.y, Math.round(event.impact / 300));
        break;
      case 'jumped':
        if (event.kind === 'ground') this.dust(creature, 0.4);
        else this.fluff(creature.x, creature.y + creature.radius * 0.5, 6);
        break;
      case 'gameOver':
        this.fx.addTrauma(0.8);
        this.fx.flashColor(0xff2030, 0.35);
        break;
    }
  }

  private dust(creature: CreatureState, strength: number): void {
    const y = this.groundY - 6;
    for (let i = 0; i < 14 * strength + 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.particles.emit({
        x: creature.x + side * creature.radius * (0.4 + Math.random() * 0.5),
        y,
        vx: side * (150 + Math.random() * 450) * strength,
        vy: -Math.random() * 120 * strength,
        size: 30 + Math.random() * 40,
        color: 0x6a5048,
        texture: this.dot,
        life: 0.45 + Math.random() * 0.35,
        drag: 4,
        endScale: 2.2,
      });
    }
  }

  /** Loose fur tufts drifting away: a touch of realism around the creature. */
  private fluff(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.emit({
        x: x + Math.cos(a) * 60,
        y: y + Math.sin(a) * 60,
        vx: Math.cos(a) * (60 + Math.random() * 160),
        vy: Math.sin(a) * (60 + Math.random() * 160) - 60,
        size: 5 + Math.random() * 6,
        color: FUR_COLORS[i % FUR_COLORS.length],
        texture: this.dot,
        life: 0.8 + Math.random() * 0.8,
        gravity: 120,
        drag: 1.8,
        endScale: 0.5,
        spin: 2,
      });
    }
  }
}
