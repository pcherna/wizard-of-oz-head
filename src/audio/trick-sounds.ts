import {
  BUBBLE_POP, DOORBELL_BARKS, FIREFLY_BURP, FIREFLY_CATCH, FIREFLY_GULP, HICCUP_TIMES, MELT_DOWN, NAP_WAKE, PERK_AT,
  PUMPKIN_LIGHT, PUMPKIN_OUT, RAINBOW_BEAT, RAINBOW_START, RAINBOW_TUNE, SCRATCH_STROKES, SHAKE_DOUSE,
  TREAT_CATCH, TREAT_CRUNCHES, TREAT_FLIP, TREAT_GULP, WIZARD_EIGHTH, WIZARD_START, WIZARD_TUNE, fireflyAt, type TrickName,
} from '../display/tricks';

/** A vowel formant: center Hz, Q and level. */
type Formant = [number, number, number];

/** The march's bass: [eighth note, Hz], one per beat, root and fifth. D, A, D, A7, D, A, G, A7, then the last D. */
const WIZARD_BASS: [number, number][] = [
  [0, 146.83], [3, 110], [6, 146.83], [9, 110], [12, 146.83], [15, 110], [18, 98], [21, 110], [24, 146.83],
];

/** The music box's accompaniment under "Over the Rainbow": [quarter note, MIDI note], root then fifth or seventh. */
const RAINBOW_BASS: [number, number][] = [
  [0, 62], [1, 69], [2, 59], [3, 66], [4, 54], [5, 61], [6, 62], [7, 60], [8, 55], [9, 62], [10, 55], [11, 65], [12, 62], [13, 66], [14, 69],
];

function midiHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Synthesized sounds for the dog tricks. Each one is timed to its trick's poses in tricks.ts. */
export class TrickSounds {
  /** Recorded "hic"s, from public/sfx/hic-1.wav, hic-2.wav and so on. They replace the synthesized one. */
  hicSamples: AudioBuffer[] = [];
  private lastHic = -1;

  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    private white: AudioBuffer,
  ) {}

  /**
   * Plays a trick's sound into `out`, so the caller can fade it all out at once. dir (+1 or -1)
   * is the side the trick goes toward, for sounds that travel with it.
   */
  play(name: TrickName, dir: number, out: AudioNode) {
    // Every node below connects at once, to this.out, so pointing it at `out` routes the lot.
    const keep = this.out;
    this.out = out;
    try {
      this.synth(name, dir);
    } finally {
      this.out = keep;
    }
  }

  private synth(name: TrickName, dir: number) {
    const t = this.ctx.currentTime;
    switch (name) {
      case 'blep':
        return this.raspberry(t + 0.3, 1.2);
      case 'shake':
        this.shake(t);
        return this.douse(t + SHAKE_DOUSE);
      case 'lick':
        return this.slurp(t + 0.35);
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
      case 'vampire':
        return this.toccata(t + 0.4);
      case 'perk':
        this.whistle(t, dir);
        this.boing(t + PERK_AT);
        return this.flop(t + 2.65);
      case 'doorbell':
        this.doorbell(t, dir);
        for (const at of DOORBELL_BARKS) this.bark(t + at, 0.45, 1.3);
        return;
      case 'firefly':
        return this.firefly(t, dir);
      case 'scratch':
        this.scrape(t);
        return this.groan(t + 2.6);
      case 'pumpkin':
        return this.candle(t);
      case 'treat':
        return this.treat(t);
      case 'wizard':
        return this.wizard(t);
      case 'rainbow':
        return this.musicBox(t);
    }
  }

  /**
   * The biscuit on the nose: a clock ticks through the wait, with a whine of longing. A "fwip" as
   * it's tossed, a chomp, four crunches, a gulp and a sparkle.
   */
  private treat(t: number) {
    [0.8, 1.3, 1.8, 2.3].forEach((at, i) => this.tick(t + at, i % 2 ? 1300 : 1800));
    this.whine(t + 1.9, 700, 950);
    const fwip = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 600, Q: 2 });
    fwip.frequency.setValueAtTime(600, t + TREAT_FLIP);
    fwip.frequency.exponentialRampToValueAtTime(3000, t + TREAT_FLIP + 0.15);
    this.noiseInto(t + TREAT_FLIP, 0.15, fwip, [[0.05, 1.2], [0.15, 0]]);
    this.chomp(t + TREAT_CATCH);
    for (const at of TREAT_CRUNCHES) this.crunch(t + at);
    this.gulp(t + TREAT_GULP);
    this.ding(t + TREAT_GULP + 0.2);
  }

  /** A woodblock "tick" of a clock. */
  private tick(t: number, hz: number) {
    this.osc('sine', hz, t, 0.06).connect(this.env(t, [[0.002, 0.5], [0.06, 0]], true));
    this.noise(t, 0.01, { type: 'highpass', frequency: 3000 }, [[0.001, 0.3], [0.01, 0]]);
  }

  /** Teeth snapping shut: a click and a thud. */
  private chomp(t: number) {
    this.noise(t, 0.03, { type: 'highpass', frequency: 2500 }, [[0.001, 0.8], [0.03, 0]]);
    const thud = this.osc('sine', 160, t, 0.1);
    thud.frequency.setValueAtTime(160, t);
    thud.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    thud.connect(this.env(t, [[0.003, 0.6], [0.1, 0]]));
  }

  /** A quick, low "glk". */
  private gulp(t: number) {
    const tone = this.osc('sine', 320, t, 0.12);
    tone.frequency.setValueAtTime(320, t);
    tone.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    tone.connect(this.env(t, [[0.01, 0.5], [0.12, 0]]));
  }

  /** A biscuit breaking between the teeth: a burst of dry crackles over a dull crack. */
  private crunch(t: number) {
    this.noise(t, 0.06, { type: 'lowpass', frequency: 900, Q: 0.7 }, [[0.003, 0.6], [0.06, 0]]);
    for (let i = 0; i < 8; i++) {
      const at = t + Math.random() * 0.07;
      this.noise(at, 0.012, { type: 'bandpass', frequency: 1500 + Math.random() * 2500, Q: 3 }, [[0.001, 0.5], [0.012, 0]]);
    }
  }

  /**
   * "We're off to see the Wizard" on a kazoo: one buzzing voice that slides from note to note,
   * tongued between them, over a tuba's oom-pah and a brush on the off-beats. A cymbal on the last note.
   */
  private wizard(t: number) {
    const at = (eighth: number) => t + WIZARD_START + eighth * WIZARD_EIGHTH;
    const first = WIZARD_TUNE[0];
    const last = WIZARD_TUNE[WIZARD_TUNE.length - 1];
    const start = at(first[0]);
    const end = at(last[0] + last[1]);
    const voice = this.osc('sawtooth', midiHz(first[2]), start, end - start + 0.2);
    voice.frequency.setValueAtTime(midiHz(first[2]), start);
    this.vibrato(voice, 5.5, 4, start, end - start + 0.2);
    // The membrane buzz: clip the tone hard, then a nasal peak and a rasp on top.
    const buzz = new WaveShaperNode(this.ctx, { curve: softClip(4) });
    const nasal = new BiquadFilterNode(this.ctx, { type: 'peaking', frequency: 1100, Q: 2, gain: 10 });
    const rasp = new BiquadFilterNode(this.ctx, { type: 'peaking', frequency: 2800, Q: 2, gain: 8 });
    const thin = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 300 });
    const level = new GainNode(this.ctx, { gain: 0 });
    level.gain.setValueAtTime(0, start);
    voice.connect(buzz).connect(nasal).connect(rasp).connect(thin).connect(level).connect(new GainNode(this.ctx, { gain: 0.12 })).connect(this.out);
    for (const [n, len, note] of WIZARD_TUNE) {
      voice.frequency.setTargetAtTime(midiHz(note), at(n) - 0.01, 0.012);
      level.gain.setTargetAtTime(1, at(n), 0.01);
      level.gain.setTargetAtTime(0.2, at(n + len) - 0.035, 0.01);
    }
    level.gain.setTargetAtTime(0, end, 0.04);
    for (const [n, hz] of WIZARD_BASS) {
      const len = n === last[0] ? 0.6 : 0.28;
      for (const [mult, gain] of [[1, 0.5], [2, 0.2], [3, 0.08]]) {
        this.osc('sine', hz * mult, at(n), len).connect(this.env(at(n), [[0.02, gain], [len, 0]], true));
      }
      if (n < last[0]) this.noise(at(n + 2), 0.06, { type: 'bandpass', frequency: 3000, Q: 0.8 }, [[0.004, 0.25], [0.06, 0]]);
    }
    this.noise(at(last[0]), 1.0, { type: 'highpass', frequency: 5000 }, [[0.005, 0.35], [1.0, 0]]);
  }

  /**
   * "Somewhere over the rainbow, way up high" on a music box, with a soft accompaniment and a
   * little hall, after a harp sweep as the rainbow appears. A contented sigh at the end.
   */
  private musicBox(t: number) {
    const at = (beat: number) => t + RAINBOW_START + beat * RAINBOW_BEAT;
    const box = new GainNode(this.ctx);
    box.connect(this.out);
    const hall = new ConvolverNode(this.ctx, { buffer: this.churchImpulse() });
    box.connect(hall).connect(new GainNode(this.ctx, { gain: 0.2 })).connect(this.out);
    this.glissando(t + 0.1, true);
    for (const [beat, , note] of RAINBOW_TUNE) this.tine(midiHz(note), at(beat), box, 1);
    for (const [beat, note] of RAINBOW_BASS) this.tine(midiHz(note), at(beat), box, 0.4);
    this.noise(at(16) + 0.1, 0.9, { type: 'bandpass', frequency: 700, Q: 0.7 }, [[0.25, 0.35], [0.9, 0]]);
  }

  /** A plucked music-box tine: a pure tone with a quick metallic overtone, ringing out. */
  private tine(hz: number, t: number, out: AudioNode, level: number) {
    for (const [mult, gain, decay] of [[1, 0.3, 1.6], [2, 0.08, 0.6], [5.4, 0.05, 0.25]]) {
      this.osc('sine', hz * mult, t, decay).connect(this.env(t, [[0.002, gain * level], [decay, 0]], true, out));
    }
  }

  /** An owner calling the dog from one side: a whistled "fweet", then a "fwee-oo-eet" that dips and rises. */
  private whistle(t: number, dir: number) {
    const pan = new StereoPannerNode(this.ctx, { pan: 0.75 * dir });
    // A little room echo, so it sounds like it comes from across the yard.
    const echo = new DelayNode(this.ctx, { delayTime: 0.11 });
    pan.connect(this.out);
    pan.connect(echo).connect(new GainNode(this.ctx, { gain: 0.25 })).connect(this.out);
    const notes: [number, number, [number, number][]][] = [
      [0.02, 0.24, [[0, 1700], [0.2, 2700]]],
      [0.34, 0.45, [[0, 2600], [0.1, 2650], [0.3, 1750], [0.45, 2350]]],
    ];
    for (const [at, len, glide] of notes) {
      const tone = this.osc('sine', glide[0][1], t + at, len);
      tone.frequency.setValueAtTime(glide[0][1], t + at);
      for (const [k, hz] of glide.slice(1)) tone.frequency.exponentialRampToValueAtTime(hz, t + at + k);
      this.vibrato(tone, 6, 25, t + at, len);
      tone.connect(this.env(t + at, [[0.03, 0.3], [len - 0.05, 0.28], [len, 0]], false, pan));
      // The breath behind a whistle.
      this.noise(t + at, len, { type: 'bandpass', frequency: 2400, Q: 2 }, [[0.03, 0.06], [len, 0]], pan);
    }
  }

  /** A cartoon "boing" as the ear springs up: a twangy tone that wobbles and dies away. */
  private boing(t: number) {
    const tone = this.osc('triangle', 180, t, 0.5);
    tone.frequency.setValueAtTime(180, t);
    tone.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    tone.frequency.exponentialRampToValueAtTime(260, t + 0.5);
    const wobble = new GainNode(this.ctx, { gain: 60 });
    wobble.gain.setValueAtTime(60, t);
    wobble.gain.exponentialRampToValueAtTime(5, t + 0.5);
    this.osc('sine', 16, t, 0.5).connect(wobble).connect(tone.frequency);
    tone.connect(this.env(t, [[0.005, 0.45], [0.5, 0]], true));
  }

  /** A soft, floppy thud as the ear drops. */
  private flop(t: number) {
    this.noise(t, 0.08, { type: 'lowpass', frequency: 400, Q: 0.7 }, [[0.005, 0.7], [0.08, 0]]);
  }

  /** A two-tone "ding-dong" doorbell from the door's side: struck bells with clangy overtones, ringing out. */
  private doorbell(t: number, dir: number) {
    const pan = new StereoPannerNode(this.ctx, { pan: 0.6 * dir });
    pan.connect(this.out);
    for (const [hz, at] of [[659.25, 0], [523.25, 0.45]]) {
      for (const [mult, level] of [[1, 0.3], [2, 0.12], [2.76, 0.08], [5.4, 0.04]]) {
        this.osc('sine', hz * mult, t + at, 1.6).connect(this.env(t + at, [[0.003, level], [1.6 / mult, 0]], true, pan));
      }
    }
  }

  /**
   * The firefly buzzing around the head, panned and louder as it passes close, its pitch bending
   * as it darts. Then a chomp, a gulp, and a fluttering burp with a sparkle.
   */
  private firefly(t: number, dir: number) {
    const pan = new StereoPannerNode(this.ctx, { pan: dir });
    const level = new GainNode(this.ctx, { gain: 0 });
    const wings = this.osc('sawtooth', 210, t, FIREFLY_CATCH);
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 900, Q: 0.8 });
    wings.connect(band).connect(level).connect(pan).connect(this.out);
    // Wingbeats flutter the level.
    const flutter = new GainNode(this.ctx, { gain: 0.3 });
    this.osc('sine', 37, t, FIREFLY_CATCH).connect(flutter).connect(level.gain);
    level.gain.setValueAtTime(0, t);
    pan.pan.setValueAtTime(dir, t);
    wings.frequency.setValueAtTime(210, t);
    const STEP = 0.03;
    let prevDist = Math.hypot(...fireflyAt(0, dir));
    for (let k = 0; k <= FIREFLY_CATCH; k += STEP) {
      const [x, y, z] = fireflyAt(k, dir);
      const dist = Math.hypot(x, y, z - 1.5);
      // Nearer the audience, at z 1.5 and up, is louder. Moving away lowers the pitch a little.
      const loud = Math.min(1, 0.6 / Math.max(dist, 0.3)) * Math.min(1, k / 0.4);
      level.gain.linearRampToValueAtTime(0.5 * loud, t + k);
      pan.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, x / 2)), t + k);
      wings.frequency.linearRampToValueAtTime(210 * (1 - 1.5 * (dist - prevDist)), t + k);
      prevDist = dist;
    }
    level.gain.linearRampToValueAtTime(0, t + FIREFLY_CATCH + 0.01);
    this.chomp(t + FIREFLY_CATCH);
    this.gulp(t + FIREFLY_GULP);
    // Burp: a low "uh" fluttering in the throat, then the sparkle of the sparks escaping.
    const burp = t + FIREFLY_BURP - 0.05;
    const uh: Formant[] = [[550, 4, 1], [1000, 5, 0.5]];
    const oh: Formant[] = [[450, 4, 1], [800, 5, 0.5]];
    const croak = new GainNode(this.ctx, { gain: 0.6 });
    this.osc('sine', 28, burp, 0.45).connect(new GainNode(this.ctx, { gain: 0.4 })).connect(croak.gain);
    croak.connect(this.out);
    const keep = this.out;
    this.out = croak;
    try {
      this.vowel(burp, 0.45, [[0, 105], [0.45, 80]], uh, oh, 0.5, [[0.03, 0.6], [0.3, 0.45], [0.45, 0]]);
    } finally {
      this.out = keep;
    }
    this.ding(t + FIREFLY_BURP + 0.1);
  }

  /**
   * Fingernails scratching through fur: a steady "shhhh" that swells on each stroke, faster and
   * faster. The strokes go back and forth, so each one is pitched a little higher or lower than the last.
   */
  private scrape(t: number) {
    const start = 0.45;
    const end = 2.5;
    const split = new GainNode(this.ctx);
    const fur = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 4000, Q: 0.9 });
    // A lower rasp under the hiss, so small speakers carry it too.
    const rasp = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 1300, Q: 1.2 });
    const strokes = new GainNode(this.ctx, { gain: 0.3 });
    split.connect(fur).connect(strokes);
    split.connect(rasp).connect(new GainNode(this.ctx, { gain: 0.5 })).connect(strokes);
    strokes.gain.setValueAtTime(0.3, t + start);
    const ends = [start, ...SCRATCH_STROKES, end];
    for (let i = 1; i < ends.length; i++) {
      const [a, b] = [ends[i - 1], ends[i]];
      fur.frequency.setTargetAtTime(i % 2 ? 3300 : 4800, t + a, 0.03);
      strokes.gain.linearRampToValueAtTime(1, t + (a + b) / 2);
      strokes.gain.linearRampToValueAtTime(0.3, t + b);
    }
    this.noiseInto(t + start, end - start, split, [[0.15, 0.7], [end - start - 0.15, 0.7], [end - start, 0]], strokes);
  }

  /** A long, contented "mmmmh" through closed lips, sinking at the end. */
  private groan(t: number) {
    const mm: Formant[] = [[250, 3, 1], [900, 5, 0.15]];
    this.vowel(t, 0.9, [[0, 150], [0.3, 165], [0.9, 105]], mm, mm, 0.2, [[0.1, 0.4], [0.6, 0.35], [0.9, 0]]);
  }

  /**
   * The jack-o'-lantern: a match strikes and the candle catches with a soft "whump", then
   * crackles quietly until the dog blows it out with a long "fff".
   */
  private candle(t: number) {
    const strike = t + PUMPKIN_LIGHT - 0.35;
    this.noise(strike, 0.2, { type: 'bandpass', frequency: 3500, Q: 1 }, [[0.01, 0.5], [0.06, 0.25], [0.2, 0]]);
    for (let i = 0; i < 5; i++) {
      this.noise(strike + Math.random() * 0.15, 0.015, { type: 'highpass', frequency: 4000 }, [[0.002, 0.4], [0.015, 0]]);
    }
    const whump = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 200, Q: 1 });
    whump.frequency.setValueAtTime(200, t + PUMPKIN_LIGHT);
    whump.frequency.exponentialRampToValueAtTime(900, t + PUMPKIN_LIGHT + 0.15);
    whump.frequency.exponentialRampToValueAtTime(250, t + PUMPKIN_LIGHT + 0.6);
    this.noiseInto(t + PUMPKIN_LIGHT, 0.6, whump, [[0.08, 1.2], [0.6, 0]]);
    for (let i = 0; i < 10; i++) {
      const at = t + PUMPKIN_LIGHT + 0.3 + Math.random() * (PUMPKIN_OUT - PUMPKIN_LIGHT - 0.5);
      this.noise(at, 0.02, { type: 'bandpass', frequency: 2500 + Math.random() * 2500, Q: 2 }, [[0.002, 0.2], [0.02, 0]]);
    }
    this.noise(t + PUMPKIN_OUT - 0.25, 0.4, { type: 'bandpass', frequency: 1300, Q: 0.8 }, [[0.05, 0.6], [0.3, 0.5], [0.4, 0]]);
  }

  /**
   * The opening of Bach's Toccata and Fugue in D minor on a pipe organ: the "A-G-A" mordent and
   * its long A, a pause, then the run down from G to the low D. A church-sized reverb carries it.
   */
  private toccata(t: number) {
    const [A, G, F, E, D, Cs] = [440, 392, 349.23, 329.63, 293.66, 277.18];
    const notes: [number, number, number][] = [
      [A, 0, 0.1], [G, 0.1, 0.1], [A, 0.2, 0.95],
      [G, 1.35, 0.12], [F, 1.47, 0.12], [E, 1.59, 0.12], [D, 1.71, 0.12], [Cs, 1.83, 0.35], [D, 2.2, 1.4],
    ];
    const organ = new GainNode(this.ctx);
    organ.connect(this.out);
    const hall = new ConvolverNode(this.ctx, { buffer: this.churchImpulse() });
    organ.connect(hall).connect(new GainNode(this.ctx, { gain: 0.5 })).connect(this.out);
    for (const [hz, at, len] of notes) this.organNote(hz, t + at, len, organ);
  }

  /** One organ note: two ranks an octave apart, each with a few harmonics, and a breathy chiff as the pipe speaks. */
  private organNote(hz: number, t: number, len: number, out: AudioNode) {
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.025);
    env.gain.setValueAtTime(0.16, t + len);
    env.gain.linearRampToValueAtTime(0, t + len + 0.12);
    env.connect(out);
    for (const [mult, level] of [[0.5, 0.6], [1, 1], [2, 0.55], [3, 0.3], [4, 0.25], [6, 0.12], [8, 0.08]]) {
      this.osc('sine', hz * mult, t, len + 0.15).connect(new GainNode(this.ctx, { gain: level })).connect(env);
    }
    this.noise(t, 0.05, { type: 'bandpass', frequency: hz * 4, Q: 2 }, [[0.005, 0.08], [0.05, 0]], out);
  }

  private church: AudioBuffer | null = null;

  /** Three seconds of stereo noise fading out: a big stone church. Made once. */
  private churchImpulse(): AudioBuffer {
    if (this.church) return this.church;
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, 3 * rate, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    return (this.church = buffer);
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
    const n = this.hicSamples.length;
    if (n > 0) {
      // A different recording each time, never the same twice in a row, a little higher or lower.
      let i = Math.floor(Math.random() * n);
      if (n > 1 && i === this.lastHic) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
      this.lastHic = i;
      const buffer = this.hicSamples[i];
      const src = new AudioBufferSourceNode(this.ctx, { buffer, playbackRate: 0.96 + Math.random() * 0.08 });
      src.connect(this.env(t, [[0.001, 1], [buffer.duration + 0.05, 1]]));
      src.start(t);
      return;
    }
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

  /**
   * A big "WOOF!": a voiced bark from "oo" to "uh", a thump of chest, and a puff of breath at the
   * end. A lower level and higher pitch make a friendlier "boof".
   */
  private bark(t: number, level = 1, pitch = 1) {
    const oo: Formant[] = [[400, 4, 1], [850, 5, 0.6]];
    const uh: Formant[] = [[650, 4, 1], [1100, 5, 0.6]];
    this.vowel(t, 0.24, [[0, 230 * pitch], [0.05, 300 * pitch], [0.24, 150 * pitch]], oo, uh, 1.5, [[0.01, 0.9 * level], [0.08, 0.7 * level], [0.24, 0]]);
    this.noise(t, 0.12, { type: 'lowpass', frequency: 200, Q: 0.7 }, [[0.004, level], [0.12, 0]]);
    this.noise(t + 0.17, 0.08, { type: 'highpass', frequency: 2000 }, [[0.01, 0.25 * level], [0.08, 0]]);
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
    this.noise(wake, 0.15, { type: 'bandpass', frequency: 900, Q: 1 }, [[0.005, 0.4], [0.15, 0]]);
    const uh: Formant[] = [[650, 4, 1], [1100, 5, 0.6]];
    this.vowel(wake + 0.15, 0.25, [[0, 160], [0.25, 330]], uh, uh, 0.8, [[0.02, 0.28], [0.2, 0.22], [0.25, 0]]);
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
   * (from MELT_DOWN to 7 s), then a rising sweep and a sparkle as it re-forms.
   */
  private melt(t: number) {
    const down = t + MELT_DOWN;
    this.noise(down - 0.2, 2.8, { type: 'highpass', frequency: 3500 }, [[0.5, 0.35], [2.2, 0.4], [2.8, 0]]);
    for (let i = 0; i < 40; i++) {
      this.noise(down + Math.random() * 2.3, 0.02, { type: 'bandpass', frequency: 3000 + Math.random() * 3000, Q: 2 }, [[0.002, 0.6], [0.02, 0]]);
    }
    const oh: Formant[] = [[500, 4, 1], [900, 5, 0.5]];
    const oo: Formant[] = [[350, 4, 1], [700, 5, 0.5]];
    this.vowel(down, 2.4, [[0, 620], [0.5, 680], [2.4, 220]], oh, oo, 0.3, [[0.3, 0.3], [1.9, 0.25], [2.4, 0]], [5, 30]);
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

  /**
   * A wet slurp: a smack as the tongue leaves the mouth, a gurgle of bubbles as it drags across
   * the nose, and two smacks as it goes back in. Each bubble rings briefly at its own pitch and
   * rises as it pops, the way real bubbles sound, and they come in uneven clusters. A little
   * low slosh sits under them. Built sample by sample.
   */
  private slurp(t: number) {
    const rate = this.ctx.sampleRate;
    const seconds = 0.85;
    const d = new Float32Array(Math.round((seconds + 0.05) * rate));
    let at = 0.02;
    while (at < seconds - 0.05) {
      // Clusters: sometimes a quick run of bubbles, sometimes a gap.
      const swell = Math.sin((Math.PI * at) / seconds);
      bubble(d, rate, at, 250 + Math.random() * 700, 0.012 + Math.random() * 0.02, (0.3 + Math.random() * 0.7) * swell);
      at += Math.random() < 0.3 ? 0.03 + Math.random() * 0.05 : 0.006 + Math.random() * 0.018;
    }
    let lp = 0;
    for (let i = 0; i < d.length; i++) {
      lp += ((Math.random() * 2 - 1) - lp) * 0.05;
      d[i] += lp * 0.6 * Math.sin((Math.PI * i) / d.length);
    }
    this.playSamples(d, t, 0.5);
    // The smack as the tongue comes out, and two as it goes back in, about 1.2 s into the lick.
    for (const at of [0, 0.88, 1.0]) this.smack(t + at);
  }

  /** A wet smack: a sharp click of parting lips, then a few small bubbles popping. */
  private smack(t: number) {
    const rate = this.ctx.sampleRate;
    const d = new Float32Array(Math.round(0.08 * rate));
    for (let i = 0; i < 0.004 * rate; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / rate / 0.0008);
    for (let k = 0; k < 3; k++) bubble(d, rate, 0.003 + Math.random() * 0.03, 600 + Math.random() * 900, 0.006 + Math.random() * 0.008, 0.5 + Math.random() * 0.5);
    this.playSamples(d, t, 0.45);
  }

  /** Plays samples made here at time t, at the given level. */
  private playSamples(d: Float32Array<ArrayBuffer>, t: number, level: number) {
    const buffer = this.ctx.createBuffer(1, d.length, this.ctx.sampleRate);
    buffer.copyToChannel(d, 0);
    const src = new AudioBufferSourceNode(this.ctx, { buffer });
    src.connect(this.env(t, [[0.001, level], [buffer.duration, level]]));
    src.start(t);
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

/**
 * Adds one bubble to d: a tone at hz that rises as it pops and dies away over about `decay`
 * seconds, starting at `at` seconds. Real bubbles ring like this as they form and burst.
 */
function bubble(d: Float32Array, rate: number, at: number, hz: number, decay: number, level: number) {
  const start = Math.round(at * rate);
  let phase = 0;
  for (let i = 0; i < decay * 5 * rate && start + i < d.length; i++) {
    const k = i / rate;
    phase += (hz * (1 + (k / decay) * 0.6)) / rate;
    d[start + i] += level * Math.exp(-k / decay) * Math.sin(2 * Math.PI * phase);
  }
}

/** A tanh curve for a WaveShaperNode: drive 1 barely bends the wave, higher clips it toward a square. */
function softClip(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(drive * ((i / (curve.length - 1)) * 2 - 1));
  return curve;
}
