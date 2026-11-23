const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');

// High-performance discrete/integrated GPU acceleration for 3D CAD & WebGL rendering
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('high-dpi-support', '1');

let mainWindow = null;

function setupNetworkInterceptors() {
  const filter = {
    urls: ['https://*/*', 'http://*/*']
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const url = details.url || '';
    if (url.includes('orbixdesigns.com') || url.includes('localhost') || url.includes('127.0.0.1')) {
      details.requestHeaders['Origin'] = 'https://studio.orbixdesigns.com';
      details.requestHeaders['Referer'] = 'https://studio.orbixdesigns.com/';
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const url = details.url || '';
    const responseHeaders = Object.assign({}, details.responseHeaders);

    if (url.includes('orbixdesigns.com') || url.includes('localhost') || url.includes('127.0.0.1')) {
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH'];
      responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      delete responseHeaders['x-frame-options'];
      delete responseHeaders['X-Frame-Options'];
    }

    callback({ responseHeaders });
  });
}

function createWindow() {
  setupNetworkInterceptors();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Orbix Studio — 3D Interior Cupboard CAD',
    backgroundColor: '#0F172A',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // allows loading local texture assets and cross-origin VPS sync
      preload: path.join(__dirname, 'electron-preload.js')
    }
  });

  // Load the standalone client app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // F12 or Ctrl+Shift+I toggles DevTools easily in desktop exe
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, detailed) => {
    console.error('[Orbix Studio Desktop] Renderer process exited:', detailed);
    if (detailed && detailed.reason !== 'clean-exit') {
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Clean application menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => { mainWindow.webContents.send('menu-action', 'new-project'); } },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => { mainWindow.webContents.send('menu-action', 'save-project'); } },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Orbix Studio CAD',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Orbix Studio CAD',
              message: 'Orbix Studio — 3D Photorealistic Interior CAD Engine',
              detail: 'Desktop Edition running on local hardware acceleration with automated VPS cloud synchronization.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

