import * as THREE from "three";
import { fbm, hash2, mulberry32, smoothstep, lerp, clamp, GeometryBatch } from "./utils.js";
import { PALETTE, addHouse, addTree, addPalm, addRubber, addBush, addRock, addPaddy, addWarung, addBoat, addLamp, addFence, addLumbung, createPlacer } from "./props.js";
import { vertexMaterial, makeOutline, TEAL, INK } from "./materials.js";

export const PLANET_R = 16;
export const WALK_R = 0.9;

const DEG = Math.PI / 180;

function dirFromLatLon(lat, lon) {
  const phi = (90 - lat) * DEG;
  const theta = lon * DEG;
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ).normalize();
}

function angleBetween(a, b) {
  return Math.acos(clamp(a.dot(b), -1, 1));
}

export const SPOTS = [
  { id: "gerbang", name: "Gerbang Bumi Murakata", lat: 25, lon: 92, pad: 2.9, height: 0.55 },
  { id: "alun-alun", name: "Alun-Alun Barabai", lat: 0, lon: 88, pad: 3.8, height: 0.6 },
  { id: "masjid", name: "Masjid Agung Riadhusshalihin", lat: 10, lon: 99, pad: 3.2, height: 0.6 },
  { id: "pasar", name: "Pasar Apam", lat: -12, lon: 76, pad: 3.2, height: 0.55 },
  { id: "taman", name: "Taman Dwi Warna", lat: 4, lon: 73, pad: 3.2, height: 0.5 },
  { id: "bukit", name: "Bukit Meratus", lat: 16, lon: 65, pad: 2.7, height: 0.8 },
  { id: "kampung", name: "Kampung Panggung", lat: -20, lon: 104, pad: 3.8, height: 0.55 },
  { id: "dermaga", name: "Dermaga Sungai Barabai", lat: -11, lon: 94, pad: 2.9, height: 0.42 },
];

for (const spot of SPOTS) {
  spot.dir = dirFromLatLon(spot.lat, spot.lon);
  spot.padRad = spot.pad / PLANET_R;
}

const BUKIT_DIR = dirFromLatLon(16, 65);
const BAY_DIR = dirFromLatLon(-26, 88);

export function spotById(id) {
  return SPOTS.find((spot) => spot.id === id) ?? null;
}

function landHeight(dir) {
  const x = dir.x;
  const y = dir.y;
  const z = dir.z;
  let h = 0.52 + (fbm(x * 1.15 + 5.2, z * 1.15 - 3.4 + y * 0.85, 4) - 0.5) * 2.3;
  h += (fbm(x * 2.6 - 1.3, z * 2.6 + y * 1.9, 3) - 0.5) * 0.6;

  const hillD = angleBetween(dir, BUKIT_DIR);
  h += 4.6 * Math.exp(-(hillD * hillD) / 0.032);

  const bayD = angleBetween(dir, BAY_DIR);
  h -= 1.7 * Math.exp(-(bayD * bayD) / 0.055);

  for (const spot of SPOTS) {
    const d = angleBetween(dir, spot.dir);
    if (d < spot.padRad * 1.3) {
      const blend = 1 - smoothstep(spot.padRad * 0.85, spot.padRad * 1.25, d);
      const arc = d * PLANET_R;
      const target = spot.height - (arc * arc) / (2 * PLANET_R);
      h = lerp(h, target, blend);
    }
  }
  return h;
}

export function surfaceRadius(dir) {
  return PLANET_R + landHeight(dir);
}

export function surfacePoint(dir, lift = 0) {
  return dir.clone().multiplyScalar(surfaceRadius(dir) + lift);
}

