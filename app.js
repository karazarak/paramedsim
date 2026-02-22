/* app.js
   IV Cannulation Simulation (MVP)
   - Vanilla JS single-page app
   - State machine drives the simulation
   - Heavily commented and beginner-friendly
*/

/* -------------------------
   Simulation: Configuration
   ------------------------- */

// List of equipment required (must be collected before proceeding)
const REQUIRED_EQUIPMENT = [
  "alcohol swab",
  "bung",
  "cannula",
  "tegaderm",
  "elastic tourniquet",
  "10 mL fluids (saline)",
  "10 mL syringe",
  "gloves",
  "goggles",
  "sharps bin",
];

// All candidate site keys (we will mark some as viable at run start)
const SITE_KEYS = ["hand", "forearm", "antecubital", "upperarm"];

/* -------------------------
   Application state (single source of truth)
   ------------------------- */

let state = {
  inventory: new Set(),        // collected items
  selectedItem: null,          // which inventory item is selected for use (string)
  selectedSite: null,          // e.g., "hand", "forearm", ...
  viableSites: [],             // chosen at random per run
  // boolean flags:
  tourniquetOn: false,
  tourniquetOff: false, // track explicit release
  siteCleaned: false,
  cannulaOpened: false,
  cannulaIn: false,
  styletDisposed: false,
  bungOn: false,
  dressingOn: false,
  syringeFilled: false,
  flushed: false,
  swelling: false,
  // UI debug/message
  message: "",
  messageType: "", // "", "error", "success", "info"
};

/* -------------------------
   Steps / State Machine
   ------------------------- */

const steps = [
  {
    id: "gather",
    title: "Gather equipment",
    requiredAction: "Collect all required equipment from the tray (order doesn't matter).",
    successMessage: "All equipment collected.",
    failMessage: "You must collect all items before starting.",
    isComplete: (s) => REQUIRED_EQUIPMENT.every((i) => s.inventory.has(i)),
    hint: "Click the equipment items on the left until all are green/collected.",
  },
  {
    id: "select-site",
    title: "Select cannulation site",
    requiredAction: "Choose a site on the arm (start at the hand and move proximally if needed).",
    successMessage: "Suitable vein selected.",
    failMessage: "Select a viable site on the arm to cannulate.",
    isComplete: (s) => Boolean(s.selectedSite) && s.viableSites.includes(s.selectedSite),
    hint: "Click a region on the arm (hand, forearm, or antecubital). Viable sites are randomized each run.",
  },
  {
    id: "apply-tourniquet",
    title: "Apply tourniquet",
    requiredAction: "Use the elastic tourniquet on the arm.",
    successMessage: "Tourniquet applied.",
    failMessage: "Apply the tourniquet before cleaning or cannulation.",
    isComplete: (s) => s.tourniquetOn === true,
    hint: "Click the 'elastic tourniquet' item then click 'Apply Tourniquet' or click the arm.",
  },
  {
    id: "clean-site",
    title: "Clean site",
    requiredAction: "Use the alcohol swab to clean the chosen site.",
    successMessage: "Site cleaned.",
    failMessage: "Clean the site with the alcohol swab first.",
    isComplete: (s) => s.siteCleaned === true,
    hint: "Select the alcohol swab from inventory then click the selected site on the arm.",
  },
  {
    id: "open-cannula",
    title: "Open cannula",
    requiredAction: "Open/prep the cannula component.",
    successMessage: "Cannula prepared.",
    failMessage: "Open the cannula before attempting insertion.",
    isComplete: (s) => s.cannulaOpened === true,
    hint: "Click the 'cannula' item, then click 'Open Cannula'.",
  },
  {
    id: "insert-cannula",
    title: "Insert cannula",
    requiredAction:
      "Insert the cannula at a shallow angle (10° or 20°). Requires viable site, tourniquet on, site cleaned, and cannula opened.",
    successMessage: "Cannula successfully inserted!",
    failMessage:
      "Cannulation failed. Ensure you have a viable site, the tourniquet is on, site is cleaned, and insert at 10°–20°.",
    isComplete: (s) => s.cannulaIn === true,
    hint: "Choose an angle of 10° or 20° when inserting. 45° will fail.",
  },
  {
    id: "release-tourniquet",
    title: "Release tourniquet",
    requiredAction: "Release/unbuckle the tourniquet after successful cannulation.",
    successMessage: "Tourniquet released.",
    failMessage: "Release the tourniquet before continuing.",
    isComplete: (s) => s.tourniquetOff === true,
    hint: "Click 'Release Tourniquet' to remove it after successful insertion.",
  },
  {
    id: "dispose-sharps",
    title: "Dispose stylet/sharp",
    requiredAction: "Dispose of the needle component in the sharps bin.",
    successMessage: "Stylet disposed correctly.",
    failMessage: "Dispose the stylet in the sharps bin before continuing.",
    isComplete: (s) => s.styletDisposed === true,
    hint: "Collect 'sharps bin' from the tray earlier, then choose 'Dispose Sharps'.",
  },
  {
    id: "attach-bung",
    title: "Attach bung",
    requiredAction: "Attach the bung to the cannula hub.",
    successMessage: "Bung attached.",
    failMessage: "Attach the bung before flushing/connecting lines.",
    isComplete: (s) => s.bungOn === true,
    hint: "Make sure the cannula is in, stylet disposed, and tourniquet released; then attach the bung.",
  },
  {
    id: "apply-dressing",
    title: "Apply tegaderm dressing",
    requiredAction: "Apply a transparent dressing over the cannula site.",
    successMessage: "Dressing applied.",
    failMessage: "Apply dressing before flushing in routine practice.",
    isComplete: (s) => s.dressingOn === true,
    hint: "Click 'tegaderm' in inventory and then 'Apply Dressing'.",
  },
  {
    id: "fill-syringe",
    title: "Fill 10 mL syringe",
    requiredAction: "Fill the syringe with 10 mL saline (click fluids then syringe).",
    successMessage: "Syringe filled.",
    failMessage: "Fill the syringe with the 10 mL fluids first.",
    isComplete: (s) => s.syringeFilled === true,
    hint: "Click '10 mL fluids (saline)' then '10 mL syringe' then 'Fill Syringe'.",
  },
  {
    id: "flush",
    title: "Flush cannula",
    requiredAction: "Flush the cannula with saline to confirm patency.",
    successMessage: "Cannula flushed successfully.",
    failMessage:
      "Flushing shows infiltration or cannula not in vein. Check placement and reattempt if needed.",
    isComplete: (s) => s.flushed === true,
    hint: "With syringe filled and bung attached, click 'Flush Cannula'.",
  },
];

