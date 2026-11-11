import "./styles.css";
import * as THREE from "three";
import { createStage } from "./stage.js";
import { createLanding } from "./landing.js";
import { createMapWorld } from "./mapworld.js";
import { MapControls } from "./mapcontrols.js";
import { createUI } from "./ui.js";
import { createGame } from "./game.js";
import { LANDMARKS, MAP_START } from "./data.js";

const FRAME_INTERVAL = 1000 / 60;
const MAX_PIXEL_RATIO = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5));
const START_TARGET = new THREE.Vector3(...MAP_START.target);

function showFatal(message) {
  const fatal = document.querySelector("#fatal");
  const landing = document.querySelector("#landing");
  if (landing) landing.setAttribute("aria-hidden", "true");
  if (!fatal) return;
  if (message) {
    const text = document.querySelector("#fatalText");
    if (text) text.textContent = message;
  }
  fatal.hidden = false;
}

function init() {
  const app = document.querySelector("#app");
  const stageEl = document.querySelector("#stage");
  if (!app || !stageEl) return;

  let stage;
  try {
    stage = createStage(stageEl, MAX_PIXEL_RATIO);
  } catch (error) {
    console.error(error);
    showFatal("Peramban ini belum bisa membuat konteks WebGL. Coba aktifkan akselerasi perangkat keras.");
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  stage.setSize(width, height);

  let landing;
  let mapWorld;
  let controls;
  let game = null;

  try {
    landing = createLanding();
    landing.resize(width, height);
    mapWorld = createMapWorld();
    mapWorld.setAspect(width / Math.max(height, 1));
    controls = new MapControls(mapWorld.camera, stage.renderer.domElement, MAP_START);
  } catch (error) {
    console.error(error);
    showFatal("Dunia 3D gagal dimuat. Muat ulang halaman untuk mencoba lagi.");
    return;
  }

  let mode = "landing";
  let eco = false;
  let dirty = true;
  let dpr = MAX_PIXEL_RATIO;
  let worldTime = 0;
  let launchStarted = 0;
  let launchWarmed = false;
  let transitionShown = false;
  let launchingToGame = false;
  let lastCoords = 0;

  function setEco(next) {
    eco = next;
    ui.setEco(eco);
    dirty = true;
    if (!eco) {
      last = performance.now();
      lastRender = last;
      accumulator = 0;
      perfStart = last;
      renderedFrames = 0;
    }
  }

  const ui = createUI({
    onStart: () => startGameExperience(),
    onFly: (landmark, instant) => {
      if (!landmark) return;
      controls.flyTo(landmark.viewTarget, landmark.viewDistance, { instant: Boolean(instant) });
      dirty = true;
    },
    onReset: () => {
      controls.reset();
      dirty = true;
    },
    onEcoToggle: () => setEco(!eco),
    onZoom: (factor) => {
      controls.zoomBy(factor);
      dirty = true;
    },
  });

  ui.setEco(false);

  function prepareMap() {
    if (launchWarmed) return;
    launchWarmed = true;
    mapWorld.warmup(START_TARGET);
    controls.setPose(MAP_START, { instant: true });
  }

  function enterMap({ instant = false, spot = null } = {}) {
    if (mode === "map") return;
    prepareMap();
    mode = "map";
    controls.enabled = true;
    if (instant) controls.setPose(MAP_START, { instant: true });
    ui.showMap();
    dirty = true;
    if (spot) {
      const normalized = spot.toLowerCase();
      const landmark = LANDMARKS.find(
        (item) => item.id === normalized || item.short.toLowerCase() === normalized,
      );
      if (landmark) ui.select(landmark.id, { fly: true, instant: true, reveal: true });
    }
  }

  function ensureGame() {
    if (game) return game;
    try {
      game = createGame({ stage });
      game.resize(window.innerWidth, window.innerHeight);
    } catch (error) {
      console.error(error);
      showFatal("Dunia permainan gagal dimuat. Muat ulang halaman untuk mencoba lagi.");
      game = null;
    }
    return game;
  }

  function enterGame() {
    if (mode === "game") return;
    const instance = ensureGame();
    if (!instance) return;
    mode = "game";
    controls.enabled = false;
    instance.start();
    ui.showGame();
    dirty = true;
  }

  function startGameExperience() {
    if (mode !== "landing") return;
    mode = "launching";
    launchStarted = performance.now();
    transitionShown = false;
    launchingToGame = true;
    ui.beginLaunch();
    landing.start();
    dirty = true;
  }

  const mapBtn = document.querySelector("#mapBtn");
  if (mapBtn) mapBtn.addEventListener("click", () => startExperience());

  const params = new URLSearchParams(window.location.search);
  if (params.has("peta") || params.has("spot")) {
    enterMap({ instant: true, spot: params.get("spot") });
  } else if (params.has("play")) {
    enterGame();
  } else {
    window.setTimeout(() => {
      if (mode === "landing") mapWorld.warmup(START_TARGET);
      launchWarmed = true;
    }, 700);
  }

  const pointerTarget = { x: 0, y: 0 };
  window.addEventListener("pointermove", (event) => {
    if (mode !== "landing" && mode !== "launching") return;
    pointerTarget.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
    pointerTarget.y = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    landing.setPointer(pointerTarget.x, pointerTarget.y);
  });

  stage.renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    showFatal("Koneksi WebGL terputus. Muat ulang halaman untuk melanjutkan penjelajahan.");
  });

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    stage.setSize(w, h);
    landing.resize(w, h);
    mapWorld.setAspect(w / Math.max(h, 1));
    if (game) game.resize(w, h);
    dirty = true;
  }

  window.addEventListener("resize", onResize);

  let last = performance.now();
  let lastRender = last;
  let accumulator = 0;
  let renderedFrames = 0;
  let perfStart = last;
  let lastQualityChange = 0;
  let smoothInterval = 0;

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      last = performance.now();
      lastRender = last;
      accumulator = 0;
      perfStart = last;
      renderedFrames = 0;
    }
  });

  if (params.has("debug")) {
    window.__barabai = {
      landing,
      mapWorld,
      controls,
      ui,
      stage,
      get game() {
        return game;
      },
      get mode() {
        return mode;
      },
      get camera() {
        if (mode === "map") return mapWorld.camera;
        if (mode === "game") return game?.camera;
        return landing.camera;
      },
    };
  }

  stage.renderer.setAnimationLoop((now) => {
    if (document.hidden) {
      last = now;
      accumulator = 0;
      return;
    }

    const delta = now - last;
    last = now;
    accumulator += delta;
    if (accumulator < FRAME_INTERVAL - 1) return;
    accumulator = Math.min(accumulator % FRAME_INTERVAL, FRAME_INTERVAL);

    const dt = Math.min((now - lastRender) / 1000, 0.05);
    lastRender = now;

    if (mode === "landing" || mode === "launching") {
      if (mode === "launching") {
        const elapsed = now - launchStarted;
        if (elapsed > 620 && !transitionShown) {
          transitionShown = true;
          ui.showTransition();
        }
        if (elapsed > 620 && !launchWarmed && !launchingToGame) {
          prepareMap();
        }
        if (elapsed > 1160) {
          if (launchingToGame) enterGame();
          else enterMap({ instant: true });
        }
      }

      landing.update(dt, worldTime);
      worldTime += dt;
      stage.renderer.render(landing.scene, landing.camera);
      dirty = false;
      return;
    }

    if (mode === "game") {
      game.update(dt);
      stage.renderer.render(game.scene, game.camera);
      dirty = false;
      return;
    }

    controls.update(dt);
    mapWorld.update(dt, controls.target);

    if (eco && !controls.moving && !dirty) {
      if (now - perfStart > 900) {
        ui.updatePerf({
          fps: 0,
          frame: 0,
          calls: stage.renderer.info.render.calls,
          tris: stage.renderer.info.render.triangles,
          dpr,
          mode: "eco",
          chunks: mapWorld.chunkCount,
        });
        perfStart = now;
        renderedFrames = 0;
      }
      return;
    }

    dirty = false;
    stage.renderer.render(mapWorld.scene, mapWorld.camera);
    ui.updateMarkers(mapWorld.camera);
    if (now - lastCoords > 120) {
      ui.updateCoords(controls.target);
      lastCoords = now;
    }

    smoothInterval = smoothInterval ? smoothInterval * 0.9 + dt * 1000 * 0.1 : dt * 1000;
    renderedFrames += 1;

    if (now - perfStart >= 700) {
      const fps = (renderedFrames * 1000) / (now - perfStart);
      ui.updatePerf({
        fps: Math.round(fps),
        frame: smoothInterval,
        calls: stage.renderer.info.render.calls,
        tris: stage.renderer.info.render.triangles,
        dpr,
        mode: eco ? "eco" : "smooth",
        chunks: mapWorld.chunkCount,
      });

      if (!eco && now - lastQualityChange > 2400) {
        if (fps < 46 && dpr > 1.001) {
          dpr = Math.max(1, dpr - 0.2);
          stage.setPixelRatio(dpr);
          lastQualityChange = now;
          dirty = true;
        } else if (fps > 58.5 && dpr < MAX_PIXEL_RATIO - 0.001) {
          dpr = Math.min(MAX_PIXEL_RATIO, dpr + 0.1);
          stage.setPixelRatio(dpr);
          lastQualityChange = now;
          dirty = true;
        }
      }

      perfStart = now;
      renderedFrames = 0;
    }
  });
}

init();