function surfaceColor(height, dir) {
  const variation = hash2(dir.x * 41.7 + 4.1, dir.z * 41.7 - dir.y * 17.3) - 0.5;
  let base;
  if (height < 0.02) base = new THREE.Color(0xbfae86);
  else if (height < 0.38) base = new THREE.Color(PALETTE.sand);
  else if (height < 1.0) base = new THREE.Color(PALETTE.greenLight);
  else if (height < 2.2) base = new THREE.Color(PALETTE.green);
  else if (height < 3.4) base = new THREE.Color(PALETTE.greenDark);
  else base = new THREE.Color(PALETTE.rock);

  const bukitD = angleBetween(dir, BUKIT_DIR);
  if (bukitD < 0.115) {
    base = new THREE.Color(PALETTE.sand).lerp(new THREE.Color(PALETTE.greenDark), smoothstep(0.045, 0.11, bukitD));
  }

  for (const spot of SPOTS) {
    const d = angleBetween(dir, spot.dir);
    if (d < spot.padRad * 1.05) {
      const padColor = new THREE.Color(PALETTE.cream).offsetHSL(0, 0, variation * 0.03);
      base.lerp(padColor, 1 - smoothstep(spot.padRad * 0.55, spot.padRad * 1.02, d));
    }
  }

  return base.offsetHSL(0, 0, variation * 0.05);
}

function buildTerrain() {
  const geometry = new THREE.SphereGeometry(PLANET_R, 148, 104);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const v = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i).normalize();
    const height = landHeight(v);
    v.multiplyScalar(PLANET_R + height);
    position.setXYZ(i, v.x, v.y, v.z);
    color.copy(surfaceColor(height, v.clone().normalize()));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, vertexMaterial);
  mesh.name = "terrain";
  return mesh;
}

function buildOcean() {
  const geometry = new THREE.SphereGeometry(PLANET_R - 0.02, 72, 48);
  const material = new THREE.MeshLambertMaterial({
    color: TEAL,
    transparent: true,
    opacity: 0.94,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ocean";
  return mesh;
}

function sphereFrame(dir) {
  const up = dir.clone().normalize();
  const east = new THREE.Vector3(0, 1, 0).cross(up);
  if (east.lengthSq() < 0.001) east.set(1, 0, 0);
  east.normalize();
  const south = new THREE.Vector3().crossVectors(east, up).normalize();
  const matrix = new THREE.Matrix4().makeBasis(east, up, south);
  return { up, east, south, matrix };
}

function orientOnSurface(placer, dir, options = {}) {
  const { matrix } = sphereFrame(dir);
  const radius = surfaceRadius(dir);
  const local = composeSurface(radius, options);
  placer.matrix = matrix.clone().multiply(local);
  return placer;
}

function composeSurface(radius, { yaw = 0, sx = 1, sy = 1, sz = 1, lift = 0 } = {}) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(0, radius + lift, 0),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(sx, sy, sz),
  );
}

function surfacePlacer(batch, dir, options = {}) {
  const { matrix } = sphereFrame(dir);
  const radius = surfaceRadius(dir);
  const local = composeSurface(radius, options);
  return createPlacer(batch, { matrix: matrix.clone().multiply(local) });
}

function slerpDirs(a, b, t) {
  return a.clone().lerp(b, t).normalize();
}

function buildPaths(batch) {
  const links = [
    ["gerbang", "alun-alun"],
    ["alun-alun", "masjid"],
    ["alun-alun", "pasar"],
    ["alun-alun", "taman"],
    ["taman", "bukit"],
    ["alun-alun", "kampung"],
    ["kampung", "dermaga"],
    ["pasar", "dermaga"],
    ["taman", "pasar"],
  ];
  const random = mulberry32(5150);
  for (const [aId, bId] of links) {
    const a = spotById(aId);
    const b = spotById(bId);
    const angDist = angleBetween(a.dir, b.dir);
    const arcLength = angDist * PLANET_R;
    const tStart = Math.min(0.35, a.pad / arcLength);
    const tEnd = 1 - Math.min(0.35, b.pad / arcLength);
    const span = tEnd - tStart;
    const steps = Math.max(2, Math.ceil((arcLength * span) / 1.15));
    for (let i = 0; i <= steps; i += 1) {
      const t = tStart + (i / steps) * span;
      const dir = slerpDirs(a.dir, b.dir, t);
      const radius = surfaceRadius(dir);
      const lift = 0.055 + random() * 0.02;
      const placer = surfacePlacer(batch, dir, { lift, sx: 0.62, sy: 1, sz: 1.05 });
      placer.box(0.34, 0.05, 0.5, PALETTE.creamDark, {
        y: -0.026 + random() * 0.02,
        ry: random() * 0.5,
      });
      if (random() > 0.86) {
        placer.box(0.2, 0.04, 0.2, PALETTE.sand, { y: -0.01 });
      }
    }
  }
}

