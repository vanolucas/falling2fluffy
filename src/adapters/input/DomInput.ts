import type { InputSource } from '../../ports/driving';

type KeyAction = 'jump' | 'left' | 'right';

/** Game keys by `KeyboardEvent.key` (letters lowercased): arrows, space, WASD (QWERTY) and ZQSD (AZERTY). */
const KEY_ACTIONS: Readonly<Record<string, KeyAction>> = {
  ' ': 'jump',
  ArrowUp: 'jump',
  w: 'jump',
  z: 'jump',
  ArrowLeft: 'left',
  a: 'left',
  q: 'left',
  ArrowRight: 'right',
  d: 'right',
};

/** Mouse, touch and keyboard input bound to the DOM; the last device used to steer takes over. */
export class DomInput implements InputSource {
  private x: number | null = null;
  private jumps = 0;
  private confirms = 0;
  /** Heights (viewport fractions) of touches not yet checked against the jump zone. */
  private touchYs: number[] = [];
  /** Held steering keys by physical code, so a release matches its press even if modifiers changed `key`. */
  private readonly heldKeys = new Map<string, number>();

  constructor(target: HTMLElement) {
    target.addEventListener('pointermove', (e) => this.track(e));
    target.addEventListener('pointerdown', (e) => this.press(e));
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.heldKeys.delete(e.code));
    // Keyups are lost while the window is unfocused
    window.addEventListener('blur', () => this.heldKeys.clear());
  }

  pointerX(): number | null {
    return this.x;
  }

  direction(): number {
    let sum = 0;
    for (const dir of this.heldKeys.values()) sum += dir;
    return Math.sign(sum);
  }

  consumeJump(touchJumpLimit: number): boolean {
    this.jumps += this.touchYs.filter((y) => y < touchJumpLimit).length;
    this.touchYs = [];
    return this.consume('jumps');
  }

  consumeConfirm(): boolean {
    return this.consume('confirms');
  }

  private track(e: PointerEvent): void {
    this.x = e.clientX / window.innerWidth;
  }

  private press(e: PointerEvent): void {
    this.track(e);
    this.confirms++;
    if (e.pointerType !== 'mouse') this.touchYs.push(e.clientY / window.innerHeight);
    else if (e.button === 0) this.jumps++;
  }

  private keyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = KEY_ACTIONS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!action) return;
    e.preventDefault();

    if (action === 'jump') {
      if (!e.repeat) this.jumps++;
      return;
    }
    this.heldKeys.set(e.code, action === 'left' ? -1 : 1);
    // Keyboard steering takes over until the pointer moves again
    this.x = null;
  }

  private consume(counter: 'jumps' | 'confirms'): boolean {
    if (this[counter] === 0) return false;
    this[counter]--;
    return true;
  }
}
