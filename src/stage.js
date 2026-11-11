import * as THREE from "three";
import { TEAL } from "./materials.js";

export function createStage(stageElement, pixelRatio = 1) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(stageElement.clientWidth, stageElement.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(TEAL, 1);
  renderer.domElement.setAttribute("aria-label", "Peta 3D Barabai Yaomink World");
  stageElement.appendChild(renderer.domElement);

  return {
    renderer,
    setSize(width, height) {
      renderer.setSize(width, height, false);
    },
    setPixelRatio(ratio) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(stageElement.clientWidth, stageElement.clientHeight, false);
    },
  };
}
