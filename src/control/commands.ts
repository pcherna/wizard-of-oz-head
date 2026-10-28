import type { EffectName, Settings } from '../config';

/** Messages relayed between the display and remotes over /ws. */
export type Message =
  | { type: 'effect'; effect: EffectName }
  | { type: 'settings'; settings: Partial<Settings> }
  /** A remote asks the display to broadcast its current settings. */
  | { type: 'hello' };

export function parseMessage(text: string): Message | null {
  try {
    const msg = JSON.parse(text) as Message;
    return typeof msg?.type === 'string' ? msg : null;
  } catch {
    return null;
  }
}
