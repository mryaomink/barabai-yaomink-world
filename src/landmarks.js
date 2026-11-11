import * as THREE from "three";
import { GeometryBatch, mulberry32 } from "./utils.js";
import { heightAt } from "./worldgen.js";
import {
  PALETTE,
  addBoat,
  addBridge,
  addBush,
  addHouse,
  addLamp,
  addLumbung,
  addPalm,
  addRock,
  addSmoke,
  addTree,
  addWarung,
  createPlacer,
} from "./props.js";
import { vertexMaterial, makeOutline } from "./materials.js";

function pad(p, radius, color = PALETTE.cream) {
  p.circle(radius, 40, color, { rx: -Math.PI / 2, y: 0.025 });
  p.ring(radius * 0.9, radius, 40, PALETTE.creamDark, {
    rx: -Math.PI / 2,
    y: 0.035,
  });
}

function gate(p) {
  pad(p, 9.5, PALETTE.sand);
  p.box(13, 0.3, 5.5, PALETTE.creamDark, { y: 0.16 });

  for (const side of [-1, 1]) {
    const x = side * 5.2;
    p.box(1.7, 0.5, 2.1, PALETTE.creamDark, { x, y: 0.3 });
    p.box(1.45, 6.2, 1.75, PALETTE.cream, { x, y: 3.6 });
    p.box(1.85, 0.35, 2.15, PALETTE.gold, { x, y: 6.75 });
    p.box(1.3, 0.55, 1.55, PALETTE.cream, { x, y: 7.15 });
    p.box(1.05, 0.28, 1.3, PALETTE.gold, { x, y: 7.52 });
    p.box(0.2, 3.2, 0.18, PALETTE.gold, { x: side * 4.6, y: 4.4, z: 1.0 });
    p.box(1.25, 0.75, 0.08, side > 0 ? PALETTE.coral : PALETTE.paper, {
      x: side * 4.6,
      y: 6.5,
      z: 1.0,
    });
  }

  p.box(12.2, 1.25, 1.9, PALETTE.cream, { y: 6.35 });
  p.box(7.4, 1.45, 0.16, PALETTE.gold, { y: 6.35, z: 0.98 });
  p.box(6.9, 0.95, 0.18, PALETTE.ink, { y: 6.35, z: 1.08 });
  p.gable(13.8, 1.35, 2.6, PALETTE.roof, { y: 7.0 });
  p.box(14.1, 0.14, 2.8, PALETTE.roofDark, { y: 7.08 });
  p.box(10.8, 0.22, 1.2, PALETTE.creamDark, { y: 0.12, z: 3.1 });
  p.box(10.8, 0.22, 1.2, PALETTE.creamDark, { y: 0.06, z: 4.1 });
  addLamp(createPlacer(p, { x: -7.2, y: 0, z: 2.4 }));
  addLamp(createPlacer(p, { x: 7.2, y: 0, z: 2.4 }));
}

function plaza(p) {
  p.circle(15, 48, PALETTE.cream, { rx: -Math.PI / 2, y: 0.03 });
  p.circle(11.2, 40, PALETTE.green, { rx: -Math.PI / 2, y: 0.05 });
  p.ring(11.2, 15, 48, PALETTE.creamDark, { rx: -Math.PI / 2, y: 0.06 });
  p.box(4.2, 0.08, 28, PALETTE.cream, { y: 0.1 });
  p.box(28, 0.08, 4.2, PALETTE.cream, { y: 0.1 });

  p.cylinder(3.0, 3.3, 0.6, 10, PALETTE.creamDark, { y: 0.3 });
  p.cylinder(2.4, 2.6, 0.35, 10, PALETTE.cream, { y: 0.72 });
  p.circle(2.25, 24, PALETTE.water, { rx: -Math.PI / 2, y: 0.91 });
  p.cylinder(0.85, 1.1, 1.2, 10, PALETTE.cream, { y: 1.3 });
  p.cylinder(1.25, 1.25, 0.2, 12, PALETTE.gold, { y: 1.95 });
  p.cone(0.42, 1.2, 8, PALETTE.gold, { y: 2.6 });
  p.sphere(0.18, 8, 6, PALETTE.paper, { y: 3.3 });

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.sin(angle) * 8.6;
    const z = Math.cos(angle) * 8.6;
    p.box(1.7, 0.2, 0.55, PALETTE.wood, { x, y: 0.38, z, ry: angle });
    p.box(1.7, 0.55, 0.12, PALETTE.woodDark, { x, y: 0.72, z: z - 0.24, ry: angle });
  }

  p.cylinder(0.09, 0.12, 8.5, 6, PALETTE.creamDark, { y: 4.25, x: 0, z: 0 });
  p.box(2.0, 1.2, 0.06, PALETTE.coral, { x: 1.0, y: 7.7, z: 0 });
  p.box(2.0, 1.2, 0.06, PALETTE.paper, { x: 1.0, y: 8.9, z: 0 });

  for (const [x, z] of [
    [-12, -10],
    [12, -10],
    [-12, 10],
    [12, 10],
  ]) {
    addTree(createPlacer(p, { x, y: 0, z }), { rng: mulberry32((x + z) * 97) });
  }
}

