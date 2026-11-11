import * as THREE from "three";

export const SUN_DIR = new THREE.Vector3(-0.52, 0.3, -0.8).normalize();

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDirection = normalize(worldPosition.xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMiddle;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uSunColor;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    float elevation = max(direction.y, 0.0);

    vec3 color = mix(uHorizon, uMiddle, smoothstep(0.0, 0.24, elevation));
    color = mix(color, uTop, smoothstep(0.22, 0.82, elevation));

    float sunDot = max(dot(direction, normalize(uSun)), 0.0);
    float halo = pow(sunDot, 6.0) * 0.28;
    float glow = pow(sunDot, 42.0) * 0.55;
    float core = pow(sunDot, 720.0) * 1.4;
    color = mix(color, uSunColor, clamp(halo + glow + core, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const PALETTE = {
  skyTop: "#3d4574",
  skyMiddle: "#a57e98",
  skyHorizon: "#f6caa2",
  sun: "#ffe2b2",
  fog: "#eec8a7",
};

export function createStage(stageElement, initialPixelRatio = 1) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(initialPixelRatio);
  renderer.setSize(stageElement.clientWidth, stageElement.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = false;
  renderer.domElement.setAttribute("aria-label", "Dunia 3D Barabai Yaomink World");
  stageElement.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0031);

  const camera = new THREE.PerspectiveCamera(
    42,
    stageElement.clientWidth / Math.max(stageElement.clientHeight, 1),
    0.5,
    680,
  );
  camera.position.set(0, 45, 100);

  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(PALETTE.skyTop) },
      uMiddle: { value: new THREE.Color(PALETTE.skyMiddle) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      uSun: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color(PALETTE.sun) },
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  const hemisphere = new THREE.HemisphereLight(0xffd6b0, 0x585072, 1.65);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xffd3a0, 2.45);
  sun.position.copy(SUN_DIR).multiplyScalar(120);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x9ab0dd, 0.55);
  fill.position.set(60, 40, 70);
  scene.add(fill);

  return {
    renderer,
    scene,
    camera,
    sun,
    sunDir: SUN_DIR.clone(),
    setSize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    },
    setPixelRatio(ratio) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(stageElement.clientWidth, stageElement.clientHeight, false);
    },
  };
}
