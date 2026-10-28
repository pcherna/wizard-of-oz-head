import { LIPSYNC } from '../config';

export interface MouthState {
  /** 0 closed .. 1 fully open. */
  jaw: number;
  /** -1 rounded ("oo") .. 1 wide ("ee"). */
  width: number;
  /** Smoothed loudness relative to sensitivity, 0..~2. */
  level: number;
  /** Strength of a syllable onset this frame, 0 if none. */
  onset: number;
  /** True on the frame a shout starts. */
  shout: boolean;
}

/** Turns the analyser's dry pitched signal into mouth shapes. */
export class LipSync {
  private time: Float32Array<ArrayBuffer>;
  private freq: Float32Array<ArrayBuffer>;
  private env = 0;
  private width = 0;
  private trough = 0;
  private peak = 0;
  private armed = true;
  private shouting = false;
  readonly state: MouthState = { jaw: 0, width: 0, level: 0, onset: 0, shout: false };

  constructor(private analyser: AnalyserNode | null) {
    const n = analyser?.fftSize ?? 1024;
    this.time = new Float32Array(n);
    this.freq = new Float32Array(n / 2);
  }

  update(dt: number, sensitivity: number, demoTime?: number): MouthState {
    let rms: number;
    if (this.analyser) {
      rms = this.measure();
    } else {
      rms = demoRms(demoTime ?? 0, sensitivity);
      this.width = Math.sin((demoTime ?? 0) * 2.3) * 0.7;
    }
    const tau = rms > this.env ? LIPSYNC.attackSec : LIPSYNC.releaseSec;
    this.env += (rms - this.env) * (1 - Math.exp(-dt / tau));

    const level = this.env / sensitivity;
    const s = this.state;
    s.level = level;
    s.jaw = Math.min(1, Math.pow(Math.max(0, level - 0.08) / 0.92, 0.75));

    // Onset: the envelope climbs well above its recent trough. One per syllable:
    // after firing, wait until the level falls back from its peak before re-arming.
    s.onset = 0;
    if (this.armed) {
      this.trough = Math.min(this.trough + dt * 0.5, level);
      if (level - this.trough > 0.2 && level > 0.3) {
        s.onset = Math.min(1, level - this.trough);
        this.armed = false;
        this.peak = level;
      }
    } else {
      this.peak = Math.max(this.peak, level);
      if (level < this.peak * 0.6) {
        this.armed = true;
        this.trough = level;
      }
    }

    const shoutNow = level > LIPSYNC.shoutFactor;
    s.shout = shoutNow && !this.shouting;
    this.shouting = shoutNow ? true : level > LIPSYNC.shoutFactor * 0.7 && this.shouting;

    s.width += (this.width - s.width) * (1 - Math.exp(-dt / 0.06));
    return s;
  }

  private measure(): number {
    const a = this.analyser!;
    a.getFloatTimeDomainData(this.time);
    let sum = 0;
    for (const v of this.time) sum += v * v;
    const rms = Math.sqrt(sum / this.time.length);

    // Bright spectrum reads as a wide mouth, dark as rounded.
    a.getFloatFrequencyData(this.freq);
    const binHz = a.context.sampleRate / a.fftSize;
    let low = 0;
    let high = 0;
    for (let i = 1; i < this.freq.length; i++) {
      const hz = i * binHz;
      const p = Math.pow(10, this.freq[i] / 10);
      if (hz >= 100 && hz < 700) low += p;
      else if (hz >= 1000 && hz < 3500) high += p;
    }
    if (rms > 0.005) this.width = Math.max(-1, Math.min(1, ((high / (low + high + 1e-12)) - 0.15) * 5));
    return rms;
  }
}

/** Fake speech for ?demo: syllables at ~4 Hz grouped into phrases with pauses. */
function demoRms(t: number, sensitivity: number): number {
  const phrase = Math.sin(t * 0.7) + Math.sin(t * 0.31 + 1);
  if (phrase < -0.3) return 0;
  const syllable = Math.max(0, Math.sin(t * Math.PI * 2 * 3.7) * 0.6 + Math.sin(t * 9.1) * 0.5);
  const shout = Math.sin(t * 0.13) > 0.97 ? 2.2 : 1;
  return syllable * sensitivity * shout;
}
