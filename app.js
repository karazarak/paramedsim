// Only two stages now:
// 1) equipment photo overlay
// 2) drag equipment onto arm + narration

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
const narrationBox = document.getElementById("narration");
const armDropZone = document.getElementById("arm-drop-zone");

// Simple state
const state = {
  collected: new Set(),
};

document.body.classList.add("overlay-open");

function formatItemLabel(item) {
  const map = {
    "10 mL fluids (saline)": "10 mL fluids",
    "elastic tourniquet": "Tourniquet",
  };
  return map[item] || item;
}

function updateOverlayStatus() {
  const count = OVERLAY_REQUIRED_ITEMS.filter(i => state.collected.has(i)).length;
  overlayStatus.textContent = `Collected: ${count} / ${OVERLAY_REQUIRED_ITEMS.length}`;
  startBtn.disabled = count !== OVERLAY_REQUIRED_ITEMS.length;

  overlayChecklist.innerHTML = OVERLAY_REQUIRED_ITEMS.map(item => {
    const done = state.collected.has(item);
    return `
      <div class="overlay-check-item ${done ? "done" : ""}">
        <span class="overlay-check-icon">${done ? "✓" : "✗"}</span>
        <span>${formatItemLabel(item)}</span>
      </div>
    `;
  }).join("");
}

hotspots.forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.dataset.item;
    if (!item) return;

    if (OVERLAY_REQUIRED_ITEMS.includes(item)) {
      state.collected.add(item);
    }

    btn.classList.add("collected");
    btn.disabled = true;

    updateOverlayStatus();
  });
});

startBtn.addEventListener("click", () => {
  startOverlay.style.display = "none";
  document.body.classList.remove("overlay-open");
  dragStage.classList.remove("hidden");
});

updateOverlayStatus();

/* -------------------------
   Drag & Drop stage logic
   ------------------------- */

const narrationText = {
  "elastic tourniquet": "Tourniquet applied. Blood flow is restricted so the vein can fill.",
  "alcohol swab": "Alcohol swab used. Site cleaned.",
  "cannula": "Cannula positioned for insertion (aim for a shallow angle).",
  "bung": "Bung attached to the cannula hub.",
  "tegaderm": "Tegaderm applied to secure the cannula.",
  "10 mL syringe": "10 mL syringe ready for flushing.",
  "10 mL fluids (saline)": "Saline ready to draw up and flush.",
};

function setNarration(text) {
  narrationBox.textContent = text;
}

function isOverDropZone(x, y) {
  const r = armDropZone.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function makeDraggable(el) {
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const originalParent = el.parentElement;
  const originalNext = el.nextElementSibling;

  el.addEventListener("pointerdown", (e) => {
    // prevent page scroll while dragging (iPad)
    e.preventDefault();

    dragging = true;
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);

    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    // lift as fixed element
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.zIndex = "99999";
    el.style.margin = "0";
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
  });

  el.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    e.preventDefault();

    dragging = false;
    el.classList.remove("dragging");

    const item = el.dataset.item;
    const droppedOnArm = isOverDropZone(e.clientX, e.clientY);

    if (droppedOnArm) {
      // place inside the drop zone
      const zoneRect = armDropZone.getBoundingClientRect();
      const x = e.clientX - zoneRect.left - offsetX;
      const y = e.clientY - zoneRect.top - offsetY;

      armDropZone.appendChild(el);

      el.style.position = "absolute";
      el.style.left = `${Math.max(0, x)}px`;
      el.style.top = `${Math.max(0, y)}px`;
      el.style.zIndex = "25";
      el.classList.add("placed");

      setNarration(narrationText[item] || `${item} applied.`);
    } else {
      // return to the left list
      if (originalParent) {
        if (originalNext && originalNext.parentElement === originalParent) {
          originalParent.insertBefore(el, originalNext);
        } else {
          originalParent.appendChild(el);
        }
      }
      el.style.position = "static";
      el.style.left = "";
      el.style.top = "";
      el.style.zIndex = "";
      el.style.margin = "";
      el.classList.remove("placed");

      setNarration("Move the item onto the arm to apply it.");
    }
  });

  el.addEventListener("pointercancel", () => {
    dragging = false;
    el.classList.remove("dragging");
  });
}

// enable dragging
document.querySelectorAll(".draggable").forEach(makeDraggable);
