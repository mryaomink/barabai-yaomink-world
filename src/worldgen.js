import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LANDMARKS, LANDMARK_BY_ID, ROADS } from "./data.js";
import { clamp, fbm, hash2, lerp, mulberry32, smoothstep, GeometryBatch } from "./utils.js";
import {
  PALETTE,
  addBush,
  addHouse,
  addIslet,
  addLumbung,
  addPaddy,
  addPalm,
  addRock,
  addRubber,
  addTree,
  addWarung,
  addBoat,
  createPlacer,
} from "./props.js";

export const WATER_LEVEL = 0;
export const CHUNK_SIZE = 96;
export const CHUNK_SEGMENTS = 24;
export const CELL_SIZE = CHUNK_SIZE / CHUNK_SEGMENTS;
export const LOAD_RADIUS = 2;

const colorCache = new Map();
function color(hex) {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.Color(hex));
  return colorCache.get(hex);
}

export function riverX(z) {
  return 27 + Math.sin(z * 0.03) * 6 + Math.sin(z * 0.09 + 1.1) * 1.6;
}

function rawHeight(x, z) {
  const main = 1 - smoothstep(74, 148, Math.hypot(x, z));
  const broad = fbm(x * 0.0068 + 11.3, z * 0.0068 - 4.7, 4);
  const detail = fbm(x * 0.026 - 3.1, z * 0.026 + 8.2, 3);
  const ridge = Math.max(0, fbm(x * 0.015 + 2.7, z * 0.015 - 6.1, 3) - 0.48);

  let height = (broad - 0.515) * 15 + main * 4.0;
  height += (detail - 0.5) * (1.3 + main * 2.5);
  height += ridge * (2.2 + main * 11);

  const hillDistance = Math.hypot(x + 64, z + 61);
  height += 8.4 * Math.exp(-(hillDistance * hillDistance) / 560);

  return height;
}

export function heightAt(x, z) {
  let height = rawHeight(x, z);

  for (const landmark of LANDMARKS) {
    const distance = Math.hypot(x - landmark.x, z - landmark.z);
    const blend = 1 - smoothstep(landmark.pad * 0.58, landmark.pad * 1.5, distance);
    if (blend > 0) height = lerp(height, landmark.padHeight, blend);
  }

  const river = Math.abs(x - riverX(z));
  const riverBand = 1 - smoothstep(3.4, 8.2, river);
  const riverLength = 1 - smoothstep(118, 170, Math.abs(z));
  height -= riverBand * riverLength * 7.4;

  return height;
}

export function slopeAt(x, z, radius = 2.2) {
  const center = heightAt(x, z);
  return Math.max(
    Math.abs(center - heightAt(x + radius, z)),
    Math.abs(center - heightAt(x - radius, z)),
    Math.abs(center - heightAt(x, z + radius)),
    Math.abs(center - heightAt(x, z - radius)),
  );
}

function pointSegmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1);
  const x = ax + dx * t;
  const z = az + dz * t;
  return Math.hypot(px - x, pz - z);
}

export const ROAD_SEGMENTS = [];
for (const road of ROADS) {
  for (let i = 0; i < road.length - 1; i += 1) {
    const [ax, az] = road[i];
    const [bx, bz] = road[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(length / 2.6));
    for (let step = 0; step < steps; step += 1) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      ROAD_SEGMENTS.push({
        ax: lerp(ax, bx, t0),
        az: lerp(az, bz, t0),
        bx: lerp(ax, bx, t1),
        bz: lerp(az, bz, t1),
      });
    }
  }
}

export function distanceToRoad(x, z) {
  let closest = Infinity;
  for (const segment of ROAD_SEGMENTS) {
    const distance = pointSegmentDistance(x, z, segment.ax, segment.az, segment.bx, segment.bz);
    if (distance < closest) closest = distance;
  }
  return closest;
}

function isNearLandmark(x, z, padding = 5) {
  for (const landmark of LANDMARKS) {
    if (Math.hypot(x - landmark.x, z - landmark.z) < landmark.pad + padding) return true;
  }
  return false;
}

function terrainColor(height, slope, x, z) {
  const variation = hash2(x * 0.37 + 4.1, z * 0.37 - 2.7) - 0.5;
  let base;
  if (height < 0.65) base = color(PALETTE.sand);
  else if (height < 1.8) base = color(PALETTE.greenLight).clone().lerp(color(PALETTE.sand), 0.32);
  else if (height < 5.2) base = color(PALETTE.green);
  else if (height < 7.8) base = color(PALETTE.greenDark);
  else base = color(PALETTE.rock);
  if (slope > 2.2) base = color(PALETTE.rock);

  const hill = LANDMARK_BY_ID.get("bukit");
  if (hill) {
    const distance = Math.hypot(x - hill.x, z - hill.z);
    if (distance < hill.pad * 1.12) {
      base = color(PALETTE.sand).clone().lerp(color(PALETTE.greenDark), smoothstep(5.5, hill.pad * 1.05, distance));
    }
  }

  return base.clone().offsetHSL(0, 0, variation * 0.055);
}

