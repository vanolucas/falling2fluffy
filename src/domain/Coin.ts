/** Read-only view of a coin exposed to adapters. */
export interface CoinState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly radius: number;
  /** Spin angle around the vertical axis, in radians. */
  readonly spin: number;
}

export class Coin implements CoinState {
  spin: number;

  constructor(
    readonly id: number,
    readonly radius: number,
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public spinRate: number,
    spin: number,
  ) {
    this.spin = spin;
  }
}