function mosque(p) {
  pad(p, 14, PALETTE.sand);
  p.box(12, 0.35, 10.5, PALETTE.creamDark, { y: 0.18 });
  p.box(9.2, 4.5, 7.4, PALETTE.cream, { y: 2.5 });
  p.box(9.7, 0.45, 7.9, PALETTE.creamDark, { y: 4.75 });
  p.box(7.4, 2.8, 1.8, PALETTE.cream, { y: 1.65, z: 4.2 });
  p.box(7.9, 0.28, 2.1, PALETTE.creamDark, { y: 3.15, z: 4.2 });
  p.box(8.4, 0.2, 8.0, PALETTE.creamDark, { y: 0.42 });

  for (const x of [-2.7, 0, 2.7]) {
    p.box(0.95, 2.0, 0.14, PALETTE.woodDark, { x, y: 1.45, z: 5.14 });
    p.box(0.65, 0.65, 0.16, PALETTE.ink, { x, y: 3.0, z: 5.15 });
  }
  for (const x of [-3.6, 3.6]) {
    p.box(0.34, 2.7, 0.34, PALETTE.cream, { x, y: 1.6, z: 5.0 });
    p.box(0.55, 0.2, 0.55, PALETTE.gold, { x, y: 3.0, z: 5.0 });
  }

  p.cylinder(3.15, 3.25, 0.55, 18, PALETTE.cream, { y: 5.0 });
  p.dome(3.0, 24, 12, PALETTE.gold, { y: 5.2 });
  p.cylinder(0.18, 0.28, 1.1, 8, PALETTE.gold, { y: 8.4 });
  p.sphere(0.22, 8, 6, PALETTE.paper, { y: 9.0 });

  for (const x of [-3.15, 3.15]) {
    p.cylinder(1.05, 1.15, 0.35, 14, PALETTE.cream, { x, y: 4.95, z: -0.6 });
    p.dome(1.0, 16, 8, PALETTE.gold, { x, y: 5.1, z: -0.6 });
    p.cone(0.12, 0.55, 6, PALETTE.gold, { x, y: 6.2, z: -0.6 });
  }

  p.box(1.5, 10.5, 1.5, PALETTE.cream, { x: 6.2, y: 5.3, z: -2.0 });
  p.box(1.8, 0.4, 1.8, PALETTE.creamDark, { x: 6.2, y: 10.2, z: -2.0 });
  p.torus(1.15, 0.13, 6, 16, PALETTE.gold, { x: 6.2, y: 9.1, z: -2.0, rx: Math.PI / 2 });
  p.cylinder(1.1, 1.25, 0.4, 12, PALETTE.cream, { x: 6.2, y: 10.5, z: -2.0 });
  p.dome(1.1, 16, 8, PALETTE.gold, { x: 6.2, y: 10.6, z: -2.0 });
  p.cone(0.16, 1.0, 6, PALETTE.gold, { x: 6.2, y: 11.9, z: -2.0 });

  p.box(7.0, 0.2, 1.0, PALETTE.cream, { y: 0.35, z: 5.5 });
  p.box(7.0, 0.2, 1.0, PALETTE.cream, { y: 0.2, z: 6.3 });
  addLamp(createPlacer(p, { x: -5.7, y: 0, z: 4.6 }));
  addLamp(createPlacer(p, { x: 5.7, y: 0, z: 4.6 }));
}

