// Nimbus OS — native macOS shell.
// Loads the hosted Nimbus OS full-window (?native=1 tells the OS to dress for a
// native window: its menu bar becomes the drag handle, shifted clear of the
// traffic lights). All data/accounts are the same as the web version.
const { app, BrowserWindow, ipcMain, Notification, shell, Menu } = require('electron');
const path = require('path');

const NIMBUS_URL = 'https://lumistead.pages.dev/apps/nimbus-os/?native=1';
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    title: 'Nimbus OS',
    titleBarStyle: 'hiddenInset',          // overlay traffic lights; OS owns the rest
    trafficLightPosition: { x: 14, y: 8 },
    backgroundColor: '#06070f',            // matches the boot screen
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadURL(NIMBUS_URL);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { win = null; });
}

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

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) { try { app.dock.setIcon(path.join(__dirname, 'build', 'icon-1024.png')); } catch (e) {} }
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