function padCircle(placer, radius, color) {
  placer.circle(radius, 40, color, { rx: -Math.PI / 2, y: 0.028 });
  placer.ring(radius * 0.94, radius, 40, PALETTE.creamDark, { rx: -Math.PI / 2, y: 0.034 });
}

function spotGate(batch) {
  const spot = spotById("gerbang");
  const placer = surfacePlacer(batch, spot.dir, { yaw: 0.4, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 5.2, PALETTE.sand);
  for (const side of [-1, 1]) {
    placer.box(0.6, 3.4, 0.6, PALETTE.cream, { x: side * 1.9, y: 1.7 });
    placer.box(0.75, 0.24, 0.75, PALETTE.gold, { x: side * 1.9, y: 3.52 });
    placer.box(0.16, 1.3, 0.12, PALETTE.gold, { x: side * 1.9, y: 4.2 });
  }
  placer.box(4.6, 0.5, 0.55, PALETTE.cream, { y: 3.15 });
  placer.gable(5.1, 0.6, 0.75, PALETTE.roof, { y: 3.4 });
  placer.box(3.1, 0.35, 0.07, PALETTE.ink, { y: 2.55, z: 0.24 });
  placer.box(2.7, 0.22, 0.08, PALETTE.coral, { y: 2.5, z: 0.3 });
  placer.box(2.4, 0.05, 0.9, PALETTE.creamDark, { y: 0.04, z: 1.9 });
  placer.box(2.4, 0.05, 0.9, PALETTE.creamDark, { y: 0.03, z: 2.9 });
  addLamp(createPlacer(placer, { x: -3.4, y: 0, z: 1.6 }));
  addLamp(createPlacer(placer, { x: 3.4, y: 0, z: 1.6 }));
}

function spotPlaza(batch) {
  const spot = spotById("alun-alun");
  const placer = surfacePlacer(batch, spot.dir, { sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 6.2, PALETTE.cream);
  placer.circle(3.9, 32, PALETTE.green, { rx: -Math.PI / 2, y: 0.04 });
  placer.cylinder(1.15, 1.3, 0.3, 12, PALETTE.creamDark, { y: 0.2 });
  placer.circle(1.0, 20, PALETTE.water, { rx: -Math.PI / 2, y: 0.36 });
  placer.cylinder(0.3, 0.42, 0.65, 10, PALETTE.cream, { y: 0.6 });
  placer.sphere(0.16, 8, 6, PALETTE.gold, { y: 1.0 });
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const x = Math.sin(angle) * 4.9;
    const z = Math.cos(angle) * 4.9;
    placer.box(0.95, 0.12, 0.34, PALETTE.wood, { x, y: 0.24, z, ry: angle });
    placer.box(0.95, 0.3, 0.08, PALETTE.woodDark, { x: x - Math.sin(angle) * 0.12, y: 0.38, z: z - Math.cos(angle) * 0.12, ry: angle });
  }
  placer.cylinder(0.06, 0.08, 3.6, 6, PALETTE.creamDark, { x: 2.2, y: 1.8, z: -1.4 });
  placer.box(0.85, 0.5, 0.03, PALETTE.coral, { x: 2.62, y: 3.2, z: -1.4 });
  placer.box(0.85, 0.45, 0.03, PALETTE.paper, { x: 2.62, y: 3.68, z: -1.4 });
  for (const [x, z] of [[-4.6, -3.4], [4.6, -3.4], [-4.6, 3.4], [4.6, 3.4], [0, 5.4]]) {
    addTree(createPlacer(placer, { x, y: 0.04, z }), { rng: mulberry32((x * 31 + z * 17) | 0) });
  }
}

function spotMosque(batch) {
  const spot = spotById("masjid");
  const placer = surfacePlacer(batch, spot.dir, { yaw: -0.5, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 5.6, PALETTE.sand);
  placer.box(4.6, 2.3, 3.6, PALETTE.cream, { y: 1.25 });
  placer.box(4.9, 0.2, 3.9, PALETTE.creamDark, { y: 2.45 });
  placer.box(2.2, 1.5, 0.7, PALETTE.cream, { y: 0.85, z: 2.0 });
  placer.dome(1.65, 18, 10, PALETTE.gold, { y: 2.55 });
  placer.cylinder(0.09, 0.14, 0.55, 6, PALETTE.gold, { y: 4.35 });
  placer.sphere(0.11, 6, 5, PALETTE.paper, { y: 4.72 });
  placer.box(0.8, 4.6, 0.8, PALETTE.cream, { x: 3.2, y: 2.4, z: -1.1 });
  placer.dome(0.52, 12, 7, PALETTE.gold, { x: 3.2, y: 4.95, z: -1.1 });
  placer.cone(0.07, 0.42, 5, PALETTE.gold, { x: 3.2, y: 5.6, z: -1.1 });
  for (const x of [-1.2, 0, 1.2]) {
    placer.box(0.4, 1.1, 0.08, PALETTE.woodDark, { x, y: 0.8, z: 1.85 });
  }
  placer.box(3.4, 0.12, 0.5, PALETTE.cream, { y: 0.16, z: 2.5 });
  placer.box(3.4, 0.12, 0.5, PALETTE.cream, { y: 0.06, z: 3.0 });
  addLamp(createPlacer(placer, { x: -2.9, y: 0, z: 2.3 }));
  addLamp(createPlacer(placer, { x: 2.9, y: 0, z: 2.3 }));
}

function spotMarket(batch) {
  const spot = spotById("pasar");
  const placer = surfacePlacer(batch, spot.dir, { yaw: 0.9, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 5.4, PALETTE.creamDark);
  const rng = mulberry32(612);
  for (const [x, z, rot] of [[-2.6, -1.4, 0.1], [0.2, -1.7, -0.08], [2.7, -1.3, 0.14], [-1.3, 1.6, -0.3], [1.5, 1.8, 0.2]]) {
    const stall = createPlacer(placer, { x, y: 0.04, z, ry: rot });
    for (const px of [-0.85, 0.85]) {
      for (const pz of [-0.55, 0.55]) {
        stall.box(0.09, 1.25, 0.09, PALETTE.woodDark, { x: px, y: 0.62, z: pz });
      }
    }
    stall.box(1.85, 0.5, 1.05, PALETTE.wood, { y: 0.4 });
    for (let i = 0; i < 3; i += 1) {
      stall.box(0.5, 0.05, 1.2, i % 2 ? PALETTE.paper : PALETTE.coral, {
        x: -0.6 + i * 0.6,
        y: 1.28,
        rz: 0.05,
      });
    }
    stall.box(0.2, 0.22, 0.2, PALETTE.yellow, { x: -0.4, y: 0.75, z: 0.2 });
    stall.box(0.16, 0.18, 0.16, PALETTE.coral, { x: 0.3, y: 0.72, z: 0.2 });
    if (rng() > 0.4) {
      stall.sphere(0.2, 7, 5, PALETTE.paper, { x: 0.05, y: 0.68, z: -0.2, sy: 0.7 });
    }
  }
  placer.box(6.4, 0.04, 0.04, PALETTE.ink, { y: 2.3, z: -2.9 });
  for (const px of [-3.1, 3.1]) {
    placer.box(0.14, 2.3, 0.14, PALETTE.woodDark, { x: px, y: 1.15, z: -2.9 });
  }
  for (let i = 0; i < 7; i += 1) {
    placer.box(0.24, 0.3, 0.03, i % 2 ? PALETTE.coral : PALETTE.yellow, {
      x: -2.7 + i * 0.9,
      y: 2.14,
      z: -2.9,
      rz: 0.1,
    });
  }
  addLumbung(createPlacer(placer, { x: -4.1, y: 0.05, z: 2.4, ry: 0.3 }));
  addLumbung(createPlacer(placer, { x: 4.0, y: 0.05, z: 2.2, ry: -0.25 }));
  addLamp(createPlacer(placer, { x: 0, y: 0.04, z: 3.4 }));
}

function spotPark(batch) {
  const spot = spotById("taman");
  const placer = surfacePlacer(batch, spot.dir, { yaw: 0.2, sx: 0.6, sy: 0.6, sz: 0.6 });
  placer.circle(5.8, 40, PALETTE.green, { rx: -Math.PI / 2, y: 0.03, sx: 1.2 });
  placer.ring(3.4, 4.4, 40, PALETTE.sand, { rx: -Math.PI / 2, y: 0.04, sx: 1.22 });
  placer.circle(2.6, 32, PALETTE.greenLight, { rx: -Math.PI / 2, y: 0.05, sx: 1.24 });
  placer.cylinder(0.9, 1.05, 0.28, 12, PALETTE.cream, { y: 0.18 });
  placer.circle(0.75, 20, PALETTE.water, { rx: -Math.PI / 2, y: 0.33 });
  placer.cylinder(0.22, 0.3, 0.6, 8, PALETTE.creamDark, { y: 0.55 });
  placer.sphere(0.13, 6, 5, PALETTE.gold, { y: 0.92 });
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    placer.box(0.8, 0.1, 0.3, PALETTE.wood, {
      x: Math.sin(angle) * 4.9,
      y: 0.2,
      z: Math.cos(angle) * 4.15,
      ry: angle,
    });
  }
  const gazebo = createPlacer(placer, { x: -2.9, y: 0.04, z: -2.4 });
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) {
    gazebo.box(0.11, 1.15, 0.11, PALETTE.woodDark, { x, y: 0.6, z });
  }
  gazebo.box(2.1, 0.12, 2.1, PALETTE.wood, { y: 1.18 });
  gazebo.gable(2.3, 0.55, 2.3, PALETTE.roofTeal, { y: 1.24 });
  for (const [x, z] of [[-4.9, 2.8], [4.6, 2.2], [-3.9, -4.6], [0, -5.6], [4.9, -4.2]]) {
    addTree(createPlacer(placer, { x, y: 0.04, z }), { rng: mulberry32((x * 13 + z * 29) | 0) });
  }
  addPalm(createPlacer(placer, { x: 3.4, y: 0.04, z: 4.6, ry: 0.5 }));
}

function spotHill(batch) {
  const spot = spotById("bukit");
  const placer = surfacePlacer(batch, spot.dir, { yaw: -0.7, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 4.4, PALETTE.sand);
  const rng = mulberry32(777);
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) {
    placer.box(0.2, 3.2, 0.2, PALETTE.woodDark, { x, y: 1.6, z });
  }
  placer.box(4.2, 0.24, 4.2, PALETTE.wood, { y: 3.24 });
  placer.box(3.5, 0.12, 3.5, PALETTE.woodDark, { y: 3.08 });
  for (let i = 0; i < 9; i += 1) {
    placer.box(0.9, 0.18, 0.34, i % 2 ? PALETTE.wood : PALETTE.woodDark, {
      x: 0,
      y: 0.3 + i * 0.33,
      z: 3.3 - i * 0.26,
    });
  }
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    placer.box(0.13, 0.8, 0.13, PALETTE.woodDark, { x, y: 3.65, z });
  }
  placer.gable(4.6, 0.85, 4.2, PALETTE.roof, { y: 4.05 });
  placer.ico(0.18, 1, PALETTE.gold, { y: 5.15 });
  placer.box(1.2, 0.14, 0.36, PALETTE.wood, { x: -0.9, y: 3.7, z: -0.8, ry: 0.15 });
  placer.box(1.2, 0.14, 0.36, PALETTE.wood, { x: 0.9, y: 3.7, z: -0.8, ry: -0.15 });
  for (let i = 0; i < 6; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 5.2 + rng() * 3.4;
    placer.ico(0.5 + rng() * 0.6, 0, rng() > 0.5 ? PALETTE.rock : PALETTE.greenDark, {
      x: Math.sin(angle) * radius,
      y: 0.3,
      z: Math.cos(angle) * radius,
      sy: 0.7,
      ry: rng() * Math.PI,
    });
  }
  addLamp(createPlacer(placer, { x: -3.4, y: 0, z: 0.8 }));
  addLamp(createPlacer(placer, { x: 3.4, y: 0, z: 0.8 }));
}