function pushTriangle(positions, colors, a, b, c, faceColor) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < 3; i += 1) colors.push(faceColor.r, faceColor.g, faceColor.b);
}

function pushQuad(positions, colors, a, b, c, d, faceColor) {
  pushTriangle(positions, colors, a, c, b, faceColor);
  pushTriangle(positions, colors, b, c, d, faceColor);
}

function buildTerrain(cx, cz, positions, colors) {
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const heights = new Float32Array((CHUNK_SEGMENTS + 1) * (CHUNK_SEGMENTS + 1));

  for (let iz = 0; iz <= CHUNK_SEGMENTS; iz += 1) {
    for (let ix = 0; ix <= CHUNK_SEGMENTS; ix += 1) {
      const x = originX + ix * CELL_SIZE;
      const z = originZ + iz * CELL_SIZE;
      heights[iz * (CHUNK_SEGMENTS + 1) + ix] = heightAt(x, z);
    }
  }

  const sample = (ix, iz) => heights[iz * (CHUNK_SEGMENTS + 1) + ix];

  for (let iz = 0; iz < CHUNK_SEGMENTS; iz += 1) {
    for (let ix = 0; ix < CHUNK_SEGMENTS; ix += 1) {
      const h00 = sample(ix, iz);
      const h10 = sample(ix + 1, iz);
      const h01 = sample(ix, iz + 1);
      const h11 = sample(ix + 1, iz + 1);
      if (Math.max(h00, h10, h01, h11) < -0.75) continue;

      const x0 = originX + ix * CELL_SIZE;
      const z0 = originZ + iz * CELL_SIZE;
      const x1 = x0 + CELL_SIZE;
      const z1 = z0 + CELL_SIZE;
      const average = (h00 + h10 + h01 + h11) * 0.25;
      const slope = Math.max(h00, h10, h01, h11) - Math.min(h00, h10, h01, h11);
      const faceColor = terrainColor(average, slope, x0, z0);

      const a = { x: x0, y: h00, z: z0 };
      const b = { x: x1, y: h10, z: z0 };
      const c = { x: x0, y: h01, z: z1 };
      const d = { x: x1, y: h11, z: z1 };

      pushTriangle(positions, colors, a, c, b, faceColor);
      pushTriangle(positions, colors, b, c, d, faceColor);
    }
  }

  for (const segment of ROAD_SEGMENTS) {
    const mx = (segment.ax + segment.bx) * 0.5;
    const mz = (segment.az + segment.bz) * 0.5;
    if (mx < originX - 2 || mx > originX + CHUNK_SIZE + 2) continue;
    if (mz < originZ - 2 || mz > originZ + CHUNK_SIZE + 2) continue;

    const dx = segment.bx - segment.ax;
    const dz = segment.bz - segment.az;
    const length = Math.hypot(dx, dz) || 1;
    const px = (-dz / length) * 1.35;
    const pz = (dx / length) * 1.35;

    const lx0 = segment.ax + px;
    const lz0 = segment.az + pz;
    const rx0 = segment.ax - px;
    const rz0 = segment.az - pz;
    const lx1 = segment.bx + px;
    const lz1 = segment.bz + pz;
    const rx1 = segment.bx - px;
    const rz1 = segment.bz - pz;

    const hL0 = heightAt(lx0, lz0);
    const hR0 = heightAt(rx0, rz0);
    const hL1 = heightAt(lx1, lz1);
    const hR1 = heightAt(rx1, rz1);
    if (Math.min(hL0, hR0, hL1, hR1) < -0.35) continue;

    const yL0 = Math.max(hL0, heightAt(segment.ax, segment.az)) + 0.11;
    const yR0 = Math.max(hR0, heightAt(segment.ax, segment.az)) + 0.11;
    const yL1 = Math.max(hL1, heightAt(segment.bx, segment.bz)) + 0.11;
    const yR1 = Math.max(hR1, heightAt(segment.bx, segment.bz)) + 0.11;
    const roadColor = color(PALETTE.sand).clone().offsetHSL(0, -0.03, 0.025);

    pushQuad(
      positions,
      colors,
      { x: lx0, y: yL0, z: lz0 },
      { x: rx0, y: yR0, z: rz0 },
      { x: lx1, y: yL1, z: lz1 },
      { x: rx1, y: yR1, z: rz1 },
      roadColor,
    );
  }
}

function seedFor(cx, cz) {
  return ((cx * 374761393 + cz * 668265263) ^ 0x5f356495) >>> 0;
}

