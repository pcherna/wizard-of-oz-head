import { SAMPLE_RATE } from './voice';

/** The cue output is off unless the operator picks a device. */
export const CUE_OFF = 'off';

/**
 * Short mute/unmute tones for the performer's ears only, such as the AirPods. They play through
 * a second audio context routed to its own device, so the room speakers never hear them.
 */
export class CueTones {
  private ctx: AudioContext | null = null;
  private deviceId = CUE_OFF;

  /** Pick the device, or CUE_OFF. Call from a click or key press the first time, so audio may start. */
  async setOutput(deviceId: string) {
    this.deviceId = deviceId;
    if (deviceId === CUE_OFF) {
      await this.ctx?.close();
      this.ctx = null;
      return;
    }
    // Same fixed rate as the voice context, for the same reason: see SAMPLE_RATE.
    this.ctx ??= new AudioContext({ latencyHint: 'interactive', sampleRate: SAMPLE_RATE });
    const ctx = this.ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    await ctx.setSinkId?.(deviceId);
  }

  /** Rising two notes for live, falling for muted. */
  play(muted: boolean) {
    const ctx = this.ctx;
    if (!ctx || this.deviceId === CUE_OFF) return;
    if (ctx.state !== 'running') ctx.resume();
    const t = ctx.currentTime + 0.02;
    const [first, second] = muted ? [880, 440] : [660, 990];
    this.blip(ctx, first, t);
    this.blip(ctx, second, t + 0.1);
  }

  private blip(ctx: AudioContext, hz: number, at: number) {
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: hz });
    const gain = new GainNode(ctx, { gain: 0 });
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.25, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.1);
  }
}