function market(p) {
  p.box(18, 0.22, 12, PALETTE.creamDark, { y: 0.12 });
  const rng = mulberry32(914);
  const stalls = [
    [-5.2, -2.4, 0.1],
    [0, -2.8, -0.05],
    [5.2, -2.3, 0.12],
    [-3.4, 2.1, 0.04],
    [3.1, 2.3, -0.08],
    [-6.6, 0.2, 0.5],
    [6.5, 0.1, -0.45],
  ];
  for (const [x, z, rotation] of stalls) {
    const p2 = createPlacer(p, { x, y: 0.22, z, ry: rotation });
    for (const px of [-1.2, 1.2]) {
      for (const pz of [-0.8, 0.8]) {
        p2.box(0.12, 1.8, 0.12, PALETTE.woodDark, { x: px, y: 0.9, z: pz });
      }
    }
    p2.box(2.5, 0.75, 1.5, PALETTE.wood, { y: 0.55 });
    for (let i = 0; i < 4; i += 1) {
      p2.box(0.55, 0.06, 1.7, i % 2 ? PALETTE.paper : PALETTE.coral, {
        x: -0.96 + i * 0.64,
        y: 1.85,
        rz: 0.06,
      });
    }
    p2.box(0.26, 0.3, 0.26, PALETTE.yellow, { x: -0.55, y: 1.1, z: 0.3 });
    p2.box(0.22, 0.24, 0.22, PALETTE.coral, { x: 0.45, y: 1.05, z: 0.3 });
    p2.sphere(0.28, 7, 5, PALETTE.paper, { x: 0.1, y: 1.0, z: -0.25, sy: 0.7 });
    addSmoke(p2, { rng });
  }

  for (const [x, z] of [
    [-7.6, -1.5],
    [-2.1, -0.4],
    [2.4, -0.2],
    [7.7, 2.2],
    [-4.8, 4.0],
    [4.6, 4.1],
  ]) {
    p.box(0.68, 0.5, 0.68, PALETTE.wood, { x, y: 0.45, z, ry: (x + z) * 0.12 });
    p.box(0.58, 0.06, 0.58, PALETTE.woodDark, { x, y: 0.72, z, ry: (x + z) * 0.12 });
  }
  for (const [x, z] of [
    [-6.4, 1.2],
    [1.2, 0.4],
    [6.1, 3.6],
    [-1.8, 4.2],
  ]) {
    p.cylinder(0.34, 0.46, 0.38, 8, PALETTE.wood, { x, y: 0.42, z });
    p.sphere(0.28, 7, 5, PALETTE.yellow, { x, y: 0.68, z, sy: 0.8 });
    p.sphere(0.2, 7, 5, PALETTE.coral, { x: x + 0.3, y: 0.66, z: z + 0.18, sy: 0.8 });
  }
  for (const [x, z] of [
    [-2.8, -1.1],
    [2.8, -1.0],
    [0.4, 3.6],
  ]) {
    p.ico(0.46, 1, PALETTE.creamDark, { x, y: 0.4, z, sy: 0.7 });
  }

  p.box(2.4, 0.7, 1.1, PALETTE.wood, { x: -6.6, y: 0.85, z: 3.1 });
  p.cylinder(0.38, 0.38, 0.14, 10, PALETTE.ink, { x: -6.9, y: 1.3, z: 3.1 });
  p.cylinder(0.38, 0.38, 0.14, 10, PALETTE.ink, { x: -5.9, y: 1.3, z: 3.1 });
  p.sphere(0.3, 8, 6, PALETTE.cream, { x: -6.9, y: 1.4, z: 3.1, sy: 0.55 });
  p.sphere(0.3, 8, 6, PALETTE.cream, { x: -5.9, y: 1.4, z: 3.1, sy: 0.55 });
  p.cylinder(0.36, 0.36, 0.16, 10, PALETTE.woodDark, { x: -7.5, y: 0.45, z: 3.1, rz: Math.PI / 2 });
  p.cylinder(0.36, 0.36, 0.16, 10, PALETTE.woodDark, { x: -5.7, y: 0.45, z: 3.1, rz: Math.PI / 2 });
  addSmoke(createPlacer(p, { x: -6.6, y: 1.7, z: 3.1 }), { rng });

  p.box(15.2, 0.05, 0.05, PALETTE.ink, { y: 3.5, z: -4.9 });
  for (let i = 0; i < 12; i += 1) {
    p.box(0.34, 0.42, 0.04, i % 2 ? PALETTE.coral : PALETTE.yellow, {
      x: -7.1 + i * 1.3,
      y: 3.25,
      z: -4.9,
      rz: 0.12,
    });
  }

  p.box(7.5, 1.4, 0.22, PALETTE.gold, { y: 3.1, z: -5.8 });
  p.box(7.0, 0.9, 0.25, PALETTE.ink, { y: 3.1, z: -5.92 });
  addLumbung(createPlacer(p, { x: -7.5, y: 0.2, z: 4.2, ry: 0.2 }));
  addLumbung(createPlacer(p, { x: 7.4, y: 0.2, z: 4.0, ry: -0.2 }));
  addLamp(createPlacer(p, { x: -8.0, y: 0.2, z: -5.0 }));
  addLamp(createPlacer(p, { x: 8.0, y: 0.2, z: -5.0 }));
  addLamp(createPlacer(p, { x: 0, y: 0.2, z: 5.2 }));
}