function spotVillage(batch) {
  const spot = spotById("kampung");
  const placer = surfacePlacer(batch, spot.dir, { yaw: 1.1, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 6.0, PALETTE.greenLight);
  placer.ring(1.4, 5.6, 40, PALETTE.creamDark, { rx: -Math.PI / 2, y: 0.035 });
  const rng = mulberry32(881);
  const homes = [
    [-2.9, -2.4, 0.7],
    [2.6, -2.9, -0.5],
    [-2.4, 2.7, 2.5],
    [3.1, 2.4, -2.2],
    [0.2, 3.9, 0.1],
  ];
  for (const [x, z, rot] of homes) {
    addHouse(createPlacer(placer, { x, y: 0.04, z, ry: rot, sx: 0.82, sy: 0.82, sz: 0.82 }), { rng });
  }
  addFence(createPlacer(placer, { x: -2.9, y: 0.04, z: -0.9, ry: 0.7 }), 2.6);
  addFence(createPlacer(placer, { x: 2.7, y: 0.04, z: -1.5, ry: -0.4 }), 2.4);
  addPaddy(createPlacer(placer, { x: -4.4, y: 0.04, z: 0.9, ry: 0.5, sx: 0.7, sy: 0.7, sz: 0.7 }), { rng });
  addPaddy(createPlacer(placer, { x: 4.5, y: 0.04, z: -0.7, ry: -0.4, sx: 0.62, sy: 0.62, sz: 0.62 }), { rng });
  for (const [x, z] of [[-4.9, 3.9], [4.9, 4.1], [-5.2, -3.6]]) {
    addTree(createPlacer(placer, { x, y: 0.04, z }), { rng: mulberry32((x * 7 + z * 11) | 0) });
  }
  addLamp(createPlacer(placer, { x: 0, y: 0.04, z: 1.4 }));
  addWarung(createPlacer(placer, { x: 0.9, y: 0.04, z: -4.6, ry: 0.15, sx: 0.85, sy: 0.85, sz: 0.85 }), { rng });
}

function spotDock(batch) {
  const spot = spotById("dermaga");
  const placer = surfacePlacer(batch, spot.dir, { yaw: 1.57, sx: 0.6, sy: 0.6, sz: 0.6 });
  padCircle(placer, 4.6, PALETTE.sand);
  const plank = createPlacer(placer, { x: -1.2, y: 0.02 });
  for (let i = 0; i < 9; i += 1) {
    plank.box(0.72, 0.09, 2.2, i % 2 ? PALETTE.wood : PALETTE.woodDark, { x: -i * 0.74, y: 0.34 });
  }
  for (let i = 0; i < 4; i += 1) {
    const x = -i * 2.1;
    for (const z of [-0.95, 0.95]) {
      plank.box(0.14, 1.7, 0.14, PALETTE.woodDark, { x, y: -0.45, z });
    }
  }
  for (const z of [-1.15, 1.15]) {
    plank.box(7.4, 0.09, 0.09, PALETTE.woodDark, { x: -2.9, y: 1.05, z });
    for (let i = 0; i < 4; i += 1) {
      plank.box(0.09, 0.5, 0.09, PALETTE.woodDark, { x: -i * 2.1, y: 0.75, z });
    }
  }
  placer.box(1.9, 1.25, 1.6, PALETTE.cream, { x: 1.8, y: 0.75, z: -1.7, ry: 0.25 });
  placer.gable(2.3, 0.5, 2.0, PALETTE.roofTeal, { x: 1.8, y: 1.4, z: -1.7, ry: 0.25 });
  addBoat(createPlacer(placer, { x: -5.6, y: -0.2, z: 1.1, ry: 1.0 }), { rng: mulberry32(31) });
  addBoat(createPlacer(placer, { x: -6.7, y: -0.22, z: -1.6, ry: 0.45, sx: 0.8, sy: 0.8, sz: 0.8 }), { rng: mulberry32(41), sail: false });
  addPalm(createPlacer(placer, { x: 3.4, y: 0.02, z: 2.4, ry: 0.3 }));
  addTree(createPlacer(placer, { x: 3.9, y: 0.02, z: -2.9 }), { rng: mulberry32(51) });
  placer.box(2.4, 0.75, 0.1, PALETTE.gold, { x: 0.2, y: 1.5, z: -3.6 });
  placer.box(2.1, 0.5, 0.11, PALETTE.ink, { x: 0.2, y: 1.5, z: -3.67 });
}

const SPOT_BUILDERS = {
  gerbang: spotGate,
  "alun-alun": spotPlaza,
  masjid: spotMosque,
  pasar: spotMarket,
  taman: spotPark,
  bukit: spotHill,
  kampung: spotVillage,
  dermaga: spotDock,
};

function buildSpots(batch) {
  for (const spot of SPOTS) {
    SPOT_BUILDERS[spot.id](batch);
    spot.worldY = surfaceRadius(spot.dir);
  }
}

function scatterNature(batch) {
  const random = mulberry32(20481);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < 340; i += 1) {
    const lat = Math.asin(random() * 2 - 1) / DEG;
    const lon = random() * 360;
    const dir = dirFromLatLon(lat, lon);
    let tooClose = false;
    for (const spot of SPOTS) {
      if (angleBetween(dir, spot.dir) < spot.padRad + 0.04) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    tmp.copy(dir);
    const height = landHeight(dir);
    const radius = PLANET_R + height;
    const roll = random();
    let placer;
    // steepness: sample neighbours ~0.6u apart; steep slopes only get nature, no buildings
    const step = 0.6 / PLANET_R;
    const eastStep = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const slope = Math.max(
      Math.abs(landHeight(dir.clone().addScaledVector(eastStep, step).normalize()) - height),
      Math.abs(landHeight(dir.clone().addScaledVector(eastStep, -step).normalize()) - height),
    );
    if (height < 0.1) {
      if (roll < 0.3) {
        placer = surfacePlacer(batch, dir, { lift: -0.14, ry: random() * Math.PI });
        addRock(placer, { rng: random });
      }
      continue;
    }
    placer = surfacePlacer(batch, dir, {
      lift: 0.02,
      ry: random() * Math.PI * 2,
      sx: 0.72 + random() * 0.23,
      sy: 0.72 + random() * 0.23,
      sz: 0.72 + random() * 0.23,
    });
    if (height < 0.55) {
      if (roll < 0.5) addPalm(placer, { rng: random });
      else if (roll < 0.7) addRock(placer, { rng: random });
      else if (roll < 0.85) addBush(placer, { rng: random });
      else addTree(placer, { rng: random });
    } else if (height > 3.4) {
      if (roll < 0.55) addRock(placer, { rng: random });
      else addBush(placer, { rng: random });
    } else {
      if (slope > 0.55) {
        if (roll < 0.5) addTree(placer, { rng: random });
        else if (roll < 0.75) addBush(placer, { rng: random });
        else addRock(placer, { rng: random });
      } else if (roll < 0.36) addTree(placer, { rng: random });
      else if (roll < 0.52) addRubber(placer, { rng: random });
      else if (roll < 0.64) addPalm(placer, { rng: random });
      else if (roll < 0.76) addBush(placer, { rng: random });
      else if (roll < 0.88) addRock(placer, { rng: random });
      else if (roll < 0.94) {
        addHouse(
          surfacePlacer(batch, dir, {
            lift: 0.02,
            ry: random() * Math.PI * 2,
            sx: 0.6,
            sy: 0.6,
            sz: 0.6,
          }),
          { rng: random },
        );
      } else {
        addWarung(
          surfacePlacer(batch, dir, {
            lift: 0.02,
            ry: random() * Math.PI * 2,
            sx: 0.6,
            sy: 0.6,
            sz: 0.6,
          }),
          { rng: random },
        );
      }
    }
  }
}

function buildClouds(scene) {
  const batch = new GeometryBatch();
  const random = mulberry32(99);
  for (let i = 0; i < 16; i += 1) {
    const dir = dirFromLatLon(-70 + random() * 140, random() * 360);
    const radius = PLANET_R + 6.5 + random() * 4.5;
    const { matrix } = sphereFrame(dir);
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(0, radius, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI * 2, 0)),
      new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + random() * 0.7),
    );
    const placer = createPlacer(batch, { matrix: matrix.clone().multiply(local) });
    placer.sphere(0.75 + random() * 0.5, 8, 6, 0xffffff, { sx: 1.5, sy: 0.55 });
    placer.sphere(0.55 + random() * 0.4, 8, 6, 0xffffff, { x: 0.7 + random() * 0.5, y: 0.1, sx: 1.3, sy: 0.5 });
  }
  const geometry = batch.toGeometry();
  if (!geometry) return null;
  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "clouds";
  scene.add(mesh);
  return mesh;
}

