/** Player intent collected between frames. */
export interface InputSource {
  /** Pointer position as a fraction of the viewport width, or null when the pointer is not steering. */
  pointerX(): number | null;
  /** Held steering direction: -1 (left), 0 (none) or 1 (right). */
  direction(): number;
  /**
   * True once per jump press since the last call.
   * Touches only jump above `touchJumpLimit`, a fraction of the viewport height.
   */
  consumeJump(touchJumpLimit: number): boolean;
  /** True once per start/restart request (click or tap) since the last call. */
  consumeConfirm(): boolean;
}

/** Calls back once per display frame with the elapsed time in seconds. */
export interface FrameClock {
  start(onFrame: (dt: number) => void): void;
}
