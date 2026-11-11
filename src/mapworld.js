import * as THREE from "three";
import { LANDMARKS } from "./data.js";
import {
  CHUNK_SIZE,
  LOAD_RADIUS,
  buildChunk,
  heightAt,
  riverX,
} from "./worldgen.js";
import { buildLandmark, buildRiverBridge } from "./landmarks.js";
import { TEAL, vertexMaterial, outlineMaterial } from "./materials.js";
import { mulberry32 } from "./utils.js";

const WATER_TILE = 120;

function makeWaterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const random = mulberry32(8102);

  context.fillStyle = "#69c5c2";
  context.fillRect(0, 0, 512, 512);

  context.lineCap = "round";
  for (let i = 0; i < 70; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    const radius = 10 + random() * 55;
    context.beginPath();
    context.globalAlpha = 0.08 + random() * 0.13;
    context.strokeStyle = random() > 0.5 ? "#8fd8d3" : "#54b1b0";
    context.lineWidth = 1 + random() * 3;
    context.arc(x, y, radius, random() * Math.PI, random() * Math.PI + 0.8 + random() * 1.8);
    context.stroke();
  }
  for (let i = 0; i < 45; i += 1) {
    const x = random() * 512;
    const y = random() * 512;
    context.globalAlpha = 0.1 + random() * 0.12;
    context.fillStyle = random() > 0.5 ? "#a7e2db" : "#4eaaa9";
    context.beginPath();
    context.arc(x, y, 1.5 + random() * 5, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addLights(scene) {
  const hemisphere = new THREE.HemisphereLight(0xfff3d8, 0x4c9a95, 2.25);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffefc9, 2.45);
  sun.position.set(-70, 130, 55);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x9edbd4, 0.7);
  fill.position.set(80, 40, -60);
  scene.add(fill);
}

function disposeChunk(entry) {
  if (!entry) return;
  if (entry.mesh) {
    entry.mesh.geometry.dispose();
    entry.mesh.removeFromParent();
  }
  if (entry.outline) {
    entry.outline.geometry.dispose();
    entry.outline.removeFromParent();
  }
}

export function createMapWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TEAL);
  scene.fog = new THREE.FogExp2(TEAL, 0.0029);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1000);
  camera.position.set(0, 100, 100);

  addLights(scene);

  const waterTexture = makeWaterTexture();
  const waterMaterial = new THREE.MeshBasicMaterial({
    map: waterTexture,
    fog: true,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.renderOrder = -1;
  scene.add(water);

  const chunksGroup = new THREE.Group();
  chunksGroup.name = "chunks";
  scene.add(chunksGroup);

  const landmarksGroup = new THREE.Group();
  landmarksGroup.name = "landmarks";
  scene.add(landmarksGroup);

  for (const landmark of LANDMARKS) {
    const group = buildLandmark(landmark);
    if (!group) continue;
    landmarksGroup.add(group);
    const baseY = group.userData.baseY;
    landmark.baseY = baseY;
    landmark.anchor = [landmark.x, baseY + landmark.lift, landmark.z];
    landmark.viewTarget = [landmark.x, landmark.viewY, landmark.z];
  }

  const bridges = [];
  for (const z of [-3, 18]) {
    const x = riverX(z);
    const bankY = Math.max(heightAt(x - 7, z), heightAt(x + 7, z));
    const bridge = buildRiverBridge(x, z, 0, Math.max(0.8, bankY - 1.15));
    if (bridge) {
      scene.add(bridge);
      bridges.push(bridge);
    }
  }

  const chunks = new Map();
  let builtChunks = 0;

  function desiredKeys(target) {
    const centerX = Math.floor(target.x / CHUNK_SIZE);
    const centerZ = Math.floor(target.z / CHUNK_SIZE);
    const keys = [];
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz += 1) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        keys.push({ key: `${cx},${cz}`, cx, cz, distance: dx * dx + dz * dz });
      }
    }
    keys.sort((a, b) => a.distance - b.distance);
    return { keys, centerX, centerZ };
  }

  function createChunk(cx, cz) {
    const { geometry, outlineGeometry } = buildChunk(cx, cz);
    const entry = { mesh: null, outline: null };
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, vertexMaterial);
      mesh.matrixAutoUpdate = false;
      chunksGroup.add(mesh);
      entry.mesh = mesh;
    }
    if (outlineGeometry) {
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.matrixAutoUpdate = false;
      chunksGroup.add(outline);
      entry.outline = outline;
    }
    builtChunks += 1;
    return entry;
  }

  function ensureChunks(target, { immediate = false } = {}) {
    const { keys } = desiredKeys(target);
    const desired = new Set(keys.map((item) => item.key));

    for (const [key, entry] of chunks) {
      if (!desired.has(key)) {
        disposeChunk(entry);
        chunks.delete(key);
      }
    }

    let budget = immediate ? keys.length : 1;
    for (const item of keys) {
      if (budget <= 0) break;
      if (chunks.has(item.key)) continue;
      const entry = createChunk(item.cx, item.cz);
      chunks.set(item.key, entry);
      budget -= 1;
    }

  }

  function warmup(target) {
    ensureChunks(target, { immediate: true });
  }

  function update(dt, target) {
    water.position.x = target.x;
    water.position.z = target.z;
    waterTexture.offset.set(target.x / WATER_TILE, -target.z / WATER_TILE);

    ensureChunks(target);
  }

  function setAspect(aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  return {
    scene,
    camera,
    water,
    landmarks: LANDMARKS,
    warmup,
    update,
    setAspect,
    ensureChunks,
    get chunkCount() {
      return chunks.size;
    },
    get builtChunkCount() {
      return builtChunks;
    },
    dispose() {
      for (const entry of chunks.values()) disposeChunk(entry);
      chunks.clear();
      water.geometry.dispose();
      waterMaterial.dispose();
      waterTexture.dispose();
      for (const group of landmarksGroup.children) {
        group.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
        });
      }
      for (const bridge of bridges) {
        bridge.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
        });
      }
    },
  };
}
