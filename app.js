// IV Cannulation Practice
// Stage 1: Tap hotspots on the kit photo to "collect" equipment
// Stage 2: Drag equipment boxes onto an arm image and read narration
// Optional: Ask questions using your /api/chat backend (Gemini)

document.addEventListener("DOMContentLoaded", () => {
  /* ------------------------------
     Stage 1: Equipment overlay
     ------------------------------ */

  const OVERLAY_REQUIRED_ITEMS = [
    "alcohol swab",
    "bung",
    "cannula",
    "tegaderm",
    "elastic tourniquet",
    "10 mL fluids (saline)",
    "10 mL syringe",
  ];

  const startOverlay = document.getElementById("start-overlay");
  const overlayStatus = document.getElementById("overlay-status");
  const overlayChecklist = document.getElementById("overlay-checklist");
  const startBtn = document.getElementById("start-btn");
  const hotspots = Array.from(document.querySelectorAll(".hotspot"));

  const dragStage = document.getElementById("drag-stage");
  const aiHelp = document.getElementById("ai-help");

  const state = { collected: new Set() };

  if (!startOverlay || !overlayStatus || !overlayChecklist || !startBtn) {
    console.warn("Overlay elements missing in HTML.");
    return;
  }

  document.body.classList.add("overlay-open");

  function formatItemLabel(item) {
    const map = {
      "10 mL fluids (saline)": "10 mL fluids",
      "elastic tourniquet": "Tourniquet",
    };
    return map[item] || item;
  }

  function updateOverlayStatus() {
    const count = OVERLAY_REQUIRED_ITEMS.filter((i) => state.collected.has(i)).length;

    overlayStatus.textContent = `Collected: ${count} / ${OVERLAY_REQUIRED_ITEMS.length}`;
    startBtn.disabled = count !== OVERLAY_REQUIRED_ITEMS.length;

    overlayChecklist.innerHTML = OVERLAY_REQUIRED_ITEMS.map((item) => {
      const done = state.collected.has(item);
      return `
        <div class="overlay-check-item ${done ? "done" : ""}">
          <span class="overlay-check-icon">${done ? "✓" : "✗"}</span>
          <span>${formatItemLabel(item)}</span>
        </div>
      `;
    }).join("");
  }

  hotspots.forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.dataset.item;
      if (!item) return;

      if (OVERLAY_REQUIRED_ITEMS.includes(item)) state.collected.add(item);

      btn.classList.add("collected");
      btn.disabled = true;

      updateOverlayStatus();
    });
  });

  startBtn.addEventListener("click", () => {
    startOverlay.style.display = "none";
    document.body.classList.remove("overlay-open");

    if (dragStage) dragStage.classList.remove("hidden");
    if (aiHelp) aiHelp.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  updateOverlayStatus();

  /* ------------------------------
     Stage 2: Drag & Drop practice
     ------------------------------ */

  const narrationBox = document.getElementById("narration");
  const armDropZone = document.getElementById("arm-drop-zone");

  const narrationText = {
    "elastic tourniquet": "Tourniquet applied. Blood flow is restricted so the vein can fill.",
    "alcohol swab": "Alcohol swab used. Site cleaned.",
    "cannula": "Cannula positioned for insertion (aim for a shallow angle 10–20°).",
    "bung": "Bung attached to the cannula hub.",
    "tegaderm": "Tegaderm applied to secure the cannula.",
    "10 mL syringe": "10 mL syringe ready for flushing.",
    "10 mL fluids (saline)": "Saline ready to draw up and flush.",
  };

  function setNarration(text) {
    if (narrationBox) narrationBox.textContent = text;
  }

  function isOverDropZone(x, y) {
    if (!armDropZone) return false;
    const r = armDropZone.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function getClientPoint(e) {
    if (typeof e.clientX === "number") return { x: e.clientX, y: e.clientY };
    const t = e.touches?.[0] || e.changedTouches?.[0];
    return t ? { x: t.clientX, y: t.clientY } : { x: 0, y: 0 };
  }

  function makeDraggable(el) {
    if (!armDropZone) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const originalParent = el.parentElement;
    const originalIndex = originalParent ? Array.from(originalParent.children).indexOf(el) : 0;

    function startDrag(e) {
      if (e.cancelable) e.preventDefault();
      dragging = true;
      el.classList.add("dragging");

      const rect = el.getBoundingClientRect();
      const pt = getClientPoint(e);
      offsetX = pt.x - rect.left;
      offsetY = pt.y - rect.top;

      el.style.position = "fixed";
      el.style.left = `${rect.left}px`;
      el.style.top = `${rect.top}px`;
      el.style.zIndex = "99999";
      el.style.margin = "0";

      if (e.pointerId != null && el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
    }

    function moveDrag(e) {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();

      const pt = getClientPoint(e);
      el.style.left = `${pt.x - offsetX}px`;
      el.style.top = `${pt.y - offsetY}px`;
    }

    function endDrag(e) {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();

      dragging = false;
      el.classList.remove("dragging");

      const pt = getClientPoint(e);
      const item = el.dataset.item || "item";

      if (isOverDropZone(pt.x, pt.y)) {
        const zoneRect = armDropZone.getBoundingClientRect();
        const x = pt.x - zoneRect.left - offsetX;
        const y = pt.y - zoneRect.top - offsetY;

        armDropZone.appendChild(el);
        el.style.position = "absolute";
        el.style.left = `${Math.max(0, x)}px`;
        el.style.top = `${Math.max(0, y)}px`;
        el.style.zIndex = "25";
        el.classList.add("placed");

        setNarration(narrationText[item] || `${item} applied.`);
      } else {
        if (originalParent) {
          const children = Array.from(originalParent.children);
          const beforeNode = children[Math.min(originalIndex, children.length)] || null;
          originalParent.insertBefore(el, beforeNode);
        }

        el.style.position = "static";
        el.style.left = "";
        el.style.top = "";
        el.style.zIndex = "";
        el.style.margin = "";
        el.classList.remove("placed");

        setNarration("Move the item onto the arm to apply it.");
      }
    }

    el.addEventListener("pointerdown", startDrag);
    el.addEventListener("pointermove", moveDrag);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    el.addEventListener("touchstart", startDrag, { passive: false });
    el.addEventListener("touchmove", moveDrag, { passive: false });
    el.addEventListener("touchend", endDrag, { passive: false });
    el.addEventListener("touchcancel", endDrag, { passive: false });
  }

  document.querySelectorAll(".draggable").forEach(makeDraggable);

  /* ------------------------------
     AI helper chat (Gemini via /api/chat)
     ------------------------------ */

  const chatLog = document.getElementById("chat-log");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");

  function addMsg(text, who) {
    if (!chatLog) return;
    const div = document.createElement("div");
    div.className = `msg ${who}`;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  async function sendChat() {
    if (!chatInput) return;
    const text = (chatInput.value || "").trim();
    if (!text) return;

    addMsg(text, "user");
    chatInput.value = "";

    addMsg("Thinking…", "ai");
    const thinkingNode = chatLog ? chatLog.lastChild : null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      let data;
      try { data = await res.json(); }
      catch { data = { error: "Server returned non-JSON response" }; }

      if (thinkingNode) thinkingNode.remove();

      if (!res.ok) {
        addMsg(`Error (${res.status}): ${data.error || "Unknown error"}`, "ai");
        if (data.details) addMsg(JSON.stringify(data.details).slice(0, 700), "ai");
        return;
      }

      addMsg(data.reply || "No reply returned.", "ai");
    } catch (e) {
      if (thinkingNode) thinkingNode.remove();
      addMsg(`Network error: ${String(e)}`, "ai");
    }
  }

  if (chatSend) chatSend.addEventListener("click", sendChat);
  if (chatInput) chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
  });
});
