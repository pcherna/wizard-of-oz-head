// AudioWorklet: noise gate followed by a two-tap delay-line pitch shifter.
// Each tap reads the input at a sweeping delay, which changes pitch by (1 - delay slope).
// The taps sit half a window apart and crossfade with sin², so the delay wrap is silent.
// Added latency averages half the window (~30 ms).

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;
declare const sampleRate: number;

interface ParamDescriptor {
  name: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  automationRate: 'k-rate';
}

const WINDOW_SEC = 0.06;
const GATE_HOLD_SEC = 0.12;

class PitchShifter extends AudioWorkletProcessor {
  static get parameterDescriptors(): ParamDescriptor[] {
    return [
      { name: 'pitch', defaultValue: 0.72, minValue: 0.25, maxValue: 2, automationRate: 'k-rate' },
      { name: 'gate', defaultValue: 0.008, minValue: 0, maxValue: 0.2, automationRate: 'k-rate' },
    ];
  }

  private buf = new Float32Array(16384);
  private mask = this.buf.length - 1;
  private write = 0;
  private phase = 0;
  private window = Math.round(WINDOW_SEC * sampleRate);

  private env = 0;
  private gateGain = 0;
  private holdLeft = 0;
  private envCoef = 1 - Math.exp(-1 / (0.01 * sampleRate));
  private openCoef = 1 - Math.exp(-1 / (0.005 * sampleRate));
  private closeCoef = 1 - Math.exp(-1 / (0.08 * sampleRate));

  process(inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>) {
    const input = inputs[0]?.[0];
    const output = outputs[0][0];
    if (!input) {
      output.fill(0);
      return true;
    }
    const ratio = params.pitch[0];
    const threshold = params.gate[0];
    const step = (1 - ratio) / this.window;
    const hold = GATE_HOLD_SEC * sampleRate;
    const { buf, mask, window } = this;

    for (let i = 0; i < input.length; i++) {
      const x = input[i];

      // Gate: open fast above threshold, hold, then close slowly.
      this.env += (x * x - this.env) * this.envCoef;
      if (Math.sqrt(this.env) > threshold) this.holdLeft = hold;
      else if (this.holdLeft > 0) this.holdLeft--;
      const target = this.holdLeft > 0 ? 1 : 0;
      this.gateGain += (target - this.gateGain) * (target > this.gateGain ? this.openCoef : this.closeCoef);

      buf[this.write] = x * this.gateGain;

      this.phase += step;
      this.phase -= Math.floor(this.phase);
      let y = 0;
      for (let tap = 0; tap < 2; tap++) {
        const p = (this.phase + tap * 0.5) % 1;
        const delay = p * window + 1;
        const pos = this.write - delay;
        const i0 = Math.floor(pos);
        const frac = pos - i0;
        const a = buf[i0 & mask];
        const b = buf[(i0 + 1) & mask];
        const s = Math.sin(Math.PI * p);
        y += (a + (b - a) * frac) * s * s;
      }
      output[i] = y;
      this.write = (this.write + 1) & mask;
    }
    return true;
  }
}

registerProcessor('pitch-shifter', PitchShifter);

export {};
