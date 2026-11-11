import * as THREE from "three";
import { composeMatrix } from "./utils.js";

export const PALETTE = {
  cream: 0xf0e8d6,
  creamDark: 0xd9cfb9,
  paper: 0xfff7e6,
  ink: 0x2f3b36,
  wood: 0x8a6043,
  woodDark: 0x5e4533,
  roof: 0xd8795f,
  roofDark: 0xb95d4c,
  roofTeal: 0x5aa6a0,
  gold: 0xd6a348,
  green: 0x78a263,
  greenDark: 0x5c8954,
  greenLight: 0x92b477,
  sand: 0xd8c79c,
  rock: 0x9b9485,
  water: 0x61c0be,
  teal: 0x57b4b2,
  coral: 0xd8795f,
  yellow: 0xf6c945,
  white: 0xf8f4e8,
};

const shade = (hex, amount) => new THREE.Color(hex).offsetHSL(0, 0, amount).getHex();

export function createPlacer(batch, parentOptions = {}) {
  const parent = composeMatrix(parentOptions);

  function add(geometry, color, options = {}) {
    const local = composeMatrix(options);
    const matrix = parent.clone().multiply(local);
    batch.add(geometry, color, { matrix });
    return add;
  }

  add.add = add;
  add.box = (width, height, depth, color, options = {}) =>
    add(new THREE.BoxGeometry(width, height, depth), color, options);
  add.cylinder = (radiusTop, radiusBottom, height, segments, color, options = {}) =>
    add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, options);
  add.cone = (radius, height, segments, color, options = {}) =>
    add(new THREE.ConeGeometry(radius, height, segments), color, options);
  add.ico = (radius, detail, color, options = {}) =>
    add(new THREE.IcosahedronGeometry(radius, detail), color, options);
  add.sphere = (radius, widthSegments, heightSegments, color, options = {}) =>
    add(new THREE.SphereGeometry(radius, widthSegments, heightSegments), color, options);
  add.dome = (radius, widthSegments, heightSegments, color, options = {}) =>
    add(
      new THREE.SphereGeometry(radius, widthSegments, heightSegments, 0, Math.PI * 2, 0, Math.PI / 2),
      color,
      options,
    );
  add.plane = (width, height, color, options = {}) =>
    add(new THREE.PlaneGeometry(width, height), color, options);
  add.circle = (radius, segments, color, options = {}) =>
    add(new THREE.CircleGeometry(radius, segments), color, options);
  add.ring = (inner, outer, segments, color, options = {}) =>
    add(new THREE.RingGeometry(inner, outer, segments), color, options);
  add.torus = (radius, tube, radial, tubular, color, options = {}) =>
    add(new THREE.TorusGeometry(radius, tube, radial, tubular), color, options);
  add.gable = (width, height, depth, color, options = {}) =>
    add(gableGeometry(width, height, depth), color, options);

  return add;
}

export function gableGeometry(width, height, depth) {
  const shape = new THREE.Shape();
  const half = width / 2;
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function leafFan(p, color, y, radius, count, size, droop = 0.35) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    p.box(size * 0.09, size * 0.05, size, color, {
      x: Math.sin(angle) * radius,
      y,
      z: Math.cos(angle) * radius,
      rx: droop,
      ry: angle,
    });
  }
}

export function addHouse(p, { rng = Math.random, roof = null } = {}) {
  const wall = rng() > 0.72 ? shade(PALETTE.cream, -0.035) : PALETTE.cream;
  const roofColor = roof ?? [PALETTE.roof, PALETTE.roofDark, PALETTE.roofTeal][Math.floor(rng() * 3)];
  const width = 2.0 + rng() * 0.55;
  const depth = 1.6 + rng() * 0.45;
  const height = 1.15 + rng() * 0.35;
  const stilt = rng() > 0.35;

  if (stilt) {
    for (const x of [-width * 0.38, width * 0.38]) {
      for (const z of [-depth * 0.34, depth * 0.34]) {
        p.box(0.15, 0.62, 0.15, PALETTE.woodDark, { x, y: 0.31, z });
      }
    }
  }

  const base = stilt ? 0.58 : 0.12;
  p.box(width, height, depth, wall, { y: base + height / 2 });
  p.box(width * 0.22, height * 0.54, 0.05, PALETTE.woodDark, {
    x: -width * 0.22,
    y: base + height * 0.43,
    z: depth / 2 + 0.028,
  });
  p.box(width * 0.18, height * 0.24, 0.05, PALETTE.teal, {
    x: width * 0.24,
    y: base + height * 0.56,
    z: depth / 2 + 0.03,
  });
  p.box(width * 0.18, height * 0.24, 0.05, PALETTE.teal, {
    x: -width * 0.24,
    y: base + height * 0.56,
    z: -depth / 2 - 0.03,
  });

  p.gable(width + 0.5, 0.8 + rng() * 0.28, depth + 0.55, roofColor, {
    y: base + height - 0.02,
  });
  p.box(width + 0.7, 0.08, depth + 0.7, shade(roofColor, -0.08), {
    y: base + height + 0.02,
  });

  if (stilt) {
    p.box(0.45, 0.08, 0.8, PALETTE.wood, { x: width * 0.24, y: 0.24, z: depth * 0.52 });
    p.box(0.45, 0.08, 0.8, PALETTE.wood, { x: width * 0.24, y: 0.12, z: depth * 0.72 });
  }
}

