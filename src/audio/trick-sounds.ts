import { BUBBLE_POP, HICCUP_TIMES, NAP_WAKE, SHAKE_DOUSE, type TrickName } from '../display/tricks';

/** A vowel formant: center Hz, Q and level. */
type Formant = [number, number, number];

/** Synthesized sounds for the dog tricks. Each one is timed to its trick's poses in tricks.ts. */
export class TrickSounds {
  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    private white: AudioBuffer,
  ) {}

  /** dir (+1 or -1) is the side the trick goes toward, for sounds that travel with it. */
  play(name: TrickName, dir: number) {
    const t = this.ctx.currentTime;
    switch (name) {
      case 'blep':
        return this.raspberry(t + 0.3, 1.2);
      case 'shake':
        this.shake(t);
        return this.douse(t + SHAKE_DOUSE);
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
      case 'colors':
        for (const at of [0, 1.3, 2.6]) this.glissando(t + at, true);
        return this.glissando(t + 3.9, false);
      case 'hiccups':
        for (const at of HICCUP_TIMES) this.hic(t + at);
        return;
      case 'bubble':
        return this.bubble(t);
      case 'lunge':
        return this.bark(t + 0.16);
      case 'nap':
        return this.nap(t);
      case 'monkeys':
        return this.monkeys(t + 0.1, dir);
      case 'melt':
        return this.melt(t);
    }
  }

  /** A harp-like sweep through eight pentatonic notes, up or down. */
  private glissando(t: number, up: boolean) {
    const notes = [523, 587, 659, 784, 880, 1047, 1175, 1319];
    (up ? notes : notes.reverse()).forEach((hz, i) => {
      const at = t + i * 0.045;
      this.osc('triangle', hz, at, 0.7).connect(this.env(at, [[0.004, 0.22], [0.7, 0]], true));
    });
  }

  /**
   * "Hic!": mostly a click. A quick breathy "h" as air rushes in, a barely-there voiced blip, then
   * the throat slamming shut: a sharp click that rings briefly, with a thump from the diaphragm
   * under it. Built sample by sample. Each one varies a little.
   */
  private hic(t: number) {
    const rate = this.ctx.sampleRate;
    const d = new Float32Array(Math.round(0.09 * rate));
    const shut = 0.04 + Math.random() * 0.01;
    const ring = 2300 + Math.random() * 600;
    for (let i = 0; i < d.length; i++) {
      const k = i / rate;
      let v = 0.5 * Math.sin(2 * Math.PI * 80 * k) * Math.exp(-k / 0.025);
      if (k < shut) {
        // Air rushing in, swelling until the throat shuts, with a faint voiced blip at the end.
        const swell = Math.min(1, k / shut);
        v += 0.4 * swell * swell * (Math.random() * 2 - 1);
        if (k > shut - 0.02) v += 0.12 * Math.sin(2 * Math.PI * 700 * k);
      } else {
        // The click: a hard snap, ringing for a few milliseconds.
        const c = k - shut;
        v += Math.exp(-c / 0.0015) * 1.6 * (Math.random() * 2 - 1);
        v += Math.exp(-c / 0.004) * (0.9 * Math.sin(2 * Math.PI * ring * c) + 0.5 * Math.sin(2 * Math.PI * 950 * c));
      }
      d[i] = v;
    }
    const buffer = this.ctx.createBuffer(1, d.length, rate);
    buffer.copyToChannel(d, 0);
    const src = new AudioBufferSourceNode(this.ctx, { buffer });
    const hp = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 60 });
    src.connect(hp).connect(this.env(t, [[0.001, 0.4], [0.09, 0.4]]));
    src.start(t);
  }

  /** A soft "fff" on each breath into the gum, then the pop. */
  private bubble(t: number) {
    for (const [a, b] of [[0.3, 1.0], [1.3, 2.1], [2.4, 3.2]]) {
      this.noise(t + a, b - a, { type: 'bandpass', frequency: 2800, Q: 1 }, [[0.1, 0.12], [b - a - 0.1, 0.1], [b - a, 0]]);
    }
    const pop = t + BUBBLE_POP;
    this.noise(pop, 0.015, { type: 'highpass', frequency: 1800 }, [[0.001, 0.5], [0.015, 0]]);
    const thup = this.osc('sine', 220, pop, 0.08);
    thup.frequency.setValueAtTime(220, pop);
    thup.frequency.exponentialRampToValueAtTime(60, pop + 0.08);
    thup.connect(this.env(pop, [[0.002, 0.6], [0.08, 0]]));
  }

  /** A big "WOOF!": a voiced bark from "oo" to "uh", a thump of chest, and a puff of breath at the end. */
  private bark(t: number) {
    const oo: Formant[] = [[400, 4, 1], [850, 5, 0.6]];
    const uh: Formant[] = [[650, 4, 1], [1100, 5, 0.6]];
    this.vowel(t, 0.24, [[0, 230], [0.05, 300], [0.24, 150]], oo, uh, 1.5, [[0.01, 0.9], [0.08, 0.7], [0.24, 0]]);
    this.noise(t, 0.12, { type: 'lowpass', frequency: 200, Q: 0.7 }, [[0.004, 1], [0.12, 0]]);
    this.noise(t + 0.17, 0.08, { type: 'highpass', frequency: 2000 }, [[0.01, 0.25], [0.08, 0]]);
  }

  /** Two snores, each a rumbling inhale and a thin whistle out, then a startled snort and "huh?!". */
  private nap(t: number) {
    for (const at of [2.9, 4.1]) {
      this.snore(t + at);
      const whistle = this.osc('sine', 1150, t + at + 0.6, 0.4);
      whistle.frequency.setValueAtTime(1150, t + at + 0.6);
      whistle.frequency.exponentialRampToValueAtTime(850, t + at + 1.0);
      whistle.connect(this.env(t + at + 0.6, [[0.08, 0.12], [0.3, 0.1], [0.4, 0]]));
    }
    const wake = t + NAP_WAKE;
    this.noise(wake, 0.15, { type: 'bandpass', frequency: 900, Q: 1 }, [[0.005, 0.9], [0.15, 0]]);
    const uh: Formant[] = [[650, 4, 1], [1100, 5, 0.6]];
    this.vowel(wake + 0.15, 0.25, [[0, 160], [0.25, 330]], uh, uh, 0.8, [[0.02, 0.6], [0.2, 0.5], [0.25, 0]]);
  }

  /** A rumbling inhale: a low buzz fluttering like a soft palate. */
  private snore(t: number) {
    const seconds = 0.6;
    const flutter = new GainNode(this.ctx, { gain: 0.5 });
    this.osc('sine', 27, t, seconds).connect(new GainNode(this.ctx, { gain: 0.5 })).connect(flutter.gain);
    const lp = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 500, Q: 1 });
    this.osc('sawtooth', 62, t, seconds).connect(flutter).connect(lp).connect(this.env(t, [[0.4, 0.9], [0.55, 0.6], [seconds, 0]]));
    this.noise(t, seconds, { type: 'bandpass', frequency: 400, Q: 1 }, [[0.4, 0.2], [seconds, 0]]);
  }

  /** The flock passing: wing flaps, and screeching "ee-ee-ee" calls that pan across with it. */
  private monkeys(t: number, dir: number) {
    const pan = new StereoPannerNode(this.ctx, { pan: -0.9 * dir });
    pan.pan.setValueAtTime(-0.9 * dir, t);
    pan.pan.linearRampToValueAtTime(0.9 * dir, t + 3.6);
    pan.connect(this.out);
    for (let k = 0; k < 16; k++) {
      this.noise(t + 0.2 + k * 0.2, 0.09, { type: 'lowpass', frequency: 350, Q: 0.7 }, [[0.01, 0.8], [0.09, 0]], pan);
    }
    for (let i = 0; i < 9; i++) {
      const call = t + 0.3 + i * 0.33 + Math.random() * 0.12;
      const calls = 2 + Math.floor(Math.random() * 2);
      for (let c = 0; c < calls; c++) {
        const at = call + c * 0.09;
        const base = 1300 + Math.random() * 400;
        const screech = this.osc('sawtooth', base, at, 0.12);
        screech.frequency.setValueAtTime(base, at);
        screech.frequency.linearRampToValueAtTime(base + 800, at + 0.04);
        screech.frequency.linearRampToValueAtTime(base + 200, at + 0.12);
        const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 2400, Q: 1.5 });
        screech.connect(band).connect(this.env(at, [[0.01, 1.1], [0.12, 0]], false, pan));
      }
    }
  }

  /**
   * Without the witch's clip: a frying sizzle with crackles and a falling wail as the head melts
   * (1.1–4.6 s), a quieter sizzle from the puddle, then a rising sweep and a sparkle as it re-forms.
   */
  private melt(t: number) {
    this.noise(t + 1.1, 6.3, { type: 'highpass', frequency: 3500 }, [[0.6, 0.35], [3.5, 0.4], [4.5, 0.15], [6.3, 0]]);
    for (let i = 0; i < 40; i++) {
      this.noise(t + 1.1 + Math.random() * 3.5, 0.02, { type: 'bandpass', frequency: 3000 + Math.random() * 3000, Q: 2 }, [[0.002, 0.6], [0.02, 0]]);
    }
    const oh: Formant[] = [[500, 4, 1], [900, 5, 0.5]];
    const oo: Formant[] = [[350, 4, 1], [700, 5, 0.5]];
    this.vowel(t + 1.2, 3.2, [[0, 620], [0.7, 680], [3.2, 220]], oh, oo, 0.3, [[0.3, 0.3], [2.5, 0.25], [3.2, 0]], [5, 30]);
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 300, Q: 1.5 });
    band.frequency.setValueAtTime(300, t + 7.4);
    band.frequency.exponentialRampToValueAtTime(3000, t + 8.4);
    this.noiseInto(t + 7.4, 1, band, [[0.8, 0.8], [1, 0]]);
    this.ding(t + 8.4);
  }

  /**
   * A wet "pbbbbt": a "P" burst, then the lips flapping about 32 times a second. Each flap is a
   * short noisy pop with a fleshy thud under it, uneven in timing and strength, and the flaps
   * slow and sputter at the end. Built sample by sample, then shaped by the mouth's resonance.
   */
  private raspberry(t: number, seconds: number) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.round((seconds + 0.1) * rate), rate);
    const d = buffer.getChannelData(0);
    const pop = (at: number, level: number, decay: number, thudHz: number) => {
      const start = Math.round(at * rate);
      const len = Math.min(d.length - start, Math.round(decay * 6 * rate));
      for (let i = 0; i < len; i++) {
        const k = i / rate;
        const fall = Math.exp(-k / decay);
        d[start + i] += level * fall * ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * thudHz * k) * 0.6);
      }
    };
    // The "P": lips bursting open.
    pop(0, 1.2, 0.012, 140);
    for (let at = 0.03; at < seconds - 0.05; ) {
      const k = at / seconds;
      // Steady at first, then slowing and sputtering as the breath runs out.
      const hz = 32 - 12 * Math.max(0, (k - 0.7) / 0.3);
      const jitter = 1 + (Math.random() - 0.5) * (k > 0.7 ? 0.5 : 0.24);
      const fade = k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
      pop(at, (0.55 + Math.random() * 0.45) * fade, 0.005 + Math.random() * 0.004, 170 + Math.random() * 90);
      at += jitter / hz;
    }
    const src = new AudioBufferSourceNode(this.ctx, { buffer });
    const hp = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 90 });
    const lips = new BiquadFilterNode(this.ctx, { type: 'peaking', frequency: 900, Q: 1.2, gain: 8 });
    const lp = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 3800 });
    src.connect(hp).connect(lips).connect(lp).connect(this.env(t, [[0.01, 0.78], [seconds, 0.78], [seconds + 0.05, 0]]));
    src.start(t);
  }

  /** Water hitting the fire: a sharp hiss that fades, with a few spits. */
  private douse(t: number) {
    this.noise(t, 1.6, { type: 'highpass', frequency: 2500 }, [[0.03, 0.45], [0.4, 0.25], [1.6, 0]]);
    for (let i = 0; i < 12; i++) {
      this.noise(t + Math.random() * 0.9, 0.015, { type: 'bandpass', frequency: 2000 + Math.random() * 3000, Q: 2 }, [[0.002, 0.35], [0.015, 0]]);
    }
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
  private vowel(t: number, seconds: number, pitch: [number, number][], from: Formant[], to: Formant[], breath: number, points: [number, number][], vibrato?: [number, number]) {
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
    if (vibrato) this.vibrato(voice, vibrato[0], vibrato[1], t, seconds);
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
  private env(t: number, points: [number, number][], exp = false, out: AudioNode = this.out): GainNode {
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    for (const [at, level] of points) {
      if (exp && level === 0) gain.gain.exponentialRampToValueAtTime(0.001, t + at);
      else gain.gain.linearRampToValueAtTime(level, t + at);
    }
    gain.connect(out);
    return gain;
  }

  private noise(t: number, seconds: number, filter: BiquadFilterOptions, points: [number, number][], out: AudioNode = this.out) {
    const f = new BiquadFilterNode(this.ctx, filter);
    this.noiseInto(t, seconds, f, points, f, out);
  }

  /** White noise into a chain from `first` to `last`, shaped by an envelope at the end. */
  private noiseInto(t: number, seconds: number, first: AudioNode, points: [number, number][], last = first, out: AudioNode = this.out) {
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.white, loop: true });
    src.connect(first);
    last.connect(this.env(t, points, false, out));
    src.start(t, Math.random() * 2);
    src.stop(t + seconds + 0.05);
  }
}