function park(p) {
  p.circle(16, 48, PALETTE.green, { rx: -Math.PI / 2, y: 0.03, sx: 1.25 });
  p.ring(10.5, 13.2, 48, PALETTE.sand, { rx: -Math.PI / 2, y: 0.06, sx: 1.28 });
  p.ring(6.0, 8.4, 48, PALETTE.creamDark, { rx: -Math.PI / 2, y: 0.065, sx: 1.3 });
  p.circle(5.5, 32, PALETTE.greenLight, { rx: -Math.PI / 2, y: 0.07, sx: 1.3 });

  p.cylinder(2.2, 2.4, 0.4, 12, PALETTE.cream, { y: 0.25, x: 0 });
  p.circle(1.8, 24, PALETTE.water, { rx: -Math.PI / 2, y: 0.47 });
  p.cylinder(0.5, 0.7, 1.3, 10, PALETTE.creamDark, { y: 1.05 });
  p.sphere(0.3, 8, 6, PALETTE.gold, { y: 1.8 });

  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.sin(angle) * 11.5 * 1.18;
    const z = Math.cos(angle) * 11.5;
    p.box(1.4, 0.16, 0.5, PALETTE.wood, { x, y: 0.36, z, ry: angle });
  }

  for (const [x, z] of [
    [-12, -8],
    [12, -8],
    [-13, 7],
    [13, 7],
    [0, -13],
  ]) {
    addTree(createPlacer(p, { x, y: 0.05, z }), { rng: mulberry32((x * 7 + z) * 13) });
  }
  addPalm(createPlacer(p, { x: -8, y: 0.05, z: 9, ry: 0.4 }));
  addPalm(createPlacer(p, { x: 9, y: 0.05, z: 10, ry: -0.5 }));

  p.box(3.2, 1.5, 2.4, PALETTE.cream, { x: -4.2, y: 0.85, z: -3.2, ry: 0.1 });
  p.gable(3.8, 0.7, 3.0, PALETTE.roofTeal, { x: -4.2, y: 1.6, z: -3.2, ry: 0.1 });
  p.box(2.4, 0.16, 0.4, PALETTE.wood, { x: -4.2, y: 0.5, z: -2.0, ry: 0.1 });
  p.box(2.4, 0.16, 0.4, PALETTE.wood, { x: -4.2, y: 0.3, z: -1.8, ry: 0.1 });
}

