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
   Each step has:
     - id
     - title
     - requiredAction (human-readable)
     - successMessage
     - failMessage
     - isComplete(state) => boolean
     - hint (one-line)
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

/* -------------------------
   Initialization / Reset
   ------------------------- */

function resetState() {
  // Reset all state fields
  state.inventory = new Set();
  state.selectedItem = null;
  state.selectedSite = null;
  // Randomly pick viable sites (light randomness: choose 2 of 3 common ones hand/forearm/antecubital)
  state.viableSites = pickRandom(["hand", "forearm", "antecubital"], 2);
  // Always include upperarm as a non-viable option (for advanced scenarios)
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
  // Re-render UI
  render();
  setMessage("New run: gather equipment and select a site. Hint available.", "info");
}

/* -------------------------
   Rendering functions
   ------------------------- */

function renderInventory() {
  // Clear grid
  inventoryGrid.innerHTML = "";
  // For each equipment item, create a card showing collected state
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

    // Click behavior:
    // - If not collected: clicking collects the item into inventory (simulating "pick up")
    // - If collected: clicking selects the item for use
    card.addEventListener("click", () => {
      if (!state.inventory.has(item)) {
        state.inventory.add(item);
        setMessage(`Collected ${item}.`, "success");
      } else {
        // toggle selection
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

function renderArmRegions() {
  // Visual selection styles
  for (const key of Object.keys(armRegions)) {
    const el = armRegions[key];
    el.classList.remove("selected");
    if (state.selectedSite === key) {
      el.classList.add("selected");
    }
  }

  // Site viability text
  if (!state.selectedSite) {
    selectedSiteSpan.textContent = "None";
    siteViabilityDiv.textContent = "";
  } else {
    selectedSiteSpan.textContent = capitalize(state.selectedSite);
    const viable = state.viableSites.includes(state.selectedSite);
    siteViabilityDiv.textContent = viable ? "Vein felt/visible here (viable)" : "No suitable vein felt here — move proximally.";
    siteViabilityDiv.style.color = viable ? "var(--success)" : "var(--danger)";
  }

  // Swelling indicator animation if swelling is true
  if (state.swelling) {
    swellingLabel.setAttribute("visibility", "visible");
    swellingIndicator.setAttribute("r", 40); // expand
    swellingIndicator.setAttribute("cx", getSiteCenterX(state.selectedSite));
    swellingIndicator.setAttribute("cy", getSiteCenterY(state.selectedSite));
  } else {
    swellingLabel.setAttribute("visibility", "hidden");
    swellingIndicator.setAttribute("r", 0);
  }
}

function getSiteCenterX(site) {
  // approximate centers used by the SVG layout
  switch (site) {
    case "hand":
      return 150;
    case "forearm":
      return 150;
    case "antecubital":
      return 150;
    case "upperarm":
      return 150;
    default:
      return 150;
  }
}
function getSiteCenterY(site) {
  switch (site) {
    case "hand":
      return 430;
    case "forearm":
      return 300;
    case "antecubital":
      return 170;
    case "upperarm":
      return 70;
    default:
      return 300;
  }
}

function renderSteps() {
  // Find first incomplete step to show as current
  const firstIncomplete = steps.find((st) => !st.isComplete(state));
  const currentTitle = firstIncomplete ? firstIncomplete.title : "Completed!";
  currentStepDiv.textContent = currentTitle;

  // Render checklist
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
  // Render the current message in the feedback area
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
  // Update selected item text
  selectedItemSpan.textContent = state.selectedItem ? state.selectedItem : "None";

  // Update console debug for developers/learners
  console.log("--- STATE ---", JSON.parse(JSON.stringify({
    inventory: Array.from(state.inventory),
    selectedItem: state.selectedItem,
    selectedSite: state.selectedSite,
    viableSites: state.viableSites,
    tourniquetOn: state.tourniquetOn,
    tourniquetOff: state.tourniquetOff,
    siteCleaned: state.siteCleaned,
    cannulaOpened: state.cannulaOpened,
    cannulaIn: state.cannulaIn,
    styletDisposed: state.styletDisposed,
    bungOn: state.bungOn,
    dressingOn: state.dressingOn,
    syringeFilled: state.syringeFilled,
    flushed: state.flushed,
    swelling: state.swelling,
  })));
}

/* -------------------------
   Utility UI helpers
   ------------------------- */

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/* -------------------------
   Site click handling
   ------------------------- */

for (const [siteKey, el] of Object.entries(armRegions)) {
  el.style.cursor = "pointer";
  el.addEventListener("click", () => {
    // When user clicks the arm region, behavior depends on selectedItem or action
    // - If selectedItem is "elastic tourniquet" and not yet on: apply tourniquet
    // - If selectedItem is "alcohol swab": clean site
    // - Otherwise: just select the site
    state.selectedSite = siteKey;
    state.siteCleaned = state.siteCleaned && state.selectedSite === siteKey; // siteCleaned remains only if same site
    state.swelling = false; // clear swelling when choosing a new site
    render();

    // If user has selected an item and it's a 'use-on-arm' item, perform appropriate action
    if (state.selectedItem === "elastic tourniquet") {
      attemptApplyTourniquet(siteKey);
      return;
    }
    if (state.selectedItem === "alcohol swab") {
      attemptCleanSite(siteKey);
      return;
    }

    // Normal selection vs viability
    if (!state.viableSites.includes(siteKey)) {
      setMessage("No suitable vein felt/seen here—move proximally.", "error");
    } else {
      setMessage(`Site selected: ${capitalize(siteKey)}.`, "success");
    }
    render();
  });
}

/* -------------------------
   Action handlers (buttons & interactions)
   ------------------------- */

actionApplyTourniquetBtn.addEventListener("click", () => {
  if (state.selectedItem === "elastic tourniquet") {
    // If tourniquet is selected as item, applying is same as clicking arm
    attemptApplyTourniquet(state.selectedSite);
  } else {
    // Allow applying tourniquet directly without selecting item only if item is collected
    if (!state.inventory.has("elastic tourniquet")) {
      setMessage("You need to collect the elastic tourniquet from the tray first.", "error");
      return;
    }
    // Apply to currently selected site if any
    attemptApplyTourniquet(state.selectedSite);
  }
});

actionReleaseTourniquetBtn.addEventListener("click", () => {
  // Releasing must happen after successful cannula insertion
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
  // Insertion is interactive: open a small angle chooser dialog (simple implementation via prompt)
  // Check preconditions first
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

  // Show angle choices using window.prompt-like UI (simpler, accessible)
  // We'll use a small custom prompt using confirm/alert loops (since no modal framework).
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

  // Evaluate insertion success
  if (angleNum === 45) {
    // Fail insertion due to wrong angle
    state.cannulaIn = false;
    // Simulate infiltration state and swelling
    state.swelling = true;
    setMessage(
      "Cannula did not enter the vein. Reattempt: choose a viable site and insert at a shallow angle (10–20°). Swelling noted.",
      "error"
    );
    render();
    return;
  }

  // Angle acceptable. Successful insertion.
  state.cannulaIn = true;
  state.cannulaOpened = true; // remains opened
  setMessage("Cannula successfully inserted into the vein.", "success");
  render();
});

actionDisposeSharpsBtn.addEventListener("click", () => {
  // Requires sharps bin collected and cannula inserted
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
  // Requires cannulaIn, stylet disposed, and tourniquetOff (released)
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
  // Must have collected syringe and fluids; require clicking both in any order then click Fill Syringe
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
  // Flush requires: syringe filled, bung attached, cannula inserted
  if (!state.syringeFilled) {
    setMessage("Fill the syringe with saline before flushing.", "error");
    return;
  }
  if (!state.bungOn) {
    setMessage("Attach the bung before flushing (to connect to the cannula).", "error");
    return;
  }

  // If cannulaIn is false, simulate infiltration/swelling and block success
  if (!state.cannulaIn) {
    // Show swelling and infiltration message
    state.swelling = true;
    state.flushed = false;
    setMessage(
      "Swelling noted—likely infiltration/extravasation. Cannula is not correctly placed.",
      "error"
    );
    render();
    return;
  }

  // Otherwise success: flush completes
  state.flushed = true;
  setMessage("Cannula flushed successfully. Procedure complete.", "success");
  render();
});

/* -------------------------
   Attempted use functions (when selectedItem used on arm)
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
  // Applying the tourniquet is allowed regardless of viability
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
  // Cleaning the selected site
  state.siteCleaned = true;
  setMessage(`Site cleaned at ${capitalize(siteKey)}.`, "success");
  render();
}

/* -------------------------
   Hint & Reset
   ------------------------- */

hintBtn.addEventListener("click", () => {
  // Find the first incomplete step and show its hint
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
   Setup event listeners for selecting items by clicking outside the inventory:
   If the user clicks an inventory item (already implemented), it's fine.
   We also allow using selected item on UI actions: e.g., clicking an item then clicking an action button.
   ------------------------- */

// Clicking on "Apply Tourniquet" button already handles selectedItem case.
// For "Open Cannula", clicking the 'cannula' item then "Open Cannula" is allowed.
// For cleaning, selecting alcohol swab and clicking arm is implemented.

// Attach small UI to enforce selecting bung, tegaderm, etc via clicking inventory then action works (if not, user can directly click action buttons).

/* -------------------------
   Arm region hover/click accessibility
   ------------------------- */

// Make regions keyboard accessible (optional) - add role and tabindex
for (const el of Object.values(armRegions)) {
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      el.click();
    }
  });
}

/* -------------------------
   Startup
   ------------------------- */

resetState(); // initialize state and render

// Expose state for debugging in console
window._ivSimState = state;
window._ivSimReset = resetState;

/* End of app.js */