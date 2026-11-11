import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import fontData from "./fonts/helvetiker_bold.typeface.json";
import {
  GeometryBatch,
  clamp,
  composeMatrix,
  fbm,
  hash2,
  lerp,
  mulberry32,
  smoothstep,
} from "./utils.js";
import {
  PALETTE,
  addBoat,
  addHouse,
  addLumbung,
  addPalm,
  addRock,
  addTree,
  addWarung,
  createPlacer,
} from "./props.js";
import { TEAL, flatMaterial, makeOutline, vertexMaterial } from "./materials.js";

const DEG = Math.PI / 180;
const PLANET_RADIUS = 10.4;

const PLANET_LANDMARKS = [
  { id: "alun", lat: 0, lon: 91, radius: 2.6 },
  { id: "masjid", lat: 10, lon: 98, radius: 2.1 },
  { id: "pasar", lat: -8, lon: 81, radius: 2.0 },
  { id: "taman", lat: 4, lon: 74, radius: 1.8 },
  { id: "gerbang", lat: 25, lon: 92, radius: 1.5 },
  { id: "dermaga", lat: -11, lon: 110, radius: 1.8 },
];

const RIVER = [
  [35, 58],
  [31, 66],
  [27, 74],
  [22, 82],
  [17, 90],
  [12, 98],
  [7, 105],
  [1, 111],
  [-5, 116],
  [-12, 122],
  [-20, 128],
  [-29, 133],
];

const ROAD_PATHS = [
  [
    [31, 59],
    [27, 68],
    [22, 77],
    [16, 85],
    [10, 91],
    [4, 92],
    [0, 91],
    [-3, 84],
    [-6, 76],
  ],
  [
    [0, 66],
    [0, 74],
    [0, 82],
    [0, 91],
    [0, 100],
    [0, 108],
    [0, 116],
  ],
  [
    [0, 91],
    [8, 95],
    [16, 99],
    [24, 104],
    [31, 110],
  ],
  [
    [0, 91],
    [-8, 87],
    [-16, 83],
    [-23, 78],
    [-30, 72],
  ],
];

function sphereFrame(lat, lon, radius = PLANET_RADIUS) {
  const phi = (90 - lat) * DEG;
  const theta = lon * DEG;
  const normal = new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ).normalize();
  const position = normal.clone().multiplyScalar(radius);
  const east = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const south = new THREE.Vector3().crossVectors(east, normal).normalize();
  const matrix = new THREE.Matrix4().makeBasis(east, normal, south);
  matrix.setPosition(position);
  return { matrix, east, south, normal, position };
}

function addSpherePath(batch, points, width, color, lift = 0.045) {
  const worldPoints = points.map(([lat, lon]) => {
    const frame = sphereFrame(lat, lon);
    return frame.position.clone().addScaledVector(frame.normal, lift);
  });

  for (let i = 0; i < worldPoints.length - 1; i += 1) {
    const a = worldPoints[i];
    const b = worldPoints[i + 1];
    const midLat = (points[i][0] + points[i + 1][0]) * 0.5;
    const midLon = (points[i][1] + points[i + 1][1]) * 0.5;
    const frame = sphereFrame(midLat, midLon);
    const direction = b.clone().sub(a);
    const dx = direction.dot(frame.east);
    const dz = direction.dot(frame.south);
    const angle = Math.atan2(dx, dz);
    const length = direction.length() + 0.06;
    const local = composeMatrix({ y: lift, ry: angle });
    const matrix = frame.matrix.clone().multiply(local);
    batch.add(new THREE.BoxGeometry(width, 0.035, length), color, { matrix });
  }
}

function surfacePoint(lat, lon, lift = 0.06) {
  const frame = sphereFrame(lat, lon);
  return frame.position.clone().addScaledVector(frame.normal, lift);
}

function nearRiver(position, threshold = 0.55) {
  for (const [lat, lon] of RIVER) {
    if (surfacePoint(lat, lon).distanceTo(position) < threshold) return true;
  }
  return false;
}

function nearLandmark(position, threshold = 1.4) {
  for (const landmark of PLANET_LANDMARKS) {
    if (surfacePoint(landmark.lat, landmark.lon).distanceTo(position) < threshold) return true;
  }
  return false;
}

