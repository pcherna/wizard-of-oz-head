import workletUrl from './pitch-worklet.ts?worker&url';
import { VOICE, type Settings } from '../config';

/**
 * Fixed context rate. Left unset, Chrome copies the default output's rate. With AirPods as the
 * macOS output, their headset mode makes that 24 kHz, and a switch to 48 kHz speakers then goes silent.
 */
export const SAMPLE_RATE = 48000;

/**
 * Mic → gate + pitch shift → bass boost → dry + reverb → compressor → master → limiter → speakers.
 * `analyser` taps the dry pitched signal, so the reverb tail never moves the mouth.
 * Other sounds (thunder) connect to `fxBus`, which skips the voice compressor.
 */
export class Voice {
  readonly analyser: AnalyserNode;
  readonly fxBus: GainNode;
  private shifter: AudioWorkletNode;
  /** Mutes the mic ahead of everything, so the mouth closes and the reverb tail dies out naturally. */
  private input: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private master: GainNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  private constructor(readonly ctx: AudioContext) {
    this.shifter = new AudioWorkletNode(ctx, 'pitch-shifter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    this.analyser = new AnalyserNode(ctx, { fftSize: 1024, smoothingTimeConstant: 0 });
    const shelf = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: VOICE.bassBoostHz, gain: VOICE.bassBoostDb });
    const reverb = new ConvolverNode(ctx, { buffer: makeImpulse(ctx, VOICE.reverbSeconds) });
    this.dry = new GainNode(ctx);
    this.wet = new GainNode(ctx);
    const comp = new DynamicsCompressorNode(ctx, { threshold: -18, knee: 12, ratio: 4, attack: 0.005, release: 0.25 });
    this.master = new GainNode(ctx);
    this.fxBus = new GainNode(ctx);
    this.input = new GainNode(ctx);

    this.input.connect(this.shifter);
    this.shifter.connect(this.analyser);
    this.shifter.connect(shelf);
    shelf.connect(this.dry).connect(comp);
    shelf.connect(reverb).connect(this.wet).connect(comp);
    comp.connect(this.master);
    this.fxBus.connect(this.master);
    // Volume can exceed 1, so a brick-wall limiter keeps peaks out of the speakers' clip zone.
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -2, knee: 0, ratio: 20, attack: 0.001, release: 0.1 });
    this.master.connect(limiter).connect(ctx.destination);
  }

  /** With `mic: false` (demo mode) the graph runs for thunder but nothing feeds the voice. */
  static async create(settings: Settings, mic = true): Promise<Voice> {
    const ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: SAMPLE_RATE });
    let voice: Voice | null = null;
    try {
      await ctx.audioWorklet.addModule(workletUrl);
      voice = new Voice(ctx);
      voice.apply(settings);
      await voice.setOutput(settings.outputId);
      if (mic) await voice.setInput(settings.inputId);
      await voice.resume();
      return voice;
    } catch (err) {
      // Release the mic and the context, so the next attempt starts clean.
      if (voice) voice.close();
      else ctx.close();
      throw err;
    }
  }

  /** Mutes at once. Unmutes after VOICE.unmuteHoldSec, once audio from the muted stretch has drained. */
  setMuted(muted: boolean) {
    const t = this.ctx.currentTime;
    const gain = this.input.gain;
    gain.cancelScheduledValues(t);
    if (muted) {
      gain.setTargetAtTime(0, t, 0.015);
    } else {
      gain.setValueAtTime(0, t);
      gain.setTargetAtTime(1, t + VOICE.unmuteHoldSec, 0.015);
    }
  }

  close() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.ctx.close();
  }

  /** Without a user gesture (or Chrome's autoplay flag) resume() never settles, so cap the wait. */
  async resume(): Promise<boolean> {
    if (this.ctx.state !== 'running') {
      await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 500))]);
    }
    return this.ctx.state === 'running';
  }

  apply(s: Partial<Settings>) {
    const t = this.ctx.currentTime;
    if (s.pitch !== undefined) this.shifter.parameters.get('pitch')!.setTargetAtTime(s.pitch, t, 0.05);
    if (s.gate !== undefined) this.shifter.parameters.get('gate')!.setValueAtTime(s.gate, t);
    if (s.reverbWet !== undefined) {
      this.wet.gain.setTargetAtTime(s.reverbWet, t, 0.05);
      this.dry.gain.setTargetAtTime(1 - s.reverbWet * 0.5, t, 0.05);
    }
    if (s.volume !== undefined) this.master.gain.setTargetAtTime(s.volume, t, 0.05);
  }

  /** A one-second beep through the full output chain, to check the speakers. */
  testTone() {
    const t = this.ctx.currentTime;
    const osc = new OscillatorNode(this.ctx, { frequency: 440 });
    const env = new GainNode(this.ctx, { gain: 0 });
    env.gain.setTargetAtTime(0.3, t, 0.01);
    env.gain.setTargetAtTime(0, t + 0.8, 0.05);
    osc.connect(env).connect(this.fxBus);
    osc.start(t);
    osc.stop(t + 1.2);
  }

  async setInput(deviceId: string) {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    // Browser voice processing smears the voice and fights the pitch shifter.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.source.connect(this.input);
  }

  /** Route output to a chosen device, so AirPods input does not drag output onto the AirPods. */
  async setOutput(deviceId: string) {
    const ctx = this.ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (ctx.setSinkId) await ctx.setSinkId(deviceId);
  }

  get inputLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label ?? '';
  }
}

/** Stereo decaying noise: a big dark hall. */
function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.round(seconds * ctx.sampleRate);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // One-pole lowpass that darkens as the tail decays.
      const white = Math.random() * 2 - 1;
      lp += (white - lp) * (0.6 - 0.45 * t);
      data[i] = lp * Math.pow(1 - t, 3.5);
    }
  }
  return buffer;
}

export async function listAudioDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: devices.filter((d) => d.kind === 'audioinput'),
    outputs: devices.filter((d) => d.kind === 'audiooutput'),
  };
}
