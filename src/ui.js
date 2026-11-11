import * as THREE from "three";
import { LANDMARKS } from "./data.js";
import { formatCompact } from "./utils.js";

export function createUI({
  onStart,
  onFly,
  onReset,
  onEcoToggle,
  onZoom,
  onPanStart,
} = {}) {
  const app = document.querySelector("#app");
  const landing = document.querySelector("#landing");
  const hud = document.querySelector("#hud");
  const startBtn = document.querySelector("#startBtn");
  const markersHost = document.querySelector("#markers");
  const journal = document.querySelector("#journal");
  const journalBtn = document.querySelector("#journalBtn");
  const journalClose = document.querySelector("#journalClose");
  const journalList = document.querySelector("#journalList");
  const detail = document.querySelector("#detail");
  const detailClose = document.querySelector("#detailClose");
  const detailIndex = document.querySelector("#detailIndex");
  const detailTitle = document.querySelector("#detailTitle");
  const detailTag = document.querySelector("#detailTag");
  const detailBody = document.querySelector("#detailBody");
  const detailFacts = document.querySelector("#detailFacts");
  const detailFly = document.querySelector("#detailFly");
  const foundCount = document.querySelector("#foundCount");
  const foundTotal = document.querySelector("#foundTotal");
  const coords = document.querySelector("#coords");
  const toast = document.querySelector("#toast");
  const toastTitle = document.querySelector("#toastTitle");
  const ecoBtn = document.querySelector("#ecoBtn");
  const perfBtn = document.querySelector("#perfBtn");
  const perfPanel = document.querySelector("#perf");
  const perfMode = document.querySelector("#perfMode");
  const perfFps = document.querySelector("#perfFps");
  const perfFrame = document.querySelector("#perfFrame");
  const perfCalls = document.querySelector("#perfCalls");
  const perfTris = document.querySelector("#perfTris");
  const perfDpr = document.querySelector("#perfDpr");
  const perfChunks = document.querySelector("#perfChunks");
  const transition = document.querySelector("#transition");
  const zoomIn = document.querySelector("#zoomIn");
  const zoomOut = document.querySelector("#zoomOut");
  const resetView = document.querySelector("#resetView");

  const projected = new THREE.Vector3();
  const cameraSpace = new THREE.Vector3();

  let started = false;
  let currentId = null;
  let journalOpen = false;
  let perfOpen = false;
  let toastTimer = 0;
  const discovered = new Set();

  foundTotal.textContent = String(LANDMARKS.length);

  const markerEls = new Map();
  const journalEls = new Map();

  LANDMARKS.forEach((landmark, index) => {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "marker is-hidden";
    marker.dataset.id = landmark.id;
    marker.setAttribute("aria-label", `Buka ${landmark.name}`);
    marker.innerHTML = `
      <span class="marker-pin"><i>${String(index + 1).padStart(2, "0")}</i></span>
      <span class="marker-label">${landmark.short}</span>
    `;
    marker.addEventListener("click", () => select(landmark.id));
    markersHost.appendChild(marker);
    markerEls.set(landmark.id, marker);

    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "journal-item";
    button.dataset.id = landmark.id;
    button.innerHTML = `
      <span class="journal-num">${String(index + 1).padStart(2, "0")}</span>
      <span class="journal-copy">
        <strong>${landmark.name}</strong>
        <small>${landmark.tag}</small>
      </span>
      <span class="journal-state" aria-hidden="true">○</span>
    `;
    button.addEventListener("click", () => select(landmark.id));
    item.appendChild(button);
    journalList.appendChild(item);
    journalEls.set(landmark.id, button);
  });

  function updateFound() {
    foundCount.textContent = String(discovered.size);
  }

  function showToast(landmark) {
    toastTitle.textContent = landmark.name;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function discover(landmark) {
    if (discovered.has(landmark.id)) return;
    discovered.add(landmark.id);
    updateFound();
    const item = journalEls.get(landmark.id);
    if (item) {
      item.classList.add("is-found");
      const state = item.querySelector(".journal-state");
      if (state) state.textContent = "✓";
    }
    showToast(landmark);
  }

  function clearActive() {
    markerEls.forEach((marker) => marker.classList.remove("is-active"));
    journalEls.forEach((item) => item.classList.remove("is-active"));
  }

  function fillDetail(landmark) {
    const index = LANDMARKS.findIndex((item) => item.id === landmark.id);
    detailIndex.textContent = `Temuan ${String(index + 1).padStart(2, "0")}`;
    detailTitle.textContent = landmark.name;
    detailTag.textContent = landmark.tag;
    detailBody.textContent = landmark.description;
    detail.style.setProperty("--accent", landmark.accent);
    detail.dataset.index = String(index + 1).padStart(2, "0");
    detailFacts.replaceChildren();
    for (const fact of landmark.facts) {
      const chip = document.createElement("span");
      chip.textContent = fact;
      detailFacts.appendChild(chip);
    }
  }

  function select(id, { fly = true, instant = false, reveal = true } = {}) {
    const landmark = LANDMARKS.find((item) => item.id === id);
    if (!landmark) return;
    currentId = id;
    fillDetail(landmark);
    detail.classList.add("is-open");
    detail.setAttribute("aria-hidden", "false");
    clearActive();
    markerEls.get(id)?.classList.add("is-active");
    journalEls.get(id)?.classList.add("is-active");
    if (reveal) discover(landmark);
    if (fly) onFly?.(landmark, instant);
    setJournal(false);
  }

  function closeDetail() {
    currentId = null;
    detail.classList.remove("is-open");
    detail.setAttribute("aria-hidden", "true");
    clearActive();
  }

  function setJournal(open = !journalOpen) {
    journalOpen = open;
    journal.classList.toggle("is-open", journalOpen);
    journal.setAttribute("aria-hidden", String(!journalOpen));
    journalBtn.setAttribute("aria-expanded", String(journalOpen));
    if (journalOpen) closeDetail();
  }

  function togglePerf(open = !perfOpen) {
    perfOpen = open;
    perfPanel.classList.toggle("is-open", perfOpen);
    perfPanel.setAttribute("aria-hidden", String(!perfOpen));
    perfBtn.setAttribute("aria-pressed", String(perfOpen));
  }

  function setEco(enabled) {
    ecoBtn.setAttribute("aria-pressed", String(enabled));
    ecoBtn.title = enabled ? "Lanjutkan animasi saat kamera diam" : "Hemat daya saat kamera diam";
  }

  function beginLaunch() {
    if (started) return;
    startBtn.disabled = true;
    app.classList.add("is-launching");
    landing.classList.add("is-leaving");
    landing.setAttribute("aria-hidden", "true");
  }

  function showTransition() {
    transition.classList.add("is-visible");
    transition.setAttribute("aria-hidden", "false");
  }

  function hideTransition() {
    transition.classList.remove("is-visible");
    transition.setAttribute("aria-hidden", "true");
  }

  function showMap() {
    if (started) return;
    started = true;
    app.dataset.ready = "map";
    app.classList.remove("is-launching");
    app.classList.add("is-map", "is-playing");
    hud.setAttribute("aria-hidden", "false");
    landing.setAttribute("aria-hidden", "true");
    startBtn.blur();
    hideTransition();
  }

  function showGame() {
    if (started) return;
    started = true;
    app.dataset.ready = "game";
    app.classList.remove("is-launching");
    app.classList.add("is-game", "is-playing");
    hud.setAttribute("aria-hidden", "true");
    landing.setAttribute("aria-hidden", "true");
    startBtn.blur();
    hideTransition();
  }

  function updateMarkers(camera) {
    if (!started) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 90;

    for (const landmark of LANDMARKS) {
      const marker = markerEls.get(landmark.id);
      if (!marker || !landmark.anchor) continue;
      projected.fromArray(landmark.anchor);
      cameraSpace.copy(projected).applyMatrix4(camera.matrixWorldInverse);

      if (cameraSpace.z > -0.5) {
        marker.classList.add("is-hidden");
        continue;
      }

      projected.project(camera);
      if (projected.z < -1 || projected.z > 1) {
        marker.classList.add("is-hidden");
        continue;
      }

      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const visible = x > -margin && x < width + margin && y > -margin && y < height + margin;
      marker.classList.toggle("is-hidden", !visible);
      if (visible) {
        marker.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        marker.style.zIndex = String(Math.round(1000 - cameraSpace.z));
      }
    }
  }

  function updateCoords(target) {
    if (!coords) return;
    coords.textContent = `${Math.round(target.x)} , ${Math.round(target.z)}`;
  }

  function updatePerf({ fps, frame, calls, tris, dpr, mode, chunks }) {
    perfMode.textContent = mode === "eco" ? "Hemat daya" : "Lancar";
    perfMode.classList.toggle("is-eco", mode === "eco");
    perfFps.textContent = fps > 0 ? String(fps) : "idle";
    perfFrame.textContent = frame > 0 ? `${frame.toFixed(1)} ms` : "—";
    perfCalls.textContent = String(calls);
    perfTris.textContent = formatCompact(tris);
    perfDpr.textContent = `${dpr.toFixed(2)}×`;
    perfChunks.textContent = String(chunks);
  }

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();

    if (!started) {
      if (key === "enter" || key === " ") {
        event.preventDefault();
        onStart?.();
      }
      return;
    }

    if (app.dataset.ready !== "map") {
      if (key === "escape") {
        closeDetail();
        setJournal(false);
      }
      return;
    }

    if (key === "escape") {
      if (perfOpen) togglePerf(false);
      else if (journalOpen) setJournal(false);
      else closeDetail();
      return;
    }
    if (key === "p") {
      togglePerf();
      return;
    }
    if (key === "j") {
      setJournal();
      return;
    }
    if (key === "r") {
      onReset?.();
      closeDetail();
      return;
    }
    if (key === "+" || key === "=") {
      onZoom?.(0.82);
      return;
    }
    if (key === "-" || key === "_") {
      onZoom?.(1.22);
      return;
    }

    const index = Number(key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < LANDMARKS.length) {
      select(LANDMARKS[index].id);
    }
  }

  startBtn.addEventListener("click", () => onStart?.());
  detailClose.addEventListener("click", closeDetail);
  detailFly.addEventListener("click", () => {
    if (currentId) onFly?.(LANDMARKS.find((item) => item.id === currentId), false);
  });
  journalBtn.addEventListener("click", () => setJournal());
  journalClose.addEventListener("click", () => setJournal(false));
  ecoBtn.addEventListener("click", () => onEcoToggle?.());
  perfBtn.addEventListener("click", () => togglePerf());
  zoomIn.addEventListener("click", () => onZoom?.(0.82));
  zoomOut.addEventListener("click", () => onZoom?.(1.22));
  resetView.addEventListener("click", () => {
    onReset?.();
    closeDetail();
  });
  window.addEventListener("keydown", onKeyDown);

  return {
    beginLaunch,
    showMap,
    showGame,
    showTransition,
    hideTransition,
    select,
    closeDetail,
    setJournal,
    togglePerf,
    setEco,
    updateMarkers,
    updateCoords,
    updatePerf,
    get isPlaying() {
      return started;
    },
    get discoveredCount() {
      return discovered.size;
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(toastTimer);
      markerEls.forEach((marker) => marker.remove());
      journalEls.forEach((item) => item.closest("li")?.remove());
    },
  };
}
