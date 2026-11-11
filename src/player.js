import * as THREE from "three";
import { clamp, damp, lerp } from "./utils.js";
import { flatMaterial } from "./materials.js";

export const OUTFIT = {
  skin: ["#f0c39a", "#c68d5e", "#9c6644", "#7a4a2b"],
  hair: ["#2f3b36", "#5a3825", "#d8795f", "#d6a348", "#69c5c2"],
  top: ["#fff8e9", "#d8795f", "#69c5c2", "#f6c945", "#75a064"],
  bottom: ["#2f3b36", "#4e5d55", "#75a064", "#d6a348", "#d8795f"],
  shoes: ["#2f3b36", "#f2ecdd", "#d8795f", "#f6c945"],
};

const DEFAULT_OUTFIT = { skin: 0, hair: 0, top: 1, bottom: 0, shoes: 0 };

function makePart(geometry, material, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = options;
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.scale.set(sx, sy, sz);
  return mesh;
}

export function buildCharacter() {
  const materials = {
    skin: flatMaterial("#f0c39a"),
    hair: flatMaterial("#2f3b36"),
    top: flatMaterial("#d8795f"),
    bottom: flatMaterial("#2f3b36"),
    shoes: flatMaterial("#2f3b36"),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const legPivots = [];
  const armPivots = [];
  for (const side of [-1, 1]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(side * 0.085, 0.42, 0);
    legPivot.add(
      makePart(new THREE.BoxGeometry(0.125, 0.4, 0.14), materials.bottom, { y: -0.2 }),
      makePart(new THREE.BoxGeometry(0.14, 0.09, 0.23), materials.shoes, { y: -0.37, z: 0.035 }),
    );
    body.add(legPivot);
    legPivots.push(legPivot);

    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.215, 0.72, 0);
    armPivot.add(
      makePart(new THREE.BoxGeometry(0.095, 0.3, 0.11), materials.top, { y: -0.15 }),
      makePart(new THREE.BoxGeometry(0.085, 0.09, 0.1), materials.skin, { y: -0.32 }),
    );
    body.add(armPivot);
    armPivots.push(armPivot);
  }

  body.add(makePart(new THREE.BoxGeometry(0.34, 0.36, 0.21), materials.top, { y: 0.6 }));
  body.add(makePart(new THREE.BoxGeometry(0.37, 0.08, 0.23), materials.bottom, { y: 0.44 }));

  const head = new THREE.Group();
  head.position.set(0, 0.96, 0);
  head.add(
    makePart(new THREE.SphereGeometry(0.155, 14, 10), materials.skin),
    makePart(new THREE.SphereGeometry(0.165, 14, 10), materials.hair, { y: 0.045, z: -0.025, sy: 0.72 }),
    makePart(new THREE.BoxGeometry(0.032, 0.05, 0.02), flatMaterial("#2f3b36"), { x: -0.055, y: 0.01, z: 0.135 }),
    makePart(new THREE.BoxGeometry(0.032, 0.05, 0.02), flatMaterial("#2f3b36"), { x: 0.055, y: 0.01, z: 0.135 }),
  );
  body.add(head);

  group.userData.materials = materials;
  group.userData.legPivots = legPivots;
  group.userData.armPivots = armPivots;
  group.userData.body = body;

  return group;
}

export function applyOutfit(group, outfit = DEFAULT_OUTFIT) {
  const materials = group.userData.materials;
  for (const key of ["skin", "hair", "top", "bottom", "shoes"]) {
    const index = clamp(outfit[key] ?? DEFAULT_OUTFIT[key], 0, OUTFIT[key].length - 1);
    materials[key].color.set(OUTFIT[key][index]);
  }
  return group;
}

const UP = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const FORWARD = new THREE.Vector3();
const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const MATRIX = new THREE.Matrix4();
const QUAT = new THREE.Quaternion();
const EULER = new THREE.Euler();

export class PlayerController {
  constructor({ planet, spawnDir, outfit = DEFAULT_OUTFIT }) {
    this.planet = planet;
    this.group = buildCharacter();
    applyOutfit(this.group, outfit);
    this.dir = spawnDir.clone().normalize();
    this.heading = new THREE.Vector3(1, 0, 0);
    this.alt = 0;
    this.vy = 0;
    this.speed = 0;
    this.phase = 0;
    this.grounded = true;
    this.item = null;
    this.moveTarget = null;

    const itemGeometry = new THREE.BoxGeometry(0.26, 0.18, 0.16);
    const itemMaterial = flatMaterial("#f6c945");
    this.itemMesh = new THREE.Mesh(itemGeometry, itemMaterial);
    this.itemMesh.position.set(0, 1.42, 0);
    this.itemMesh.visible = false;
    this.group.add(this.itemMesh);

    this.syncTransform();
  }