export function addTree(p, { rng = Math.random } = {}) {
  const height = 1.7 + rng() * 0.9;
  p.cylinder(0.12, 0.18, height, 5, PALETTE.woodDark, { y: height / 2 });
  p.ico(0.85 + rng() * 0.3, 1, rng() > 0.5 ? PALETTE.green : PALETTE.greenDark, {
    x: -0.18,
    y: height + 0.25,
    z: 0.1,
  });
  p.ico(0.62 + rng() * 0.2, 1, PALETTE.greenLight, {
    x: 0.45,
    y: height + 0.02,
    z: -0.22,
  });
  p.ico(0.45 + rng() * 0.18, 1, PALETTE.green, {
    x: 0.1,
    y: height + 0.65,
    z: 0.25,
  });
}

export function addPalm(p, { rng = Math.random } = {}) {
  const height = 2.8 + rng() * 0.9;
  p.cylinder(0.1, 0.17, height, 5, PALETTE.wood, { y: height / 2 });
  p.cylinder(0.16, 0.16, 0.12, 6, PALETTE.greenDark, { y: height });
  leafFan(p, PALETTE.green, height + 0.08, 0.42, 6, 2.0, 0.24);
  p.sphere(0.12, 6, 4, PALETTE.woodDark, { x: 0.12, y: height - 0.12, z: 0.14 });
  p.sphere(0.11, 6, 4, PALETTE.woodDark, { x: -0.12, y: height - 0.1, z: -0.1 });
}

export function addRubber(p, { rng = Math.random } = {}) {
  const height = 2.4 + rng() * 1.2;
  p.cylinder(0.1, 0.16, height, 5, PALETTE.woodDark, { y: height / 2 });
  p.ico(0.78, 1, PALETTE.greenDark, { y: height + 0.3, sx: 1.1 });
  p.ico(0.58, 1, PALETTE.green, { x: 0.55, y: height, z: 0.2 });
  p.ico(0.54, 1, PALETTE.green, { x: -0.5, y: height + 0.55, z: -0.18 });
}

export function addBush(p, { rng = Math.random } = {}) {
  p.ico(0.5 + rng() * 0.25, 1, PALETTE.greenDark, {
    y: 0.35,
    sx: 1.2,
    sy: 0.72,
  });
}

export function addRock(p, { rng = Math.random } = {}) {
  const size = 0.5 + rng() * 0.8;
  p.ico(size, 0, rng() > 0.5 ? PALETTE.rock : shade(PALETTE.rock, -0.08), {
    y: size * 0.55,
    sx: 1 + rng() * 0.4,
    sy: 0.72 + rng() * 0.3,
    sz: 1 + rng() * 0.3,
    ry: rng() * Math.PI,
  });
}

export function addPaddy(p, { rng = Math.random } = {}) {
  const width = 3.2 + rng() * 1.8;
  const depth = 2.2 + rng() * 1.2;
  p.box(width, 0.09, depth, PALETTE.greenLight, { y: 0.05 });
  for (let i = -2; i <= 2; i += 1) {
    p.box(width * 0.92, 0.025, 0.06, PALETTE.greenDark, {
      y: 0.11,
      z: i * (depth / 6),
    });
  }
  p.box(0.08, 0.14, depth, PALETTE.wood, { x: -width / 2, y: 0.06 });
  p.box(0.08, 0.14, depth, PALETTE.wood, { x: width / 2, y: 0.06 });
}

