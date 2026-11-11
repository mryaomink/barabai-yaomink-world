import * as THREE from "three";
import { createPlanet, dirFromLatLon } from "./planet.js";
import { PlayerController, OrbitCamera, applyOutfit, OUTFIT } from "./player.js";
import { createNPCs } from "./npcs.js";
import { QUESTS, QuestState, idleLine } from "./quests.js";
import { createGameUI } from "./gameui.js";
import { AmbientAudio } from "./audio.js";

const MOVE_KEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createGame({ stage }) {
  const planet = createPlanet();
  const quests = new QuestState();
  const audio = new AmbientAudio();
  audio.enabled = quests.sound;

  const outfit = { skin: 0, hair: 0, top: 1, bottom: 0, shoes: 0, ...(quests.outfit ?? {}) };

  function applyOutfitKeys() {
    if (player) applyOutfit(player.group, outfit);
  }

  const gerbangDir = dirFromLatLon(25, 92);
  const gerbangFrame = planet.frameAt(gerbangDir);
  const spawnAngle = 2.4 / 16;
  const spawnDir = gerbangDir
    .clone()
    .multiplyScalar(Math.cos(spawnAngle))
    .addScaledVector(gerbangFrame.east, Math.sin(spawnAngle))
    .normalize();
  const player = new PlayerController({
    planet,
    spawnDir,
    outfit,
  });
  planet.scene.add(player.group);

  const orbit = new OrbitCamera(planet.camera, planet);
  orbit.reset(player.dir);

  const npcs = createNPCs(planet, planet.scene);

  const ui = createGameUI({
    onEmote: () => audio.pop(),
    onOutfit: (key, index) => {
      outfit[key] = Math.max(0, Math.round(index));
      quests.outfit = { ...outfit };
      quests.save();
      applyOutfitKeys();
      audio.pop();
    },
    onSound: () => {
      const next = !quests.sound;
      quests.sound = next;
      quests.save();
      audio.setEnabled(next);
      ui.setSound(next);
    },
    onResetQuests: () => {
      quests.reset();
      player.setItem(false);
      refreshChecklist();
      refreshMarkers();
      ui.toast("Tugas dimulai dari awal. Mampiri warga lagi ya.");
    },
    onStay: () => {},
  });

  const gameui = ui;
  let active = false;
  let moveTarget = null;
  let pendingNpc = null;
  let jumpQueued = false;
  let interactQueued = false;
  let keys = new Set();
  let welcomed = false;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const camForward = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const moveDir = new THREE.Vector2();
  const upVec = new THREE.Vector3();

  const clickMarkerGeometry = new THREE.RingGeometry(0.22, 0.3, 24);
  const clickMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xd6a348,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  const clickMarker = new THREE.Mesh(clickMarkerGeometry, clickMarkerMaterial);
  planet.scene.add(clickMarker);
  let clickMarkerLife = 0;

  if ("ontouchstart" in window) {
    const jumpBtn = document.createElement("button");
    jumpBtn.type = "button";
    jumpBtn.className = "g-jump";
    jumpBtn.setAttribute("aria-label", "Lompat");
    jumpBtn.textContent = "⤒";
    jumpBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      jumpQueued = true;
    });
    gameui.root.appendChild(jumpBtn);
  }

  const domElement = stage.renderer.domElement;
  let dragPointer = null;
  let downInfo = null;

  function pointerPos(event) {
    return {
      x: (event.clientX / window.innerWidth) * 2 - 1,
      y: -((event.clientY / window.innerHeight) * 2 - 1),
      cx: event.clientX,
      cy: event.clientY,
    };
  }

  function onPointerDown(event) {
    if (!active) return;
    if (event.button === 2) {
      jumpQueued = true;
      return;
    }
    downInfo = { ...pointerPos(event), time: performance.now() };
    dragPointer = { ...downInfo };
  }

  function onPointerMove(event) {
    if (!active || !dragPointer) return;
    const pos = pointerPos(event);
    orbit.applyDrag(pos.cx - dragPointer.cx, pos.cy - dragPointer.cy);
    dragPointer = pos;
  }

  function onPointerUp(event) {
    if (!active) return;
    const wasDown = downInfo;
    dragPointer = null;
    downInfo = null;
    if (!wasDown) return;
    const dt = performance.now() - wasDown.time;
    const dist = Math.hypot(event.clientX - wasDown.cx, event.clientY - wasDown.cy);
    if (dt > 350 || dist > 7) return;
    handleTap(event);
  }

  function handleTap(event) {
    if (event.target.closest(".game-ui") && event.target !== domElement) return;
    const pos = pointerPos(event);
    pointerNdc.set(pos.x, pos.y);
    raycaster.setFromCamera(pointerNdc, planet.camera);

    const npcHits = raycaster.intersectObjects(
      npcs.list.map((npc) => npc.group),
      true,
    );
    if (npcHits.length > 0) {
      let object = npcHits[0].object;
      while (object && !object.userData?.npcDef) {
        object = object.parent;
      }
      if (object?.userData?.npcDef) {
        walkToNpc(npcs.byId(object.userData.npcDef.id));
        return;
      }
    }

    const terrainHit = raycaster.intersectObject(planet.terrain, false);
    if (terrainHit.length > 0) {
      const point = terrainHit[0].point;
      moveTarget = point.clone().normalize();
      pendingNpc = null;
      showClickMarker(point);
    }
  }

  function walkToNpc(npc) {
    if (!npc) return;
    pendingNpc = npc;
    moveTarget = npc.group.position.clone().normalize();
  }

  function showClickMarker(point) {
    const dir = point.clone().normalize();
    const up = dir;
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    if (east.lengthSq() < 1e-5) east.set(1, 0, 0);
    east.normalize();
    const south = new THREE.Vector3().crossVectors(east, up).normalize();
    clickMarker.matrix.makeBasis(east, up, south);
    clickMarker.matrix.setPosition(dir.clone().multiplyScalar(planet.surfaceRadius(dir) + 0.04));
    clickMarker.matrixAutoUpdate = false;
    clickMarker.updateMatrix();
    clickMarker.visible = true;
    clickMarkerLife = 0.7;
  }

  function onWheel(event) {
    if (!active) return;
    orbit.zoom(event.deltaY * 0.004);
  }

  function onContextMenu(event) {
    if (active) event.preventDefault();
  }

  domElement.addEventListener("pointerdown", onPointerDown);
  domElement.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("wheel", onWheel, { passive: true });
  domElement.addEventListener("contextmenu", onContextMenu);

  function onKeyDown(event) {
    if (!active) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const code = event.code;

    if (code === "Space") {
      event.preventDefault();
      if (gameui.dialogIsOpen()) {
        gameui.dialogClick();
        return;
      }
      jumpQueued = true;
      return;
    }
    if (code === "KeyE" || code === "Enter") {
      event.preventDefault();
      interactQueued = true;
      return;
    }
    if (code === "KeyQ") {
      gameui.toggleChecklist();
      return;
    }
    if (code === "KeyC") {
      gameui.toggleOutfit(undefined, outfit);
      return;
    }
    if (code === "Escape") {
      gameui.toggleChecklist(false);
      gameui.toggleEmotes(false);
      gameui.toggleOutfit(false);
      gameui.closeDialog();
      return;
    }
    if (code.startsWith("Digit")) {
      const index = Number(code.slice(5));
      if (Number.isInteger(index) && index >= 0 && index < 10) {
        gameui.emoteByIndex(index === 0 ? 9 : index - 1);
      }
    }
    if (MOVE_KEYS[code]) {
      keys.add(code);
      moveTarget = null;
      pendingNpc = null;
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function questById(id) {
    return QUESTS.find((quest) => quest.id === id) ?? null;
  }

  function questForNpc(npc) {
    return QUESTS.find((quest) => quest.giver === npc.def.id || quest.target === npc.def.id) ?? null;
  }

  function npcName(id) {
    return npcs.byId(id)?.def.name ?? id;
  }

  function refreshChecklist() {
    gameui.renderChecklist(QUESTS, quests);
  }

  function refreshMarkers() {
    const activeQuest = quests.activeQuest();
    for (const npc of npcs.list) {
      const quest = questForNpc(npc);
      let mode = null;
      if (npc.def.role === "giver") {
        if (quest && quests.of(quest.id) === "offered" && !activeQuest) mode = "offer";
      } else if (quest && activeQuest && activeQuest.id === quest.id) {
        mode = "deliver";
      }
      npc.setMarker(mode);
    }
  }

  function acceptQuest(quest) {
    quests.accept(quest.id);
    player.setItem(true);
    audio.pop();
    gameui.toast(`Bawa ${quest.item} ke ${npcName(quest.target)}`);
    refreshChecklist();
    refreshMarkers();
  }

  function deliverQuest(quest) {
    quests.deliver(quest.id);
    player.setItem(false);
    audio.chime();
    gameui.toast(`${quest.title} — selesai!`);
    refreshChecklist();
    refreshMarkers();
    if (quests.allDone()) {
      window.setTimeout(() => {
        if (active) gameui.showCompletion();
      }, 900);
    }
  }

  function openNPCDialog(npc) {
    const def = npc.def;
    const quest = questForNpc(npc);
    const status = quest ? quests.of(quest.id) : "offered";
    const activeQuest = quests.activeQuest();

    player.faceTo(npc.group.position.clone().normalize());

    if (def.role === "target" && activeQuest && quest && activeQuest.id === quest.id) {
      gameui.openDialog({
        name: def.name,
        lines: quest.deliver,
        actions: [
          { label: "Serahkan paket", run: () => deliverQuest(quest) },
          { label: "Nanti dulu", ghost: true, run: () => {} },
        ],
      });
      return;
    }

    if (def.role === "giver" && status === "offered" && !activeQuest) {
      gameui.openDialog({
        name: def.name,
        lines: quest.offer,
        actions: [
          { label: "Terima titipan", run: () => acceptQuest(quest) },
          { label: "Nanti dulu", ghost: true, run: () => {} },
        ],
      });
      return;
    }

    if (def.role === "giver" && quest && status === "active") {
      gameui.openDialog({ name: def.name, lines: [quest.accept, "Tetap hati-hati di jalan ya."] });
      return;
    }

    if (def.role === "giver" && quest && status === "done") {
      gameui.openDialog({ name: def.name, lines: [quest.done] });
      return;
    }

    if (activeQuest) {
      gameui.openDialog({
        name: def.name,
        lines: [idleLine(def.id), `Kalau ada titipan, tanganmu masih membawa ${activeQuest.item} ya.`],
      });
      return;
    }

    gameui.openDialog({ name: def.name, lines: [idleLine(def.id)] });
  }

  function interact() {
    if (gameui.completionOpen()) {
      gameui.hideCompletion();
      return;
    }
    if (gameui.dialogIsOpen()) {
      gameui.dialogClick();
      return;
    }
    const npc = npcs.nearest(player, 2.3);
    if (npc) openNPCDialog(npc);
  }

  gameui.setProjector(() => {
    const point = player.group.position
      .clone()
      .addScaledVector(player.dir.clone().normalize(), 1.35);
    point.project(planet.camera);
    if (point.z > 1) return null;
    return {
      x: (point.x * 0.5 + 0.5) * window.innerWidth,
      y: (-point.y * 0.5 + 0.5) * window.innerHeight,
    };
  });

  gameui.setSound(quests.sound);

  function start() {
    active = true;
    gameui.show();
    refreshChecklist();
    refreshMarkers();
    if (!welcomed) {
      welcomed = true;
      window.setTimeout(() => {
        if (!active) return;
        gameui.openDialog({
          name: "Warga Barabai",
          lines: [
            "Selamat datang, kurir hari ini!",
            "Ada lima titipan warga. Dekati orang dengan tanda emas di atas kepala, lalu bicara.",
            "Daftar tugas ada di pojok kiri atas. Pelan-pelan saja.",
          ],
        });
      }, 700);
    }
  }

  function stop() {
    active = false;
    keys.clear();
    gameui.hide();
  }

  function update(dt) {
    if (!active) return;
    audio.resume();
    audio.update(dt);

    const dialogOpen = gameui.dialogIsOpen() || gameui.completionOpen();
    moveDir.set(0, 0);
    if (!dialogOpen) {
      for (const code of keys) {
        const [x, y] = MOVE_KEYS[code];
        if (x) moveDir.x += x;
        if (y) moveDir.y += y;
      }
      if (moveTarget) {
        upVec.copy(player.dir).normalize();
        camForward.copy(moveTarget).sub(upVec.clone().multiplyScalar(moveTarget.dot(upVec)));
        if (camForward.lengthSq() < 1e-6) {
          moveTarget = null;
        }
      }
    } else {
      moveTarget = null;
      pendingNpc = null;
    }

    if (interactQueued) {
      interactQueued = false;
      interact();
    }

    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const jumping = jumpQueued && !dialogOpen;
    jumpQueued = false;
    player.update(dt, { move: moveDir, sprint, jump: jumping });

    npcs.update(dt, player);
    orbit.update(dt, player);
    gameui.update(dt, outfit);

    if (clickMarkerLife > 0) {
      clickMarkerLife -= dt;
      clickMarkerMaterial.opacity = Math.max(0, clickMarkerLife) * 1.2;
      if (clickMarkerLife <= 0) clickMarker.visible = false;
    }

    if (pendingNpc && !dialogOpen) {
      const near = pendingNpc.group.position.distanceTo(player.group.position);
      if (near < 2.3) {
        const npc = pendingNpc;
        pendingNpc = null;
        moveTarget = null;
        openNPCDialog(npc);
      } else if (near > 26) {
        pendingNpc = null;
        moveTarget = null;
      }
    }

    if (moveTarget && !dialogOpen) {
      upVec.copy(player.dir).normalize();
      const targetDir = moveTarget;
      const angle = Math.acos(Math.min(1, Math.max(-1, upVec.dot(targetDir.clone().normalize()))));
      if (angle < 0.03) {
        moveTarget = null;
      }
    }
  }

  function resize(width, height) {
    planet.camera.aspect = width / Math.max(height, 1);
    planet.camera.updateProjectionMatrix();
  }

  function dispose() {
    stop();
    domElement.removeEventListener("pointerdown", onPointerDown);
    domElement.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    domElement.removeEventListener("wheel", onWheel);
    domElement.removeEventListener("contextmenu", onContextMenu);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    clickMarkerGeometry.dispose();
    clickMarkerMaterial.dispose();
    planet.dispose();
  }

  return {
    scene: planet.scene,
    camera: planet.camera,
    planet,
    player,
    npcs,
    quests,
    audio,
    ui: gameui,
    orbit,
    update,
    resize,
    start,
    stop,
    dispose,
    interact,
  };
}
