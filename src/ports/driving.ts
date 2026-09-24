/** Player intent collected between frames. */
export interface InputSource {
  /** Pointer position as a fraction of the viewport width, or null before any pointer movement. */
  pointerX(): number | null;
  /** True once per jump press since the last call. */
  consumeJump(): boolean;
  /** True once per start/restart request (click or tap) since the last call. */
  consumeConfirm(): boolean;
}

/** Calls back once per display frame with the elapsed time in seconds. */
export interface FrameClock {
  start(onFrame: (dt: number) => void): void;
}
