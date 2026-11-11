import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

export function valueNoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm(x, y, octaves = 3) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(x * frequency, y * frequency) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value / total;
}

export function formatCompact(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

function varyColor(color, jitter, x, y, z) {
  if (!jitter) return color;
  const offset = (hash2(x * 0.73 + z * 1.31, y * 0.57 + z * 0.19) - 0.5) * jitter;
  return color.clone().offsetHSL(0, 0, offset);
}

export function composeMatrix(options = {}) {
  if (options.matrix) return options.matrix.clone();
  const {
    x = 0,
    y = 0,
    z = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  } = options;
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    quaternion,
    new THREE.Vector3(sx, sy, sz),
  );
}

const KEEP_ATTRIBUTES = new Set(["position", "normal", "color"]);

/**
 * Mengumpulkan banyak geometri kecil lalu menggabungkannya menjadi satu
 * BufferGeometry. Ini menekan jumlah draw call menjadi sangat kecil tanpa
 * mengorbankan detail visual.
 */
export class GeometryBatch {
  constructor() {
    this.items = [];
  }

  add(geometry, color, options = {}) {
    let geo = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const {
      x = 0,
      y = 0,
      z = 0,
      rx = 0,
      ry = 0,
      rz = 0,
      sx = 1,
      sy = 1,
      sz = 1,
      jitter = 0,
      colorFn = null,
      keepColors = false,
    } = options;

    const matrix = new THREE.Matrix4();
    if (options.matrix) {
      matrix.copy(options.matrix);
    } else {
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
      matrix.compose(
        new THREE.Vector3(x, y, z),
        quaternion,
        new THREE.Vector3(sx, sy, sz),
      );
    }
    geo.applyMatrix4(matrix);

    if (!geo.attributes.normal) geo.computeVertexNormals();

    const position = geo.attributes.position;
    const count = position.count;
    const hasColors = Boolean(geo.attributes.color);

    if (!(keepColors && hasColors)) {
      const colors = new Float32Array(count * 3);
      const baseColor = new THREE.Color(color ?? 0xffffff);

      for (let i = 0; i < count; i += 1) {
        const vx = position.getX(i);
        const vy = position.getY(i);
        const vz = position.getZ(i);
        const vertexColor = colorFn
          ? colorFn(vx, vy, vz, i)
          : varyColor(baseColor, jitter, vx, vy, vz);
        colors[i * 3] = vertexColor.r;
        colors[i * 3 + 1] = vertexColor.g;
        colors[i * 3 + 2] = vertexColor.b;
      }

      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }

    for (const name of Object.keys(geo.attributes)) {
      if (!KEEP_ATTRIBUTES.has(name)) geo.deleteAttribute(name);
    }
    geo.morphAttributes = {};
    this.items.push(geo);
    return this;
  }

  box(width, height, depth, color, options = {}) {
    return this.add(new THREE.BoxGeometry(width, height, depth), color, options);
  }

  cylinder(radiusTop, radiusBottom, height, segments, color, options = {}) {
    return this.add(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false),
      color,
      options,
    );
  }

  cone(radius, height, segments, color, options = {}) {
    return this.add(new THREE.ConeGeometry(radius, height, segments), color, options);
  }

  ico(radius, detail, color, options = {}) {
    return this.add(new THREE.IcosahedronGeometry(radius, detail), color, options);
  }

  sphere(radius, widthSegments, heightSegments, color, options = {}) {
    return this.add(
      new THREE.SphereGeometry(radius, widthSegments, heightSegments),
      color,
      options,
    );
  }

  dome(radius, widthSegments, heightSegments, color, options = {}) {
    return this.add(
      new THREE.SphereGeometry(radius, widthSegments, heightSegments, 0, Math.PI * 2, 0, Math.PI / 2),
      color,
      options,
    );
  }

  torus(radius, tube, radialSegments, tubularSegments, color, options = {}) {
    return this.add(
      new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments),
      color,
      options,
    );
  }

  plane(width, height, color, options = {}) {
    return this.add(new THREE.PlaneGeometry(width, height), color, options);
  }

  ring(innerRadius, outerRadius, segments, color, options = {}) {
    return this.add(
      new THREE.RingGeometry(innerRadius, outerRadius, segments),
      color,
      options,
    );
  }

  circle(radius, segments, color, options = {}) {
    return this.add(new THREE.CircleGeometry(radius, segments), color, options);
  }

  arch(width, height, depth, color, options = {}) {
    const shape = new THREE.Shape();
    const radius = width / 2;
    const shoulder = height - radius;
    shape.moveTo(-radius, 0);
    shape.lineTo(-radius, shoulder);
    shape.absarc(0, shoulder, radius, Math.PI, 0, true);
    shape.lineTo(radius, 0);
    shape.closePath();
    return this.add(
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 }),
      color,
      options,
    );
  }

  toGeometry() {
    if (this.items.length === 0) return null;
    const merged = mergeGeometries(this.items, false);
    for (const item of this.items) item.dispose();
    this.items = [];
    if (merged) merged.computeBoundingSphere();
    return merged;
  }

  build(material) {
    const merged = this.toGeometry();
    if (!merged) return null;
    const mesh = new THREE.Mesh(merged, material);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

export function makeSignTexture(title, subtitle) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  context.scale(2, 2);

  const gradient = context.createLinearGradient(0, 0, 0, 192);
  gradient.addColorStop(0, "#302738");
  gradient.addColorStop(1, "#221b2d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 192);

  context.strokeStyle = "rgba(240, 196, 118, 0.7)";
  context.lineWidth = 3;
  context.strokeRect(13, 13, 486, 166);
  context.strokeStyle = "rgba(240, 196, 118, 0.26)";
  context.lineWidth = 1;
  context.strokeRect(22, 22, 468, 148);

  context.textAlign = "center";
  context.fillStyle = "#f5e7ce";
  context.font = "600 62px Georgia, 'Times New Roman', serif";
  context.fillText(title, 256, 102);

  context.fillStyle = "rgba(240, 196, 118, 0.8)";
  context.font = "500 18px -apple-system, 'Segoe UI', sans-serif";
  context.letterSpacing = "7px";
  context.fillText(subtitle, 262, 137);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function disposeObject(root) {
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    }
  });
}
