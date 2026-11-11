const EMOTES = ["😊", "👋", "❤️", "😂", "😴", "😎", "😢", "😡", "😮", "👍"];

const OUTFIT_LABELS = {
  skin: "Kulit",
  hair: "Rambut",
  top: "Atasan",
  bottom: "Bawahan",
  shoes: "Sepatu",
};

const OUTFIT_COLORS = {
  skin: ["#f0c39a", "#c68d5e", "#9c6644", "#7a4a2b"],
  hair: ["#2f3b36", "#5a3825", "#d8795f", "#d6a348", "#69c5c2"],
  top: ["#fff8e9", "#d8795f", "#69c5c2", "#f6c945", "#75a064"],
  bottom: ["#2f3b36", "#4e5d55", "#75a064", "#d6a348", "#d8795f"],
  shoes: ["#2f3b36", "#f2ecdd", "#d8795f", "#f6c945"],
};

function el(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

export function createGameUI({ onEmote, onOutfit, onSound, onResetQuests, onStay }) {
  const root = el("div", "game-ui", document.body);
  root.id = "game-ui";
  root.hidden = true;

  const top = el("div", "g-top", root);
  const questBtn = el("button", "g-pill", top);
  questBtn.type = "button";
  questBtn.innerHTML = '<span aria-hidden="true">☑️</span><span>Tugas</span><b class="g-quest-count">0/5</b>';

  const topRight = el("div", "g-top-right", top);
  const soundBtn = el("button", "g-icon", topRight);
  soundBtn.type = "button";
  soundBtn.setAttribute("aria-label", "Bunyi latar");
  soundBtn.textContent = "♪";

  const checklist = el("aside", "g-panel g-checklist", root);
  checklist.hidden = true;
  const checklistHead = el("div", "g-panel-head", checklist);
  const checklistTitle = el("h3", "", checklistHead);
  checklistTitle.textContent = "Tugas Hari Ini";
  const checklistHint = el("p", "g-panel-hint", checklistHead);
  checklistHint.textContent = "Titipan warga untuk diantar";
  const checklistList = el("ol", "g-checklist-list", checklist);

  const bottom = el("div", "g-bottom", root);
  const outfitBtn = el("button", "g-icon", bottom);
  outfitBtn.type = "button";
  outfitBtn.setAttribute("aria-label", "Busana");
  outfitBtn.innerHTML = "🧢";

  const prompt = el("button", "g-prompt", bottom);
  prompt.type = "button";
  prompt.hidden = true;
  prompt.innerHTML = '<kbd>E</kbd><span class="g-prompt-text"></span>';

  const emoteBtn = el("button", "g-icon", bottom);
  emoteBtn.type = "button";
  emoteBtn.setAttribute("aria-label", "Ekspresi");
  emoteBtn.innerHTML = "😊";

  const emoteWheel = el("div", "g-emotes", root);
  emoteWheel.hidden = true;
  const emoteBtns = EMOTES.map((emoji, index) => {
    const btn = el("button", "g-emote", emoteWheel);
    btn.type = "button";
    btn.textContent = emoji;
    btn.dataset.index = String(index);
    return btn;
  });

  const outfitPanel = el("aside", "g-panel g-outfit", root);
  outfitPanel.hidden = true;
  const outfitHead = el("div", "g-panel-head", outfitPanel);
  el("h3", "", outfitHead).textContent = "Busana";
  el("p", "g-panel-hint", outfitHead).textContent = "Racik gaya muatan-muatanmu";
  const outfitRows = el("div", "g-outfit-rows", outfitPanel);
  const outfitKeys = Object.keys(OUTFIT_COLORS);
  const swatches = {};
  for (const key of outfitKeys) {
    const row = el("div", "g-outfit-row", outfitRows);
    el("span", "g-outfit-label", row).textContent = OUTFIT_LABELS[key];
    const group = el("div", "g-outfit-swatches", row);
    swatches[key] = OUTFIT_COLORS[key].map((color) => {
      const btn = el("button", "g-swatch", group);
      btn.type = "button";
      btn.style.background = color;
      btn.dataset.key = key;
      return btn;
    });
  }

  const dialog = el("section", "g-dialog", root);
  dialog.hidden = true;
  const dialogName = el("p", "g-dialog-name", dialog);
  const dialogText = el("p", "g-dialog-text", dialog);
  const dialogHint = el("p", "g-dialog-hint", dialog);
  const dialogActions = el("div", "g-dialog-actions", dialog);

  const toastEl = el("div", "g-toast", root);
  toastEl.hidden = true;

  const floaters = el("div", "g-floaters", root);

  const completion = el("section", "g-completion", root);
  completion.hidden = true;
  const completionCard = el("div", "g-completion-card", completion);
  el("p", "g-kicker", completionCard).textContent = "Barabai · pelan-pelan";
  el("h2", "", completionCard).textContent = "Semua titipan sampai!";
  el("p", "g-completion-copy", completionCard).textContent =
    "Lima paket sudah sampai ke tangan yang tepat. Warga Barabai tersenyum hari ini berkatmu.";
  const completionActions = el("div", "g-completion-actions", completionCard);
  const stayBtn = el("button", "g-btn", completionActions);
  stayBtn.type = "button";
  stayBtn.textContent = "Tetap berkeliling";
  const againBtn = el("button", "g-btn g-btn-ghost", completionActions);
  againBtn.type = "button";
  againBtn.textContent = "Ulangi tugas";

  const keyboardHint = el("p", "g-hint", root);
  keyboardHint.innerHTML =
    '<span><kbd>WASD</kbd> jalan</span><span class="hint-dot"></span><span><kbd>Shift</kbd> lari</span><span class="hint-dot"></span><span><kbd>Spasi</kbd> lompat</span><span class="hint-dot"></span><span><kbd>E</kbd> bicara</span>';

  let projector = null;
  let dialogState = null;
  let typed = "";
  let typeProgress = 0;
  let toastTimer = 0;
  let soundOn = true;
  let promptAction = null;
  let checklistOpen = false;
  let emoteOpen = false;
  let outfitOpen = false;

  function show() {
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
  }

  function setProjector(fn) {
    projector = fn;
  }

  function prompt_(text, action) {
    if (!text) {
      prompt.hidden = true;
      promptAction = null;
      return;
    }
    prompt.hidden = false;
    prompt.querySelector(".g-prompt-text").textContent = text;
    promptAction = action ?? null;
  }

  function renderChecklist(quests, state) {
    checklistList.innerHTML = "";
    let doneCount = 0;
    for (const quest of quests) {
      const status = state.of(quest.id);
      if (status === "done") doneCount += 1;
      const item = el("li", `g-check-item is-${status}`, checklistList);
      const icon = el("span", "g-check-icon", item);
      icon.textContent = status === "done" ? "✓" : status === "active" ? "▸" : "○";
      const title = el("span", "g-check-title", item);
      title.textContent = quest.title;
      const sub = el("span", "g-check-sub", item);
      sub.textContent =
        status === "done"
          ? quest.done.split(".")[0]
          : status === "active"
            ? `Antar ${quest.item}`
            : "Temui pemberi titipan";
    }
    questBtn.querySelector(".g-quest-count").textContent = `${doneCount}/5`;
  }

  function toggleChecklist(force) {
    checklistOpen = force !== undefined ? force : !checklistOpen;
    checklist.hidden = !checklistOpen;
    if (checklistOpen) {
      emoteOpen = false;
      outfitOpen = false;
      emoteWheel.hidden = true;
      outfitPanel.hidden = true;
    }
  }

  function toggleEmotes(force) {
    emoteOpen = force !== undefined ? force : !emoteOpen;
    emoteWheel.hidden = !emoteOpen;
    if (emoteOpen) {
      checklistOpen = false;
      outfitOpen = false;
      checklist.hidden = true;
      outfitPanel.hidden = true;
    }
  }

  function toggleOutfit(force, outfit) {
    outfitOpen = force !== undefined ? force : !outfitOpen;
    outfitPanel.hidden = !outfitOpen;
    if (outfitOpen) {
      checklistOpen = false;
      emoteOpen = false;
      checklist.hidden = true;
      emoteWheel.hidden = true;
      renderOutfit(outfit);
    }
  }

  function renderOutfit(outfit) {
    for (const key of outfitKeys) {
      const index = outfit[key] ?? 0;
      swatches[key].forEach((btn, i) => {
        btn.classList.toggle("is-active", i === index);
      });
    }
  }

  function openDialog({ name, lines, actions }) {
    dialogState = { name, lines, index: 0, actions: actions ?? [] };
    dialogName.textContent = name;
    dialog.hidden = false;
    dialog.classList.remove("is-done");
    dialogActions.innerHTML = "";
    typeLine(0);
  }

  function typeLine(index) {
    dialogState.index = index;
    typed = "";
    typeProgress = 0;
    dialogText.textContent = "";
    dialogHint.textContent = "";
    dialogHint.hidden = false;
  }

  function advance() {
    if (!dialogState) return false;
    if (typed.length < dialogState.lines[dialogState.index].length) {
      typed = dialogState.lines[dialogState.index];
      dialogText.textContent = typed;
      return true;
    }
    if (dialogState.index + 1 < dialogState.lines.length) {
      typeLine(dialogState.index + 1);
      return true;
    }
    return false;
  }

  function finishDialog() {
    if (!dialogState) return;
    const actions = dialogState.actions;
    dialogText.textContent = dialogState.lines[dialogState.index];
    dialogHint.hidden = true;
    dialogActions.innerHTML = "";
    if (actions.length > 0) {
      for (const action of actions) {
        const btn = el("button", `g-btn${action.ghost ? " g-btn-ghost" : ""}`, dialogActions);
        btn.type = "button";
        btn.textContent = action.label;
        btn.addEventListener("click", () => {
          closeDialog();
          action.run();
        });
      }
    } else {
      dialog.classList.add("is-done");
      const btn = el("button", "g-btn", dialogActions);
      btn.type = "button";
      btn.textContent = "Tutup";
      btn.addEventListener("click", () => closeDialog());
    }
    dialogState = null;
  }

  function dialogClick() {
    if (!dialogState) return;
    if (!advance()) finishDialog();
  }

  function closeDialog() {
    dialogState = null;
    dialog.hidden = true;
  }

  function dialogIsOpen() {
    return !dialog.hidden;
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastTimer = 3.2;
  }

  function floatEmote(emoji) {
    const pos = projector?.() ?? null;
    const span = el("span", "g-floater", floaters);
    span.textContent = emoji;
    if (pos) {
      span.style.left = `${pos.x + (Math.random() * 36 - 18)}px`;
      span.style.top = `${pos.y - 40 - Math.random() * 20}px`;
    } else {
      span.style.left = `${window.innerWidth / 2}px`;
      span.style.top = `${window.innerHeight / 2}px`;
    }
    window.setTimeout(() => span.remove(), 1500);
  }

  function emoteByIndex(index) {
    const emoji = EMOTES[index % EMOTES.length];
    floatEmote(emoji);
    onEmote?.(emoji);
    return emoji;
  }

  function showCompletion() {
    completion.hidden = false;
  }

  function hideCompletion() {
    completion.hidden = true;
  }

  function completionOpen() {
    return !completion.hidden;
  }

  function setSound(value) {
    soundOn = value;
    soundBtn.classList.toggle("is-muted", !value);
    soundBtn.textContent = value ? "♪" : "♪̶";
  }

  questBtn.addEventListener("click", () => toggleChecklist());
  prompt.addEventListener("click", () => promptAction?.());
  emoteBtn.addEventListener("click", () => toggleEmotes());
  outfitBtn.addEventListener("click", () => toggleOutfit());
  dialog.addEventListener("click", () => dialogClick());
  soundBtn.addEventListener("click", () => onSound?.());
  emoteBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      emoteByIndex(Number(btn.dataset.index));
      toggleEmotes(false);
    }),
  );
  for (const key of outfitKeys) {
    for (const btn of swatches[key]) {
      btn.addEventListener("click", () => {
        onOutfit?.(key, Number(btn.dataset.index ?? btn.getAttribute("data-index") ?? 0));
      });
    }
  }
  stayBtn.addEventListener("click", () => {
    hideCompletion();
    onStay?.();
  });
  againBtn.addEventListener("click", () => {
    hideCompletion();
    onResetQuests?.();
  });

  function update(dt, outfit) {
    if (dialogState) {
      const line = dialogState.lines[dialogState.index];
      if (typed.length < line.length) {
        typeProgress += dt * 55;
        const next = Math.min(line.length, Math.floor(typeProgress));
        if (next !== typed.length) {
          typed = line.slice(0, next);
          dialogText.textContent = typed;
        }
      }
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.hidden = true;
    }
    if (outfitOpen) renderOutfit(outfit);
  }

  return {
    root,
    show,
    hide,
    setProjector,
    prompt: prompt_,
    openDialog,
    dialogClick,
    closeDialog,
    dialogIsOpen,
    toast,
    renderChecklist,
    toggleChecklist,
    toggleEmotes,
    toggleOutfit,
    emoteByIndex,
    showCompletion,
    hideCompletion,
    completionOpen,
    setSound,
    update,
  };
}