export function createPlanet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TEAL);
  scene.fog = new THREE.FogExp2(TEAL, 0.0062);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  const hemisphere = new THREE.HemisphereLight(0xfff3d8, 0x54918c, 1.35);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffefc9, 1.9);
  sun.position.set(-38, 46, 24);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9edbd4, 0.5);
  fill.position.set(40, -20, -30);
  scene.add(fill);

  const terrain = buildTerrain();
  scene.add(terrain);
  const ocean = buildOcean();
  scene.add(ocean);

  const batch = new GeometryBatch();
  buildSpots(batch);
  buildPaths(batch);
  scatterNature(batch);
  const worldGeometry = batch.toGeometry();
  let worldMesh = null;
  let worldOutline = null;
  if (worldGeometry) {
    worldMesh = new THREE.Mesh(worldGeometry, vertexMaterial);
    scene.add(worldMesh);
    worldOutline = makeOutline(worldGeometry, 24);
    scene.add(worldOutline);
  }

  const clouds = buildClouds(scene);

  for (const spot of SPOTS) {
    spot.anchor = surfacePoint(spot.dir, 0);
  }

  return {
    scene,
    camera,
    terrain,
    ocean,
    clouds,
    surfaceRadius,
    surfacePoint,
    spotById,
    frameAt: sphereFrame,
    dispose() {
      terrain.geometry.dispose();
      ocean.geometry.dispose();
      ocean.material.dispose();
      if (worldGeometry) {
        worldGeometry.dispose();
        worldOutline.geometry.dispose();
      }
      if (clouds) {
        clouds.geometry.dispose();
        clouds.material.dispose();
      }
    },
  };
}

export { dirFromLatLon, sphereFrame, angleBetween };
