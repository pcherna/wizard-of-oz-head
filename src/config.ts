// Constants and defaults. Live-tunable values live in Settings (see settings.ts).
// Keep this file free of browser APIs: the Node server imports it too.

export const PORT = 8787;

export type EffectName = 'fire' | 'steam' | 'lightning';
export type HeadVariant = 'scan' | 'procedural';

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
  inputId: string;
  outputId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 1,
  fireBase: 1,
  pitch: 0.72,
  reverbWet: 0.45,
  gate: 0.008,
  sensitivity: 0.08,
  headScale: 1,
  headY: 0,
  headVariant: 'scan',
  inputId: '',
  outputId: '',
};

/** Settings the phone remote may change. Device ids stay on the display Mac. */
export const REMOTE_SETTING_KEYS = ['volume', 'fireBase'] as const;

export const VOICE = {
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
