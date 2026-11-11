import * as THREE from "three";
import { GeometryBatch, mulberry32, damp } from "./utils.js";
import { PALETTE, createPlacer } from "./props.js";
import { vertexMaterial, makeOutline } from "./materials.js";
import { PLANET_R } from "./planet.js";

const SKIN = [0xf0c39a, 0xd9a06f, 0xc68d5e, 0x9c6644, 0x7a4a2b];

export const NPCS = [
  {
    id: "hambali",
    name: "Pak Hambali",
    role: "giver",
    spot: "dermaga",
    offset: [-0.96, 0.72],
    yaw: 2.4,
    skin: 3,
    hair: 0x4e5d55,
    top: PALETTE.coral,
    bottom: 0x4e5d55,
    hat: "cap",
    skirt: false,
  },
  {
    id: "rosa",
    name: "Bu Rosa",
    role: "giver",
    spot: "pasar",
    offset: [-0.72, 0.36],
    yaw: 2.8,
    skin: 1,
    hair: 0x5a3825,
    top: PALETTE.coral,
    bottom: PALETTE.paper,
    hat: null,
    skirt: true,
  },
  {
    id: "andi",
    name: "Andi",
    role: "giver",
    spot: "gerbang",
    offset: [1.08, 0.48],
    yaw: -2.2,
    skin: 0,
    hair: 0x2f3b36,
    top: PALETTE.teal,
    bottom: 0x4e5d55,
    hat: "cap",
    skirt: false,
  },
  {
    id: "laila",
    name: "Bu Laila",
    role: "giver",
    spot: "taman",
    offset: [0.84, -0.36],
    yaw: -2.6,
    skin: 2,
    hair: 0x2f3b36,
    top: PALETTE.green,
    bottom: PALETTE.paper,
    hat: null,
    skirt: true,
  },
  {
    id: "rakim",
    name: "Kakek Rakim",
    role: "giver",
    spot: "kampung",
    offset: [0.36, 1.2],
    yaw: 3.0,
    skin: 4,
    hair: 0xd9cfb9,
    top: PALETTE.cream,
    bottom: 0x5a3825,
    hat: "songkok",
    skirt: false,
  },
  {
    id: "durasid",
    name: "Pak Durasid",
    role: "target",
    spot: "kampung",
    offset: [-1.8, -0.84],
    yaw: -0.8,
    skin: 3,
    hair: 0xd9cfb9,
    top: PALETTE.paper,
    bottom: 0x5a3825,
    hat: "songkok",
    skirt: false,
  },
  {
    id: "jambri",
    name: "Om Jambri",
    role: "target",
    spot: "bukit",
    offset: [0.72, 0.84],
    yaw: 2.2,
    skin: 2,
    hair: 0x4e5d55,
    top: PALETTE.green,
    bottom: 0x4e5d55,
    hat: "cap",
    skirt: false,
  },
  {
    id: "ketua",
    name: "Pak Ketua RT",
    role: "target",
    spot: "alun-alun",
    offset: [-1.32, 1.2],
    yaw: -2.4,
    skin: 1,
    hair: 0x2f3b36,
    top: PALETTE.gold,
    bottom: 0x2f3b36,
    hat: "songkok",
    skirt: false,
  },
  {
    id: "rina",
    name: "Teteh Rina",
    role: "target",
    spot: "masjid",
    offset: [1.32, 1.44],
    yaw: -2.8,
    skin: 0,
    hair: 0x2f3b36,
    top: PALETTE.paper,
    bottom: PALETTE.teal,
    hat: "hijab",
    skirt: true,
  },
  {
    id: "saribi",
    name: "Mbah Saribi",
    role: "target",
    spot: "taman",
    offset: [-1.44, 0.96],
    yaw: 2.9,
    skin: 4,
    hair: 0xd9cfb9,
    top: PALETTE.coral,
    bottom: 0x5a3825,
    hat: "hijab",
    skirt: true,
  },
];

const SKIRT_H = 0.52;
const BODY_Y = 0.46;

function npcGeometry(def) {
  const batch = new GeometryBatch();
  const random = mulberry32(def.id.length * 977 + def.spot.length * 31);
  const p = createPlacer(batch);
  const skin = SKIN[def.skin % SKIN.length];

  if (def.skirt) {
    p.cylinder(0.19, 0.3, SKIRT_H, 10, def.bottom, { y: SKIRT_H / 2 });
    p.box(0.3, 0.26, 0.19, def.top, { y: SKIRT_H + 0.13 });
    p.cylinder(0.05, 0.07, 0.24, 6, skin, { x: -0.2, y: SKIRT_H + 0.1 });
    p.cylinder(0.05, 0.07, 0.24, 6, skin, { x: 0.2, y: SKIRT_H + 0.1 });
  } else {
    for (const side of [-1, 1]) {
      p.box(0.12, 0.4, 0.13, def.bottom, { x: side * 0.085, y: 0.2 });
      p.box(0.13, 0.08, 0.2, PALETTE.ink, { x: side * 0.085, y: 0.04, z: 0.03 });
      p.box(0.09, 0.28, 0.1, def.top, { x: side * 0.215, y: 0.55 });
      p.box(0.08, 0.08, 0.09, skin, { x: side * 0.215, y: 0.38 });
    }
    p.box(0.32, 0.32, 0.2, def.top, { y: BODY_Y + 0.13 });
  }

  p.sphere(0.15, 12, 9, skin, { y: 0.94 });
  if (def.hat === "hijab") {
    p.sphere(0.163, 12, 9, def.hair, { y: 0.945, z: -0.02, sy: 0.88, sz: 1.04 });
    p.cylinder(0.1, 0.13, 0.16, 8, def.hair, { y: 0.82, z: 0.05, rx: -0.35 });
  } else {
    p.sphere(0.158, 12, 9, def.hair, { y: 0.965, z: -0.02, sy: 0.62 });
    if (def.hat === "cap") {
      p.sphere(0.155, 10, 7, PALETTE.teal, { y: 1.02, sy: 0.55 });
      p.box(0.2, 0.03, 0.1, PALETTE.teal, { y: 0.99, z: 0.13 });
    } else if (def.hat === "songkok") {
      p.cylinder(0.155, 0.16, 0.12, 10, PALETTE.ink, { y: 1.06 });
    }
  }
  p.box(0.03, 0.05, 0.02, PALETTE.ink, { x: -0.05, y: 0.95, z: 0.135 });
  p.box(0.03, 0.05, 0.02, PALETTE.ink, { x: 0.05, y: 0.95, z: 0.135 });
  if (random() > 0.5) {
    p.box(0.02, 0.02, 0.02, PALETTE.ink, { y: 0.88, z: 0.14 });
  }

  const geometry = batch.toGeometry();
  if (!geometry) return null;
  geometry.computeVertexNormals?.();
  return geometry;
}