function hill(p) {
  p.circle(6.2, 34, PALETTE.sand, { rx: -Math.PI / 2, y: 0.03 });
  const rng = mulberry32(4242);
  p.ico(3.8, 1, PALETTE.rock, { y: 1.2, sy: 0.55, sx: 1.35, sz: 1.15 });
  p.ico(2.2, 1, PALETTE.rock, { x: -2.8, y: 0.6, z: 1.6, sy: 0.45, ry: 0.8 });
  p.ico(1.6, 1, PALETTE.rock, { x: 2.9, y: 0.5, z: 1.1, sy: 0.4, ry: 1.4 });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + 0.2;
    const radius = 6.8 + rng() * 2.2;
    p.ico(0.8 + rng() * 0.8, 0, i % 2 ? PALETTE.rock : PALETTE.greenDark, {
      x: Math.sin(angle) * radius,
      y: 0.5 + rng() * 0.5,
      z: Math.cos(angle) * radius,
      sx: 1.25,
      sy: 0.7,
      ry: rng() * Math.PI,
    });
  }

  for (const [x, z] of [
    [-2.35, -2.35],
    [2.35, -2.35],
    [-2.35, 2.35],
    [2.35, 2.35],
  ]) {
    p.box(0.28, 6.9, 0.28, PALETTE.woodDark, { x, y: 3.45, z });
  }
  p.box(5.9, 0.38, 5.9, PALETTE.wood, { y: 6.9 });
  p.box(5.1, 0.18, 5.1, PALETTE.woodDark, { y: 6.68 });

  for (let i = 0; i < 12; i += 1) {
    p.box(1.5, 0.26, 0.48, i % 2 ? PALETTE.wood : PALETTE.woodDark, {
      x: 0,
      y: 0.5 + i * 0.5,
      z: 5.9 - i * 0.34,
    });
  }

  for (const [x, z] of [
    [-2.7, -2.7],
    [2.7, -2.7],
    [-2.7, 2.7],
    [2.7, 2.7],
  ]) {
    p.box(0.16, 1.15, 0.16, PALETTE.woodDark, { x, y: 7.65, z });
  }
  for (const [x, z, w, d] of [
    [0, -2.8, 5.6, 0.14],
    [0, 2.8, 5.6, 0.14],
    [-2.8, 0, 0.14, 5.6],
    [2.8, 0, 0.14, 5.6],
  ]) {
    p.box(w, 0.14, d, PALETTE.woodDark, { x, y: 8.2, z });
  }

  for (const [x, z] of [
    [-2.2, -2.2],
    [2.2, -2.2],
    [-2.2, 2.2],
    [2.2, 2.2],
  ]) {
    p.box(0.22, 2.5, 0.22, PALETTE.woodDark, { x, y: 8.4, z });
  }
  p.gable(7.0, 1.7, 6.4, PALETTE.roof, { y: 9.5 });
  p.box(7.2, 0.12, 6.6, PALETTE.roofDark, { y: 9.56 });
  p.ico(0.28, 1, PALETTE.gold, { y: 10.95 });

  p.box(1.9, 0.2, 0.5, PALETTE.wood, { x: -1.5, y: 7.3, z: -1.2, ry: 0.2 });
  p.box(1.9, 0.2, 0.5, PALETTE.wood, { x: 1.5, y: 7.3, z: -1.2, ry: -0.2 });

  p.cylinder(0.08, 0.11, 4.4, 5, PALETTE.woodDark, { x: 2.8, y: 11.4, z: -2.8 });
  p.box(2.0, 1.15, 0.06, PALETTE.coral, { x: 3.8, y: 12.6, z: -2.8 });
  p.box(2.0, 0.12, 0.08, PALETTE.gold, { x: 3.8, y: 12.1, z: -2.8 });

  p.box(3.2, 0.9, 0.16, PALETTE.gold, { x: -4.4, y: 1.4, z: 4.4, ry: 0.35 });
  p.box(2.8, 0.55, 0.18, PALETTE.ink, { x: -4.4, y: 1.4, z: 4.31, ry: 0.35 });

  addLamp(createPlacer(p, { x: -4.8, y: 0.1, z: 1.2 }));
  addLamp(createPlacer(p, { x: 4.8, y: 0.1, z: 1.2 }));
  for (const [x, z] of [
    [-7.4, 2.0],
    [7.2, -2.2],
    [-6.0, -5.6],
    [5.8, 5.0],
  ]) {
    addTree(createPlacer(p, { x, y: 0, z }), { rng: mulberry32((x + z * 9) * 17) });
  }
  addBush(createPlacer(p, { x: -3.6, y: 0.2, z: -4.2 }), { rng: mulberry32(91) });
  addBush(createPlacer(p, { x: 3.7, y: 0.2, z: -3.9 }), { rng: mulberry32(92) });
}

