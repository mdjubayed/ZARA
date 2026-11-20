'use strict';

const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const net = require('node:net');
const path = require('node:path');

const isDevelopment = process.argv.includes('--dev') || !app.isPackaged;
let mainWindow = null;
let apiServer = null;
let localOrigin = '';

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      if (!isDevelopment) await startLocalApi();
      await createMainWindow();
    } catch {
      dialog.showErrorBox(
        'ZARA could not start',
        'ZARA could not start its local application service. Please reinstall the application or contact support.',
      );
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });

  app.on('before-quit', () => {
    if (apiServer) apiServer.close();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('zara:launch-app', (event, appId) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    return { ok: false, error: 'UNAUTHORIZED_CALLER' };
  }

  const allowedApps = {
    notepad: 'notepad.exe',
    calculator: 'calc.exe',
  };
  const executable = allowedApps[appId];
  if (!executable || process.platform !== 'win32') {
    return { ok: false, error: 'APP_NOT_SUPPORTED' };
  }

  return new Promise((resolve) => {
    const child = spawn(executable, [], {
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: false,
    });
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true });
    });
    child.once('error', () => resolve({ ok: false, error: 'APP_LAUNCH_FAILED' }));
  });
});

ipcMain.handle('zara:open-external', async (event, rawUrl) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || typeof rawUrl !== 'string') {
    return { ok: false, error: 'UNAUTHORIZED_CALLER' };
  }
  try {
    const target = new URL(rawUrl);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      return { ok: false, error: 'URL_SCHEME_NOT_ALLOWED' };
    }
    await shell.openExternal(target.toString());
    return { ok: true };
  } catch {
    return { ok: false, error: 'INVALID_URL' };
  }
});

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('LOCAL_PORT_UNAVAILABLE'));
        return;
      }
      const port = address.port;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startLocalApi() {
  const port = await findAvailablePort();
  localOrigin = `http://127.0.0.1:${port}`;

  process.env.NODE_ENV = 'production';
  process.env.PORT = String(port);
  process.env.ZARA_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  process.env.CORS_ORIGINS = [...new Set([...configuredOrigins, localOrigin])].join(',');

  const { app: apiApp } = require(path.join(app.getAppPath(), 'dist-server', 'app.cjs'));
  const express = require('express');
  const frontendDirectory = path.join(app.getAppPath(), 'dist');
  const indexFile = path.join(frontendDirectory, 'index.html');

  apiApp.use(express.static(frontendDirectory, { index: false }));
  apiApp.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next();
      return;
    }
    response.sendFile(indexFile);
  });

  apiServer = createServer(apiApp);
  await new Promise((resolve, reject) => {
    apiServer.once('error', reject);
    apiServer.listen(port, '127.0.0.1', resolve);
  });
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#080d27',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' || target.protocol === 'http:') {
        void shell.openExternal(target.toString());
      }
    } catch {
      // Invalid external URLs are ignored.
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isDevelopment) {
      if (!url.startsWith('http://127.0.0.1:5173/')) event.preventDefault();
      return;
    }
    if (!url.startsWith(localOrigin + '/')) event.preventDefault();
  });

  if (isDevelopment) {
    await window.loadURL('http://127.0.0.1:5173');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadURL(localOrigin);
  }
}