const MARKER_GEO = new THREE.OctahedronGeometry(0.09);
const MARKER_MAT = new THREE.MeshLambertMaterial({ color: PALETTE.gold });

export class NPC {
  constructor(def, planet, scene) {
    this.def = def;
    const geometry = npcGeometry(def);
    this.group = new THREE.Group();
    this.group.userData.npcDef = def;

    const mesh = new THREE.Mesh(geometry, vertexMaterial);
    this.group.add(mesh);
    const outline = makeOutline(geometry, 20);
    this.group.add(outline);

    this.marker = new THREE.Mesh(MARKER_GEO, MARKER_MAT);
    this.marker.position.set(0, 1.35, 0);
    this.marker.visible = false;
    this.group.add(this.marker);

    const up = def.anchorDir.clone().normalize();
    const frame = def.frame;
    const offsetAngle = Math.hypot(def.offset[0], def.offset[1]) / PLANET_R;
    const tangent = frame.east.clone().multiplyScalar(def.offset[0]).addScaledVector(frame.south, def.offset[1]);
    if (tangent.lengthSq() > 1e-8) tangent.normalize();
    const offsetDir = up
      .clone()
      .multiplyScalar(Math.cos(offsetAngle))
      .addScaledVector(tangent, Math.sin(offsetAngle))
      .normalize();
    const radius = planet.surfaceRadius(offsetDir);
    this.group.position.copy(offsetDir).multiplyScalar(radius);
    this.basePos = this.group.position.clone();
    this.up = offsetDir;
    this.faceYaw = def.yaw;

    this.alignQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(frame.east, up, frame.south),
    );
    this.heading = new THREE.Quaternion();
    this.phase = Math.random() * Math.PI * 2;
    this.playerNear = 999;

    scene.add(this.group);
    this.syncTransform();
  }

  syncTransform() {
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.faceYaw);
    this.heading.slerp(yawQuat, 0.12);
    this.group.quaternion.copy(this.alignQuaternion).multiply(this.heading);
  }

  update(dt, player) {
    this.phase += dt;
    const dist = this.group.position.distanceTo(player.group.position);
    this.playerNear = dist;

    if (dist < 4.5) {
      const toPlayer = player.group.position.clone().sub(this.group.position);
      toPlayer.sub(this.up.clone().multiplyScalar(toPlayer.dot(this.up)));
      if (toPlayer.lengthSq() > 1e-6) {
        const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.up).normalize();
        const south = new THREE.Vector3().crossVectors(east, this.up).normalize();
        const x = toPlayer.dot(east);
        const z = toPlayer.dot(south);
        this.faceYaw = damp(this.faceYaw, Math.atan2(x, z), 6, dt);
      }
    } else {
      this.faceYaw = damp(this.faceYaw, this.def.yaw, 2, dt);
    }

    const bob = Math.sin(this.phase * 1.6) * 0.012;
    this.group.position.copy(this.basePos).addScaledVector(this.up, bob);
    this.syncTransform();

    this.marker.rotation.y += dt * 2.4;
    this.marker.position.y = 1.35 + Math.sin(this.phase * 2.4) * 0.05;
  }

  setMarker(mode) {
    this.marker.visible = mode !== null;
  }
}

export function createNPCs(planet, scene) {
  const npcs = [];
  for (const def of NPCS) {
    const spot = planet.spotById ? planet.spotById(def.spot) : null;
    if (!spot) continue;
    def.anchorDir = spot.dir;
    def.frame = planet.frameAt(spot.dir);
    npcs.push(new NPC(def, planet, scene));
  }

  return {
    list: npcs,
    byId(id) {
      return npcs.find((npc) => npc.def.id === id) ?? null;
    },
    update(dt, player) {
      for (const npc of npcs) npc.update(dt, player);
    },
    nearest(player, maxDist = 2.1) {
      let best = null;
      let bestDist = maxDist;
      for (const npc of npcs) {
        const dist = npc.group.position.distanceTo(player.group.position);
        if (dist < bestDist) {
          best = npc;
          bestDist = dist;
        }
      }
      return best;
    },
  };
}

export { MARKER_GEO, MARKER_MAT };