function planetBase() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 56, 36);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const green = new THREE.Color(PALETTE.green);
  const greenDark = new THREE.Color(PALETTE.greenDark);
  const sand = new THREE.Color(PALETTE.sand);
  const rock = new THREE.Color(PALETTE.rock);

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i) / PLANET_RADIUS;
    const y = position.getY(i) / PLANET_RADIUS;
    const z = position.getZ(i) / PLANET_RADIUS;
    const noise = fbm(x * 2.4 + 6.2, z * 2.4 + y * 1.8, 3);
    const variation = (hash2(x * 8.1 + 2.7, z * 8.1 - 4.2) - 0.5) * 0.07;

    let color;
    if (y < -0.28) color = rock.clone().lerp(sand, 0.18);
    else if (noise < 0.42) color = sand.clone();
    else if (noise > 0.61) color = greenDark.clone();
    else color = green.clone();

    color.offsetHSL(0, 0, variation);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, vertexMaterial);
  return mesh;
}

function planetTown() {
  const batch = new GeometryBatch();

  addSpherePath(batch, RIVER, 1.0, PALETTE.sand, 0.035);
  addSpherePath(batch, RIVER, 0.66, PALETTE.water, 0.05);
  for (const road of ROAD_PATHS) {
    addSpherePath(batch, road, 0.34, PALETTE.sand, 0.05);
    addSpherePath(batch, road, 0.22, PALETTE.creamDark, 0.062);
  }

  const random = mulberry32(7301);
  const latStart = -31;
  const latEnd = 32;
  const lonStart = 58;
  const lonEnd = 128;

  for (let lat = latStart; lat <= latEnd; lat += 5.6) {
    for (let lon = lonStart; lon <= lonEnd; lon += 5.4) {
      const jitterLat = lat + (random() - 0.5) * 2.5;
      const jitterLon = lon + (random() - 0.5) * 2.4;
      const frame = sphereFrame(jitterLat, jitterLon);
      const point = frame.position.clone();
      if (nearRiver(point, 0.62) || nearLandmark(point, 1.55)) continue;
      const roll = random();
      if (roll < 0.16) continue;

      const scale = 0.34 + random() * 0.16;
      const parent = frame.matrix
        .clone()
        .multiply(composeMatrix({ ry: random() * Math.PI * 2, sx: scale, sy: scale, sz: scale }));
      const placer = createPlacer(batch, { matrix: parent });

      if (roll < 0.63) addHouse(placer, { rng: random });
      else if (roll < 0.8) addTree(placer, { rng: random });
      else if (roll < 0.9) addPalm(placer, { rng: random });
      else if (roll < 0.96) addWarung(placer, { rng: random });
      else addLumbung(placer, { rng: random });
    }
  }

  const randomEdge = mulberry32(339);
  for (let i = 0; i < 28; i += 1) {
    const lat = -36 + randomEdge() * 72;
    const lon = 54 + randomEdge() * 80;
    const frame = sphereFrame(lat, lon);
    const point = frame.position.clone();
    if (nearRiver(point, 0.9) || nearLandmark(point, 1.8)) continue;
    const parent = frame.matrix.clone().multiply(
      composeMatrix({
        ry: randomEdge() * Math.PI * 2,
        sx: 0.42,
        sy: 0.42,
        sz: 0.42,
      }),
    );
    const placer = createPlacer(batch, { matrix: parent });
    if (randomEdge() < 0.55) addTree(placer, { rng: randomEdge });
    else if (randomEdge() < 0.8) addPalm(placer, { rng: randomEdge });
    else addRock(placer, { rng: randomEdge });
  }

  for (const landmark of PLANET_LANDMARKS) {
    const frame = sphereFrame(landmark.lat, landmark.lon);
    const scale = landmark.id === "alun" ? 0.62 : 0.48;
    const parent = frame.matrix
      .clone()
      .multiply(composeMatrix({ sx: scale, sy: scale, sz: scale }));
    const placer = createPlacer(batch, { matrix: parent });

    if (landmark.id === "alun") {
      placer.circle(2.8, 28, PALETTE.cream, { rx: -Math.PI / 2, y: 0.08 });
      placer.circle(2.1, 24, PALETTE.green, { rx: -Math.PI / 2, y: 0.1 });
      placer.cylinder(0.7, 0.9, 0.6, 10, PALETTE.cream, { y: 0.4 });
      placer.circle(0.55, 16, PALETTE.water, { rx: -Math.PI / 2, y: 0.72 });
      placer.cylinder(0.1, 0.12, 3.4, 5, PALETTE.creamDark, { y: 1.8 });
      placer.box(0.85, 0.5, 0.04, PALETTE.coral, { x: 0.42, y: 3.2 });
    } else if (landmark.id === "masjid") {
      placer.box(3.2, 1.8, 2.7, PALETTE.cream, { y: 0.95 });
      placer.cylinder(1.3, 1.35, 0.3, 14, PALETTE.cream, { y: 1.9 });
      placer.dome(1.25, 16, 8, PALETTE.gold, { y: 2.05 });
      placer.cylinder(0.36, 0.46, 4.4, 8, PALETTE.cream, { x: 2.1, y: 2.2 });
      placer.dome(0.42, 10, 6, PALETTE.gold, { x: 2.1, y: 4.4 });
      placer.cone(0.1, 0.7, 5, PALETTE.gold, { x: 2.1, y: 5.2 });
    } else if (landmark.id === "pasar") {
      for (const [x, z] of [
        [-0.9, -0.6],
        [0.9, -0.6],
        [0, 0.9],
      ]) {
        placer.box(1.35, 0.15, 1.0, PALETTE.wood, { x, y: 0.8, z });
        placer.box(1.45, 0.08, 1.1, x > 0 ? PALETTE.coral : PALETTE.teal, {
          x,
          y: 1.7,
          z,
        });
        for (const px of [-0.55, 0.55]) {
          placer.box(0.08, 1.1, 0.08, PALETTE.woodDark, { x: x + px, y: 0.55, z });
        }
      }
    } else if (landmark.id === "taman") {
      placer.circle(2.4, 26, PALETTE.green, { rx: -Math.PI / 2, y: 0.08, sx: 1.25 });
      placer.ring(1.3, 1.9, 24, PALETTE.sand, { rx: -Math.PI / 2, y: 0.1, sx: 1.25 });
      placer.cylinder(0.45, 0.55, 0.4, 8, PALETTE.cream, { y: 0.28 });
      placer.circle(0.35, 12, PALETTE.water, { rx: -Math.PI / 2, y: 0.5 });
      addTree(createPlacer(placer, { x: -1.4, y: 0.05, z: 0.4, sx: 0.7, sy: 0.7, sz: 0.7 }), { rng: randomEdge });
      addPalm(createPlacer(placer, { x: 1.4, y: 0.05, z: 0.6, sx: 0.7, sy: 0.7, sz: 0.7 }), { rng: randomEdge });
    } else if (landmark.id === "gerbang") {
      placer.box(0.35, 2.2, 0.4, PALETTE.cream, { x: -1.1, y: 1.1 });
      placer.box(0.35, 2.2, 0.4, PALETTE.cream, { x: 1.1, y: 1.1 });
      placer.box(2.9, 0.4, 0.5, PALETTE.gold, { y: 2.2 });
      placer.gable(3.2, 0.5, 0.8, PALETTE.roof, { y: 2.4 });
    } else if (landmark.id === "dermaga") {
      for (let i = 0; i < 6; i += 1) {
        placer.box(0.7, 0.08, 0.85, i % 2 ? PALETTE.wood : PALETTE.woodDark, {
          x: -i * 0.65,
          y: 0.15,
        });
      }
      placer.box(4.0, 0.08, 0.12, PALETTE.woodDark, { x: -1.6, y: 0.5, z: 0.5 });
      addBoat(createPlacer(placer, { x: -3.3, y: 0.1, z: 0.6, sx: 0.55, sy: 0.55, sz: 0.55, ry: 1.2 }));
    }
  }

  const geometry = batch.toGeometry();
  if (!geometry) return null;
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, vertexMaterial);
  group.add(mesh, makeOutline(geometry, 32));
  return group;
}

