# Nimbus OS

A fake operating system that lives in a browser tab. Boot screen → desktop with
wallpaper, menu bar, draggable/resizable windows, and a dock that bounces.
No build step, no dependencies — **double-click `index.html`** to boot.

## The OS shell

- **Lock screen** on boot (live clock; any password / click unlocks) — also `◈ → Lock Screen`.
- **Spotlight** — ⌘-Space (or the 🔍 in the menu bar) to fuzzy-search **apps and files**; ↑/↓ + Return to open.
- **Window snapping** — drag a window to a screen edge to tile it: top = maximize, left/right = half, corners = quarter. A live preview shows where it'll land.
- **Notifications** — toast cards slide in top-right (e.g. when Paint saves an image); click to dismiss. Suppressed by Do Not Disturb.
- **Control Center** — the toggle icon in the menu bar opens Wi-Fi / Bluetooth / Dark Mode / Do Not Disturb tiles plus Brightness & Volume sliders. The menu-bar clock opens a calendar popover.
- **Sound effects** (`sound.js`) — synthesized boot chime, window open/close/minimize, notifications, toggles. All Web Audio, no files; toggle + volume in Settings.
- **In-OS dialogs** (`ui.js`) — styled prompt / confirm / alert and a real **file Save/Open panel** (folder navigation + name field). These replace the browser's native `prompt`/`confirm`, which are blocked in many embedded/webview contexts — that's why file operations silently failed before.

## Customization (System Settings)

A real System Settings app with a category sidebar:
- **Appearance** — dark/light theme, accent color (6 presets + custom color picker), reduce motion.
- **Wallpaper** — gradient gallery + a custom solid-color picker.
- **Dock & Menu** — position (bottom / left / right), size slider, magnification toggle, auto-hide.
- **Sound** — effects toggle + volume.
- **Date & Time** — 24-hour clock, show seconds.
- **General** — reset filesystem, reset all settings.

All preferences persist to `localStorage` and apply live.

## Performance note

Only the **focused** window runs a live `backdrop-filter: blur()`. Background
(inactive) windows drop the blur for a solid background — stacked backdrop
filters were the cause of typing/drag input lag once several windows were open.

## Apps

| App | What it does |
|-----|--------------|
| 🌐 **Nimbus Browser** | A real web browser — tabs, address bar, back/forward/reload, bookmarks, a start page, and an iframe with a graceful fallback for sites that block embedding (open in a real tab). |
| 🖥️ **Terminal** | A real tiny shell: `ls cd pwd cat echo mkdir touch write rm tree edit open neofetch date whoami clear reset`. ↑/↓ history, Ctrl-L clear. |
| 📁 **Files** | Browse the filesystem, double-click folders/files (images open in the viewer), new file/folder, rename, delete (right-click). |
| 📝 **Text Editor** | Open… / Save / Save As… via a real file panel. ⌘S to save, Tab inserts spaces. |
| 🗒️ **Notes** | Auto-saving scratchpad. |
| 🎨 **Paint** | Canvas drawing — palette, brush size, eraser. Saves a real PNG into `/Pictures`. |
| 🖼️ **Photos / Image Viewer** | Photos shows everything in `/Pictures`; the viewer opens a single image. |
| 💣 **Minesweeper** | Classic 9×9 / 10-mine game with flood-fill reveal and flags (right-click). |
| 🎵 **Music** | A 6×16 Web-Audio step sequencer with adjustable tempo. |
| 📊 **Activity Monitor** | Live CPU/memory gauges; lists open windows as processes you can force-quit. |
| 📅 **Calendar** | Month grid with today highlighted; prev/next navigation. |
| 🧮 **Calculator** | Standard calculator. |
| 🕐 **Clock** | Live analog + digital clock. |
| ◈ **About** | About-this-computer panel. |
| ⚙️ **Settings** | Full System Settings (see Customization above). |

## The shared filesystem

Terminal, Files, and the Editor all read and write **one in-memory filesystem**
(`fs.js`). Create a file in the terminal (`echo hi > note.txt`) and it appears in
Files; edit it in the Editor and the terminal `cat`s the new content. It persists
to `localStorage`, so your files survive a reload.

## Window manager

`wm.js` owns the window lifecycle — drag by the title bar, resize from the
bottom-right corner, traffic-light close/minimize/maximize, double-click the title
bar to maximize, click to focus (raises z-order), minimize animates into the dock.

## Files

```
index.html   markup + boot screen + desktop shell
os.css       all styling (themes via CSS variables)
fs.js        in-memory filesystem (localStorage-backed)
ui.js        in-OS modal dialogs (prompt/confirm/alert/file panel)
sound.js     synthesized system sound effects (Web Audio)
wm.js        window manager
apps.js      every built-in app
os.js        boot sequence, dock, menu bar, icons, prefs/themes,
             lock screen, Spotlight, notifications
```

## Where it spirals

Adding an app is one `Apps.def({...})` block in `apps.js` plus its id in the
`dockApps` array in `os.js`. The "wait, I could add…" list: a real web-browser
app, file-icon drag-and-drop, multiple desktops/spaces, a notification center,
widgets, a global menu-bar search history…