function placeCluster(propBatch, random, centerX, centerZ, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 3 + random() * 11;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    const height = heightAt(x, z);
    if (height < 0.55 || slopeAt(x, z) > 1.25) continue;
    if (isNearLandmark(x, z, 2) || distanceToRoad(x, z) < 2.4) continue;

    const placer = createPlacer(propBatch, {
      x,
      y: height,
      z,
      ry: random() * Math.PI * 2,
      sx: 0.8 + random() * 0.35,
      sy: 0.8 + random() * 0.35,
      sz: 0.8 + random() * 0.35,
    });
    const roll = random();
    if (roll < 0.56) addHouse(placer, { rng: random });
    else if (roll < 0.7) addWarung(placer, { rng: random });
    else if (roll < 0.8) addLumbung(placer, { rng: random });
    else if (roll < 0.9) addTree(placer, { rng: random });
    else addPaddy(placer, { rng: random });
  }
}

function buildProps(cx, cz, propBatch) {
  const random = mulberry32(seedFor(cx, cz));
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const centerX = originX + CHUNK_SIZE * 0.5;
  const centerZ = originZ + CHUNK_SIZE * 0.5;
  const centerHeight = heightAt(centerX, centerZ);
  const near = Math.hypot(centerX, centerZ) < 150;

  if (centerHeight < -0.7) {
    if (random() < 0.42) {
      const x = originX + 10 + random() * (CHUNK_SIZE - 20);
      const z = originZ + 10 + random() * (CHUNK_SIZE - 20);
      if (heightAt(x, z) < -0.8) {
        const placer = createPlacer(propBatch, {
          x,
          y: 0.02,
          z,
          ry: random() * Math.PI * 2,
          sx: 0.8 + random() * 0.4,
          sy: 0.8 + random() * 0.4,
          sz: 0.8 + random() * 0.4,
        });
        if (random() < 0.55) addBoat(placer, { rng: random });
        else addIslet(placer, { rng: random });
      }
    }
    return;
  }

  const clusters = near ? (random() < 0.82 ? 2 : 1) : random() < 0.36 ? 1 : 0;
  for (let i = 0; i < clusters; i += 1) {
    let centerTry = 0;
    while (centerTry < 8) {
      const x = originX + 12 + random() * (CHUNK_SIZE - 24);
      const z = originZ + 12 + random() * (CHUNK_SIZE - 24);
      if (heightAt(x, z) > 0.8 && slopeAt(x, z) < 1.5 && !isNearLandmark(x, z, 4)) {
        placeCluster(propBatch, random, x, z, near ? 4 + Math.floor(random() * 4) : 2 + Math.floor(random() * 3));
        break;
      }
      centerTry += 1;
    }
  }

  const attempts = near ? 14 : 7;
  for (let i = 0; i < attempts; i += 1) {
    const x = originX + 4 + random() * (CHUNK_SIZE - 8);
    const z = originZ + 4 + random() * (CHUNK_SIZE - 8);
    const height = heightAt(x, z);
    if (height < 0.55 || slopeAt(x, z) > 1.6) continue;
    if (isNearLandmark(x, z, 2) || distanceToRoad(x, z) < 2.2) continue;

    const placer = createPlacer(propBatch, {
      x,
      y: height,
      z,
      ry: random() * Math.PI * 2,
      sx: 0.85 + random() * 0.4,
      sy: 0.85 + random() * 0.4,
      sz: 0.85 + random() * 0.4,
    });
    const roll = random();
    if (height < 1.3 && roll < 0.18) addPaddy(placer, { rng: random });
    else if (roll < 0.33) addTree(placer, { rng: random });
    else if (roll < 0.45) addPalm(placer, { rng: random });
    else if (roll < 0.56) addRubber(placer, { rng: random });
    else if (roll < 0.64) addBush(placer, { rng: random });
    else if (roll < 0.72) addRock(placer, { rng: random });
    else if (roll < 0.8) addHouse(placer, { rng: random });
    else if (roll < 0.9) addPaddy(placer, { rng: random });
    else addWarung(placer, { rng: random });
  }
}

export function buildChunk(cx, cz) {
  const positions = [];
  const colors = [];
  buildTerrain(cx, cz, positions, colors);

  const propBatch = new GeometryBatch();
  buildProps(cx, cz, propBatch);
  const propGeometry = propBatch.toGeometry();

  let outlineGeometry = null;
  if (propGeometry) {
    outlineGeometry = new THREE.EdgesGeometry(propGeometry, 27);
  }

  let geometry = null;
  if (positions.length > 0) {
    const terrainGeometry = new THREE.BufferGeometry();
    terrainGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    terrainGeometry.computeVertexNormals();
    if (propGeometry) {
      geometry = mergeGeometries([terrainGeometry, propGeometry], false);
      terrainGeometry.dispose();
      propGeometry.dispose();
    } else {
      geometry = terrainGeometry;
    }
  } else if (propGeometry) {
    geometry = propGeometry;
  }

  if (geometry) geometry.computeBoundingSphere();
  return { geometry, outlineGeometry };
}
