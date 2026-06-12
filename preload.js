// Exposes a tiny, safe native bridge to the hosted Nimbus OS page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nimbusNative', {
  isNative: true,
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('nimbus-notify', { title, body })
});