  setItem(active) {
    this.item = active;
    this.itemMesh.visible = Boolean(active);
  }

  faceTo(dir) {
    const up = this.dir;
    FORWARD.copy(dir).sub(up.clone().multiplyScalar(dir.dot(up)));
    if (FORWARD.lengthSq() > 1e-6) {
      FORWARD.normalize();
      this.heading.copy(FORWARD);
      this.syncTransform();
    }
  }

  syncTransform() {
    UP.copy(this.dir).normalize();
    FORWARD.copy(this.heading).sub(UP.clone().multiplyScalar(this.heading.dot(UP)));
    if (FORWARD.lengthSq() < 1e-6) FORWARD.set(1, 0, 0);
    FORWARD.normalize();
    RIGHT.crossVectors(UP, FORWARD).normalize();
    FORWARD.crossVectors(RIGHT, UP).normalize();
    MATRIX.makeBasis(RIGHT, UP, FORWARD);
    QUAT.setFromRotationMatrix(MATRIX);
    const radius = this.planet.surfaceRadius(UP);
    this.group.position.copy(UP).multiplyScalar(radius + this.alt);
    this.group.quaternion.copy(QUAT);
  }

  surfaceRadius() {
    return this.planet.surfaceRadius(this.dir);
  }

  update(dt, { move = new THREE.Vector2(), sprint = false, jump = false } = {}) {
    const planet = this.planet;
    UP.copy(this.dir).normalize();

    if (this.moveTarget) {
      TMP2.copy(this.moveTarget).normalize();
      if (angleDistance(UP, TMP2) < 0.03) {
        this.moveTarget = null;
      } else {
        TMP.copy(TMP2).sub(UP.clone().multiplyScalar(TMP2.dot(UP)));
        if (TMP.lengthSq() > 1e-6) {
          TMP.normalize();
          RIGHT.crossVectors(UP, this.heading).normalize();
          FORWARD.crossVectors(RIGHT, UP).normalize();
          move.set(TMP.dot(RIGHT), TMP.dot(FORWARD));
        }
      }
    }

    const moveLen = clamp(move.length(), 0, 1);
    if (moveLen > 0.001) {
      RIGHT.crossVectors(UP, this.heading).normalize();
      FORWARD.crossVectors(RIGHT, UP).normalize();
      TMP.copy(FORWARD).multiplyScalar(move.y).addScaledVector(RIGHT, move.x);
      if (TMP.lengthSq() > 1e-6) {
        TMP.normalize();
        const turnRate = this.grounded ? 10 : 4.5;
        const t = 1 - Math.exp(-turnRate * dt);
        this.heading.lerp(TMP, t);
        if (this.heading.lengthSq() > 1e-6) this.heading.normalize();
      }
    }

    const targetSpeed = moveLen * (sprint ? 4.6 : 2.7);
    this.speed = damp(this.speed, targetSpeed, this.grounded ? 12 : 5, dt);

    const distance = this.speed * dt;
    if (distance > 0) {
      const next = TMP2.copy(this.dir).addScaledVector(this.heading, distance / planet.surfaceRadius(this.dir)).normalize();
      this.dir.copy(next);
      UP.copy(this.dir).normalize();
    }

    if (jump && this.grounded) {
      this.vy = 4.4;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 10.5 * dt;
      this.alt += this.vy * dt;
      if (this.alt <= 0) {
        this.alt = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    this.phase += this.speed * dt * 2.6;
    this.animate(dt);
    this.syncTransform();
  }

  animate(dt) {
    const { legPivots, armPivots, body } = this.group.userData;
    const grounded = this.grounded;
    const speedNorm = clamp(this.speed / 4.6, 0, 1);
    const amp = grounded ? lerp(0.12, 0.62, clamp(this.speed / 2.7, 0, 1)) : 0;

    if (grounded) {
      const s = Math.sin(this.phase * Math.PI);
      legPivots[0].rotation.x = s * amp;
      legPivots[1].rotation.x = -s * amp;
      armPivots[0].rotation.x = -s * amp * 0.72;
      armPivots[1].rotation.x = s * amp * 0.72;
      body.position.y = Math.abs(Math.cos(this.phase * Math.PI)) * 0.028 * speedNorm * 2;
    } else {
      legPivots[0].rotation.x = damp(legPivots[0].rotation.x, -0.5, 12, dt);
      legPivots[1].rotation.x = damp(legPivots[1].rotation.x, 0.25, 12, dt);
      armPivots[0].rotation.x = damp(armPivots[0].rotation.x, -0.9, 12, dt);
      armPivots[1].rotation.x = damp(armPivots[1].rotation.x, -0.9, 12, dt);
      body.position.y = 0;
    }

    this.itemMesh.rotation.y += dt * 1.6;
  }
}

function angleDistance(a, b) {
  return Math.acos(clamp(a.dot(b), -1, 1));
}

const CAM_TMP = new THREE.Vector3();
const CAM_TMP2 = new THREE.Vector3();
const CAM_UP = new THREE.Vector3();
const CAM_RIGHT = new THREE.Vector3();
const CAM_FWD = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export class OrbitCamera {
  constructor(camera, planet) {
    this.camera = camera;
    this.planet = planet;
    this.terrain = planet.terrain;
    this.raycaster = new THREE.Raycaster();
    this.yaw = 0;
    this.pitch = 0.62;
    this.dist = 6.2;
    this.targetYaw = 0;
    this.targetPitch = 0.62;
    this.targetDist = 6.2;
    this.smoothTarget = new THREE.Vector3(0, 1, 0);
    this.rayOrigin = new THREE.Vector3();
    this.rayDir = new THREE.Vector3();
  }

  applyDrag(dx, dy) {
    this.targetYaw -= dx * 0.0052;
    this.targetPitch = clamp(this.targetPitch + dy * 0.0042, -0.2, 1.32);
  }

  zoom(delta) {
    this.targetDist = clamp(this.targetDist + delta, 3.2, 10);
  }

  reset(targetDir) {
    this.smoothTarget.copy(this.planet.surfacePoint(targetDir, 0.4));
    this.targetPitch = this.pitch = 0.62;
    this.targetDist = this.dist = 6.2;
    this.targetYaw = this.yaw = 0;
  }

  update(dt, player) {
    const target = player.group.position;
    const up = CAM_UP.copy(player.dir).normalize();

    this.yaw = damp(this.yaw, this.targetYaw, 14, dt);
    this.pitch = damp(this.pitch, this.targetPitch, 14, dt);
    this.dist = damp(this.dist, this.targetDist, 10, dt);

    CAM_RIGHT.crossVectors(WORLD_UP, up);
    if (CAM_RIGHT.lengthSq() < 1e-5) CAM_RIGHT.set(1, 0, 0);
    CAM_RIGHT.normalize();
    CAM_FWD.crossVectors(CAM_RIGHT, up).normalize();

    const offset = CAM_TMP
      .copy(up)
      .multiplyScalar(Math.sin(this.pitch))
      .addScaledVector(CAM_FWD, -Math.cos(this.pitch) * Math.cos(this.yaw))
      .addScaledVector(CAM_RIGHT, -Math.cos(this.pitch) * Math.sin(this.yaw))
      .normalize();
    const desired = CAM_TMP2.copy(this.smoothTarget).addScaledVector(offset, this.dist);

    this.rayOrigin.copy(this.smoothTarget).addScaledVector(up, 1.1);
    this.rayDir.copy(desired).sub(this.rayOrigin);
    const range = this.rayDir.length();
    if (range > 0.001) {
      this.rayDir.normalize();
      this.raycaster.set(this.rayOrigin, this.rayDir);
      this.raycaster.far = range;
      const hits = this.raycaster.intersectObject(this.terrain, false);
      if (hits.length > 0 && hits[0].distance < range) {
        const pull = Math.max(2.4, hits[0].distance * 0.9);
        desired.copy(this.rayOrigin).addScaledVector(this.rayDir, pull);
      }
    }

    this.camera.position.copy(desired);
    this.smoothTarget.lerp(target, 1 - Math.exp(-16 * dt));
    this.camera.up.copy(up);
    this.camera.lookAt(CAM_FWD.copy(this.smoothTarget).addScaledVector(up, 0.45));
  }
}
