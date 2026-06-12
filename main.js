// Nimbus OS — native macOS shell.
// Loads the hosted Nimbus OS full-window (?native=1 tells the OS to dress for a
// native window: its menu bar becomes the drag handle, shifted clear of the
// traffic lights). All data/accounts are the same as the web version.
const { app, BrowserWindow, ipcMain, Notification, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Present as "Nimbus OS" everywhere (menu, About, dock, crash dir) — never
// "Electron" — even when run unpackaged via `npm start`.
app.setName('Nimbus OS');

// The OS frontend is bundled into os/ and served from a tiny local server, so
// the whole OS runs fully offline. (Online features — accounts, the .nim web,
// app store, social, sync — still hit the live backend when there's a
// connection, and fail gracefully like "wi-fi is off" when there isn't.)
const OS_ROOT = path.join(__dirname, 'os');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.md': 'text/markdown', '.woff2': 'font/woff2'
};
let win = null, port = 0;

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/' || p === '') p = '/index.html';
      const file = path.normalize(path.join(OS_ROOT, p));
      if (!file.startsWith(OS_ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    title: 'Nimbus OS',
    icon: ICON,
    titleBarStyle: 'hiddenInset',          // overlay traffic lights; OS owns the rest
    trafficLightPosition: { x: 14, y: 8 },
    backgroundColor: '#06070f',            // matches the boot screen
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // keep the window title fixed (don't let the OS page's <title> leak through)
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL('http://127.0.0.1:' + port + '/index.html?native=1');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}

const ICON = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon-1024.png'));

// native notifications fired by the OS (when its window is in the background)
ipcMain.on('nimbus-notify', (e, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title: title || 'Nimbus OS', body: body || '' }).show();
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    { role: 'windowMenu' }
  ]));
}

app.whenReady().then(async () => {
  // a clean "About Nimbus OS" panel (no Electron name/version)
  app.setAboutPanelOptions({
    applicationName: 'Nimbus OS',
    applicationVersion: app.getVersion(),
    version: '',
    credits: 'A whole operating system, on your Mac.',
    copyright: '© Josi'
  });
  // strip "Electron/x" and the app token from the user-agent so pages can't tell
  try { app.userAgentFallback = app.userAgentFallback.replace(/\s(Nimbus OS|Electron)\/[\d.]+/g, ''); } catch (e) {}
  // dock icon (dev — packaged builds use build/icon.icns from the bundle)
  if (process.platform === 'darwin' && app.dock && !ICON.isEmpty()) { try { app.dock.setIcon(ICON); } catch (e) {} }
  port = await startServer();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
