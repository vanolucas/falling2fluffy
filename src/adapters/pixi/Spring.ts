/** Damped spring used for bouncy, frame-rate independent secondary motion. */
export class Spring {
  velocity = 0;
  target: number;

  constructor(
    public value: number,
    private readonly stiffness: number,
    private readonly damping: number,
  ) {
    this.target = value;
  }

  update(dt: number): number {
    // Semi-implicit Euler in small slices stays stable for stiff springs
    const steps = Math.ceil(dt / (1 / 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.stiffness * (this.target - this.value) - this.damping * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  kick(impulse: number): void {
    this.velocity += impulse;
  }
}
