import * as THREE from 'three';

const MAX_ZS = 6;
/** Seconds between "Z"s, and how long each floats. */
const EVERY_SEC = 0.65;
const FLOAT_SEC = 2.2;

/** Where the "Z"s rise from. */
export interface Sleeper {
  /** Floats "Z"s while above 0.5. */
  readonly zzz: number;
  crownWorld(out: THREE.Vector3): THREE.Vector3;
}

/** "Z"s that float up from a sleeping head, growing, drifting and fading. */
export class Snooze {
  readonly group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private age: number[] = [];
  private next = 0;
  private wait = 0;
  private from = new THREE.Vector3();

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d')!;
    g.font = 'bold 104px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#7dff8a';
    g.shadowBlur = 14;
    g.fillStyle = '#d8ffe0';
    g.fillText('Z', 64, 68);
    const map = new THREE.CanvasTexture(canvas);
    for (let i = 0; i < MAX_ZS; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.visible = false;
      this.sprites.push(sprite);
      this.age.push(Infinity);
      this.group.add(sprite);
    }
  }

  update(dt: number, sleeper: Sleeper | null) {
    this.wait -= dt;
    if (sleeper && sleeper.zzz > 0.5 && this.wait <= 0) {
      this.wait = EVERY_SEC;
      const i = this.next;
      this.next = (this.next + 1) % MAX_ZS;
      this.age[i] = 0;
      sleeper.crownWorld(this.from);
      this.sprites[i].position.set(this.from.x + 0.25, this.from.y + 0.05, this.from.z + 0.2);
    }
    for (let i = 0; i < MAX_ZS; i++) {
      const s = this.sprites[i];
      this.age[i] += dt;
      const k = this.age[i] / FLOAT_SEC;
      s.visible = k < 1;
      if (!s.visible) continue;
      // Rise and drift off to one side, swaying, growing and fading.
      s.position.y += dt * 0.35;
      s.position.x += dt * 0.15 + Math.cos(this.age[i] * 3) * dt * 0.12;
      s.scale.setScalar(0.12 + 0.2 * k);
      s.material.opacity = Math.min(1, k * 6) * (1 - k);
      s.material.rotation = 0.25 * Math.sin(this.age[i] * 2);
    }
  }
}
