import type { InputSource } from '../../ports/driving';

/** Mouse/touch pointer and keyboard input bound to the DOM. */
export class DomInput implements InputSource {
  private x: number | null = null;
  private jumps = 0;
  private confirms = 0;

  constructor(target: HTMLElement) {
    target.addEventListener('pointermove', (e) => this.track(e));
    target.addEventListener('pointerdown', (e) => {
      this.track(e);
      this.confirms++;
      // No keyboard on touch screens: a tap also jumps
      if (e.pointerType === 'touch') this.jumps++;
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!e.repeat) this.jumps++;
    });
  }

  pointerX(): number | null {
    return this.x;
  }

  consumeJump(): boolean {
    return this.consume('jumps');
  }

  consumeConfirm(): boolean {
    return this.consume('confirms');
  }

  private track(e: PointerEvent): void {
    this.x = e.clientX / window.innerWidth;
  }

  private consume(counter: 'jumps' | 'confirms'): boolean {
    if (this[counter] === 0) return false;
    this[counter]--;
    return true;
  }
}
