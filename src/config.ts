// Constants and defaults. Live-tunable values live in Settings (see settings.ts).
// Keep this file free of browser APIs: the Node server imports it too.

export const PORT = 8787;

export type EffectName = 'fire' | 'steam' | 'lightning';
export type HeadVariant = 'oz' | 'scan' | 'procedural' | 'labrador';

/** Presentation clickers send these keys. The setup panel shows the last key pressed. */
export const KEY_MAP: Record<string, EffectName> = {
  PageDown: 'fire',
  ArrowRight: 'fire',
  PageUp: 'steam',
  ArrowLeft: 'steam',
  b: 'lightning',
  '.': 'lightning',
  '1': 'fire',
  '2': 'steam',
  '3': 'lightning',
};

/** Keys that mute or unmute the mic. A clicker's "start show" button sends F5 and Esc in turn. */
export const MIC_TOGGLE_KEYS = ['F5', 'Escape'];

export interface Settings {
  /** Master output gain, 0..2. */
  volume: number;
  /** Resting fire height/brightness, 0..2. */
  fireBase: number;
  /** Voice pitch ratio, 0.5..1. Lower is deeper. */
  pitch: number;
  /** Reverb wet level, 0..1. */
  reverbWet: number;
  /** Noise gate threshold (input RMS), 0..0.05. */
  gate: number;
  /** Processed-voice RMS that opens the jaw fully, 0.02..0.3. */
  sensitivity: number;
  headScale: number;
  headY: number;
  headVariant: HeadVariant;
  /** Specular highlight strength, 0 (matte) .. 1. */
  headShine: number;
  /** Green edge glow strength, 0 (none) .. 1.5. */
  headRim: number;
  /** Brightness of the film's pipe-organ backdrop, 0 (off, pure black) .. 1.5. */
  backdrop: number;
  /** Dims the whole picture for a projector that is too bright, 0.1 .. 1. */
  brightness: number;
  /** Oz sculpt strengths, in mesh units. See oz-sculpt.ts. */
  ozDome: number;
  /** Height on the face where the dome widening begins (chin ≈ -0.6, lips ≈ 0.45, eyes ≈ 1.8). */
  ozDomeStart: number;
  ozCrown: number;
  ozForehead: number;
  ozBrow: number;
  ozEyes: number;
  ozNose: number;
  ozFolds: number;
  ozTaper: number;
  ozChin: number;
  /** Scale of the eyes-nose-mouth region (1 = unchanged). */
  ozFeatures: number;
  /** Vertical shift of the eyes-nose-mouth region. */
  ozFeatureY: number;
  inputId: string;
  outputId: string;
  /** Where mute/unmute cue tones play, such as the performer's AirPods. 'off' plays none. */
  cueOutputId: string;
}

/** Starting strengths for the Oz sculpt, tuned by eye on Oct 27. The setup panel's reset button restores these. */
export const OZ_SCULPT_DEFAULTS = {
  ozDome: 0.59,
  ozDomeStart: 0.21,
  ozCrown: 0.95,
  ozForehead: 0.16,
  ozBrow: 0.26,
  ozEyes: 0.03,
  ozNose: 0.05,
  ozFolds: 0.1,
  ozTaper: 0,
  ozChin: 0,
  ozFeatures: 0.76,
  ozFeatureY: -0.22,
} satisfies Partial<Settings>;

export const DEFAULT_SETTINGS: Settings = {
  volume: 1.3,
  fireBase: 0.35,
  pitch: 0.87,
  reverbWet: 0.48,
  gate: 0.008,
  sensitivity: 0.08,
  headScale: 1.42,
  headY: -0.22,
  headVariant: 'oz',
  headShine: 0.38,
  headRim: 0.61,
  backdrop: 0,
  brightness: 1,
  ...OZ_SCULPT_DEFAULTS,
  // Chrome assigns device ids per browser profile, so these stay on the system default.
  inputId: '',
  outputId: '',
  cueOutputId: 'off',
};

/** Settings the phone remote may change. Device ids stay on the display Mac. */
export const REMOTE_SETTING_KEYS = ['volume', 'fireBase', 'brightness'] as const;

export const VOICE = {
  /**
   * After unmuting, keep the mic shut this long. Audio spoken while muted is still in transit
   * (Bluetooth, macOS and Chrome buffers, about 150–250 ms with AirPods) and would leak out.
   */
  unmuteHoldSec: 0.35,
  reverbSeconds: 3.2,
  bassBoostDb: 6,
  bassBoostHz: 220,
};

export const LIPSYNC = {
  attackSec: 0.03,
  releaseSec: 0.08,
  /** Shout = envelope above sensitivity × this factor. */
  shoutFactor: 1.8,
  autoFlareDebounceMs: 2000,
};
