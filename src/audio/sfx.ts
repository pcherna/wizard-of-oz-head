import { TRICKS, type TrickName } from '../display/tricks';
import { TrickSounds } from './trick-sounds';

type SoundName = 'thunder' | 'steam' | 'fire' | 'trick';

/** Mix level of each sound relative to the voice. Applies to synthesized sounds and .wav files alike. */
const LEVELS: Record<SoundName, number> = {
  fire: 0.3,
  steam: 0.3,
  thunder: 0.7,
  trick: 0.5,
};

/** A spoken clip, such as "Squirrel!", plays this much louder than the synthesized trick sounds, so it cuts through. */
const CLIP_BOOST = 2;

/**
 * Effect sounds on the speaker bus. Each plays public/sfx/<name>.wav if that file exists,
 * and synthesizes the sound otherwise.
 */
export class Sfx {
  private samples: Partial<Record<SoundName, AudioBuffer>> = {};
  /** Clips that play before a trick moves, such as public/sfx/squirrel.mp3. */
  private clips: Partial<Record<TrickName, AudioBuffer>> = {};
  private white: AudioBuffer;
  private brown: AudioBuffer;
  private bus: Record<SoundName, GainNode>;
  private tricks: TrickSounds;
  /** The operator's effects volume, shared by all the sounds. */
  private volume: GainNode;

  constructor(private ctx: BaseAudioContext, out: AudioNode) {
    this.volume = new GainNode(ctx);
    this.volume.connect(out);
    this.bus = {
      fire: new GainNode(ctx, { gain: LEVELS.fire }),
      steam: new GainNode(ctx, { gain: LEVELS.steam }),
      thunder: new GainNode(ctx, { gain: LEVELS.thunder }),
      trick: new GainNode(ctx, { gain: LEVELS.trick }),
    };
    for (const bus of Object.values(this.bus)) bus.connect(this.volume);
    this.white = whiteNoise(ctx, 3);
    this.brown = brownNoise(ctx, 8);
    this.tricks = new TrickSounds(ctx, this.bus.trick, this.white);
    for (const name of ['thunder', 'steam', 'fire'] as const) {
      loadSample(ctx, `/sfx/${name}.wav`).then((buf) => {
        if (buf) this.samples[name] = buf;
      });
    }
    for (const trick of TRICKS.filter((tr) => tr.clip)) {
      loadSample(ctx, `/sfx/${trick.name}.mp3`)
        .then((buf) => buf ?? loadSample(ctx, `/sfx/${trick.name}.wav`))
        .then((buf) => {
          if (buf) this.clips[trick.name] = buf;
        });
    }
  }

  setVolume(level: number) {
    this.volume.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05);
  }

  /**
   * The sound for a dog trick, timed to its poses. dir is the side the trick goes toward.
   * Returns how long a 'first' clip plays before the head should move, or 0.
   */
  trick(name: TrickName, dir: number): number {
    const clip = this.clips[name];
    if (!clip) {
      this.tricks.play(name, dir);
      return 0;
    }
    const src = new AudioBufferSourceNode(this.ctx, { buffer: clip });
    src.connect(new GainNode(this.ctx, { gain: CLIP_BOOST })).connect(this.bus.trick);
    src.start();
    return TRICKS.find((tr) => tr.name === name)?.clip === 'first' ? clip.duration : 0;
  }

  thunder() {
    if (this.playSample('thunder')) return;
    const t = this.ctx.currentTime;
    this.crack(t);
    this.rumble(t + 0.08);
  }

  /** A pressurized hiss from both vents, lasting as long as the visual burst. */
  steam(seconds: number) {
    if (this.playSample('steam')) return;
    const t = this.ctx.currentTime;
    for (const pan of [-0.8, 0.8]) {
      // Different start offsets keep the two vents from sounding like one mono source.
      const src = new AudioBufferSourceNode(this.ctx, { buffer: this.white, loop: true });
      const hp = new BiquadFilterNode(this.ctx, { type: 'highpass', frequency: 3000, Q: 0.5 });
      hp.frequency.setValueAtTime(3000, t);
      hp.frequency.linearRampToValueAtTime(1600, t + seconds + 0.6);
      const gain = new GainNode(this.ctx, { gain: 0 });
      gain.gain.setTargetAtTime(0.35, t, 0.015);
      gain.gain.setTargetAtTime(0, t + seconds, 0.2);
      src.connect(hp).connect(gain).connect(new StereoPannerNode(this.ctx, { pan })).connect(this.bus.steam);
      src.start(t, Math.random() * 2);
      src.stop(t + seconds + 1.5);
    }
  }

  /** A roaring whoosh as the flames leap, with a few crackles. */
  fire() {
    if (this.playSample('fire')) return;
    const t = this.ctx.currentTime;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.brown });
    const lp = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 250, Q: 0.8 });
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    lp.frequency.exponentialRampToValueAtTime(350, t + 1.6);
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.2, t + 0.12);
    // Decay on the same time scale as the visual flare, so the roar lasts as long as the flames.
    gain.gain.setTargetAtTime(0, t + 0.25, 0.5);
    src.connect(lp).connect(gain).connect(this.bus.fire);
    src.start(t, Math.random() * 4);
    src.stop(t + 3);

    for (let i = 0; i < 7; i++) this.crackle(t + 0.05 + Math.random() * 1.3);
  }

  private playSample(name: SoundName): boolean {
    const buffer = this.samples[name];
    if (!buffer) return false;
    const src = new AudioBufferSourceNode(this.ctx, { buffer });
    src.connect(this.bus[name]);
    src.start();
    return true;
  }

  private crackle(t: number) {
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.white });
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 2000 + Math.random() * 3000, Q: 1.5 });
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.3, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03 + Math.random() * 0.04);
    src.connect(band).connect(gain).connect(this.bus.fire);
    src.start(t, Math.random() * 2);
    src.stop(t + 0.1);
  }

  private crack(t: number) {
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.white });
    const band = new BiquadFilterNode(this.ctx, { type: 'bandpass', frequency: 1800, Q: 0.6 });
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.9, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(band).connect(gain).connect(this.bus.thunder);
    src.start(t);
    src.stop(t + 0.6);
  }

  private rumble(t: number) {
    const dur = 5 + Math.random() * 2;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.brown, playbackRate: 0.8 + Math.random() * 0.3 });
    const lp = new BiquadFilterNode(this.ctx, { type: 'lowpass', frequency: 900, Q: 0.7 });
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + dur * 0.6);
    const gain = new GainNode(this.ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1.6, t + 0.15);
    // A few rolling swells as the rumble decays.
    let at = t + 0.15;
    let level = 1.6;
    while (at < t + dur - 0.6) {
      const next = at + 0.35 + Math.random() * 0.6;
      level *= 0.72;
      gain.gain.linearRampToValueAtTime(level * (0.5 + Math.random() * 0.5), (at + next) / 2);
      gain.gain.linearRampToValueAtTime(level, next);
      at = next;
    }
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(lp).connect(gain).connect(this.bus.thunder);
    src.start(t);
    src.stop(t + dur + 0.1);
  }
}

/** A decoded sound file, or null when it is missing or not audio. */
function loadSample(ctx: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  return fetch(url)
    .then((r) => (r.ok && r.headers.get('content-type')?.startsWith('audio') ? r.arrayBuffer() : null))
    .then((data) => (data ? ctx.decodeAudioData(data) : null))
    .catch(() => null);
}

function whiteNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function brownNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.round(seconds * ctx.sampleRate), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}
