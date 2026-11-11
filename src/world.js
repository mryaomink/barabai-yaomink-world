import * as THREE from "three";
import {
  GeometryBatch,
  clamp,
  fbm,
  hash2,
  lerp,
  makeSignTexture,
  mulberry32,
  smoothstep,
  disposeObject,
} from "./utils.js";

const ISLAND_RADIUS = 58;
const TOP_HEIGHT = 6.2;
const RIVER_WIDTH = 4.7;

const COLORS = {
  grassA: "#97bb75",
  grassB: "#7ca25f",
  grassC: "#b3c68a",
  lush: "#6d9957",
  riverBed: "#6e8260",
  sand: "#ead4a2",
  meadow: "#b3a579",
  stone: "#d9cbae",
  stoneDark: "#bfae8d",
  wallCream: "#f3e4c8",
  wallWarm: "#ecd3ae",
  wood: "#8a5f43",
  woodDark: "#5f4335",
  roofTerracotta: "#c46f50",
  roofTeal: "#4f8981",
  roofPlum: "#7c5b6e",
  roofBrown: "#7b5844",
  gold: "#e8b862",
  goldDeep: "#c9924b",
  teal: "#3f7976",
  glow: "#ffd18d",
  pine: "#5e8753",
};

function createRiver(seed) {
  const random = mulberry32(seed);

  const coast = (angle) => {
    const n = fbm(Math.cos(angle) * 1.45 + 7.1, Math.sin(angle) * 1.45 - 3.8, 3);
    return ISLAND_RADIUS * (0.9 + n * 0.14);
  };

  const startAngle = Math.atan2(-35, 39);
  const startRadius = coast(startAngle) * 0.94;
  const endAngle = Math.atan2(47, 33);
  const endRadius = coast(endAngle) * 0.994;

  const points = [
    new THREE.Vector3(Math.cos(startAngle) * startRadius, 0, Math.sin(startAngle) * startRadius),
    new THREE.Vector3(32, 0, -23),
    new THREE.Vector3(28, 0, -10),
    new THREE.Vector3(26.2, 0, 2),
    new THREE.Vector3(26.8, 0, 14),
    new THREE.Vector3(28.8, 0, 27),
    new THREE.Vector3(Math.cos(endAngle) * endRadius, 0, Math.sin(endAngle) * endRadius),
  ];

  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.36);
  const samples = curve.getPoints(78);
  const distance = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < samples.length - 1; i += 1) {
      const a = samples[i];
      const b = samples[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lengthSq = abx * abx + abz * abz;
      let t = 0;
      if (lengthSq > 0) {
        t = clamp(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0, 1);
      }
      const dx = x - (a.x + abx * t);
      const dz = z - (a.z + abz * t);
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };

  void random;
  return { coast, samples, distance };
}