export function addWarung(p, { rng = Math.random } = {}) {
  const width = 2.6;
  const depth = 1.8;
  const awning = [PALETTE.teal, PALETTE.yellow, PALETTE.coral][Math.floor(rng() * 3)];
  for (const x of [-width * 0.42, width * 0.42]) {
    for (const z of [-depth * 0.38, depth * 0.38]) {
      p.box(0.12, 1.8, 0.12, PALETTE.woodDark, { x, y: 0.9, z });
    }
  }
  p.box(width * 0.9, 0.72, depth * 0.7, PALETTE.creamDark, { y: 0.62 });
  p.box(width, 0.12, depth, awning, { y: 1.84 });
  p.box(width, 0.08, depth, shade(awning, -0.08), { y: 1.7, z: -0.05 });
  p.box(0.7, 0.1, 0.55, PALETTE.wood, { x: 0.2, y: 1.05, z: 0.25 });
  p.box(0.26, 0.3, 0.26, PALETTE.yellow, { x: -0.65, y: 1.22, z: 0.2 });
  p.box(0.22, 0.24, 0.22, PALETTE.coral, { x: 0.7, y: 1.19, z: 0.2 });
}

export function addBoat(p, { rng = Math.random, sail = true } = {}) {
  const hull = rng() > 0.5 ? PALETTE.wood : PALETTE.woodDark;
  p.box(2.5, 0.48, 0.9, hull, { y: 0.18 });
  p.box(0.55, 0.36, 0.9, shade(hull, -0.08), { x: -1.1, y: 0.18, rz: -0.28 });
  p.box(0.55, 0.36, 0.9, shade(hull, -0.08), { x: 1.1, y: 0.18, rz: 0.28 });
  p.box(2.2, 0.06, 0.62, PALETTE.cream, { y: 0.44 });
  if (sail) {
    p.cylinder(0.04, 0.05, 2.0, 4, PALETTE.woodDark, { y: 1.3 });
    p.plane(1.2, 1.45, PALETTE.paper, { x: 0.15, y: 1.55, z: 0.02, ry: 0.08 });
  }
}

export function addIslet(p, { rng = Math.random } = {}) {
  p.circle(1.2 + rng() * 0.8, 10, PALETTE.sand, { y: 0.03, rx: -Math.PI / 2 });
  p.ico(0.7 + rng() * 0.5, 0, PALETTE.rock, { y: 0.4, sy: 0.75 });
  if (rng() > 0.55) addPalm(p, { rng });
}

export function addBridge(p) {
  const length = 15;
  const width = 4.2;
  p.box(length, 0.38, width, PALETTE.wood, { y: 1.05 });
  for (let x = -6; x <= 6; x += 3) {
    for (const z of [-width * 0.42, width * 0.42]) {
      p.box(0.28, 2.6, 0.28, PALETTE.woodDark, { x, y: 0.2, z });
    }
  }
  for (const z of [-width * 0.46, width * 0.46]) {
    p.box(length, 0.12, 0.12, PALETTE.woodDark, { y: 1.9, z });
    for (let x = -6; x <= 6; x += 2) {
      p.box(0.12, 1.0, 0.12, PALETTE.woodDark, { x, y: 1.4, z });
    }
  }
  p.box(3, 0.35, width + 1.2, PALETTE.sand, { x: -length / 2 - 0.5, y: 0.4 });
  p.box(3, 0.35, width + 1.2, PALETTE.sand, { x: length / 2 + 0.5, y: 0.4 });
}

export function addLamp(p) {
  p.cylinder(0.08, 0.11, 2.2, 5, PALETTE.woodDark, { y: 1.1 });
  p.sphere(0.22, 8, 6, PALETTE.yellow, { y: 2.3 });
  p.cone(0.32, 0.26, 6, PALETTE.ink, { y: 2.58 });
}

export function addSmoke(p, { rng = Math.random } = {}) {
  for (let i = 0; i < 3; i += 1) {
    p.sphere(0.2 + i * 0.1, 6, 4, PALETTE.paper, {
      x: (rng() - 0.5) * 0.5,
      y: 2.2 + i * 0.38,
      z: (rng() - 0.5) * 0.5,
      sy: 0.7,
    });
  }
}

export function addLumbung(p, { rng = Math.random } = {}) {
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.45, 0.45]) {
      p.box(0.12, 0.9, 0.12, PALETTE.woodDark, { x, y: 0.45, z });
    }
  }
  p.box(1.5, 1.1, 1.2, PALETTE.cream, { y: 1.35 });
  p.gable(1.9, 0.7, 1.55, PALETTE.roofTeal, { y: 1.88 });
  p.box(0.42, 0.7, 0.05, PALETTE.woodDark, { y: 1.22, z: 0.63 });
}

export function addFence(p, length = 4) {
  for (let x = -length / 2; x <= length / 2; x += 1) {
    p.box(0.08, 0.7, 0.08, PALETTE.wood, { x, y: 0.35 });
  }
  p.box(length, 0.06, 0.06, PALETTE.wood, { y: 0.48 });
  p.box(length, 0.06, 0.06, PALETTE.wood, { y: 0.24 });
}
