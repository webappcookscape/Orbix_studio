const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('OrbixDesktop', {
  isDesktop: true,
  platform: process.platform,
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => callback(action));
  }
});