function riverDock(p, baseY) {
  p.box(6.0, 0.25, 10.0, PALETTE.sand, { x: 2.5, y: 0.12 });
  const waterLocal = 0.18 - baseY;

  for (let i = 0; i < 13; i += 1) {
    p.box(1.05, 0.14, 3.4, i % 2 ? PALETTE.wood : PALETTE.woodDark, {
      x: -i * 1.05,
      y: 0.35,
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const x = -i * 2.4;
    for (const z of [-1.35, 1.35]) {
      p.box(0.2, 2.5, 0.2, PALETTE.woodDark, {
        x,
        y: -0.45,
        z,
      });
    }
  }
  for (const z of [-1.7, 1.7]) {
    p.box(13.2, 0.12, 0.12, PALETTE.woodDark, { x: -6.0, y: 1.0, z });
    for (let i = 0; i < 6; i += 1) {
      p.box(0.12, 0.7, 0.12, PALETTE.woodDark, { x: -i * 2.4, y: 0.6, z });
    }
  }

  p.box(3.0, 2.0, 2.6, PALETTE.cream, { x: 2.4, y: 1.3, z: -2.4, ry: 0.2 });
  p.gable(3.6, 0.8, 3.1, PALETTE.roofTeal, { x: 2.4, y: 2.3, z: -2.4, ry: 0.2 });
  p.box(0.8, 1.3, 0.08, PALETTE.woodDark, { x: 2.4, y: 1.05, z: -1.07, ry: 0.2 });

  const boatA = createPlacer(p, { x: -8.2, y: waterLocal, z: 1.8, ry: 1.15 });
  addBoat(boatA, { rng: mulberry32(19) });
  const boatB = createPlacer(p, { x: -11.0, y: waterLocal, z: -1.4, ry: 0.4 });
  addBoat(boatB, { rng: mulberry32(27), sail: false });

  addLamp(createPlacer(p, { x: -1.2, y: 0.35, z: -1.7 }));
  addLamp(createPlacer(p, { x: -6.0, y: 0.35, z: 1.7 }));
  addPalm(createPlacer(p, { x: 5.0, y: 0.05, z: 3.8, ry: 0.4 }));
  addTree(createPlacer(p, { x: 5.3, y: 0.05, z: -4.2 }), { rng: mulberry32(71) });
  p.box(3.8, 1.2, 0.16, PALETTE.gold, { x: 0.8, y: 2.2, z: -4.5 });
  p.box(3.4, 0.8, 0.18, PALETTE.ink, { x: 0.8, y: 2.2, z: -4.62 });
}

const BUILDERS = {
  gerbang: gate,
  "alun-alun": plaza,
  masjid: mosque,
  pasar: market,
  taman: park,
  bukit: hill,
  sungai: riverDock,
};

export function buildLandmark(landmark) {
  const batch = new GeometryBatch();
  const p = createPlacer(batch);
  const builder = BUILDERS[landmark.id];
  if (!builder) return null;

  const baseY = heightAt(landmark.x, landmark.z);
  if (landmark.id === "sungai") builder(p, baseY);
  else builder(p);

  const geometry = batch.toGeometry();
  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, vertexMaterial);
  mesh.position.set(landmark.x, baseY, landmark.z);
  mesh.rotation.y = landmark.rotation ?? 0;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);

  const outline = makeOutline(geometry, 26);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.matrixAutoUpdate = false;
  outline.updateMatrix();
  outline.updateMatrixWorld(true);

  const group = new THREE.Group();
  group.add(mesh, outline);
  group.userData.landmark = landmark.id;
  group.userData.baseY = baseY;
  return group;
}

export function buildRiverBridge(x, z, rotation = 0, baseY = 1.4) {
  const batch = new GeometryBatch();
  const p = createPlacer(batch);
  addBridge(p);
  const geometry = batch.toGeometry();
  if (!geometry) return null;

  const mesh = new THREE.Mesh(geometry, vertexMaterial);
  mesh.position.set(x, baseY, z);
  mesh.rotation.y = rotation;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();

  const outline = makeOutline(geometry, 26);
  outline.position.copy(mesh.position);
  outline.rotation.copy(mesh.rotation);
  outline.matrixAutoUpdate = false;
  outline.updateMatrix();

  const group = new THREE.Group();
  group.add(mesh, outline);
  return group;
}