/* -------------------------
   DOM references
   ------------------------- */

const inventoryGrid = document.getElementById("inventory-grid");
const selectedItemSpan = document.getElementById("selected-item");
const selectedSiteSpan = document.getElementById("selected-site");
const siteViabilityDiv = document.getElementById("site-viability");
const currentStepDiv = document.getElementById("current-step");
const stepsOl = document.getElementById("steps-ol");
const feedbackDiv = document.getElementById("feedback");
const hintBtn = document.getElementById("hint-btn");
const resetBtn = document.getElementById("reset-btn");

const actionApplyTourniquetBtn = document.getElementById("action-apply-tourniquet");
const actionCleanSiteBtn = document.getElementById("action-clean-site");
const actionReleaseTourniquetBtn = document.getElementById("action-release-tourniquet");
const actionOpenCannulaBtn = document.getElementById("action-open-cannula");
const actionInsertCannulaBtn = document.getElementById("action-insert-cannula");
const actionDisposeSharpsBtn = document.getElementById("action-dispose-sharps");
const actionAttachBungBtn = document.getElementById("action-attach-bung");
const actionApplyDressingBtn = document.getElementById("action-apply-dressing");
const actionFillSyringeBtn = document.getElementById("action-fill-syringe");
const actionFlushBtn = document.getElementById("action-flush");

/* Arm region elements */
const armRegions = {
  hand: document.getElementById("region-hand"),
  forearm: document.getElementById("region-forearm"),
  antecubital: document.getElementById("region-antecubital"),
  upperarm: document.getElementById("region-upperarm"),
};
const swellingIndicator = document.getElementById("swelling-indicator");
const swellingLabel = document.getElementById("swelling-label");

/* Drag stage elements */
const dragStage = document.getElementById("drag-stage");
const simStage = document.getElementById("app");
const dragItems = document.getElementById("drag-items");
const narrationBox = document.getElementById("narration");
const armDropZone = document.getElementById("arm-drop-zone");
const continueToSimBtn = document.getElementById("continue-to-sim");

/* -------------------------
   Helpers
   ------------------------- */

