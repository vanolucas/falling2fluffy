import type { GameEvent } from '../../domain/events';
import type { SoundPlayer } from '../../ports/driven';

interface Tone {
  freq: number;
  to?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

/** Synthesized retro sound effects; the audio context starts on the first user gesture. */
export class WebAudioSound implements SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(volume = 0.35) {
    const unlock = (): void => {
      try {
        this.ctx ??= new AudioContext();
        if (!this.master) {
          this.master = this.ctx.createGain();
          this.master.gain.value = volume;
          this.master.connect(this.ctx.destination);
        }
        void this.ctx.resume();
      } catch (err) {
        console.warn('Audio unavailable', err);
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  play(events: readonly GameEvent[]): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    for (const event of events) {
      switch (event.type) {
        case 'coinEaten': {
          const up = 2 ** (Math.min(event.streak - 1, 12) / 12);
          this.tone({ freq: 988 * up, duration: 0.07, type: 'square', gain: 0.18 });
          this.tone({ freq: 1319 * up, duration: 0.28, type: 'square', gain: 0.18, delay: 0.07 });
          this.noise(0.06, 0.35, 900);
          this.tone({ freq: 150, to: 55, duration: 0.12, gain: 0.5 });
          break;
        }
        case 'jumped':
          if (event.kind === 'ground') this.tone({ freq: 200, to: 520, duration: 0.16, type: 'sine', gain: 0.3 });
          else this.tone({ freq: 330, to: 900, duration: 0.14, type: 'triangle', gain: 0.25 });
          break;
        case 'landed':
          this.tone({ freq: 120, to: 45, duration: 0.14, gain: Math.min(0.6, event.impact / 2500) });
          break;
        case 'coinBounced':
          this.tone({ freq: 700, to: 460, duration: 0.06, type: 'square', gain: 0.08 });
          break;
        case 'coinMissed':
          this.tone({ freq: 220, to: 90, duration: 0.3, type: 'square', gain: 0.16 });
          this.noise(0.2, 0.3, 2500);
          break;
        case 'started':
          [523, 659, 784, 1047].forEach((freq, i) =>
            this.tone({ freq, duration: 0.09, type: 'square', gain: 0.12, delay: i * 0.07 }),
          );
          break;
        case 'gameOver':
          [523, 392, 330, 262, 196].forEach((freq, i) =>
            this.tone({ freq, duration: 0.18, type: 'square', gain: 0.14, delay: i * 0.13 }),
          );
          break;
      }
    }
  }

  private tone({ freq, to, duration, type = 'sine', gain = 0.2, delay = 0 }: Tone): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain: number, cutoff: number): void {
    const { ctx, master } = this;
    if (!ctx || !master) return;
    this.noiseBuffer ??= this.createNoise(ctx);
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(env).connect(master);
    src.start(t0);
    src.stop(t0 + duration);
  }

  private createNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