function floatingRocks() {
  const batch = new GeometryBatch();
  const random = mulberry32(918);
  const spots = [
    [-12.8, 3.8, 4.2, 0.8],
    [12.4, 4.4, 2.8, 0.6],
    [-12.1, -4.2, 1.6, 0.55],
    [12.8, -3.0, 5.2, 0.72],
    [8.8, 8.4, 1.0, 0.5],
    [-8.2, -7.2, 3.0, 0.62],
  ];
  for (const [x, y, z, scale] of spots) {
    const placer = createPlacer(batch, {
      x,
      y,
      z,
      ry: random() * Math.PI * 2,
      sx: scale,
      sy: scale,
      sz: scale,
    });
    addRock(placer, { rng: random });
    if (random() > 0.45) {
      addTree(createPlacer(placer, { x: 0.2, y: 0.5, z: -0.1, sx: 0.7, sy: 0.7, sz: 0.7 }), {
        rng: random,
      });
    }
  }
  const geometry = batch.toGeometry();
  if (!geometry) return null;
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, vertexMaterial), makeOutline(geometry, 28));
  return group;
}

function makeTitle(font) {
  const group = new THREE.Group();
  const material = flatMaterial(0xf3efe4);
  const tracking = 0.48;
  const size = 5.15;
  const depth = 1.35;

  function makeRow(text, y) {
    const row = new THREE.Group();
    let cursor = 0;
    const letterMeshes = [];
    for (const char of text) {
      const geometry = new TextGeometry(char, {
        font,
        size,
        depth,
        curveSegments: 4,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.055,
        bevelSegments: 1,
      });
      geometry.computeBoundingBox();
      const width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.x = cursor;
      const outline = makeOutline(geometry, 24);
      outline.position.copy(mesh.position);
      row.add(mesh, outline);
      letterMeshes.push({ mesh, width });
      cursor += width + tracking;
    }
    const total = cursor - tracking;
    row.position.x = -total * 0.5;
    row.position.y = y;
    group.add(row);
    return row;
  }

  const top = makeRow("BARA", 2.55);
  const bottom = makeRow("BAI", -3.35);
  group.position.z = 12.3;
  group.rotation.x = -0.015;
  return { group, top, bottom };
}

