/** Flash brightness over time: a bright strike, a dip, a restrike, then a fade. */
const FLICKER: [number, number][] = [
  [0, 1],
  [0.05, 0.15],
  [0.1, 0.85],
  [0.18, 0.05],
  [0.3, 0.6],
  [0.38, 0.2],
  [0.7, 0],
];

/** Full-screen white flicker plus thunder. `level` also lights the head. */
export class Lightning {
  level = 0;
  /** The overall brightness setting. The flash is an HTML overlay, outside the dimming pass. */
  brightness = 1;
  private startedAt = -Infinity;

  constructor(private overlay: HTMLElement, private onStrike: () => void) {}

  strike(t: number) {
    this.startedAt = t;
    this.onStrike();
  }

  update(t: number) {
    this.level = sample(t - this.startedAt);
    this.overlay.style.opacity = String(this.level * 0.85 * this.brightness);
  }
}

function sample(dt: number): number {
  if (dt < 0 || dt >= FLICKER[FLICKER.length - 1][0]) return 0;
  for (let i = 1; i < FLICKER.length; i++) {
    const [t1, v1] = FLICKER[i];
    if (dt < t1) {
      const [t0, v0] = FLICKER[i - 1];
      return v0 + ((v1 - v0) * (dt - t0)) / (t1 - t0);
    }
  }
  return 0;
}
