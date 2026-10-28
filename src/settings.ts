import { DEFAULT_SETTINGS, type Settings } from './config';

const STORAGE_KEY = 'wizard-settings';

/** Live settings for the display, persisted to localStorage. */
export class SettingsStore {
  readonly value: Settings;
  private listeners: ((changed: Partial<Settings>) => void)[] = [];

  constructor() {
    this.value = { ...DEFAULT_SETTINGS, ...load() };
  }

  update(changed: Partial<Settings>) {
    Object.assign(this.value, changed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // Storage can be unavailable; settings still apply for this session.
    }
    for (const fn of this.listeners) fn(changed);
  }

  subscribe(fn: (changed: Partial<Settings>) => void) {
    this.listeners.push(fn);
  }
}

function load(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
  } catch {
    return {};
  }
}
