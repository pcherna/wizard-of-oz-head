import type { EffectName, Settings } from '../config';

/** Messages relayed between the display and remotes over /ws. */
export type Message =
  | { type: 'effect'; effect: EffectName }
  | { type: 'settings'; settings: Partial<Settings> }
  /** A remote asks the display to broadcast its current settings. */
  | { type: 'hello' }
  /** Asks the display to broadcast all of its settings, for copying them into the defaults. */
  | { type: 'dump' }
  /** Mic mute state. The display broadcasts it, and a remote sends it to change it. */
  | { type: 'mic'; muted: boolean };

export function parseMessage(text: string): Message | null {
  try {
    const msg = JSON.parse(text) as Message;
    return typeof msg?.type === 'string' ? msg : null;
  } catch {
    return null;
  }
}
