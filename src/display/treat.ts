import * as THREE from 'three';

/** Width of the biscuit in world units at full size. */
const WIDTH = 0.3;

/** Where the biscuit is. */
export interface TreatHost {
  /** Size of the biscuit, 0 (none) to 1. */
  readonly treat: number;
  /** Radians the biscuit has spun in the air. */
  readonly treatSpin: number;
  treatWorld(out: THREE.Vector3): THREE.Vector3;
}

/** A bone-shaped dog biscuit, for the treat trick. */
export class Treat {
  readonly sprite: THREE.Sprite;

  constructor() {
    // Drawn over the head, so it sits on the nose instead of sinking into it. Dimmed below the
    // bloom threshold, so it reads as a biscuit, not a light.
    const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(drawBiscuit()), color: 0x909090, transparent: true, depthTest: false, depthWrite: false });
    this.sprite = new THREE.Sprite(material);
    this.sprite.renderOrder = 10;
    this.sprite.visible = false;
  }

  update(host: TreatHost | null) {
    const size = host?.treat ?? 0;
    this.sprite.visible = size > 0.001;
    if (!host || !this.sprite.visible) return;
    host.treatWorld(this.sprite.position);
    this.sprite.scale.set(WIDTH * size, (WIDTH / 2) * size, 1);
    this.sprite.material.rotation = host.treatSpin;
  }
}

/** A golden-brown bone with a dark edge and three docking holes, twice as wide as it is tall. */
function drawBiscuit(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const g = canvas.getContext('2d')!;
  const bone = (grow: number) => {
    g.beginPath();
    for (const [x, y] of [[22, 20], [22, 44], [106, 20], [106, 44]]) {
      g.moveTo(x + 13 + grow, y);
      g.arc(x, y, 13 + grow, 0, 2 * Math.PI);
    }
    g.rect(22, 20 - grow, 84, 24 + 2 * grow);
    g.fill();
  };
  g.fillStyle = '#5a3010';
  bone(3);
  const fill = g.createLinearGradient(0, 6, 0, 58);
  fill.addColorStop(0, '#f0c27a');
  fill.addColorStop(0.5, '#d29448');
  fill.addColorStop(1, '#94561f');
  g.fillStyle = fill;
  bone(0);
  g.fillStyle = '#7a4418';
  for (const x of [50, 64, 78]) {
    g.beginPath();
    g.arc(x, 32, 2.5, 0, 2 * Math.PI);
    g.fill();
  }
  return canvas;
}
