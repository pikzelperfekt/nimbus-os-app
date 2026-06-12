# Nimbus OS — macOS app

The whole [Nimbus OS](https://lumistead.pages.dev/apps/nimbus-os/) as a native
Mac app — a complete desktop OS (boot screen, windows, dock, filesystem, app
store, NimbusNet, the works) running in its own window.

It's a thin Electron shell around the hosted OS (`?native=1`), so it stays in
sync with the web version automatically and shares the same NimbusNet accounts —
sign in here and your files, settings, and apps follow you (cloud sync).

## Run it

```bash
npm install
npm start
```

## Build a .dmg

```bash
npm run app:build      # signed/notarized if Apple creds are set in env
npm run app:dir        # quick unsigned local build (dist-app/)
```

## How it works

- `main.js` — a `BrowserWindow` with the macOS hidden-inset title bar (traffic
  lights overlay the OS's own menu bar, which becomes the window's drag handle)
  loading `lumistead.pages.dev/apps/nimbus-os/?native=1`.
- `preload.js` — exposes `window.nimbusNative` (contextIsolated). The OS fires
  **native macOS notifications** through it when the window is in the background.
- `?native=1` makes the OS add `<html class="native">`: its menu bar gets
  `-webkit-app-region: drag` and shifts right to clear the traffic lights.
- The browser-facing OS code lives in the Nimbus OS repo
  (`browser-os/`, served from Lumistead) — edit there, redeploy, the app updates.

## Notes

- Requires an internet connection (NimbusNet is a real shared backend).
- Its localStorage (local filesystem/prefs) is separate from your browser's, but
  signing into the same NimbusNet account syncs everything across both.
- Change `NIMBUS_URL` in `main.js` to point at a different deployment.
