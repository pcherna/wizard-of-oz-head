import * as THREE from 'three';

/**
 * The flock flies between the organ backdrop (z -3) and the back of the head (about z -0.8 at
 * show size), so the monkeys always pass behind the head, never through it.
 */
const MONKEY_Z_NEAR = -1.3;
const MONKEY_Z_FAR = -2.6;
/** Seconds after launch that each monkey sets off. */
const DEPARTURES = [0, 0.3, 0.55, 0.9, 1.25];

interface Flyer {
  sprite: THREE.Sprite;
  /** Each monkey banks on its own, so each has its own pair of materials. */
  up: THREE.SpriteMaterial;
  down: THREE.SpriteMaterial;
  start: number;
  seconds: number;
  /** Quadratic bezier: from, swoop control, to. */
  path: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  flapHz: number;
  phase: number;
}

/**
 * Flying monkeys from the film: dark silhouettes with bat wings, a glowing green edge and yellow
 * eyes. launch() sends a flock swooping across the stage, toward the dir side.
 */
export class Monkeys {
  readonly group = new THREE.Group();
  private flyers: Flyer[];
  private p = new THREE.Vector3();
  private q = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    const up = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(drawMonkey(true)), transparent: true, depthWrite: false });
    const down = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(drawMonkey(false)), transparent: true, depthWrite: false });
    this.flyers = DEPARTURES.map(() => {
      const flyer = { up: up.clone(), down: down.clone(), start: Infinity, seconds: 1, flapHz: 4, phase: 0 };
      const sprite = new THREE.Sprite(flyer.up);
      sprite.visible = false;
      this.group.add(sprite);
      return { ...flyer, sprite, path: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
    });
  }

  launch(t: number, dir: number) {
    this.flyers.forEach((f, i) => {
      const z = MONKEY_Z_NEAR - Math.random() * (MONKEY_Z_NEAR - MONKEY_Z_FAR);
      // Start and end just off screen at this depth.
      const edge = this.halfWidth(z) + 0.8;
      const y0 = 1.2 + Math.random() * 0.8;
      f.path[0].set(-dir * edge, y0, z);
      f.path[1].set(-dir * edge * 0.2, -0.4 + Math.random() * 0.8, z);
      f.path[2].set(dir * edge, y0 + 0.2 + Math.random() * 0.6, z);
      f.start = t + DEPARTURES[i];
      f.seconds = 2.6 + Math.random() * 0.8;
      f.flapHz = 4 + Math.random() * 1.5;
      f.phase = Math.random() * 6;
      // Farther than the head, so drawn larger to keep a similar size on screen.
      f.sprite.scale.setScalar(0.75 + (z - MONKEY_Z_FAR) * 0.15);
    });
  }

  update(t: number) {
    for (const f of this.flyers) {
      const k = (t - f.start) / f.seconds;
      f.sprite.visible = k >= 0 && k <= 1;
      if (!f.sprite.visible) continue;
      bezier(f.path, k, this.p);
      bezier(f.path, Math.min(1, k + 0.01), this.q);
      const beat = Math.sin(f.phase + (t - f.start) * 2 * Math.PI * f.flapHz);
      f.sprite.material = beat > 0 ? f.down : f.up;
      // Each downstroke lifts a little.
      f.sprite.position.copy(this.p).setY(this.p.y + 0.04 * beat);
      // Bank into the climb or dive.
      const dx = this.q.x - this.p.x;
      const slope = Math.atan2(this.q.y - this.p.y, Math.abs(dx));
      f.sprite.material.rotation = Math.sign(dx) * Math.max(-0.4, Math.min(0.4, slope));
    }
  }

  /** Half the visible width at depth z. */
  private halfWidth(z: number): number {
    const c = this.camera;
    return (c.position.z - z) * Math.tan((c.fov * Math.PI) / 360) * c.aspect;
  }
}

function bezier([a, b, c]: [THREE.Vector3, THREE.Vector3, THREE.Vector3], k: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - k;
  return out.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(b, 2 * u * k).addScaledVector(c, k * k);
}

/** A flying monkey, seen from the front with its wings spread up or down. */
function drawMonkey(wingsUp: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const cx = 128;
  g.shadowColor = '#5dff7a';
  g.shadowBlur = 12;
  g.fillStyle = g.strokeStyle = '#081208';
  g.lineCap = g.lineJoin = 'round';

  // Bat wings from the shoulders, scalloped between the finger bones.
  for (const side of [-1, 1]) {
    const sx = cx + side * 10;
    const sy = 118;
    const at = (angle: number, r: number): [number, number] => [sx + side * Math.cos(angle) * r, sy + Math.sin(angle) * r];
    const a = wingsUp ? -0.6 : 0.45;
    g.beginPath();
    g.moveTo(sx, sy - 6);
    g.lineTo(...at(a - 0.1, 114));
    let prev: [number, number] = [a - 0.1, 114];
    for (const [angle, r] of [[a + 0.3, 100], [a + 0.65, 84], [a + 1.0, 62]]) {
      g.quadraticCurveTo(...at((prev[0] + angle) / 2, Math.min(prev[1], r) * 0.62), ...at(angle, r));
      prev = [angle, r];
    }
    g.quadraticCurveTo(...at(a + 1.3, 36), sx, sy + 26);
    g.closePath();
    g.fill();
  }

  // Body, head, ears, and a little cap with a tassel.
  g.beginPath();
  g.ellipse(cx, 140, 19, 31, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx, 97, 17, 0, Math.PI * 2);
  g.arc(cx - 17, 93, 7, 0, Math.PI * 2);
  g.arc(cx + 17, 93, 7, 0, Math.PI * 2);
  g.fill();
  g.fillRect(cx - 8, 74, 16, 9);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx + 6, 75);
  g.lineTo(cx + 15, 68);
  g.stroke();

  // Arms reaching down, legs, and a curled tail.
  g.lineWidth = 7;
  for (const [x0, y0, x1, y1] of [[cx - 13, 124, cx - 26, 152], [cx + 13, 124, cx + 26, 152], [cx - 8, 166, cx - 14, 194], [cx + 8, 166, cx + 14, 194]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(cx, 168);
  g.bezierCurveTo(cx + 22, 214, cx + 58, 196, cx + 46, 172);
  g.stroke();

  // Glowing yellow eyes, without the green halo.
  g.shadowColor = '#ffcc33';
  g.shadowBlur = 6;
  g.fillStyle = '#ffe14a';
  for (const x of [cx - 6, cx + 6]) {
    g.beginPath();
    g.arc(x, 96, 2.6, 0, Math.PI * 2);
    g.fill();
  }
  return canvas;
}
