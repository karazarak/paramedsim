# IV Cannulation Simulation — MVP

A vanilla HTML/CSS/JavaScript single-page simulation that models basic steps of IV cannulation for paramedicine learners.

This repository contains four files:
- `index.html` — the single-page app
- `styles.css` — styling
- `app.js` — simulation logic and state machine
- `README.md` — this file

How to run
- The app is static — no backend.
- You can open `index.html` directly in your browser (double-click). Some browsers restrict local JavaScript/prompt behavior; if you hit issues, run a simple HTTP server:
  - Python 3: `python -m http.server 8000` then open `http://localhost:8000/`
  - Node (http-server): `npx http-server` then open the provided URL
- Once open, you will see three panels: Equipment (left), Patient Arm (middle), Checklist/Feedback (right).

Simulation overview & rules
- Click equipment items on the left to collect them. Once collected, click an item again to select it for use.
- Select a cannulation site by clicking the arm regions (hand, forearm, antecubital, upper arm).
- Each run randomly chooses which sites are viable (2 of 3: hand, forearm, antecubital).
- Follow this high-level sequence (the app enforces order and gives clear feedback if a step is missed):
  1. Gather all equipment (collect all items on the tray)
  2. Select a viable site
  3. Apply tourniquet (select elastic tourniquet then click "Apply Tourniquet" or click the arm)
  4. Clean site with alcohol swab (select alcohol swab then click the chosen site)
  5. Open cannula (select cannula and click "Open Cannula")
  6. Insert cannula (click "Insert Cannula" and choose angle: 10°, 20° succeed; 45° fails)
  7. Release tourniquet (click "Release Tourniquet")
  8. Dispose stylet in sharps bin (must have collected sharps bin)
  9. Attach bung (requires cannula inserted, stylet disposed, tourniquet released)
  10. Apply tegaderm dressing
  11. Fill syringe with saline
  12. Flush cannula — if cannula is not in place, swelling/infiltration feedback is shown

State machine & data model
- The app uses a single source-of-truth `state` object in `app.js`.
- Important state properties:
  - inventory: Set of collected items
  - selectedItem: the item chosen for use
  - selectedSite: which arm region was selected
  - viableSites: randomized per run (2 of 3)
  - booleans: tourniquetOn, tourniquetOff, siteCleaned, cannulaOpened, cannulaIn, styletDisposed, bungOn, dressingOn, syringeFilled, flushed, swelling
- The `steps` array defines the ordered checklist. Each step has:
  - id, title, requiredAction, successMessage, failMessage, isComplete(state) function, and hint.
- The UI shows the current step, completed steps, and immediate feedback messages.

How to modify steps/items
- To change equipment or steps, edit `app.js`:
  - Update `REQUIRED_EQUIPMENT` to change tray items.
  - Update `steps` array to add/remove/modify steps and the `isComplete` checks.
  - Each `isComplete` must reference the `state` object to decide completion.
- The UI mapping between inventory names and logic relies on matching strings. If you rename equipment entries, update logic checks that use those exact names (for example, checks for `"alcohol swab"`, `"elastic tourniquet"`, `"cannula"`, etc).

Notes on UX and errors
- Wrong or out-of-order actions will show descriptive error messages explaining what's missing and how to fix it.
- The "Hint" button gives a one-line hint for the next required action.
- The "Reset" button starts a new run and randomizes viable sites.
- For demo simplicity, the "Insert Cannula" action uses a `prompt()` for angle entry. This keeps dependencies minimal. You can replace this with a custom modal UI if desired.

Developer tips
- The app logs a debug snapshot of the state to the console on each render.
- You can access `window._ivSimState` and `window._ivSimReset()` for debugging.
- All logic is in `app.js` and commented for clarity.

License / Attribution
- This is a simple educational MVP for local use. No medical certification is implied. Use it as a learning aid only.