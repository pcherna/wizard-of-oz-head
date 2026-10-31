import { DEFAULT_SETTINGS, type Settings } from '../config';
import type { SettingsStore } from '../settings';

type Corners = Settings['keystone'];
const SQUARE = DEFAULT_SETTINGS.keystone;
/** Corners pulled in to a quarter of the way from each edge, so all four show on a screen that crops its edges. */
const INSET: Corners = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]];

/**
 * Fits the picture to the wall. Flip turns the whole page 180°, for a projector mounted upside down.
 * Keystone warps the picture so each corner lands where it was dragged, for a projector off-angle.
 * Both save with the other settings.
 */
export class Projection {
  private handles: HTMLElement[];

  /** `picture` holds everything to warp. `ui` holds the four corner handles and their help line. */
  constructor(private picture: HTMLElement, private ui: HTMLElement, private store: SettingsStore) {
    this.handles = [...ui.querySelectorAll<HTMLElement>('.corner')];
    this.handles.forEach((handle, i) => this.makeDraggable(handle, i));
    store.subscribe((changed) => {
      if (changed.flipped !== undefined || changed.keystone !== undefined) this.apply();
    });
    addEventListener('resize', () => this.apply());
    this.apply();
  }

  get handlesVisible() {
    return !this.ui.hidden;
  }

  toggleHandles() {
    this.ui.hidden = !this.ui.hidden;
  }

  toggleFlipped() {
    this.store.update({ flipped: !this.store.value.flipped });
  }

  resetKeystone() {
    this.store.update({ keystone: SQUARE });
  }

  insetKeystone() {
    this.store.update({ keystone: INSET });
  }

  /** The saved corners, or square if the saved value is damaged. */
  private get corners(): Corners {
    const saved = this.store.value.keystone;
    const valid = Array.isArray(saved) && saved.length === 4
      && saved.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
    return valid ? saved : SQUARE;
  }

  private apply() {
    document.documentElement.classList.toggle('flipped', this.store.value.flipped === true);
    const w = innerWidth;
    const h = innerHeight;
    const corners = this.corners;
    const isSquare = corners.every(([x, y], i) => x === SQUARE[i][0] && y === SQUARE[i][1]);
    // Square means no transform at all, so the picture stays pixel-exact.
    const transform = isSquare ? '' : keystoneMatrix(corners.map(([x, y]) => [x * w, y * h]), w, h);
    if (transform !== null) this.picture.style.transform = transform; // null: corners in a line, keep the last shape
    corners.forEach(([x, y], i) => {
      this.handles[i].style.left = `${x * w}px`;
      this.handles[i].style.top = `${y * h}px`;
    });
  }

  /** The pointer in page coordinates. On a flipped page these run the other way from the screen's. */
  private pagePoint(e: PointerEvent): [number, number] {
    return this.store.value.flipped ? [innerWidth - e.clientX, innerHeight - e.clientY] : [e.clientX, e.clientY];
  }

  private makeDraggable(handle: HTMLElement, i: number) {
    let grab: [number, number] | null = null; // pointer offset from the corner, so the corner doesn't jump to the pointer
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      const [x, y] = this.pagePoint(e);
      const [cx, cy] = this.corners[i];
      grab = [x - cx * innerWidth, y - cy * innerHeight];
    });
    handle.addEventListener('pointermove', (e) => {
      if (!grab) return;
      const [x, y] = this.pagePoint(e);
      const moved: [number, number] = [clamp01((x - grab[0]) / innerWidth), clamp01((y - grab[1]) / innerHeight)];
      this.store.update({ keystone: this.corners.map((p, j) => (j === i ? moved : p)) });
    });
    handle.addEventListener('lostpointercapture', () => (grab = null));
  }
}

/**
 * The perspective transform that maps the w×h window onto four points, as CSS matrix3d.
 * Heckbert's square-to-quad mapping, scaled from the unit square to window pixels.
 */
function keystoneMatrix([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Corners, w: number, h: number): string | null {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const k = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1]; // column-major
  return m.every(Number.isFinite) ? `matrix3d(${m.join(',')})` : null;
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
