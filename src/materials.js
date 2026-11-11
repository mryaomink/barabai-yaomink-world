import * as THREE from "three";

export const INK = 0x2f3b36;
export const TEAL = 0x69c5c2;
export const TEAL_DEEP = 0x51b3b2;
export const CREAM = 0xf2ecdd;
export const PAPER = 0xfff8e9;
export const YELLOW = 0xf6c945;
export const CORAL = 0xd8795f;
export const GOLD = 0xd6a348;
export const GREEN = 0x75a064;

export const flatMaterial = (color = 0xffffff, options = {}) =>
  new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...options,
  });

export const vertexMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
});

export const outlineMaterial = new THREE.LineBasicMaterial({
  color: INK,
  transparent: true,
  opacity: 0.92,
  depthWrite: false,
});

export function makeOutline(geometry, threshold = 26) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geometry, threshold), outlineMaterial);
}