export function createWorld() {
  const random = mulberry32(0x5a7ab41);
  const group = new THREE.Group();
  group.name = "barabai-world";

  const staticBatch = new GeometryBatch();
  const glowBatch = new GeometryBatch();
  const clothBatch = new GeometryBatch();
  const waterMaterials = [];
  const pathSamples = [];
  const houseSpots = [];

  const river = createRiver(0xba7ab41);
  const coastlineRadius = river.coast;

  const flatSpots = [
    { x: 0, z: 6, r: 12.6, feather: 4, h: 6.25 },
    { x: -2, z: -18.5, r: 12.4, feather: 4, h: 6.75 },
    { x: 37, z: -4, r: 7.2, feather: 2.4, h: 5.9 },
    { x: -26, z: -2, r: 15, feather: 4.4, h: 6.35 },
    { x: 0, z: 38, r: 8.4, feather: 2.8, h: 6.1 },
    { x: -33, z: 28, r: 9.5, feather: 3, h: 5.8 },
  ];

  function heightAt(x, z) {
    const angle = Math.atan2(z, x);
    const coast = coastlineRadius(angle);
    const radius = Math.hypot(x, z);
    const rn = radius / coast;

    let height = TOP_HEIGHT + 0.78 * (1 - Math.min(rn * rn, 1));
    height += 8.8 * Math.exp(-((x + 20) ** 2 / (2 * 9.4 ** 2) + (z + 31) ** 2 / (2 * 8.6 ** 2)));
    height += 2.5 * Math.exp(-((x - 18) ** 2 / (2 * 8.5 ** 2) + (z + 34) ** 2 / (2 * 8 ** 2)));
    height += 1.8 * Math.exp(-((x + 42) ** 2 / (2 * 8 ** 2) + (z + 7) ** 2 / (2 * 9 ** 2)));
    height += 1.2 * Math.exp(-((x - 40) ** 2 / (2 * 9 ** 2) + (z - 22) ** 2 / (2 * 9 ** 2)));
    height += (fbm(x * 0.055 + 2.1, z * 0.055 - 1.3, 3) - 0.5) * 1.9;
    height -= smoothstep(0.86, 1.0, rn) * 3.8;

    const riverDistance = river.distance(x, z);
    height -= (1 - smoothstep(RIVER_WIDTH * 0.55, RIVER_WIDTH * 1.9, riverDistance)) * 2.05;

    for (const spot of flatSpots) {
      const distance = Math.hypot(x - spot.x, z - spot.z);
      const influence = 1 - smoothstep(spot.r, spot.r + spot.feather, distance);
      if (influence > 0) height = lerp(height, spot.h, influence);
    }

    return height;
  }

  const nearestSample = (targetZ) => {
    let best = river.samples[0];
    let bestDistance = Infinity;
    for (const sample of river.samples) {
      const d = Math.abs(sample.z - targetZ);
      if (d < bestDistance) {
        bestDistance = d;
        best = sample;
      }
    }
    return best;
  };

  const bridgeCenter = nearestSample(-2);
  const dockCenter = nearestSample(17);
  const bridgeHalf = 4.5;
  const bridgeWest = bridgeCenter.x - bridgeHalf;
  const bridgeEast = bridgeCenter.x + bridgeHalf;

  const landmarkExclusions = [
    { x: 0, z: 6, r: 15 },
    { x: -2, z: -18.5, r: 16.5 },
    { x: 37, z: -4, r: 12.5 },
    { x: -26, z: -2, r: 18.5 },
    { x: 0, z: 38, r: 11 },
    { x: -33, z: 28, r: 12 },
    { x: bridgeCenter.x, z: -2, r: 7.5 },
    { x: dockCenter.x + 3.2, z: 17, r: 7 },
    { x: -20, z: -31, r: 8 },
  ];

  // ---------------------------------------------------------------- terrain

  function buildIslandShape({
    batch,
    offset = [0, 0, 0],
    radius,
    coastFn,
    heightFn,
    topColorFn,
    bands,
    tipDrop,
    tipColor,
    segments = 88,
    rings = 26,
  }) {
    const [ox, oy, oz] = offset;
    const positions = [];
    const indices = [];

    positions.push(0, heightFn(0, 0), 0);
    for (let r = 1; r <= rings; r += 1) {
      const rn = r / rings;
      for (let s = 0; s < segments; s += 1) {
        const angle = (s / segments) * Math.PI * 2;
        const coast = coastFn(angle);
        const radiusAt = coast * rn;
        const x = Math.cos(angle) * radiusAt;
        const z = Math.sin(angle) * radiusAt;
        positions.push(x, heightFn(x, z), z);
      }
    }

    for (let s = 0; s < segments; s += 1) {
      const a = 1 + s;
      const b = 1 + ((s + 1) % segments);
      indices.push(0, b, a);
    }

    for (let r = 1; r < rings; r += 1) {
      const inner = 1 + (r - 1) * segments;
      const outer = 1 + r * segments;
      for (let s = 0; s < segments; s += 1) {
        const a = inner + s;
        const b = inner + ((s + 1) % segments);
        const c = outer + ((s + 1) % segments);
        const d = outer + s;
        indices.push(a, b, c, a, c, d);
      }
    }

    const topGeometry = new THREE.BufferGeometry();
    topGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    topGeometry.setIndex(indices);
    topGeometry.computeVertexNormals();

    batch.add(topGeometry, undefined, {
      x: ox,
      y: oy,
      z: oz,
      colorFn: (x, y, z) => topColorFn(x - ox, y - oy, z - oz),
    });

    const edgeHeights = [];
    const edgeRadii = [];
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * Math.PI * 2;
      const coast = coastFn(angle);
      const x = Math.cos(angle) * coast;
      const z = Math.sin(angle) * coast;
      edgeHeights.push(heightFn(x, z));
      edgeRadii.push(coast);
    }

    let previousRing = null;

    for (let b = 0; b < bands.length; b += 1) {
      const band = bands[b];
      const ringPositions = [];
      for (let s = 0; s < segments; s += 1) {
        const angle = (s / segments) * Math.PI * 2;
        const rib = 1 + (hash2(s * 1.73, b * 0.91) - 0.5) * 0.035;
        const radiusAt = edgeRadii[s] * band.scale * rib;
        ringPositions.push(
          Math.cos(angle) * radiusAt,
          edgeHeights[s] - band.drop,
          Math.sin(angle) * radiusAt,
        );
      }

      if (previousRing) {
        const strip = [];
        for (let s = 0; s < segments; s += 1) {
          const ns = (s + 1) % segments;
          const a = [previousRing[s * 3], previousRing[s * 3 + 1], previousRing[s * 3 + 2]];
          const bpt = [previousRing[ns * 3], previousRing[ns * 3 + 1], previousRing[ns * 3 + 2]];
          const c = [ringPositions[ns * 3], ringPositions[ns * 3 + 1], ringPositions[ns * 3 + 2]];
          const d = [ringPositions[s * 3], ringPositions[s * 3 + 1], ringPositions[s * 3 + 2]];
          strip.push(...a, ...bpt, ...c, ...a, ...c, ...d);
        }
        const stripGeometry = new THREE.BufferGeometry();
        stripGeometry.setAttribute("position", new THREE.Float32BufferAttribute(strip, 3));
        stripGeometry.computeVertexNormals();
        batch.add(stripGeometry, band.color, {
          x: ox,
          y: oy,
          z: oz,
          jitter: 0.07,
        });
      }

      previousRing = ringPositions;
    }

    if (previousRing) {
      const tip = [];
      for (let s = 0; s < segments; s += 1) {
        const ns = (s + 1) % segments;
        const a = [previousRing[s * 3], previousRing[s * 3 + 1], previousRing[s * 3 + 2]];
        const bpt = [previousRing[ns * 3], previousRing[ns * 3 + 1], previousRing[ns * 3 + 2]];
        tip.push(...a, ...bpt, 0, -tipDrop, 0);
      }
      const tipGeometry = new THREE.BufferGeometry();
      tipGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tip, 3));
      tipGeometry.computeVertexNormals();
      batch.add(tipGeometry, tipColor, { x: ox, y: oy, z: oz, jitter: 0.06 });
    }

    void radius;
  }

  const cliffBands = [
    { drop: 0.08, scale: 1.0, color: "#e3cda0" },
    { drop: 1.4, scale: 0.995, color: "#d4b080" },
    { drop: 3.2, scale: 0.975, color: "#c99c6b" },
    { drop: 5.4, scale: 0.94, color: "#b98a5d" },
    { drop: 8.1, scale: 0.89, color: "#a87852" },
    { drop: 11.3, scale: 0.83, color: "#94684a" },
    { drop: 14.9, scale: 0.74, color: "#815b43" },
    { drop: 18.8, scale: 0.62, color: "#6d4d3b" },
    { drop: 22.6, scale: 0.46, color: "#5b4135" },
    { drop: 26.0, scale: 0.27, color: "#4b352f" },
  ];

  const grassA = new THREE.Color(COLORS.grassA);
  const grassB = new THREE.Color(COLORS.grassB);
  const grassC = new THREE.Color(COLORS.grassC);
  const lush = new THREE.Color(COLORS.lush);
  const riverBedColor = new THREE.Color(COLORS.riverBed);
  const sandColor = new THREE.Color(COLORS.sand);
  const meadowColor = new THREE.Color(COLORS.meadow);

  function topColor(x, y, z) {
    const angle = Math.atan2(z, x);
    const coast = coastlineRadius(angle);
    const rn = Math.hypot(x, z) / coast;
    const riverDistance = river.distance(x, z);

    const color = grassA
      .clone()
      .lerp(grassB, fbm(x * 0.075 + 3.2, z * 0.075 - 1.7, 3));
    const light = smoothstep(0.42, 0.78, fbm(x * 0.22 - 2.2, z * 0.22 + 4.7, 2));
    color.lerp(grassC, light * 0.26);

    const high = smoothstep(10.5, 15.8, y);
    color.lerp(meadowColor, high * 0.55);

    const lushMix = 1 - smoothstep(RIVER_WIDTH * 0.7, RIVER_WIDTH * 1.85, riverDistance);
    color.lerp(lush, lushMix * 0.58);

    const bed = 1 - smoothstep(0.0, RIVER_WIDTH * 0.84, riverDistance);
    color.lerp(riverBedColor, bed * 0.9);

    const beach = smoothstep(0.875, 0.998, rn);
    color.lerp(sandColor, beach * 0.92);

    color.offsetHSL(0, 0, (fbm(x * 0.31 + 9.1, z * 0.31 - 5.2, 2) - 0.5) * 0.055);
    return color;
  }

  buildIslandShape({
    batch: staticBatch,
    radius: ISLAND_RADIUS,
    coastFn: coastlineRadius,
    heightFn: heightAt,
    topColorFn: topColor,
    bands: cliffBands,
    tipDrop: 29.2,
    tipColor: "#42302b",
    segments: 88,
    rings: 27,
  });

  // ---------------------------------------------------------------- far islands

  function addFarIsland({ x, z, y, radius, seed, peaks, bands, topColors, rings = 16 }) {
    const rng = mulberry32(seed);
    const coastFn = (angle) => {
      const n = fbm(Math.cos(angle) * 1.5 + seed * 1.7, Math.sin(angle) * 1.5 - seed, 3);
      return radius * (0.76 + n * 0.42);
    };
    const heightFn = (lx, lz) => {
      const angle = Math.atan2(lz, lx);
      const rn = Math.hypot(lx, lz) / coastFn(angle);
      let height = 1.6 + 2.8 * (1 - Math.min(rn * rn, 1));
      height += (fbm(lx * 0.06 + seed * 2.1, lz * 0.06 - seed, 2) - 0.5) * 2.3;
      for (const peak of peaks) {
        height +=
          peak.amp *
          Math.exp(
            -((lx - peak.x) ** 2 / (2 * peak.spread ** 2) + (lz - peak.z) ** 2 / (2 * peak.spread ** 2)),
          );
      }
      height -= smoothstep(0.84, 1.0, rn) * 2.4;
      return height;
    };

    const colorLow = new THREE.Color(topColors[0]);
    const colorHigh = new THREE.Color(topColors[1]);
    const colorRock = new THREE.Color(topColors[2]);

    buildIslandShape({
      batch: staticBatch,
      offset: [x, y, z],
      radius,
      coastFn,
      heightFn,
      segments: 34,
      rings,
      bands,
      tipDrop: 17 + radius * 0.24,
      tipColor: "#4b352f",
      topColorFn: (lx, ly, lz) => {
        const angle = Math.atan2(lz, lx);
        const rn = Math.hypot(lx, lz) / coastFn(angle);
        const color = colorLow
          .clone()
          .lerp(colorHigh, smoothstep(0, 17, ly) * 0.75)
          .lerp(colorRock, smoothstep(17, 31, ly) * 0.5);
        const edge = smoothstep(0.84, 1.0, rn);
        color.lerp(sandColor, edge * 0.48);
        color.offsetHSL(0, 0, (rng() - 0.5) * 0.045);
        return color;
      },
    });
  }

  addFarIsland({
    x: -138,
    z: -128,
    y: -8,
    radius: 40,
    seed: 1.7,
    rings: 18,
    peaks: [
      { x: -10, z: 4, amp: 7, spread: 10 },
      { x: 12, z: -7, amp: 11, spread: 8 },
    ],
    topColors: ["#71916c", "#8d9277", "#b4a38b"],
    bands: [
      { drop: 0.1, scale: 1, color: "#d3bb91" },
      { drop: 4, scale: 0.94, color: "#ac8560" },
      { drop: 10, scale: 0.77, color: "#83604a" },
      { drop: 16, scale: 0.47, color: "#594238" },
    ],
  });

  addFarIsland({
    x: 158,
    z: -102,
    y: -15,
    radius: 25,
    seed: 3.2,
    rings: 12,
    peaks: [{ x: 4, z: 3, amp: 8, spread: 7 }],
    topColors: ["#77926f", "#93947c", "#b3a58e"],
    bands: [
      { drop: 0.1, scale: 1, color: "#cbb38c" },
      { drop: 3.4, scale: 0.88, color: "#9c795a" },
      { drop: 10, scale: 0.5, color: "#5d463a" },
    ],
  });

  addFarIsland({
    x: 72,
    z: -218,
    y: -5,
    radius: 54,
    seed: 5.8,
    rings: 22,
    peaks: [
      { x: -20, z: 2, amp: 20, spread: 11 },
      { x: 1, z: -10, amp: 29, spread: 9 },
      { x: 20, z: 7, amp: 16, spread: 12 },
    ],
    topColors: ["#687f6b", "#8a8a7c", "#a99a8a"],
    bands: [
      { drop: 0.1, scale: 1, color: "#c6ad87" },
      { drop: 5, scale: 0.95, color: "#a07d5d" },
      { drop: 12, scale: 0.82, color: "#7e5d49" },
      { drop: 21, scale: 0.55, color: "#564238" },
    ],
  });

  addFarIsland({
    x: -196,
    z: 62,
    y: -19,
    radius: 26,
    seed: 8.4,
    rings: 12,
    peaks: [{ x: 1, z: -2, amp: 7, spread: 7 }],
    topColors: ["#78906f", "#96927c", "#b3a38e"],
    bands: [
      { drop: 0.1, scale: 1, color: "#c9b08a" },
      { drop: 4.5, scale: 0.88, color: "#946f54" },
      { drop: 12, scale: 0.45, color: "#584136" },
    ],
  });

  // ---------------------------------------------------------------- paths

  function addRibbon(points, width, color) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "catmullrom",
      0.24,
    );
    const steps = Math.max(12, points.length * 10);
    const samples = curve.getPoints(steps);
    const positions = [];
    const indices = [];

    for (let i = 0; i <= steps; i += 1) {
      const point = samples[i];
      const previous = samples[Math.max(i - 1, 0)];
      const next = samples[Math.min(i + 1, steps)];
      const tx = next.x - previous.x;
      const tz = next.z - previous.z;
      const length = Math.hypot(tx, tz) || 1;
      const nx = -tz / length;
      const nz = tx / length;
      const y = heightAt(point.x, point.z) + 0.085;
      positions.push(
        point.x + nx * width * 0.5,
        y,
        point.z + nz * width * 0.5,
        point.x - nx * width * 0.5,
        y,
        point.z - nz * width * 0.5,
      );
      pathSamples.push({ x: point.x, z: point.z, width });
      if (i < steps) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    staticBatch.add(geometry, color, { jitter: 0.035 });
  }

  addRibbon(
    [
      [0, 44],
      [0, 35.5],
      [0.1, 29],
      [0, 21],
      [0, 16],
    ],
    2.7,
    "#e8d5a8",
  );
  addRibbon(
    [
      [0, -4.5],
      [-0.8, -8],
      [-1.6, -12],
      [-2, -15],
    ],
    2.4,
    "#e6d1a2",
  );
  addRibbon(
    [
      [-7, 3],
      [-12, 1],
      [-17, 0],
      [-21, 0],
    ],
    2.2,
    "#e8d5a8",
  );
  addRibbon(
    [
      [8.5, 4],
      [13, 2],
      [17, 0],
      [20.8, -2],
    ],
    2.3,
    "#e6d2a4",
  );
  addRibbon(
    [
      [bridgeEast, -2],
      [32, -2.6],
      [32.8, -3.6],
    ],
    2.2,
    "#e6d2a4",
  );
  addRibbon(
    [
      [35.5, 1],
      [37, 6],
      [36.5, 11],
      [34.5, 14.5],
    ],
    1.9,
    "#d9c295",
  );
  addRibbon(
    [
      [-27, -8],
      [-25, -14],
      [-23, -20],
      [-20.5, -25.5],
    ],
    1.8,
    "#d8c397",
  );
  addRibbon(
    [
      [-5, 34],
      [-13, 32],
      [-21, 30],
      [-27.5, 29],
    ],
    1.6,
    "#cdb78b",
  );
  addRibbon(
    [
      [37, 0],
      [40, 6],
      [42, 9],
    ],
    1.5,
    "#d9c295",
  );

  // ---------------------------------------------------------------- plaza

  const plazaX = 0;
  const plazaZ = 6;
  const plazaGround = 6.25;

  staticBatch.circle(10.8, 48, "#e6d3aa", {
    x: plazaX,
    y: plazaGround + 0.025,
    z: plazaZ,
    rx: -Math.PI / 2,
    jitter: 0.02,
  });
  staticBatch.ring(10.8, 11.35, 56, "#c8b68e", {
    x: plazaX,
    y: plazaGround + 0.03,
    z: plazaZ,
    rx: -Math.PI / 2,
  });
  staticBatch.ring(4.15, 4.45, 40, "#c2a66e", {
    x: plazaX,
    y: plazaGround + 0.04,
    z: plazaZ,
    rx: -Math.PI / 2,
  });
  staticBatch.circle(1.2, 20, "#d9bd83", {
    x: plazaX,
    y: plazaGround + 0.045,
    z: plazaZ,
    rx: -Math.PI / 2,
  });

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    staticBatch.box(0.9, 0.18, 0.36, "#d3bf94", {
      x: plazaX + Math.cos(angle) * 9,
      y: plazaGround + 0.12,
      z: plazaZ + Math.sin(angle) * 9,
      ry: -angle,
    });
  }

  for (const [x, z] of [
    [-8, 0],
    [8, 0],
    [-8, 12],
    [8, 12],
  ]) {
    addLamp(plazaX + x, plazaZ + z, plazaGround, 4.2);
  }

  addBench(-6.6, plazaZ + 8.2, plazaGround, Math.PI * 0.1);
  addBench(6.6, plazaZ + 8.2, plazaGround, -Math.PI * 0.1);
  addBench(-9.2, plazaZ - 4.5, plazaGround, Math.PI * 0.5);
  addBench(9.2, plazaZ - 4.5, plazaGround, -Math.PI * 0.5);

  staticBatch.cylinder(0.2, 0.32, 12.4, 6, "#6e5847", {
    x: plazaX + 5.2,
    y: plazaGround + 6.2,
    z: plazaZ,
  });
  staticBatch.cylinder(1.1, 1.2, 0.28, 8, "#c7b28b", {
    x: plazaX + 5.2,
    y: plazaGround + 0.14,
    z: plazaZ,
  });
  staticBatch.ico(0.24, 0, COLORS.gold, {
    x: plazaX + 5.2,
    y: plazaGround + 12.5,
    z: plazaZ,
  });
  staticBatch.box(1.7, 0.48, 0.055, "#c84e48", {
    x: plazaX + 5.2 + 0.9,
    y: plazaGround + 11.95,
    z: plazaZ,
    jitter: 0.02,
  });
  staticBatch.box(1.7, 0.48, 0.055, "#f2e8d2", {
    x: plazaX + 5.2 + 0.9,
    y: plazaGround + 11.47,
    z: plazaZ,
    jitter: 0.02,
  });

  addFlowerPatch(-10.6, 16.2, plazaGround + 0.1, 7);
  addFlowerPatch(10.4, 16.3, plazaGround + 0.1, 7);
  addFlowerPatch(11.3, -0.8, plazaGround + 0.1, 6);

  // ---------------------------------------------------------------- mosque

  const mosqueX = -2;
  const mosqueZ = -18.5;
  const mosqueGround = 6.75;
  const mosqueFront = mosqueZ + 8;

  staticBatch.box(19.5, 0.35, 17.5, "#d3c3a1", {
    x: mosqueX,
    y: mosqueGround + 0.17,
    z: mosqueZ + 1.2,
    jitter: 0.015,
  });
  staticBatch.box(20.3, 0.16, 18.3, "#beab88", {
    x: mosqueX,
    y: mosqueGround + 0.3,
    z: mosqueZ + 1.2,
  });

  for (let i = 0; i < 3; i += 1) {
    staticBatch.box(4.2 - i * 0.5, 0.22, 0.8, "#cbb995", {
      x: mosqueX,
      y: mosqueGround + 0.12 + i * 0.2,
      z: mosqueFront + 2.4 + i * 0.75,
    });
  }

  const bodyY = mosqueGround + 0.42;
  const bodyWidth = 9.6;
  const bodyHeight = 5.8;
  const bodyDepth = 9.6;

  staticBatch.box(bodyWidth + 0.5, 0.55, bodyDepth + 0.5, "#cbb792", {
    x: mosqueX,
    y: bodyY + 0.28,
    z: mosqueZ,
  });
  staticBatch.box(bodyWidth, bodyHeight, bodyDepth, COLORS.wallCream, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight / 2,
    z: mosqueZ,
    jitter: 0.015,
  });
  staticBatch.box(bodyWidth + 0.24, 0.32, bodyDepth + 0.24, COLORS.gold, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight,
    z: mosqueZ,
  });

  for (const side of [-1, 1]) {
    staticBatch.box(0.36, bodyHeight, 0.36, "#e6d4b3", {
      x: mosqueX + side * (bodyWidth / 2 + 0.02),
      y: bodyY + 0.55 + bodyHeight / 2,
      z: mosqueZ + bodyDepth / 2 - 0.15,
    });
    staticBatch.box(0.36, bodyHeight, 0.36, "#e6d4b3", {
      x: mosqueX + side * (bodyWidth / 2 + 0.02),
      y: bodyY + 0.55 + bodyHeight / 2,
      z: mosqueZ - bodyDepth / 2 + 0.15,
    });
  }

  staticBatch.arch(2.5, 3.6, 0.14, COLORS.gold, {
    x: mosqueX,
    y: bodyY + 0.55,
    z: mosqueZ + bodyDepth / 2 + 0.02,
  });
  staticBatch.arch(2.06, 3.2, 0.16, "#366b69", {
    x: mosqueX,
    y: bodyY + 0.55,
    z: mosqueZ + bodyDepth / 2 + 0.14,
  });

  for (const side of [-1, 1]) {
    const windowX = mosqueX + side * 2.75;
    staticBatch.arch(1.25, 2.25, 0.12, COLORS.goldDeep, {
      x: windowX,
      y: bodyY + 2.5,
      z: mosqueZ + bodyDepth / 2 + 0.04,
    });
    staticBatch.arch(0.94, 1.95, 0.13, "#3f7370", {
      x: windowX,
      y: bodyY + 2.6,
      z: mosqueZ + bodyDepth / 2 + 0.13,
    });
    glowBatch.box(0.64, 1.2, 0.06, "#f7cd83", {
      x: windowX,
      y: bodyY + 3.2,
      z: mosqueZ + bodyDepth / 2 + 0.24,
    });

    staticBatch.box(0.75, 1.7, 0.2, COLORS.gold, {
      x: mosqueX + side * (bodyWidth / 2 + 0.04),
      y: bodyY + 2.5,
      z: mosqueZ + 1.8,
    });
    staticBatch.box(0.55, 1.4, 0.18, "#3c706d", {
      x: mosqueX + side * (bodyWidth / 2 + 0.15),
      y: bodyY + 2.5,
      z: mosqueZ + 1.8,
    });
  }

  staticBatch.cylinder(4.7, 4.7, 1.3, 16, "#ddc59a", {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight + 0.65,
    z: mosqueZ,
  });
  staticBatch.dome(4.8, 20, 10, COLORS.gold, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight + 1.25,
    z: mosqueZ,
    sy: 0.82,
  });
  staticBatch.cylinder(0.55, 0.9, 0.28, 8, COLORS.goldDeep, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight + 4.75,
    z: mosqueZ,
  });
  staticBatch.cone(0.32, 1.0, 6, COLORS.gold, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight + 5.3,
    z: mosqueZ,
  });
  staticBatch.torus(0.5, 0.1, 5, 12, COLORS.gold, {
    x: mosqueX,
    y: bodyY + 0.55 + bodyHeight + 6.0,
    z: mosqueZ,
    rz: -0.4,
  });

  for (const side of [-1, 1]) {
    staticBatch.cylinder(1.85, 1.95, 0.8, 12, "#e0c99f", {
      x: mosqueX + side * 3.35,
      y: bodyY + 0.55 + bodyHeight + 0.4,
      z: mosqueZ + 2.5,
    });
    staticBatch.dome(1.9, 12, 7, COLORS.gold, {
      x: mosqueX + side * 3.35,
      y: bodyY + 0.55 + bodyHeight + 0.8,
      z: mosqueZ + 2.5,
      sy: 0.85,
    });
  }

  // minaret
  const minaretX = mosqueX + 7.1;
  const minaretZ = mosqueZ + 5.1;
  staticBatch.box(2.7, 0.7, 2.7, "#cbb792", {
    x: minaretX,
    y: mosqueGround + 0.35,
    z: minaretZ,
  });
  staticBatch.cylinder(1.2, 1.34, 9.8, 8, COLORS.wallCream, {
    x: minaretX,
    y: mosqueGround + 0.7 + 4.9,
    z: minaretZ,
    jitter: 0.018,
  });
  for (const [height, radius] of [
    [4.1, 1.42],
    [7.2, 1.36],
    [9.65, 1.5],
  ]) {
    staticBatch.cylinder(radius, radius, 0.25, 8, COLORS.gold, {
      x: minaretX,
      y: mosqueGround + 0.7 + height,
      z: minaretZ,
    });
  }
  staticBatch.cylinder(1.55, 1.4, 0.55, 8, "#e1caa2", {
    x: minaretX,
    y: mosqueGround + 10.75,
    z: minaretZ,
  });
  staticBatch.dome(1.5, 12, 7, COLORS.gold, {
    x: minaretX,
    y: mosqueGround + 11.0,
    z: minaretZ,
    sy: 0.88,
  });
  staticBatch.cone(0.25, 1.5, 5, COLORS.gold, {
    x: minaretX,
    y: mosqueGround + 12.7,
    z: minaretZ,
  });
  staticBatch.torus(0.42, 0.08, 5, 10, COLORS.gold, {
    x: minaretX,
    y: mosqueGround + 13.55,
    z: minaretZ,
    rz: -0.35,
  });
  glowBatch.box(0.34, 0.55, 0.22, "#ffd38d", {
    x: minaretX,
    y: mosqueGround + 8.4,
    z: minaretZ + 1.34,
  });

  for (let i = 0; i < 4; i += 1) {
    const side = i < 2 ? -1 : 1;
    const offset = i % 2 === 0 ? -5.2 : 5.2;
    addLamp(mosqueX + side * 8.2, mosqueZ + 3.4 + offset * 0.5, mosqueGround + 0.1, 3.8);
  }

  addFlagLine(
    new THREE.Vector3(mosqueX - 8.5, mosqueGround + 4.2, mosqueZ + 8.2),
    new THREE.Vector3(mosqueX + 8.5, mosqueGround + 4.2, mosqueZ + 8.2),
    11,
  );

  // ---------------------------------------------------------------- market

  const marketX = 37;
  const marketZ = -4;
  const marketGround = 5.9;

  staticBatch.box(13.5, 0.3, 11.2, "#cab48d", {
    x: marketX,
    y: marketGround + 0.15,
    z: marketZ,
    jitter: 0.02,
  });
  staticBatch.box(13.9, 0.16, 11.6, "#ad9370", {
    x: marketX,
    y: marketGround + 0.04,
    z: marketZ,
  });

  const stalls = [
    { x: -4.1, z: -3.1, color: COLORS.roofTerracotta, ry: 0.1 },
    { x: 0.4, z: -3.4, color: COLORS.roofPlum, ry: -0.06 },
    { x: 4.7, z: -3.0, color: COLORS.roofTeal, ry: 0.05 },
    { x: -2.7, z: 3.2, color: COLORS.roofTeal, ry: -0.08 },
    { x: 2.1, z: 3.4, color: COLORS.roofTerracotta, ry: 0.08 },
  ];

  for (const stall of stalls) {
    const x = marketX + stall.x;
    const z = marketZ + stall.z;
    const y = marketGround + 0.3;
    staticBatch.box(3.6, 0.2, 2.5, "#8e6a4b", { x, y, z, ry: stall.ry });
    for (const [dx, dz] of [
      [-1.5, -1],
      [1.5, -1],
      [-1.5, 1],
      [1.5, 1],
    ]) {
      const wx = x + dx * Math.cos(stall.ry) + dz * Math.sin(stall.ry);
      const wz = z - dx * Math.sin(stall.ry) + dz * Math.cos(stall.ry);
      staticBatch.cylinder(0.08, 0.1, 2.3, 4, "#6b4c38", { x: wx, y: y + 1.15, z: wz });
    }
    addHipRoof(staticBatch, 4.3, 3.1, 0.85, stall.color, {
      x,
      y: y + 2.3,
      z,
      ry: stall.ry,
      jitter: 0.02,
    });
    staticBatch.box(4.0, 0.12, 2.8, "#70513d", { x, y: y + 2.25, z, ry: stall.ry });

    staticBatch.box(3.0, 0.75, 0.9, "#9d714d", { x, y: y + 0.48, z: z + 0.8, ry: stall.ry });
    staticBatch.box(2.7, 0.12, 0.8, "#b98d62", { x, y: y + 0.92, z: z + 0.8, ry: stall.ry });

    for (let i = 0; i < 4; i += 1) {
      const px = x + (i - 1.5) * 0.55;
      const pz = z + 0.8;
      const produceColors = ["#d98a45", "#91a756", "#d3aa58", "#c7654f"];
      staticBatch.ico(0.14, 0, produceColors[i], {
        x: px,
        y: y + 1.06,
        z: pz,
      });
    }

    for (let i = 0; i < 5; i += 1) {
      staticBatch.cylinder(0.24, 0.24, 0.06, 8, i === 4 ? "#d8b57b" : "#f1ddaf", {
        x: x - 0.7 + i * 0.32,
        y: y + 1.02 + i * 0.055,
        z: z + 0.8,
        rx: 0.05,
      });
    }
  }

  staticBatch.cylinder(0.1, 0.12, 3.4, 5, "#5d483a", {
    x: marketX - 6.1,
    y: marketGround + 1.95,
    z: marketZ + 5,
  });
  staticBatch.cylinder(0.1, 0.12, 3.4, 5, "#5d483a", {
    x: marketX + 6.1,
    y: marketGround + 1.95,
    z: marketZ + 5,
  });
  addStringLights(
    new THREE.Vector3(marketX - 6.1, marketGround + 3.5, marketZ + 5),
    new THREE.Vector3(marketX + 6.1, marketGround + 3.5, marketZ + 5),
    13,
    0.65,
  );
  addFlagLine(
    new THREE.Vector3(marketX - 6.1, marketGround + 3.6, marketZ + 4.95),
    new THREE.Vector3(marketX + 6.1, marketGround + 3.6, marketZ + 4.95),
    10,
  );

  addLamp(marketX - 6.5, marketZ - 1, marketGround + 0.25, 3.6);
  addLamp(marketX + 6.7, marketZ + 1.5, marketGround + 0.25, 3.6);
  addFlowerPatch(marketX - 6.8, marketZ + 6.2, marketGround + 0.1, 5);

  // ---------------------------------------------------------------- gate

  const gateX = 0;
  const gateZ = 38;
  const gateGround = 6.1;

  for (const side of [-1, 1]) {
    const x = gateX + side * 5.1;
    staticBatch.box(2.4, 0.7, 2.4, "#bda67f", {
      x,
      y: gateGround + 0.35,
      z: gateZ,
    });
    staticBatch.box(1.55, 5.6, 1.55, COLORS.wallCream, {
      x,
      y: gateGround + 0.7 + 2.8,
      z: gateZ,
      jitter: 0.02,
    });
    staticBatch.box(1.8, 0.28, 1.8, COLORS.gold, {
      x,
      y: gateGround + 0.72 + 5.6,
      z: gateZ,
    });
    staticBatch.box(1.76, 0.22, 1.76, COLORS.goldDeep, {
      x,
      y: gateGround + 3.1,
      z: gateZ,
    });
    addLamp(x, gateZ + 1.25, gateGround + 3.8, 2.1);
  }

  staticBatch.box(12.3, 0.7, 2.1, "#e2d0ad", {
    x: gateX,
    y: gateGround + 6.7,
    z: gateZ,
  });
  staticBatch.box(12.8, 0.18, 2.5, COLORS.gold, {
    x: gateX,
    y: gateGround + 7.1,
    z: gateZ,
  });
  addHipRoof(staticBatch, 14.5, 3.3, 1.0, COLORS.roofTerracotta, {
    x: gateX,
    y: gateGround + 7.2,
    z: gateZ,
  });
  addHipRoof(staticBatch, 10.8, 2.7, 0.85, COLORS.roofBrown, {
    x: gateX,
    y: gateGround + 8.05,
    z: gateZ,
  });
  addHipRoof(staticBatch, 7.0, 2.1, 0.7, COLORS.roofTerracotta, {
    x: gateX,
    y: gateGround + 8.75,
    z: gateZ,
  });
  staticBatch.ico(0.3, 0, COLORS.gold, {
    x: gateX,
    y: gateGround + 9.8,
    z: gateZ,
  });

  const signTexture = makeSignTexture("BARABAI", "YAOMINK WORLD");
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 2.78),
    new THREE.MeshBasicMaterial({ map: signTexture, toneMapped: true }),
  );
  sign.position.set(gateX, gateGround + 5.8, gateZ + 1.16);
  group.add(sign);

  addFlagLine(
    new THREE.Vector3(gateX - 5.1, gateGround + 7.25, gateZ + 1.1),
    new THREE.Vector3(gateX + 5.1, gateGround + 7.25, gateZ + 1.1),
    9,
  );

  // ---------------------------------------------------------------- park

  const parkX = -26;
  const parkZ = -2;
  const parkGround = 6.35;

  staticBatch.circle(1, 42, "#84ab67", {
    x: parkX,
    y: parkGround + 0.06,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 10.2,
    sy: 6.55,
  });
  staticBatch.ring(0.785, 1.0, 56, "#c2705a", {
    x: parkX,
    y: parkGround + 0.075,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 13.4,
    sy: 8.9,
  });
  staticBatch.ring(0.76, 0.79, 56, "#f0e2c4", {
    x: parkX,
    y: parkGround + 0.085,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 13.4,
    sy: 8.9,
  });
  staticBatch.ring(1.0, 1.035, 56, "#f0e2c4", {
    x: parkX,
    y: parkGround + 0.085,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 13.4,
    sy: 8.9,
  });
  staticBatch.ring(0.9, 0.908, 56, "#e5cfad", {
    x: parkX,
    y: parkGround + 0.09,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 13.4,
    sy: 8.9,
  });
  staticBatch.ring(0.855, 0.863, 56, "#e5cfad", {
    x: parkX,
    y: parkGround + 0.09,
    z: parkZ,
    rx: -Math.PI / 2,
    sx: 13.4,
    sy: 8.9,
  });

  staticBatch.cylinder(2.3, 2.5, 0.55, 12, "#c7b48d", {
    x: parkX,
    y: parkGround + 0.28,
    z: parkZ,
  });
  staticBatch.circle(2.05, 24, "#7dc4b9", {
    x: parkX,
    y: parkGround + 0.57,
    z: parkZ,
    rx: -Math.PI / 2,
  });
  staticBatch.cylinder(0.4, 0.6, 1.1, 8, "#b9a67e", {
    x: parkX,
    y: parkGround + 1.05,
    z: parkZ,
  });
  staticBatch.ico(0.32, 1, "#f1d9a5", {
    x: parkX,
    y: parkGround + 1.75,
    z: parkZ,
  });

  for (const [x, z, rot] of [
    [parkX - 10.8, parkZ + 2.2, 0.2],
    [parkX + 10.8, parkZ - 1.8, -0.2],
    [parkX - 4.6, parkZ + 9.3, Math.PI],
    [parkX + 6.2, parkZ - 9.4, 0],
  ]) {
    addBench(x, z, parkGround + 0.05, rot);
  }

  for (const [x, z] of [
    [parkX - 12.7, parkZ - 6.6],
    [parkX + 13.3, parkZ + 5.3],
  ]) {
    addLamp(x, z, parkGround + 0.05, 3.9);
  }

  addFlagLine(
    new THREE.Vector3(parkX - 9, parkGround + 4, parkZ + 5.5),
    new THREE.Vector3(parkX + 9, parkGround + 4, parkZ + 5.5),
    9,
  );

  // ---------------------------------------------------------------- paddy fields

  const paddyX = -33;
  const paddyZ = 28;
  const paddyGround = 5.8;
  const paddies = [
    { x: -2.2, z: -2.2, w: 7.2, d: 4.6, color: "#7fa85f", lift: 0.08 },
    { x: 3.1, z: -2.1, w: 4.8, d: 4.4, color: "#8eb56a", lift: 0.16 },
    { x: -1.2, z: 2.9, w: 9.4, d: 4.2, color: "#739d59", lift: 0.12 },
  ];
  for (const paddy of paddies) {
    const x = paddyX + paddy.x;
    const z = paddyZ + paddy.z;
    const y = paddyGround + paddy.lift;
    staticBatch.box(paddy.w, 0.22, paddy.d, paddy.color, {
      x,
      y,
      z,
      jitter: 0.035,
    });
    staticBatch.box(paddy.w + 0.35, 0.4, 0.17, "#a58f69", { x, y: y + 0.18, z: z - paddy.d / 2 });
    staticBatch.box(paddy.w + 0.35, 0.4, 0.17, "#a58f69", { x, y: y + 0.18, z: z + paddy.d / 2 });
    staticBatch.box(0.17, 0.4, paddy.d + 0.35, "#a58f69", { x: x - paddy.w / 2, y: y + 0.18, z });
    staticBatch.box(0.17, 0.4, paddy.d + 0.35, "#a58f69", { x: x + paddy.w / 2, y: y + 0.18, z });
    for (let row = -1; row <= 1; row += 1) {
      staticBatch.box(paddy.w * 0.82, 0.04, 0.1, "#5f8749", {
        x,
        y: y + 0.12,
        z: z + row * (paddy.d * 0.22),
      });
    }
  }
  addHut(paddyX + 7, paddyZ + 3.8, paddyGround + 0.25, -0.35);
  addFlowerPatch(paddyX - 8.3, paddyZ - 3.6, paddyGround + 0.1, 4);

  // ---------------------------------------------------------------- bridge

  const bridgeDeckY =
    Math.max(
      heightAt(bridgeWest, -2),
      heightAt(bridgeEast, -2),
    ) + 0.32;
  const bridgePlanks = 8;
  const bridgeSpan = bridgeEast - bridgeWest;

  for (let i = 0; i < bridgePlanks; i += 1) {
    const t = i / (bridgePlanks - 1);
    const x = lerp(bridgeWest, bridgeEast, t);
    const y = bridgeDeckY + Math.sin(t * Math.PI) * 0.48;
    staticBatch.box(bridgeSpan / bridgePlanks + 0.08, 0.18, 3.2, i % 2 ? "#9b714a" : "#a87b51", {
      x,
      y,
      z: -2,
      jitter: 0.03,
    });
  }

  for (const side of [-1, 1]) {
    const z = -2 + side * 1.48;
    for (let i = 0; i <= 7; i += 1) {
      const t = i / 7;
      const x = lerp(bridgeWest, bridgeEast, t);
      const y = bridgeDeckY + Math.sin(t * Math.PI) * 0.48;
      staticBatch.cylinder(0.08, 0.1, 1.1, 4, "#72513b", {
        x,
        y: y + 0.55,
        z,
      });
      if (i < 7) {
        const nextT = (i + 1) / 7;
        const nextX = lerp(bridgeWest, bridgeEast, nextT);
        const nextY = bridgeDeckY + Math.sin(nextT * Math.PI) * 0.48;
        const rail = new THREE.Vector3(nextX, nextY + 1.02, z);
        const start = new THREE.Vector3(x, y + 1.02, z);
        addSegment(staticBatch, start, rail, 0.055, "#72513b", 4);
      }
    }
    staticBatch.cylinder(0.12, 0.16, 2.4, 5, "#6b4a36", {
      x: bridgeWest + 0.2,
      y: bridgeDeckY - 1.0,
      z: -2 + side * 1.1,
    });
    staticBatch.cylinder(0.12, 0.16, 2.4, 5, "#6b4a36", {
      x: bridgeEast - 0.2,
      y: bridgeDeckY - 1.0,
      z: -2 + side * 1.1,
    });
    addLamp(bridgeWest - 0.2, -2 + side * 1.7, bridgeDeckY - 0.4, 2.0);
    addLamp(bridgeEast + 0.2, -2 + side * 1.7, bridgeDeckY - 0.4, 2.0);
  }

  // ---------------------------------------------------------------- dock

  const waterAtDock = heightAt(dockCenter.x, dockCenter.z) + 0.54;
  const dockX = dockCenter.x + 4.35;
  const dockZ = 17;
  const dockY = waterAtDock + 0.72;

  staticBatch.box(5.8, 0.28, 5.0, "#a77c52", {
    x: dockX,
    y: dockY,
    z: dockZ,
    jitter: 0.04,
  });
  for (let i = 0; i < 7; i += 1) {
    staticBatch.box(0.12, 0.06, 4.8, "#6f4f38", {
      x: dockX - 2.7 + i * 0.9,
      y: dockY + 0.16,
      z: dockZ,
    });
  }
  for (const [dx, dz] of [
    [-2.2, -2],
    [2.2, -2],
    [-2.2, 2],
    [2.2, 2],
  ]) {
    staticBatch.cylinder(0.14, 0.17, 2.7, 5, "#674934", {
      x: dockX + dx,
      y: dockY - 1.1,
      z: dockZ + dz,
    });
  }
  addLamp(dockX + 2.2, dockZ + 1.8, dockY + 0.1, 2.4);
  addLamp(dockX - 2.1, dockZ - 1.7, dockY + 0.1, 2.2);
  staticBatch.box(0.9, 0.7, 0.9, "#876546", { x: dockX + 1.8, y: dockY + 0.5, z: dockZ - 1.8 });
  staticBatch.box(0.8, 0.55, 0.8, "#9a7753", { x: dockX + 2.5, y: dockY + 0.4, z: dockZ - 1.3 });
  addBoat(dockCenter.x + 0.6, dockZ + 3.4, waterAtDock, 0);
  addBoat(dockCenter.x - 1.1, dockZ - 5.5, heightAt(dockCenter.x, dockZ - 5.5) + 0.54, 0.08);

  for (let i = 0; i < 5; i += 1) {
    staticBatch.box(0.8 + random() * 0.5, 0.1, 2.2 + random(), "#8f6b4a", {
      x: dockCenter.x + (i < 2 ? -4.4 : 4.1) + random() * 0.3,
      y: waterAtDock + 0.17,
      z: dockZ - 1.8 + i * 0.9,
      ry: random() * 0.4,
    });
  }

  // ---------------------------------------------------------------- hill

  const hillX = -20;
  const hillZ = -31;
  const hillGround = heightAt(hillX, hillZ);

  staticBatch.box(8.4, 0.4, 5.4, "#a67b50", {
    x: hillX,
    y: hillGround + 0.18,
    z: hillZ,
    ry: 0.12,
    jitter: 0.03,
  });
  for (const [dx, dz] of [
    [-3.7, -2.2],
    [3.7, -2.2],
    [-3.7, 2.2],
    [3.7, 2.2],
  ]) {
    staticBatch.cylinder(0.12, 0.16, 2.0, 5, "#674934", {
      x: hillX + dx,
      y: hillGround,
      z: hillZ + dz,
    });
  }
  for (const side of [-1, 1]) {
    const z = hillZ + side * 2.45;
    staticBatch.box(8.0, 0.12, 0.12, "#7a563c", {
      x: hillX,
      y: hillGround + 1.3,
      z,
      ry: 0.12,
    });
    for (let i = 0; i < 5; i += 1) {
      staticBatch.cylinder(0.07, 0.09, 1.2, 4, "#6f4f38", {
        x: hillX - 3.4 + i * 1.7,
        y: hillGround + 0.85,
        z,
      });
    }
  }
  addBench(hillX + 2.2, hillZ, hillGround + 0.5, 0.2);
  addLamp(hillX - 3.1, hillZ + 1.9, hillGround + 0.3, 3.0);

  staticBatch.cylinder(0.1, 0.13, 7.2, 5, "#5c4537", {
    x: hillX + 3.0,
    y: hillGround + 3.8,
    z: hillZ - 1.2,
  });
  staticBatch.box(1.7, 0.46, 0.06, "#c84e48", {
    x: hillX + 3.88,
    y: hillGround + 7.0,
    z: hillZ - 1.2,
  });
  staticBatch.box(1.7, 0.46, 0.06, "#f0e6d1", {
    x: hillX + 3.88,
    y: hillGround + 6.53,
    z: hillZ - 1.2,
  });

  staticBatch.cylinder(0.08, 0.1, 1.35, 5, "#54473c", {
    x: hillX - 2.3,
    y: hillGround + 1.28,
    z: hillZ - 1.9,
  });
  staticBatch.cylinder(0.06, 0.12, 0.55, 5, "#54473c", {
    x: hillX - 2.3,
    y: hillGround + 1.95,
    z: hillZ - 1.9,
    rz: 0.6,
  });

  for (const [x, z, scale] of [
    [hillX - 3.7, hillZ - 2.8, 1.1],
    [hillX + 4.2, hillZ + 1.6, 0.8],
    [hillX + 2.5, hillZ + 2.4, 0.65],
    [hillX - 1.5, hillZ - 2.9, 0.5],
  ]) {
    staticBatch.ico(0.9 * scale, 0, "#8c7b68", {
      x,
      y: heightAt(x, z) + 0.25 * scale,
      z,
      sx: 1,
      sy: 0.7,
      sz: 1,
      jitter: 0.07,
    });
  }

  // ---------------------------------------------------------------- houses

  const clusters = [
    { x: -39, z: -22, r: 6.2, count: 4 },
    { x: -10, z: 24, r: 7.2, count: 5 },
    { x: 18, z: 14, r: 6.5, count: 3 },
    { x: 42, z: 10, r: 5.2, count: 3 },
    { x: 12, z: -29, r: 5.4, count: 3 },
    { x: -38, z: 14, r: 4.5, count: 2 },
    { x: 14, z: 34, r: 5.6, count: 3 },
    { x: 20, z: -22, r: 4.8, count: 2 },
  ];

  function canPlaceHouse(x, z) {
    const angle = Math.atan2(z, x);
    const coast = coastlineRadius(angle);
    if (Math.hypot(x, z) > coast * 0.8) return false;
    if (river.distance(x, z) < RIVER_WIDTH * 1.7 + 1.2) return false;
    for (const ex of landmarkExclusions) {
      if (Math.hypot(x - ex.x, z - ex.z) < ex.r) return false;
    }
    for (const house of houseSpots) {
      if (Math.hypot(x - house.x, z - house.z) < 5.1) return false;
    }
    for (const path of pathSamples) {
      if (Math.hypot(x - path.x, z - path.z) < path.width * 0.75 + 1.5) return false;
    }
    return true;
  }

  const roofColors = [COLORS.roofTerracotta, COLORS.roofTeal, COLORS.roofBrown, COLORS.roofPlum];
  for (const cluster of clusters) {
    let placed = 0;
    let attempts = 0;
    while (placed < cluster.count && attempts < 80) {
      attempts += 1;
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * cluster.r;
      const x = cluster.x + Math.cos(angle) * radius;
      const z = cluster.z + Math.sin(angle) * radius;
      if (!canPlaceHouse(x, z)) continue;
      addHouse(x, z, random() * Math.PI * 2, {
        roof: roofColors[Math.floor(random() * roofColors.length)],
        scale: 0.82 + random() * 0.4,
        stilts: random() > 0.55,
        wall: random() > 0.5 ? COLORS.wallCream : COLORS.wallWarm,
      });
      houseSpots.push({ x, z });
      placed += 1;
    }
  }

  // ---------------------------------------------------------------- trees

  const extraTreeSpots = [
    [-41, -7],
    [-27, -18],
    [-11, -3],
    [-27, 12],
    [8, -28],
    [-12, -29],
    [-12, 14],
    [13, 12],
    [44, -9],
    [43, 3],
    [35, 22],
    [32, 11],
    [-28, -26],
    [-13, -35],
    [7, 32],
    [-39, 30],
  ];

  const treePositions = [];
  for (const [x, z] of extraTreeSpots) {
    treePositions.push({ x, z });
  }

  function canPlaceTree(x, z) {
    const angle = Math.atan2(z, x);
    const coast = coastlineRadius(angle);
    if (Math.hypot(x, z) > coast * 0.86) return false;
    if (river.distance(x, z) < RIVER_WIDTH * 1.3 + 1.3) return false;
    for (const ex of landmarkExclusions) {
      if (Math.hypot(x - ex.x, z - ex.z) < ex.r * 0.86) return false;
    }
    for (const house of houseSpots) {
      if (Math.hypot(x - house.x, z - house.z) < 3.7) return false;
    }
    for (const other of treePositions) {
      if (Math.hypot(x - other.x, z - other.z) < 2.7) return false;
    }
    for (const path of pathSamples) {
      if (Math.hypot(x - path.x, z - path.z) < path.width * 0.8 + 1.2) return false;
    }
    return true;
  }

  let treeAttempts = 0;
  while (treePositions.length < 126 && treeAttempts < 3600) {
    treeAttempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * coastlineRadius(angle) * 0.85;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!canPlaceTree(x, z)) continue;
    treePositions.push({ x, z });
  }

  const treeGeometryBatch = new GeometryBatch();
  treeGeometryBatch.cylinder(0.18, 0.28, 1.65, 5, "#6d4d38", {
    y: 0.82,
    jitter: 0.05,
  });
  treeGeometryBatch.ico(1.4, 0, "#6f9758", { y: 2.35, jitter: 0.06 });
  treeGeometryBatch.ico(1.05, 0, "#84aa63", { x: 0.55, y: 2.85, z: 0.2, jitter: 0.06 });
  treeGeometryBatch.ico(0.95, 0, "#5f8c50", { x: -0.55, y: 2.1, z: -0.2, jitter: 0.06 });
  treeGeometryBatch.ico(0.8, 0, "#97b76f", { x: 0.1, y: 3.35, z: -0.35, jitter: 0.06 });
  const treePlaceholder = treeGeometryBatch.build(
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  const treeGeometry = treePlaceholder.geometry;
  treePlaceholder.material.dispose();

  const treeMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const trees = new THREE.InstancedMesh(treeGeometry, treeMaterial, treePositions.length);
  const dummy = new THREE.Object3D();
  const treeTint = new THREE.Color();
  const trunkScale = new THREE.Vector3();

  treePositions.forEach((position, index) => {
    const scale = 0.7 + random() * 0.72;
    const y = heightAt(position.x, position.z);
    dummy.position.set(position.x, y, position.z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    trunkScale.set(scale, scale * (0.85 + random() * 0.3), scale);
    dummy.scale.copy(trunkScale);
    dummy.updateMatrix();
    trees.setMatrixAt(index, dummy.matrix);
    treeTint.setRGB(
      0.88 + random() * 0.18,
      0.88 + random() * 0.18,
      0.82 + random() * 0.16,
    );
    trees.setColorAt(index, treeTint);
  });
  trees.instanceMatrix.needsUpdate = true;
  if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  trees.computeBoundingSphere();
  group.add(trees);

  // palms
  const palmBatch = new GeometryBatch();
  palmBatch.cylinder(0.14, 0.23, 1.9, 5, "#8a6545", {
    y: 0.95,
    rz: -0.06,
    jitter: 0.04,
  });
  palmBatch.cylinder(0.1, 0.16, 1.9, 5, "#98714e", {
    x: 0.24,
    y: 2.7,
    rz: -0.16,
    jitter: 0.04,
  });
  const palmTop = new THREE.Vector3(0.55, 3.5, 0);
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.15;
    const frond = new THREE.ConeGeometry(0.3, 2.5, 4);
    frond.translate(0, 1.25, 0);
    frond.scale(1, 1, 0.55);
    const quaternion = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.36 + (i % 2) * 0.1),
      );
    const matrix = new THREE.Matrix4().compose(palmTop, quaternion, new THREE.Vector3(1, 1, 1));
    palmBatch.add(frond, i % 2 ? "#5f8b53" : "#76a460", { matrix, jitter: 0.04 });
  }
  for (let i = 0; i < 3; i += 1) {
    palmBatch.ico(0.16, 0, "#6f4c35", {
      x: palmTop.x + (i - 1) * 0.22,
      y: palmTop.y - 0.2 - (i % 2) * 0.12,
      z: palmTop.z,
    });
  }
  const palmPlaceholder = palmBatch.build(
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  const palmGeometry = palmPlaceholder.geometry;
  palmPlaceholder.material.dispose();
  const palmMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const palmPositions = [
    [31.5, 21],
    [34.7, 25.5],
    [22.4, 10.5],
    [20.2, -7.5],
    [40.5, 4.6],
    [13, 41.5],
    [6.5, 43],
    [44.5, -2.8],
    [24, 29],
    [17.4, -12],
    [18.6, 27],
    [-10.5, 37.5],
    [-35.5, -9],
    [42, 16],
    [11.2, -38],
    [-28, 32],
  ];
  const palms = new THREE.InstancedMesh(palmGeometry, palmMaterial, palmPositions.length);
  palmPositions.forEach(([x, z], index) => {
    const scale = 0.72 + random() * 0.5;
    dummy.position.set(x, heightAt(x, z), z);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    palms.setMatrixAt(index, dummy.matrix);
    treeTint.setRGB(0.9 + random() * 0.14, 0.9 + random() * 0.12, 0.86 + random() * 0.1);
    palms.setColorAt(index, treeTint);
  });
  palms.instanceMatrix.needsUpdate = true;
  if (palms.instanceColor) palms.instanceColor.needsUpdate = true;
  palms.computeBoundingSphere();
  group.add(palms);

  // shrubs and flowers around the island
  for (let i = 0; i < 34; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * coastlineRadius(angle) * 0.8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!canPlaceTree(x, z)) continue;
    const y = heightAt(x, z);
    const scale = 0.25 + random() * 0.4;
    staticBatch.ico(scale, 0, random() > 0.5 ? "#6f9a59" : "#85aa63", {
      x,
      y: y + scale * 0.5,
      z,
      sy: 0.7,
      jitter: 0.06,
    });
  }

  for (let i = 0; i < 22; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 14 + random() * 30;
    const x = Math.cos(angle) * radius + (random() - 0.5) * 5;
    const z = Math.sin(angle) * radius + (random() - 0.5) * 5;
    if (river.distance(x, z) < RIVER_WIDTH * 0.85) continue;
    if (Math.hypot(x, z) > coastlineRadius(Math.atan2(z, x)) * 0.84) continue;
    if (houseSpots.some((house) => Math.hypot(x - house.x, z - house.z) < 2.4)) continue;
    addFlowerPatch(x, z, heightAt(x, z) + 0.08, 3 + Math.floor(random() * 4));
  }

  // rocks
  for (let i = 0; i < 16; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 18 + random() * 30;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!canPlaceTree(x, z)) continue;
    const scale = 0.3 + random() * 0.7;
    staticBatch.ico(scale, 0, random() > 0.5 ? "#91806c" : "#817468", {
      x,
      y: heightAt(x, z) + scale * 0.35,
      z,
      sy: 0.62,
      jitter: 0.07,
    });
  }

  // ---------------------------------------------------------------- floating rocks

  const floatingRocks = [
    [-69, 8, 4],
    [73, -2, 15],
    [-52, -1, 16],
    [81, -6, 17],
    [-33, -5, 12],
    [55, 4, 7],
  ];
  for (const [x, y, z] of floatingRocks) {
    const scale = 2.2 + random() * 2.6;
    staticBatch.ico(scale, 0, "#7d6858", {
      x,
      y,
      z,
      sy: 1.4 + random() * 0.6,
      jitter: 0.07,
    });
    staticBatch.ico(scale * 0.8, 0, "#86a76c", {
      x,
      y: y + scale * 0.55,
      z,
      sy: 0.25,
      jitter: 0.05,
    });
    if (random() > 0.4) {
      staticBatch.cylinder(0.12, 0.18, 1.2, 4, "#66503f", {
        x: x + 0.3,
        y: y + scale * 0.65,
        z,
      });
      staticBatch.ico(0.62, 0, "#6f9958", {
        x: x + 0.3,
        y: y + scale * 0.65 + 1.0,
        z,
      });
    }
  }

  // ---------------------------------------------------------------- static meshes

  const staticMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const staticMesh = staticBatch.build(staticMaterial);
  group.add(staticMesh);

  const glowMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: true,
  });
  const glowMesh = glowBatch.build(glowMaterial);
  group.add(glowMesh);

  const clothMaterial = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const clothMesh = clothBatch.build(clothMaterial);
  group.add(clothMesh);

  // ---------------------------------------------------------------- water

  const riverMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#357d7d") },
      uShallow: { value: new THREE.Color("#71c6b5") },
      uFoam: { value: new THREE.Color("#d8f2dc") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      varying vec2 vUv;
      varying vec3 vWorld;

      void main() {
        float flow = vUv.y * 22.0 - uTime * 1.15;
        float ripple = sin(flow + sin(vUv.x * 10.0) * 1.25) * 0.5 + 0.5;
        float bands = smoothstep(0.45, 1.0, ripple);
        vec3 color = mix(uDeep, uShallow, 0.24 + bands * 0.52);
        float edge = smoothstep(0.38, 0.5, abs(vUv.x - 0.5));
        color = mix(color, uFoam, edge * 0.62);
        color += vec3(0.11, 0.14, 0.1) * pow(bands, 3.0);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
  });
  waterMaterials.push(riverMaterial);

  const riverGeometry = buildRiverGeometry();
  const riverMesh = new THREE.Mesh(riverGeometry, riverMaterial);
  riverMesh.renderOrder = 1;
  group.add(riverMesh);

  const waterfallInfo = buildWaterfallGeometry();
  const waterfallMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#a7e3d8") },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;

      void main() {
        float streaks = sin((vUv.y * 15.0 - uTime * 2.0) * 3.14159 + sin(vUv.x * 10.0) * 2.0) * 0.5 + 0.5;
        float center = smoothstep(0.0, 0.22, vUv.x) * smoothstep(0.0, 0.22, 1.0 - vUv.x);
        float fade = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
        float alpha = center * fade * (0.36 + streaks * 0.46);
        vec3 color = mix(uColor, vec3(1.0), streaks * 0.5);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  waterMaterials.push(waterfallMaterial);
  const waterfallMesh = new THREE.Mesh(waterfallInfo.geometry, waterfallMaterial);
  waterfallMesh.renderOrder = 2;
  group.add(waterfallMesh);

  function buildRiverGeometry() {
    const samples = river.samples;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < samples.length; i += 1) {
      const sample = samples[i];
      const previous = samples[Math.max(i - 1, 0)];
      const next = samples[Math.min(i + 1, samples.length - 1)];
      const tx = next.x - previous.x;
      const tz = next.z - previous.z;
      const length = Math.hypot(tx, tz) || 1;
      const nx = -tz / length;
      const nz = tx / length;
      const width = RIVER_WIDTH * (0.9 + Math.sin(i * 0.26) * 0.07);
      const y = heightAt(sample.x, sample.z) + 0.54;
      positions.push(
        sample.x + nx * width * 0.5,
        y,
        sample.z + nz * width * 0.5,
        sample.x - nx * width * 0.5,
        y,
        sample.z - nz * width * 0.5,
      );
      const v = i / (samples.length - 1);
      uvs.push(0, v, 1, v);
      if (i < samples.length - 1) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  function buildWaterfallGeometry() {
    const last = river.samples[river.samples.length - 1];
    const previous = river.samples[river.samples.length - 2];
    const direction = new THREE.Vector3(last.x - previous.x, 0, last.z - previous.z).normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    const topY = heightAt(last.x, last.z) + 0.54;
    const rows = 9;
    const width = RIVER_WIDTH * 0.94;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let row = 0; row <= rows; row += 1) {
      const t = row / rows;
      const outward = 0.6 + t * 4.2;
      const widthNow = width * (1 - t * 0.14);
      const centerX = last.x + direction.x * outward;
      const centerZ = last.z + direction.z * outward;
      const y = topY - t * 25.5;
      positions.push(
        centerX + side.x * widthNow * 0.5,
        y,
        centerZ + side.z * widthNow * 0.5,
        centerX - side.x * widthNow * 0.5,
        y,
        centerZ - side.z * widthNow * 0.5,
      );
      uvs.push(0, t, 1, t);
      if (row < rows) {
        const a = row * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return {
      geometry,
      x: last.x + direction.x * 5,
      z: last.z + direction.z * 5,
      y: topY - 25.5,
      topY,
    };
  }

  // ---------------------------------------------------------------- clouds

  const cloudPuffs = [];
  const addCloud = (cx, cy, cz, base, puffs = 4, tint = 0) => {
    for (let i = 0; i < puffs; i += 1) {
      cloudPuffs.push({
        x: cx + (random() - 0.5) * base * 1.5,
        y: cy + (random() - 0.5) * base * 0.34,
        z: cz + (random() - 0.5) * base * 1.1,
        scale: base * (0.38 + random() * 0.55),
        rotation: random() * Math.PI * 2,
        tint,
      });
    }
  };

  for (let i = 0; i < 32; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 38 + random() * 96;
    addCloud(
      Math.cos(angle) * radius,
      -19 - random() * 15,
      Math.sin(angle) * radius,
      6 + random() * 7,
      3 + Math.floor(random() * 4),
      random(),
    );
  }

  for (let i = 0; i < 27; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 92 + random() * 110;
    addCloud(
      Math.cos(angle) * radius,
      -10 + random() * 28,
      Math.sin(angle) * radius,
      7 + random() * 9,
      2 + Math.floor(random() * 3),
      random(),
    );
  }

  for (let i = 0; i < 9; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 120 + random() * 100;
    addCloud(
      Math.cos(angle) * radius,
      27 + random() * 28,
      Math.sin(angle) * radius,
      4.5 + random() * 5,
      2 + Math.floor(random() * 3),
      random(),
    );
  }

  addCloud(waterfallInfo.x, waterfallInfo.y + 4, waterfallInfo.z, 3.5, 5, 0.2);
  addCloud(waterfallInfo.x + 2, waterfallInfo.y + 8, waterfallInfo.z + 1, 2.6, 3, 0.1);
  addCloud(waterfallInfo.x, waterfallInfo.y + 3, waterfallInfo.z, 8, 5, 0.2);
  addCloud(waterfallInfo.x + 5, waterfallInfo.y + 1, waterfallInfo.z + 4, 6, 4, 0.5);
  addCloud(waterfallInfo.x - 5, waterfallInfo.y - 1, waterfallInfo.z + 3, 7, 4, 0.4);

  const cloudGeometry = new THREE.IcosahedronGeometry(1, 0);
  const cloudMaterial = new THREE.MeshLambertMaterial({
    flatShading: true,
    emissive: new THREE.Color("#544257"),
    emissiveIntensity: 0.2,
  });
  const clouds = new THREE.InstancedMesh(cloudGeometry, cloudMaterial, cloudPuffs.length);
  const cloudColor = new THREE.Color();
  const creamCloud = new THREE.Color("#f7e8d2");
  const pinkCloud = new THREE.Color("#f1cbb9");
  const lavenderCloud = new THREE.Color("#ddc9d5");

  cloudPuffs.forEach((puff, index) => {
    dummy.position.set(puff.x, puff.y, puff.z);
    dummy.rotation.set(0, puff.rotation, 0);
    dummy.scale.set(puff.scale, puff.scale * (0.46 + random() * 0.2), puff.scale * (0.75 + random() * 0.2));
    dummy.updateMatrix();
    clouds.setMatrixAt(index, dummy.matrix);
    if (puff.tint < 0.35) cloudColor.copy(creamCloud);
    else if (puff.tint < 0.7) cloudColor.copy(pinkCloud);
    else cloudColor.copy(lavenderCloud);
    cloudColor.offsetHSL(0, 0, (random() - 0.5) * 0.06);
    clouds.setColorAt(index, cloudColor);
  });
  clouds.instanceMatrix.needsUpdate = true;
  if (clouds.instanceColor) clouds.instanceColor.needsUpdate = true;
  clouds.computeBoundingSphere();
  group.add(clouds);

  // ---------------------------------------------------------------- birds

  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.32, -1.25, 0.28, 0.15, -0.42, 0, -0.18, 0, 0, 0.32, 0.42, 0, -0.18, 1.25, 0.28, 0.15,
      ],
      3,
    ),
  );
  birdGeometry.computeVertexNormals();
  const birdMaterial = new THREE.MeshBasicMaterial({
    color: "#38313f",
    side: THREE.DoubleSide,
  });
  const birdCount = 15;
  const birds = new THREE.InstancedMesh(birdGeometry, birdMaterial, birdCount);
  birds.frustumCulled = false;
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const birdData = [];
  for (let i = 0; i < birdCount; i += 1) {
    birdData.push({
      radius: 30 + random() * 22,
      height: 23 + random() * 8,
      speed: 0.055 + random() * 0.035,
      phase: random() * Math.PI * 2,
      scale: 1.1 + random() * 0.9,
    });
  }
  group.add(birds);

  // ---------------------------------------------------------------- balloon

  const balloonBatch = new GeometryBatch();
  const goreColors = ["#f2ddbd", "#d98b6d", "#6b9a8d", "#f2ddbd", "#b67463", "#f2ddbd", "#6b9a8d", "#d9a96b"];
  for (let i = 0; i < 8; i += 1) {
    const thetaStart = (i / 8) * Math.PI * 2;
    balloonBatch.add(
      new THREE.SphereGeometry(3.1, 7, 8, thetaStart, (Math.PI * 2) / 8, 0, Math.PI * 0.8),
      goreColors[i],
      { jitter: 0.015 },
    );
  }
  balloonBatch.torus(2.32, 0.075, 4, 16, "#e8bd70", {
    y: -1.55,
    rx: Math.PI / 2,
  });
  balloonBatch.box(1.45, 0.95, 1.45, "#6c4b38", { y: -4.85, jitter: 0.04 });
  balloonBatch.box(1.7, 0.14, 1.7, "#c79e63", { y: -4.33 });
  balloonBatch.box(0.5, 0.32, 0.5, "#513b2f", { y: -5.45 });
  for (const [dx, dz] of [
    [-2.1, -1.5],
    [2.1, -1.5],
    [-2.1, 1.5],
    [2.1, 1.5],
  ]) {
    addSegment(
      balloonBatch,
      new THREE.Vector3(dx, -2.1, dz),
      new THREE.Vector3(dx * 0.33, -4.35, dz * 0.33),
      0.022,
      "#5d4637",
      3,
    );
  }
  balloonBatch.cone(0.14, 0.7, 4, "#e8bd70", { y: 3.55 });
  const balloonPlaceholder = balloonBatch.build(
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  const balloonMesh = new THREE.Mesh(
    balloonPlaceholder.geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  balloonPlaceholder.material.dispose();
  const balloon = new THREE.Group();
  balloon.add(balloonMesh);
  balloon.position.set(34, 30, 23);
  balloon.scale.setScalar(1.15);
  group.add(balloon);
  const balloonBaseY = balloon.position.y;

  // ---------------------------------------------------------------- update

  function update(time) {
    for (const material of waterMaterials) {
      material.uniforms.uTime.value = time;
    }

    for (let i = 0; i < birdCount; i += 1) {
      const bird = birdData[i];
      const angle = bird.phase + time * bird.speed;
      const x = Math.cos(angle) * bird.radius;
      const z = Math.sin(angle) * bird.radius;
      const y = bird.height + Math.sin(time * 0.45 + bird.phase) * 1.4;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, -angle, Math.sin(time * 0.6 + bird.phase) * 0.12);
      dummy.scale.setScalar(bird.scale);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;

    balloon.position.y = balloonBaseY + Math.sin(time * 0.52) * 0.85;
    balloon.rotation.y = time * 0.035;
    balloon.rotation.z = Math.sin(time * 0.34) * 0.02;
  }

  function dispose() {
    disposeObject(group);
  }

  return {
    group,
    update,
    dispose,
    bridgeCenter: new THREE.Vector3(bridgeCenter.x, 0, -2),
    dockCenter,
    sign,
    stats: {
      trees: treePositions.length,
      palms: palmPositions.length,
      houses: houseSpots.length,
    },
  };

  // ---------------------------------------------------------------- helpers

  function addHipRoof(batch, width, depth, height, color, options = {}) {
    const hw = width / 2;
    const hd = depth / 2;
    const ridge = width * 0.12;
    const vertices = [
      -hw, 0, -hd,
      hw, 0, -hd,
      hw, 0, hd,
      -hw, 0, hd,
      -ridge, height, 0,
      ridge, height, 0,
    ];
    const faces = [
      [3, 2, 5],
      [3, 5, 4],
      [1, 0, 4],
      [1, 4, 5],
      [0, 3, 4],
      [2, 1, 5],
    ];
    const positions = [];
    for (const face of faces) {
      for (const index of face) {
        positions.push(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    batch.add(geometry, color, options);
  }

  function addSegment(batch, from, to, radius, color, radialSegments = 4) {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    if (length < 0.0001) return;
    const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    batch.add(geometry, color, { matrix });
  }

  function addLamp(x, z, groundY, height = 4.2) {
    staticBatch.cylinder(0.065, 0.1, height, 5, "#403340", {
      x,
      y: groundY + height / 2,
      z,
    });
    staticBatch.cone(0.15, 0.12, 4, "#352b34", {
      x,
      y: groundY + height + 0.43,
      z,
      ry: Math.PI / 4,
    });
    glowBatch.ico(0.27, 0, "#ffcf82", {
      x,
      y: groundY + height + 0.1,
      z,
    });
  }

  function addBench(x, z, groundY, rotation = 0) {
    staticBatch.box(2.0, 0.14, 0.52, "#8f6948", {
      x,
      y: groundY + 0.52,
      z,
      ry: rotation,
    });
    staticBatch.box(2.0, 0.42, 0.12, "#815d40", {
      x: x - Math.sin(rotation) * 0.24,
      y: groundY + 0.72,
      z: z - Math.cos(rotation) * 0.24,
      ry: rotation,
    });
    for (const side of [-1, 1]) {
      staticBatch.box(0.12, 0.5, 0.44, "#5e4535", {
        x: x + Math.cos(rotation) * side * 0.78,
        y: groundY + 0.27,
        z: z - Math.sin(rotation) * side * 0.78,
        ry: rotation,
      });
    }
  }

  function addFlowerPatch(x, z, groundY, count) {
    const colors = ["#e59a83", "#f2c66d", "#f5e6c8", "#b9829a"];
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = random() * 1.1;
      const px = x + Math.cos(angle) * radius;
      const pz = z + Math.sin(angle) * radius;
      const height = 0.2 + random() * 0.2;
      staticBatch.cylinder(0.025, 0.035, height, 3, "#6c8d53", {
        x: px,
        y: groundY + height / 2,
        z: pz,
      });
      staticBatch.ico(0.12 + random() * 0.06, 0, colors[Math.floor(random() * colors.length)], {
        x: px,
        y: groundY + height + 0.06,
        z: pz,
      });
    }
  }

  function addHut(x, z, groundY, rotation) {
    staticBatch.box(3.2, 1.8, 2.8, "#e3cda3", {
      x,
      y: groundY + 0.9,
      z,
      ry: rotation,
      jitter: 0.03,
    });
    addHipRoof(staticBatch, 3.9, 3.4, 1.1, "#a98d5d", {
      x,
      y: groundY + 1.8,
      z,
      ry: rotation,
      jitter: 0.04,
    });
    staticBatch.box(0.7, 1.3, 0.1, "#6c4c36", {
      x: x + Math.sin(rotation) * 1.42,
      y: groundY + 0.75,
      z: z + Math.cos(rotation) * 1.42,
      ry: rotation,
    });
    glowBatch.box(0.34, 0.4, 0.06, "#ffcf83", {
      x: x + Math.cos(rotation) * 0.9 + Math.sin(rotation) * 1.43,
      y: groundY + 1.2,
      z: z - Math.sin(rotation) * 0.9 + Math.cos(rotation) * 1.43,
      ry: rotation,
    });
  }

  function addHouse(x, z, rotation, options) {
    const ground = heightAt(x, z);
    const scale = options.scale ?? 1;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const local = (lx, lz) => ({
      x: x + lx * cos + lz * sin,
      z: z - lx * sin + lz * cos,
    });

    staticBatch.box(4.3 * scale, 0.38, 4.1 * scale, "#b9a47c", {
      x,
      y: ground + 0.19,
      z,
      ry: rotation,
      jitter: 0.025,
    });

    const baseY = ground + 0.38;
    if (options.stilts) {
      for (const [lx, lz] of [
        [-1.25, -1.2],
        [1.25, -1.2],
        [-1.25, 1.2],
        [1.25, 1.2],
      ]) {
        const point = local(lx * scale, lz * scale);
        staticBatch.cylinder(0.11 * scale, 0.13 * scale, 0.68 * scale, 4, "#5d4333", {
          x: point.x,
          y: baseY + 0.34 * scale,
          z: point.z,
        });
      }
    }

    const floorY = baseY + (options.stilts ? 0.68 * scale : 0);
    staticBatch.box(3.2 * scale, 2.45 * scale, 3.4 * scale, options.wall, {
      x,
      y: floorY + 1.22 * scale,
      z,
      ry: rotation,
      jitter: 0.02,
    });

    addHipRoof(staticBatch, 3.9 * scale, 4.1 * scale, 1.15 * scale, options.roof, {
      x,
      y: floorY + 2.44 * scale,
      z,
      ry: rotation,
      jitter: 0.03,
    });
    staticBatch.box(2.8 * scale, 0.14, 0.18, "#6d4b37", {
      x,
      y: floorY + 3.5 * scale,
      z,
      ry: rotation,
    });

    const door = local(0, 1.72 * scale);
    staticBatch.box(0.72 * scale, 1.45 * scale, 0.08, "#5e4332", {
      x: door.x,
      y: floorY + 0.73 * scale,
      z: door.z,
      ry: rotation,
    });

    for (const side of [-1, 1]) {
      const window = local(side * 1.0 * scale, 1.72 * scale);
      glowBatch.box(0.4 * scale, 0.5 * scale, 0.06, "#ffcf83", {
        x: window.x,
        y: floorY + 1.55 * scale,
        z: window.z,
        ry: rotation,
      });
      staticBatch.box(0.56 * scale, 0.66 * scale, 0.04, "#72513b", {
        x: window.x,
        y: floorY + 1.55 * scale,
        z: window.z - 0.02,
        ry: rotation,
      });
    }

    if (random() > 0.55) {
      const porch = local(0, 2.05 * scale);
      staticBatch.box(2.3 * scale, 0.12, 1.0 * scale, "#8b6646", {
        x: porch.x,
        y: floorY + 0.5 * scale,
        z: porch.z,
        ry: rotation,
      });
      for (const side of [-1, 1]) {
        const post = local(side * 1.0 * scale, 2.45 * scale);
        staticBatch.cylinder(0.06 * scale, 0.08 * scale, 1.3 * scale, 4, "#654a37", {
          x: post.x,
          y: ground + 1.02 * scale,
          z: post.z,
        });
      }
    }
  }

  function addBoat(x, z, waterY, rotation = 0) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const local = (lx, lz) => ({
      x: x + lx * cos + lz * sin,
      z: z - lx * sin + lz * cos,
    });

    for (const side of [-1, 1]) {
      const front = local(0, side * 1.2);
      staticBatch.cone(0.8, 2.4, 4, side > 0 ? "#7b543a" : "#714b35", {
        x: front.x,
        y: waterY + 0.24,
        z: front.z,
        rx: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        ry: rotation,
        sz: 0.7,
        jitter: 0.04,
      });
    }
    staticBatch.box(1.1, 0.16, 3.5, "#8a6446", {
      x,
      y: waterY + 0.56,
      z,
      ry: rotation,
    });
    for (const [lx, lz] of [
      [-0.48, -1.25],
      [0.48, -1.25],
      [-0.48, 1.25],
      [0.48, 1.25],
    ]) {
      const point = local(lx, lz);
      staticBatch.cylinder(0.045, 0.055, 1.5, 4, "#5e4433", {
        x: point.x,
        y: waterY + 1.32,
        z: point.z,
      });
    }
    addHipRoof(staticBatch, 1.8, 2.8, 0.55, "#4d837d", {
      x,
      y: waterY + 2.05,
      z,
      ry: rotation,
      jitter: 0.03,
    });
    staticBatch.box(1.4, 0.1, 2.4, "#72503a", {
      x,
      y: waterY + 2.0,
      z,
      ry: rotation,
    });
    glowBatch.ico(0.14, 0, "#ffd28a", {
      x: local(0.56, -1.3).x,
      y: waterY + 1.45,
      z: local(0.56, -1.3).z,
    });
  }

  function addStringLights(start, end, count, sag) {
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const x = lerp(start.x, end.x, t);
      const z = lerp(start.z, end.z, t);
      const y = lerp(start.y, end.y, t) - Math.sin(t * Math.PI) * sag;
      glowBatch.ico(0.075, 0, "#ffd899", { x, y, z });
    }
  }

  function addFlagLine(start, end, count) {
    const colors = ["#d88a63", "#e8bd70", "#76a594", "#f0d9b5", "#b77475"];
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    direction.normalize();
    const flagWidth = Math.min(0.42, length / count * 0.36);
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const center = new THREE.Vector3().lerpVectors(start, end, t);
      center.y -= Math.sin(t * Math.PI) * Math.min(0.7, length * 0.045);
      const left = center.clone().addScaledVector(direction, -flagWidth / 2);
      const right = center.clone().addScaledVector(direction, flagWidth / 2);
      const bottom = center.clone().addScaledVector(direction, flagWidth * 0.04);
      bottom.y -= 0.52;
      const positions = [
        left.x, left.y, left.z,
        right.x, right.y, right.z,
        bottom.x, bottom.y, bottom.z,
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      clothBatch.add(geometry, colors[i % colors.length], { jitter: 0.02 });
    }
  }
}