export function createLanding() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TEAL);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 240);
  const base = { x: 0, y: 2.2, z: 72 };
  camera.position.set(base.x, base.y, base.z);
  camera.lookAt(0, 0.3, 0);

  const hemisphere = new THREE.HemisphereLight(0xfff5df, 0x6fb3a8, 2.6);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xfff0cf, 2.4);
  sun.position.set(-32, 52, 68);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9ee0d8, 1.35);
  fill.position.set(32, -30, 48);
  scene.add(fill);
  const ambient = new THREE.AmbientLight(0xfff4dd, 0.3);
  scene.add(ambient);

  const root = new THREE.Group();
  scene.add(root);

  const planet = new THREE.Group();
  root.add(planet);
  planet.add(planetBase());
  const town = planetTown();
  if (town) planet.add(town);

  const rocks = floatingRocks();
  if (rocks) root.add(rocks);

  const font = new FontLoader().parse(fontData);
  const title = makeTitle(font);
  root.add(title.group);

  let baseZ = 72;
  let started = false;
  let elapsed = 0;
  let launchTime = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize(width, height) {
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 36 : 32;
    baseZ = aspect < 0.8 ? 101 : 72;
    base.z = baseZ;
    if (!started) camera.position.z = baseZ;
    camera.updateProjectionMatrix();
  }

  function start() {
    if (started) return;
    started = true;
    launchTime = 0;
    elapsed = 0;
  }

  function update(dt, time) {
    elapsed += dt;
    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-3 * dt));
    pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-3 * dt));

    planet.rotation.y = Math.sin(time * 0.075) * 0.055;
    planet.rotation.x = Math.sin(time * 0.045 + 1.2) * 0.018;
    title.group.position.y = Math.sin(time * 0.8) * 0.075;
    title.group.rotation.y = pointer.x * 0.035;
    title.group.rotation.x = -0.015 + pointer.y * 0.02;

    if (started) {
      launchTime += dt;
      const t = clamp(launchTime / 1.25, 0, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.z = lerp(baseZ, 19, eased);
      camera.position.y = lerp(base.y, 0.6, eased);
      camera.position.x = pointer.x * (1 - eased) * 1.1;
      planet.scale.setScalar(1 + eased * 0.35);
      title.group.scale.setScalar(1 + eased * 0.16);
      title.group.position.z = 12.3 + eased * 2.2;
    } else {
      camera.position.x = pointer.x * 1.1;
      camera.position.y = base.y + pointer.y * 0.7;
      camera.position.z = baseZ;
    }

    camera.lookAt(0, 0.25, 0);
  }

  function setPointer(x, y) {
    pointer.tx = x;
    pointer.ty = y;
  }

  return {
    scene,
    camera,
    start,
    update,
    resize,
    setPointer,
    get started() {
      return started;
    },
  };
}