// Helper: pick N random items from array
function pickRandom(array, n) {
  const copy = array.slice();
  const result = [];
  while (result.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// Display a message in the feedback box
function setMessage(text, type = "info") {
  state.message = text;
  state.messageType = type;
  renderMessages();
  console.log("[MSG]", type.toUpperCase(), text);
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/* -------------------------
   Initialization / Reset
   ------------------------- */

function resetState() {
  state.inventory = new Set();
  state.selectedItem = null;
  state.selectedSite = null;
  state.viableSites = pickRandom(["hand", "forearm", "antecubital"], 2);

  state.tourniquetOn = false;
  state.tourniquetOff = false;
  state.siteCleaned = false;
  state.cannulaOpened = false;
  state.cannulaIn = false;
  state.styletDisposed = false;
  state.bungOn = false;
  state.dressingOn = false;
  state.syringeFilled = false;
  state.flushed = false;
  state.swelling = false;

  state.message = "";
  state.messageType = "";

  render();
  setMessage("New run: gather equipment and select a site. Hint available.", "info");
}

/* -------------------------
   Rendering functions
   ------------------------- */

function renderInventory() {
  inventoryGrid.innerHTML = "";

  for (const item of REQUIRED_EQUIPMENT) {
    const card = document.createElement("div");
    card.className = "item-card";
    if (state.inventory.has(item)) card.classList.add("collected");
    if (state.selectedItem === item) card.classList.add("selected");

    card.dataset.item = item;

    const label = document.createElement("div");
    label.className = "item-label";
    label.textContent = item;

    const check = document.createElement("div");
    check.className = "item-check";
    check.textContent = state.inventory.has(item) ? "Collected ✓" : "Click to collect";

    card.appendChild(label);
    card.appendChild(check);

    card.addEventListener("click", () => {
      if (!state.inventory.has(item)) {
        state.inventory.add(item);
        setMessage(`Collected ${item}.`, "success");
      } else {
        if (state.selectedItem === item) {
          state.selectedItem = null;
          setMessage(`${item} deselected.`, "info");
        } else {
          state.selectedItem = item;
          setMessage(`${item} selected for use.`, "info");
        }
      }
      render();
    });

    inventoryGrid.appendChild(card);
  }

  selectedItemSpan.textContent = state.selectedItem ? state.selectedItem : "None";
}

function getSiteCenterX(site) {
  return 150;
}
function getSiteCenterY(site) {
  switch (site) {
    case "hand": return 430;
    case "forearm": return 300;
    case "antecubital": return 170;
    case "upperarm": return 70;
    default: return 300;
  }
}

function renderArmRegions() {
  for (const key of Object.keys(armRegions)) {
    const el = armRegions[key];
    el.classList.remove("selected");
    if (state.selectedSite === key) el.classList.add("selected");
  }

  if (!state.selectedSite) {
    selectedSiteSpan.textContent = "None";
    siteViabilityDiv.textContent = "";
  } else {
    selectedSiteSpan.textContent = capitalize(state.selectedSite);
    const viable = state.viableSites.includes(state.selectedSite);
    siteViabilityDiv.textContent = viable ? "Vein felt/visible here (viable)" : "No suitable vein felt here — move proximally.";
    siteViabilityDiv.style.color = viable ? "var(--success)" : "var(--danger)";
  }

  if (state.swelling) {
    swellingLabel.setAttribute("visibility", "visible");
    swellingIndicator.setAttribute("r", 40);
    swellingIndicator.setAttribute("cx", getSiteCenterX(state.selectedSite));
    swellingIndicator.setAttribute("cy", getSiteCenterY(state.selectedSite));
  } else {
    swellingLabel.setAttribute("visibility", "hidden");
    swellingIndicator.setAttribute("r", 0);
  }
}

function renderSteps() {
  const firstIncomplete = steps.find((st) => !st.isComplete(state));
  currentStepDiv.textContent = firstIncomplete ? firstIncomplete.title : "Completed!";

  stepsOl.innerHTML = "";
  for (const st of steps) {
    const li = document.createElement("li");
    li.className = "step-item";
    if (st.isComplete(state)) li.classList.add("completed");

    const title = document.createElement("div");
    title.className = "step-title";
    title.textContent = st.title;

    const status = document.createElement("div");
    status.className = "step-status";
    status.textContent = st.isComplete(state) ? "Done" : "Pending";

    li.appendChild(title);
    li.appendChild(status);
    stepsOl.appendChild(li);
  }
}

function renderMessages() {
  feedbackDiv.innerHTML = "";
  if (!state.message) {
    feedbackDiv.textContent = "Actions and guidance will appear here.";
    return;
  }
  const p = document.createElement("div");
  if (state.messageType === "error") p.className = "error";
  else if (state.messageType === "success") p.className = "success";
  p.textContent = state.message;
  feedbackDiv.appendChild(p);
}

function render() {
  renderInventory();
  renderArmRegions();
  renderSteps();
  renderMessages();
  selectedItemSpan.textContent = state.selectedItem ? state.selectedItem : "None";
}

/* -------------------------
   Site click handling
   ------------------------- */

for (const [siteKey, el] of Object.entries(armRegions)) {
  el.style.cursor = "pointer";
  el.addEventListener("click", () => {
    state.selectedSite = siteKey;
    state.siteCleaned = state.siteCleaned && state.selectedSite === siteKey;
    state.swelling = false;
    render();

    if (state.selectedItem === "elastic tourniquet") {
      attemptApplyTourniquet(siteKey);
      return;
    }
    if (state.selectedItem === "alcohol swab") {
      attemptCleanSite(siteKey);
      return;
    }

    if (!state.viableSites.includes(siteKey)) {
      setMessage("No suitable vein felt/seen here—move proximally.", "error");
    } else {
      setMessage(`Site selected: ${capitalize(siteKey)}.`, "success");
    }
    render();
  });
}

/* -------------------------
   Action handlers
   ------------------------- */

actionApplyTourniquetBtn.addEventListener("click", () => {
  if (state.selectedItem === "elastic tourniquet") {
    attemptApplyTourniquet(state.selectedSite);
  } else {
    if (!state.inventory.has("elastic tourniquet")) {
      setMessage("You need to collect the elastic tourniquet from the tray first.", "error");
      return;
    }
    attemptApplyTourniquet(state.selectedSite);
  }
});

actionCleanSiteBtn.addEventListener("click", () => {
  attemptCleanSite(state.selectedSite);
});

actionReleaseTourniquetBtn.addEventListener("click", () => {
  if (!state.cannulaIn) {
    setMessage("Release the tourniquet only after successful insertion. Cannula is not in.", "error");
    return;
  }
  if (!state.tourniquetOn) {
    setMessage("Tourniquet is not applied.", "error");
    return;
  }
  state.tourniquetOn = false;
  state.tourniquetOff = true;
  setMessage("Tourniquet released.", "success");
  render();
});

actionOpenCannulaBtn.addEventListener("click", () => {
  if (!state.inventory.has("cannula")) {
    setMessage("You must collect a cannula before opening it.", "error");
    return;
  }
  state.cannulaOpened = true;
  setMessage("Cannula opened/prepared.", "success");
  render();
});

actionInsertCannulaBtn.addEventListener("click", () => {
  if (!state.cannulaOpened) {
    setMessage("Open the cannula before attempting insertion.", "error");
    return;
  }
  if (!state.selectedSite) {
    setMessage("Select a site on the arm before inserting the cannula.", "error");
    return;
  }
  if (!state.viableSites.includes(state.selectedSite)) {
    setMessage("No suitable vein felt/seen here—move proximally and choose a viable site.", "error");
    return;
  }
  if (!state.tourniquetOn) {
    setMessage("Apply the tourniquet before insertion.", "error");
    return;
  }
  if (!state.siteCleaned) {
    setMessage("Clean the chosen site with an alcohol swab before insertion.", "error");
    return;
  }

  const angle = prompt("Choose insertion angle: enter 10, 20, or 45 (degrees). Recommended: 10 or 20.");
  if (angle === null) {
    setMessage("Cannula insertion cancelled.", "info");
    return;
  }
  const angleNum = parseInt(angle.trim(), 10);
  if (![10, 20, 45].includes(angleNum)) {
    setMessage("Invalid angle selected. Choose 10, 20, or 45.", "error");
    return;
  }

  if (angleNum === 45) {
    state.cannulaIn = false;
    state.swelling = true;
    setMessage(
      "Cannula did not enter the vein. Reattempt: choose a viable site and insert at a shallow angle (10–20°). Swelling noted.",
      "error"
    );
    render();
    return;
  }

  state.cannulaIn = true;
  setMessage("Cannula successfully inserted into the vein.", "success");
  render();
});

actionDisposeSharpsBtn.addEventListener("click", () => {
  if (!state.inventory.has("sharps bin")) {
    setMessage("You need to collect the sharps bin from the tray to dispose the stylet.", "error");
    return;
  }
  if (!state.cannulaIn) {
    setMessage("You may not have a cannula in place. Ensure insertion succeeded before disposing stylet.", "error");
    return;
  }
  state.styletDisposed = true;
  setMessage("Stylet disposed in sharps bin.", "success");
  render();
});

actionAttachBungBtn.addEventListener("click", () => {
  if (!state.cannulaIn) {
    setMessage("Cannula must be in before attaching the bung.", "error");
    return;
  }
  if (!state.styletDisposed) {
    setMessage("Dispose of the stylet in the sharps bin before attaching the bung.", "error");
    return;
  }
  if (!state.tourniquetOff) {
    setMessage("Release the tourniquet before attaching the bung.", "error");
    return;
  }
  if (!state.inventory.has("bung")) {
    setMessage("You need to collect the bung from the tray.", "error");
    return;
  }
  state.bungOn = true;
  setMessage("Bung attached to cannula hub.", "success");
  render();
});

actionApplyDressingBtn.addEventListener("click", () => {
  if (!state.inventory.has("tegaderm")) {
    setMessage("Collect tegaderm from the tray first.", "error");
    return;
  }
  state.dressingOn = true;
  setMessage("Tegaderm dressing applied over cannula.", "success");
  render();
});

actionFillSyringeBtn.addEventListener("click", () => {
  if (!state.inventory.has("10 mL syringe")) {
    setMessage("Collect the 10 mL syringe from the tray first.", "error");
    return;
  }
  if (!state.inventory.has("10 mL fluids (saline)")) {
    setMessage("Collect the 10 mL fluids (saline) from the tray first.", "error");
    return;
  }
  state.syringeFilled = true;
  setMessage("Syringe filled with 10 mL saline.", "success");
  render();
});

actionFlushBtn.addEventListener("click", () => {
  if (!state.syringeFilled) {
    setMessage("Fill the syringe with saline before flushing.", "error");
    return;
  }
  if (!state.bungOn) {
    setMessage("Attach the bung before flushing (to connect to the cannula).", "error");
    return;
  }

  if (!state.cannulaIn) {
    state.swelling = true;
    state.flushed = false;
    setMessage("Swelling noted—likely infiltration/extravasation. Cannula is not correctly placed.", "error");
    render();
    return;
  }

  state.flushed = true;
  setMessage("Cannula flushed successfully. Procedure complete.", "success");
  render();
});

/* -------------------------
   Attempted use functions
   ------------------------- */

function attemptApplyTourniquet(siteKey) {
  if (!state.inventory.has("elastic tourniquet")) {
    setMessage("You must collect the elastic tourniquet first.", "error");
    return;
  }
  if (!siteKey) {
    setMessage("Select a site on the arm to apply the tourniquet (click an arm region).", "error");
    return;
  }
  state.tourniquetOn = true;
  state.tourniquetOff = false;
  setMessage(`Tourniquet applied at ${capitalize(siteKey)}.`, "success");
  render();
}

function attemptCleanSite(siteKey) {
  if (!state.inventory.has("alcohol swab")) {
    setMessage("Collect an alcohol swab from the tray first.", "error");
    return;
  }
  if (!siteKey) {
    setMessage("Select a site to clean (click an arm region).", "error");
    return;
  }
  state.siteCleaned = true;
  setMessage(`Site cleaned at ${capitalize(siteKey)}.`, "success");
  render();
}

/* -------------------------
   Hint & Reset
   ------------------------- */

hintBtn.addEventListener("click", () => {
  const firstIncomplete = steps.find((st) => !st.isComplete(state));
  if (!firstIncomplete) {
    setMessage("All steps complete. Reset to practice again.", "info");
    return;
  }
  setMessage(`Hint: ${firstIncomplete.hint}`, "info");
});

resetBtn.addEventListener("click", () => {
  if (confirm("Reset simulation and choose new viable sites?")) {
    resetState();
  }
});

/* -------------------------
   Accessibility
   ------------------------- */

for (const el of Object.values(armRegions)) {
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") el.click();
  });
}

/* -------------------------
   Startup
   ------------------------- */

resetState();
window._ivSimState = state;
window._ivSimReset = resetState;

/* -------------------------
   Equipment overlay (hotspots)
   ------------------------- */

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

// Lock background scroll while overlay is open
document.body.classList.add("overlay-open");

function formatItemLabel(item) {
  const map = {
    "10 mL fluids (saline)": "10 mL fluids",
    "elastic tourniquet": "Tourniquet",
  };
  return map[item] || item;
}

function updateOverlayStatus() {
  const collectedCount = OVERLAY_REQUIRED_ITEMS.filter(i => state.inventory.has(i)).length;
  overlayStatus.textContent = `Collected: ${collectedCount} / ${OVERLAY_REQUIRED_ITEMS.length}`;
  startBtn.disabled = collectedCount !== OVERLAY_REQUIRED_ITEMS.length;

  if (overlayChecklist) {
    overlayChecklist.innerHTML = OVERLAY_REQUIRED_ITEMS.map(item => {
      const done = state.inventory.has(item);
      return `
        <div class="overlay-check-item ${done ? "done" : ""}">
          <span class="overlay-check-icon">${done ? "✓" : "✗"}</span>
          <span>${formatItemLabel(item)}</span>
        </div>
      `;
    }).join("");
  }
}

hotspots.forEach(btn => {
  btn.addEventListener("click", () => {
    const item = btn.dataset.item;
    if (!item) return;

    if (OVERLAY_REQUIRED_ITEMS.includes(item)) {
      state.inventory.add(item);
    }

    btn.classList.add("collected");
    btn.disabled = true;

    render();
    updateOverlayStatus();
  });
});

startBtn.addEventListener("click", () => {
  startOverlay.style.display = "none";
  document.body.classList.remove("overlay-open");

  // Show drag stage first, hide full sim for now
  if (dragStage) dragStage.classList.remove("hidden");
  if (simStage) simStage.classList.add("hidden");
});

updateOverlayStatus();

/* -------------------------
   Drag & Drop stage logic
   ------------------------- */

const narrationText = {
  "elastic tourniquet": "Tourniquet applied. Blood flow is restricted to help the vein fill.",
  "alcohol swab": "Alcohol swab used. Site cleaned.",
  "cannula": "Cannula positioned for insertion at a shallow angle (10–20°).",
  "bung": "Bung attached to the cannula hub.",
  "tegaderm": "Tegaderm applied to secure the cannula.",
  "10 mL syringe": "10 mL syringe ready.",
  "10 mL fluids (saline)": "Saline ready to draw up for flushing."
};

function setNarration(msg) {
  if (narrationBox) narrationBox.textContent = msg;
}

function isOverDropZone(x, y) {
  if (!armDropZone) return false;
  const r = armDropZone.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function makeDraggable(el) {
  const originalParent = el.parentElement;
  const originalNext = el.nextElementSibling;

  let dragging = false;
  let pointerId = null;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("pointerdown", (e) => {
    pointerId = e.pointerId;
    el.setPointerCapture(pointerId);

    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    el.classList.add("dragging");
    dragging = true;

    // Lift element above everything
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.zIndex = "99999";
    el.style.margin = "0";
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    el.style.left = `${e.clientX - offsetX}px`;
    el.style.top = `${e.clientY - offsetY}px`;
  });

  el.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("dragging");

    const droppedOnArm = isOverDropZone(e.clientX, e.clientY);
    const item = el.dataset.item;

    if (droppedOnArm && armDropZone) {
      // Place inside drop zone
      const zoneRect = armDropZone.getBoundingClientRect();
      const x = e.clientX - zoneRect.left - offsetX;
      const y = e.clientY - zoneRect.top - offsetY;

      armDropZone.appendChild(el);
      el.style.position = "absolute";
      el.style.left = `${Math.max(0, x)}px`;
      el.style.top = `${Math.max(0, y)}px`;
      el.style.zIndex = "30";
      el.classList.add("placed");

      setNarration(narrationText[item] || `${item} applied.`);
    } else {
      // Return to left panel list
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

// Enable dragging
document.querySelectorAll(".draggable").forEach(makeDraggable);

// Continue to full simulation
if (continueToSimBtn) {
  continueToSimBtn.addEventListener("click", () => {
    if (dragStage) dragStage.classList.add("hidden");
    if (simStage) simStage.classList.remove("hidden");
    setMessage("Continue the procedure in the full simulation.", "info");
  });
}
