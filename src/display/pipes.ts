import * as THREE from 'three';
import { VENT_Y, VENT_Z } from './steam';

/** Bottom of the pipes, below the frame at any aspect ratio. */
const FLOOR_Y = -2.4;
const RADIUS = 0.11;

/**
 * Dark silver steam pipes under the two vents, part of the organ backdrop. They are the only
 * lit (standard-material) objects, so their lights touch nothing else. The fire's flicker
 * lights them from below.
 */
export class SteamPipes {
  readonly group = new THREE.Group();
  private sides: THREE.Group[] = [];
  private fireLight = new THREE.PointLight(0xff7a2a, 0, 0, 2);
  private keyLight = new THREE.DirectionalLight(0xdde6f0, 0);
  private skyLight = new THREE.HemisphereLight(0x9fb0c0, 0x1a0c04, 0);
  private brightness = 0;

  constructor() {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a9199, metalness: 0.75, roughness: 0.4 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x4a4f56, metalness: 0.8, roughness: 0.5 });

    for (let s = 0; s < 2; s++) {
      const side = new THREE.Group();
      const height = VENT_Y - FLOOR_Y;

      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS, RADIUS, height, 32), metal);
      pipe.position.y = FLOOR_Y + height / 2;
      side.add(pipe);

      // A flanged nozzle at the vent, and two bands down the pipe.
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 1.55, RADIUS * 1.55, 0.05, 32), darkMetal);
      flange.position.y = VENT_Y - 0.06;
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 0.8, RADIUS * 1.1, 0.07, 32), darkMetal);
      nozzle.position.y = VENT_Y - 0.005;
      side.add(flange, nozzle);
      for (const y of [VENT_Y - 0.28, VENT_Y - 0.5]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS * 1.15, RADIUS * 1.15, 0.03, 32), darkMetal);
        band.position.y = y;
        side.add(band);
      }

      side.position.z = VENT_Z;
      this.sides.push(side);
      this.group.add(side);
    }

    this.fireLight.position.set(0, -1.9, 1.2);
    this.keyLight.position.set(-1.5, 3, 4);
    this.group.add(this.fireLight, this.keyLight, this.skyLight);
    this.group.visible = false;
  }

  /** Line the pipes up under the steam vents. */
  setVentX(x: number) {
    this.sides[0].position.x = -x;
    this.sides[1].position.x = x;
  }

  /** Follows the organ backdrop slider: 0 hides the pipes. */
  setBrightness(brightness: number) {
    this.brightness = brightness;
    this.group.visible = brightness > 0;
    this.keyLight.intensity = 1.2 * brightness;
    this.skyLight.intensity = 1.1 * brightness;
  }

  update(t: number, fire: number) {
    const flicker = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 6.7 + 2);
    this.fireLight.intensity = 6 * Math.min(fire, 2.5) * flicker * this.brightness;
  }
}
