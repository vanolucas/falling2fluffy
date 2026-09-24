import type { FrameClock } from '../../ports/driving';

/** Frame clock driven by requestAnimationFrame, synced to the display refresh rate. */
export class AnimationFrameClock implements FrameClock {
  start(onFrame: (dt: number) => void): void {
    let last = performance.now();
    const loop = (now: number): void => {
      onFrame(Math.max(0, now - last) / 1000);
      last = now;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
