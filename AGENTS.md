# Stickman Prime Robot

A dependency-free demo monorepo with two client-side products:

- `webapp/` — a standalone static web page (vanilla HTML/CSS/JS) that visualizes an animated SVG stickman running mock processes on prime-number intervals (2s/3s/5s/7s/11s), with a live activity log, connector panels, and a prime-number chat.
- `extension/` — a Chrome Manifest V3 extension that does the same conceptually from a toolbar popup + background service worker + content script.

There is **no backend, database, package manager, build step, lint config, or test suite** anywhere in the repo. All data is mocked in-memory.

## Cursor Cloud specific instructions

- **Nothing to install.** There are no dependency manifests (`package.json`, lockfiles, etc.), no build tooling, and no test/lint frameworks. Do not attempt `npm install`/`pip install` — there is nothing to install.
- **Run the webapp** by serving the static directory; it is purely client-side. From `webapp/`: `python3 -m http.server 8000`, then open `http://localhost:8000/`. (`python3` is preinstalled.) Opening `index.html` directly also works, but serving over HTTP is preferred.
  - Hello-world / smoke test: type a number (e.g. `17` or `24`) or `help` into the bottom chat box; the bot replies with prime analysis.
  - Note: the chat input is styled to blend into the dark background and can be hard to see/click in automated tooling; clicking the area just left of the `SEND` button (bottom row) focuses it.
- **The extension** is loaded unpacked in a Chromium browser via `chrome://extensions` → enable Developer mode → "Load unpacked" → select `extension/`. It has no build step. The background service worker auto-starts its prime-interval schedulers; open the toolbar popup to view it.
- **Lint/test/build:** none are configured. If asked to add them, they must be created from scratch.
