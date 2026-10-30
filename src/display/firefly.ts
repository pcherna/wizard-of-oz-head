import * as THREE from 'three';

/** Glowing dots left behind the firefly, so its darting path shows. */
const TRAIL = 8;

/** Where the firefly is. */
export interface FireflyHost {
  /** How bright the firefly glows, 0 (gone) to 1. */
  readonly firefly: number;
  fireflyWorld(out: THREE.Vector3): THREE.Vector3;
}

/** A glowing yellow-green firefly with a short fading trail, for the firefly trick. */
export class Firefly {
  readonly group = new THREE.Group();
  private glow: THREE.Sprite;
  private trail: THREE.Sprite[] = [];
  private history: THREE.Vector3[] = [];
  private at = new THREE.Vector3();

  constructor() {
    const map = new THREE.CanvasTexture(drawGlow());
    const material = () => new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glow = new THREE.Sprite(material());
    this.group.add(this.glow);
    for (let i = 0; i < TRAIL; i++) {
      const dot = new THREE.Sprite(material());
      this.trail.push(dot);
      this.group.add(dot);
    }
    this.group.visible = false;
  }

  update(host: FireflyHost | null) {
    const bright = host?.firefly ?? 0;
    this.group.visible = bright > 0.001;
    if (!host || !this.group.visible) {
      this.history = [];
      return;
    }
    host.fireflyWorld(this.at);
    this.glow.position.copy(this.at);
    this.glow.scale.setScalar(0.12 + 0.12 * bright);
    this.glow.material.opacity = 0.4 + 0.6 * bright;
    this.history.unshift(this.at.clone());
    this.history.length = Math.min(this.history.length, TRAIL);
    this.trail.forEach((dot, i) => {
      const p = this.history[i];
      dot.visible = !!p;
      if (!p) return;
      const k = 1 - i / TRAIL;
      dot.position.copy(p);
      dot.scale.setScalar(0.06 * k);
      dot.material.opacity = 0.35 * k * bright;
    });
  }
}

/** A soft round glow, white-hot in the middle and yellow-green at the edge. */
function drawGlow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const fill = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, 'rgba(255, 255, 220, 1)');
  fill.addColorStop(0.2, 'rgba(220, 255, 90, 0.9)');
  fill.addColorStop(0.5, 'rgba(150, 230, 40, 0.3)');
  fill.addColorStop(1, 'rgba(120, 200, 30, 0)');
  g.fillStyle = fill;
  g.fillRect(0, 0, 64, 64);
  return canvas;
}
