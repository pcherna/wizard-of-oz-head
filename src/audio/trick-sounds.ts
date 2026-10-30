import type { TrickName } from '../display/tricks';

/** A vowel formant: center Hz, Q and level. */
type Formant = [number, number, number];

/** Synthesized sounds for the dog tricks. Each one is timed to its trick's poses in tricks.ts. */
export class TrickSounds {
  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    private white: AudioBuffer,
  ) {}

  play(name: TrickName) {
    const t = this.ctx.currentTime;
    switch (name) {
      case 'blep':
        return this.raspberry(t + 0.3, 1.2);
      case 'shake':
        return this.shake(t);
      case 'lick':
        return this.slurp(t + 0.3);
      case 'tilt':
        return this.whine(t + 0.05, 650, 1000);
      case 'sneeze':
        return this.sneeze(t);
      case 'howl':
        return this.howl(t + 0.85);
      case 'pant':
        return this.pant(t + 0.15);
      case 'squirrel':
        return this.alert(t);
      case 'wink':
        return this.ding(t + 0.33);
      case 'ghost':
        return this.ghost(t + 0.2);
      case 'spin':
        return this.whoosh(t + 0.15, 0.8);
    }
  }

  /** A lip-trill "pbbbt": a buzz chopped into flaps by a fast square wave. */
  private raspberry(t: number, seconds: number) {
    const buzz = this.osc('sawtooth', 95, t, seconds);
    buzz.frequency.setValueAtTime(95, t);
    buzz.frequency.linearRampToValueAtTime(80, t + seconds);
    const flaps = new GainNode(this.ctx, { gain: 0.5 });
    const lfo = this.osc('square', 26, t, seconds);
    lfo.connect(new GainNode(this.ctx, { gain: 0.5 })).connect(flaps.gain);
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 650, Q: 0.9 });
    buzz.connect(flaps).connect(band).connect(this.env(t, [[0.04, 0.9], [seconds - 0.2, 0.8], [seconds, 0]]));
  }

  /** Ears flapping against the head, plus a collar tag jingling. */
  private shake(t: number) {
    for (let i = 0; i < 9; i++) {
      const at = t + 0.1 + i * 0.1;
      const level = 2 * (1 - i / 11);
      this.noise(at, 0.06, { type: 'lowpass', frequency: 500, Q: 0.7 }, [[0.005, level], [0.06, 0]]);
    }
    for (let i = 0; i < 7; i++) {
      const at = t + 0.12 + Math.random() * 0.9;
      const ping = this.osc('sine', 3200 + Math.random() * 2400, at, 0.25);
      ping.connect(this.env(at, [[0.002, 0.12], [0.25, 0]], true));
    }
  }

  /** A wet slurp: noise through a resonant filter that sweeps up and back. */
  private slurp(t: number) {
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 700, Q: 5 });
    band.frequency.setValueAtTime(700, t);
    band.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    band.frequency.exponentialRampToValueAtTime(600, t + 0.45);
    this.noiseInto(t, 0.5, band, [[0.04, 1.4], [0.3, 1], [0.5, 0]]);
  }

  /** A questioning whine that rises, with a little vibrato. */
  private whine(t: number, from: number, to: number) {
    const tone = this.osc('triangle', from, t, 0.5);
    tone.frequency.setValueAtTime(from, t);
    tone.frequency.exponentialRampToValueAtTime(to, t + 0.45);
    this.vibrato(tone, 7, 18, t, 0.5);
    const lp = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 2500 });
    tone.connect(lp).connect(this.env(t, [[0.06, 0.6], [0.35, 0.5], [0.5, 0]]));
  }

  /** Two breathy inhales, then the burst at 1.2 s, when the head snaps forward. */
  private sneeze(t: number) {
    for (const [at, len] of [[0.1, 0.4], [0.62, 0.5]]) {
      const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 1100, Q: 1.5 });
      band.frequency.setValueAtTime(1100, t + at);
      band.frequency.exponentialRampToValueAtTime(2200, t + at + len);
      this.noiseInto(t + at, len, band, [[len * 0.8, 0.35], [len, 0]]);
    }
    // A sneeze is mostly explosive breath, with only a trace of voice.
    const choo = t + 1.2;
    // "CH": a sharp crack of hiss with a 2 ms attack, and a thump of air.
    this.noise(choo, 0.08, { type: 'highpass', frequency: 2500, Q: 0.7 }, [[0.002, 0.9], [0.03, 0.6], [0.08, 0]]);
    this.noise(choo, 0.15, { type: 'lowpass', frequency: 180, Q: 0.7 }, [[0.003, 1], [0.15, 0]]);
    // The blast of air, darkening from "sh" toward "oo".
    const blast = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 2200, Q: 0.8 });
    blast.frequency.setValueAtTime(2200, choo + 0.02);
    blast.frequency.exponentialRampToValueAtTime(700, choo + 0.3);
    this.noiseInto(choo + 0.02, 0.32, blast, [[0.01, 1.1], [0.08, 0.7], [0.32, 0]]);
    // "OO": breath through the vowel's formants, with a little voice under it.
    const oo: Formant[] = [[320, 4, 1], [800, 5, 0.5]];
    this.vowel(choo + 0.04, 0.3, [[0, 300], [0.3, 190]], oo, oo, 3, [[0.02, 0.35], [0.1, 0.25], [0.3, 0]]);
  }

  /** A wolf howl: a voiced glide up and back down, through an "oo" formant, with an echo. */
  private howl(t: number) {
    const seconds = 2.3;
    const echo = new DelayNode(this.ctx, { delayTime: 0.3 });
    const feedback = new GainNode(this.ctx, { gain: 0.35 });
    const dark = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 1800 });
    echo.connect(dark).connect(feedback).connect(echo);
    const env = this.env(t, [[0.3, 0.3], [1.5, 0.32], [seconds, 0]]);
    env.connect(echo);
    dark.connect(this.out);
    const formant = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 900, Q: 2 });
    formant.frequency.setValueAtTime(900, t);
    formant.frequency.linearRampToValueAtTime(650, t + seconds);
    formant.connect(env);
    for (const [type, level] of [['sawtooth', 0.6], ['sine', 1]] as const) {
      const voice = this.osc(type, 280, t, seconds);
      voice.frequency.setValueAtTime(280, t);
      voice.frequency.exponentialRampToValueAtTime(520, t + 0.5);
      voice.frequency.linearRampToValueAtTime(560, t + 1.5);
      voice.frequency.exponentialRampToValueAtTime(420, t + seconds);
      this.vibrato(voice, 5.5, 12, t, seconds);
      voice.connect(new GainNode(this.ctx, { gain: level })).connect(formant);
    }
  }

  /** Breathy "hah hah" on the jaw's beat (3.6 per second), out loud and in soft. */
  private pant(t: number) {
    for (let i = 0; i < 14; i++) {
      const at = t + i / 7.2;
      const exhale = i % 2 === 0;
      this.noise(at, 0.11, { type: 'bandpass', frequency: exhale ? 1300 : 1900, Q: 1.2 }, [[0.015, exhale ? 0.9 : 0.35], [0.11, 0]]);
    }
  }

  /** A quick zip as the head snaps around, then a rising "wip!". */
  private alert(t: number) {
    const hp = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 1500 });
    hp.frequency.setValueAtTime(1500, t);
    hp.frequency.exponentialRampToValueAtTime(6000, t + 0.12);
    this.noiseInto(t, 0.14, hp, [[0.01, 0.5], [0.14, 0]]);
    const chirp = this.osc('sine', 900, t + 0.12, 0.12);
    chirp.frequency.setValueAtTime(900, t + 0.12);
    chirp.frequency.exponentialRampToValueAtTime(1700, t + 0.22);
    chirp.connect(this.env(t + 0.12, [[0.01, 0.4], [0.12, 0]]));
  }

  /** A theremin "wooOOooo": a sine gliding up and down with a slow, deep wobble, an echo, and a cold breath of air. */
  private ghost(t: number) {
    const seconds = 3;
    const echo = new DelayNode(this.ctx, { delayTime: 0.35 });
    const feedback = new GainNode(this.ctx, { gain: 0.45 });
    echo.connect(feedback).connect(echo);
    echo.connect(this.out);
    const env = this.env(t, [[0.6, 0.35], [2.2, 0.35], [seconds, 0]]);
    env.connect(echo);
    const tone = this.osc('sine', 330, t, seconds);
    tone.frequency.setValueAtTime(330, t);
    tone.frequency.exponentialRampToValueAtTime(620, t + 0.9);
    tone.frequency.exponentialRampToValueAtTime(440, t + 1.6);
    tone.frequency.exponentialRampToValueAtTime(700, t + 2.2);
    tone.frequency.exponentialRampToValueAtTime(260, t + seconds);
    this.vibrato(tone, 5, 22, t, seconds);
    tone.connect(env);
    const air = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 500, Q: 0.8 });
    air.frequency.setValueAtTime(500, t);
    air.frequency.exponentialRampToValueAtTime(1500, t + seconds / 2);
    air.frequency.exponentialRampToValueAtTime(400, t + seconds);
    this.noiseInto(t, seconds, air, [[1, 0.25], [2.2, 0.2], [seconds, 0]]);
  }

  /** A cartoon sparkle. */
  private ding(t: number) {
    for (const hz of [2093, 3136]) {
      this.osc('sine', hz, t, 0.9).connect(this.env(t, [[0.003, 0.3], [0.9, 0]], true));
    }
  }

  /** Air swept across the stereo field as the head turns. */
  private whoosh(t: number, seconds: number) {
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 300, Q: 1.5 });
    band.frequency.setValueAtTime(300, t);
    band.frequency.exponentialRampToValueAtTime(1800, t + seconds / 2);
    band.frequency.exponentialRampToValueAtTime(300, t + seconds);
    const pan = new StereoPannerNode(this.ctx, { pan: -0.8 });
    pan.pan.setValueAtTime(-0.8, t);
    pan.pan.linearRampToValueAtTime(0.8, t + seconds);
    band.connect(pan);
    this.noiseInto(t, seconds, band, [[seconds / 2, 2.2], [seconds, 0]], pan);
  }

  /**
   * A voiced vowel: a buzz following a [seconds after t, Hz] pitch contour, plus some breath,
   * through formants that glide from `from` to `to`. The envelope points work as in env().
   */
  private vowel(t: number, seconds: number, pitch: [number, number][], from: Formant[], to: Formant[], breath: number, points: [number, number][]) {
    const input = new GainNode(this.ctx);
    const mix = new GainNode(this.ctx);
    from.forEach(([hz, Q, level], i) => {
      const formant = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: hz, Q });
      formant.frequency.setValueAtTime(hz, t);
      formant.frequency.linearRampToValueAtTime(to[i][0], t + seconds);
      input.connect(formant).connect(new GainNode(this.ctx, { gain: level })).connect(mix);
    });
    const voice = this.osc('sawtooth', pitch[0][1], t, seconds);
    voice.frequency.setValueAtTime(pitch[0][1], t);
    for (const [at, hz] of pitch.slice(1)) voice.frequency.linearRampToValueAtTime(hz, t + at);
    voice.connect(input);
    const air = new AudioBufferSourceNode(this.ctx, { buffer: this.white, loop: true });
    air.connect(new GainNode(this.ctx, { gain: breath })).connect(input);
    air.start(t, Math.random() * 2);
    air.stop(t + seconds + 0.05);
    // Bandpass formants pass only a slice of the buzz, so make up the level.
    mix.connect(new GainNode(this.ctx, { gain: 4 })).connect(this.env(t, points));
  }

  private osc(type: OscillatorType, frequency: number, t: number, seconds: number): OscillatorNode {
    const osc = new OscillatorNode(this.ctx, { type, frequency });
    osc.start(t);
    osc.stop(t + seconds + 0.05);
    return osc;
  }

  /** Wobbles an oscillator's pitch by ±depth Hz. */
  private vibrato(osc: OscillatorNode, rate: number, depth: number, t: number, seconds: number) {
    this.osc('sine', rate, t, seconds).connect(new GainNode(this.ctx, { gain: depth })).connect(osc.frequency);
  }

  /**
   * A gain envelope from 0 at t through [seconds after t, level] points, wired to the output.
   * Linear ramps by default. `exp` decays exponentially, for struck sounds.
   */
  private env(t: number, points: [number, number][], exp = false): GainNode {
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    for (const [at, level] of points) {
      if (exp && level === 0) gain.gain.exponentialRampToValueAtTime(0.001, t + at);
      else gain.gain.linearRampToValueAtTime(level, t + at);
    }
    gain.connect(this.out);
    return gain;
  }

  private noise(t: number, seconds: number, filter: BiquadFilterOptions, points: [number, number][]) {
    this.noiseInto(t, seconds, new BiquadFilterNode(this.ctx, filter), points);
  }

  /** White noise into a chain from `first` to `last`, shaped by an envelope at the end. */
  private noiseInto(t: number, seconds: number, first: AudioNode, points: [number, number][], last = first) {
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.white, loop: true });
    src.connect(first);
    last.connect(this.env(t, points));
    src.start(t, Math.random() * 2);
    src.stop(t + seconds + 0.05);
  }
}
