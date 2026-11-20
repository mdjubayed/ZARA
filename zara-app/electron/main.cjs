'use strict';

const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require('electron');
const { readFile, writeFile, rename, unlink, mkdir } = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const net = require('node:net');
const path = require('node:path');

const isDevelopment = !app.isPackaged;
let mainWindow = null;
let apiServer = null;
let localOrigin = '';
let storedProviderKeys = { omniroute: '', freellmapi: '' };

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

function isTrustedRenderer(event) {
  return Boolean(mainWindow && event.sender === mainWindow.webContents);
}

async function confirmNativeAction(title, message, detail, confirmLabel) {
  if (!mainWindow) return false;
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title,
    message,
    detail,
    buttons: ['Cancel', confirmLabel],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}

function providerKeyEnvironmentName(providerId) {
  return providerId === 'omniroute'
    ? 'OMNIROUTE_API_KEY'
    : providerId === 'freellmapi'
      ? 'FREELLMAPI_API_KEY'
      : null;
}

function credentialsFilePath() {
  return path.join(app.getPath('userData'), 'provider-credentials.enc');
}

async function writeEncryptedProviderKeys(keys) {
  if (process.platform !== 'win32' || !(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('SECURE_STORAGE_UNAVAILABLE');
  }
  const file = credentialsFilePath();
  const temporaryFile = file + '.tmp';
  await mkdir(path.dirname(file), { recursive: true });
  const encrypted = await safeStorage.encryptStringAsync(JSON.stringify(keys));
  await writeFile(temporaryFile, encrypted, { mode: 0o600 });
  await rename(temporaryFile, file);
}

async function loadEncryptedProviderKeys() {
  if (process.platform !== 'win32') return { omniroute: '', freellmapi: '' };
  if (!(await safeStorage.isAsyncEncryptionAvailable())) {
    throw new Error('SECURE_STORAGE_UNAVAILABLE');
  }

  let encrypted;
  try {
    encrypted = await readFile(credentialsFilePath());
  } catch (error) {
    if (error && error.code === 'ENOENT') return { omniroute: '', freellmapi: '' };
    throw error;
  }

  const decrypted = await safeStorage.decryptStringAsync(encrypted);
  const parsed = JSON.parse(decrypted);
  const keys = {
    omniroute: typeof parsed.omniroute === 'string' ? parsed.omniroute : '',
    freellmapi: typeof parsed.freellmapi === 'string' ? parsed.freellmapi : '',
  };

  return keys;
}

ipcMain.handle('zara:get-provider-key-status', (event) => {
  if (!isTrustedRenderer(event)) return { available: false, omniroute: false, freellmapi: false };
  const available = !isDevelopment && process.platform === 'win32';
  return {
    available,
    omniroute: Boolean(storedProviderKeys.omniroute),
    freellmapi: Boolean(storedProviderKeys.freellmapi),
  };
});

ipcMain.handle('zara:save-provider-key', async (event, providerId, rawKey) => {
  if (!isTrustedRenderer(event) || isDevelopment || process.platform !== 'win32') {
    return { ok: false, error: 'SECURE_STORAGE_UNAVAILABLE' };
  }
  const envName = providerKeyEnvironmentName(providerId);
  if (!envName || typeof rawKey !== 'string') return { ok: false, error: 'INVALID_PROVIDER' };
  const key = rawKey.trim();
  if (!key || key.length > 4096 || /[\r\n\0]/.test(key)) {
    return { ok: false, error: 'INVALID_API_KEY' };
  }

  const approved = await confirmNativeAction(
    'Save provider API key',
    'Save this provider key in encrypted Windows storage?',
    'The key will be encrypted for this Windows user account. ZARA will not display it again.',
    'Save key',
  );
  if (!approved) return { ok: false, error: 'CANCELLED' };

  try {
    const next = { ...storedProviderKeys, [providerId]: key };
    await writeEncryptedProviderKeys(next);
    storedProviderKeys = next;
    process.env[envName] = key;
    return { ok: true };
  } catch {
    return { ok: false, error: 'SECURE_STORAGE_FAILED' };
  }
});

ipcMain.handle('zara:clear-provider-key', async (event, providerId) => {
  if (!isTrustedRenderer(event) || isDevelopment || process.platform !== 'win32') {
    return { ok: false, error: 'SECURE_STORAGE_UNAVAILABLE' };
  }
  const envName = providerKeyEnvironmentName(providerId);
  if (!envName) return { ok: false, error: 'INVALID_PROVIDER' };

  const approved = await confirmNativeAction(
    'Remove provider API key',
    'Remove the saved key from this Windows account?',
    'ZARA will no longer use this saved credential.',
    'Remove key',
  );
  if (!approved) return { ok: false, error: 'CANCELLED' };

  try {
    const next = { ...storedProviderKeys, [providerId]: '' };
    if (next.omniroute || next.freellmapi) {
      await writeEncryptedProviderKeys(next);
    } else {
      try { await unlink(credentialsFilePath()); } catch (error) {
        if (!error || error.code !== 'ENOENT') throw error;
      }
    }
    storedProviderKeys = next;
    delete process.env[envName];
    return { ok: true };
  } catch {
    return { ok: false, error: 'SECURE_STORAGE_FAILED' };
  }
});

const allowedTextExtensions = ['.txt', '.md', '.json', '.csv', '.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.xml', '.log', '.yml', '.yaml'];

ipcMain.handle('zara:open-text-file', async (event) => {
  if (!isTrustedRenderer(event)) return { ok: false, error: 'UNAUTHORIZED_CALLER' };
  if (!mainWindow) return { ok: false, error: 'WINDOW_UNAVAILABLE' };
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open a text file in ZARA',
      properties: ['openFile'],
      filters: [{ name: 'Text and source files', extensions: allowedTextExtensions.map((value) => value.slice(1)) }],
    });
    if (result.canceled || result.filePaths.length !== 1) return { ok: false, error: 'CANCELLED' };
    const filePath = result.filePaths[0];
    const extension = path.extname(filePath).toLowerCase();
    if (!allowedTextExtensions.includes(extension)) return { ok: false, error: 'FILE_TYPE_NOT_ALLOWED' };
    const content = await readFile(filePath);
    if (content.byteLength > 512000) return { ok: false, error: 'FILE_TOO_LARGE' };
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(content);
    } catch {
      return { ok: false, error: 'FILE_NOT_VALID_UTF8' };
    }
    return { ok: true, name: path.basename(filePath), content: text };
  } catch {
    return { ok: false, error: 'FILE_READ_FAILED' };
  }
});

ipcMain.handle('zara:save-text-file', async (event, suggestedName, content) => {
  if (!isTrustedRenderer(event)) return { ok: false, error: 'UNAUTHORIZED_CALLER' };
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 512000) {
    return { ok: false, error: 'INVALID_OR_LARGE_CONTENT' };
  }
  const safeName = typeof suggestedName === 'string' && /^[a-zA-Z0-9 _.-]{1,100}$/.test(suggestedName)
    ? suggestedName
    : 'zara-note.txt';
  const extension = path.extname(safeName).toLowerCase();
  if (!allowedTextExtensions.includes(extension)) return { ok: false, error: 'FILE_TYPE_NOT_ALLOWED' };
  if (!mainWindow) return { ok: false, error: 'WINDOW_UNAVAILABLE' };

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save a text file from ZARA',
      defaultPath: safeName,
      filters: [{ name: 'Text and source files', extensions: allowedTextExtensions.map((value) => value.slice(1)) }],
    });
    if (result.canceled || !result.filePath) return { ok: false, error: 'CANCELLED' };
    if (!allowedTextExtensions.includes(path.extname(result.filePath).toLowerCase())) {
      return { ok: false, error: 'FILE_TYPE_NOT_ALLOWED' };
    }
    const approved = await confirmNativeAction(
      'Confirm file save',
      'Save this text file to the selected location?',
      'ZARA will write only the text you provided to the file path selected in the save dialog.',
      'Save file',
    );
    if (!approved) return { ok: false, error: 'CANCELLED' };
    await writeFile(result.filePath, content, { encoding: 'utf8', flag: 'w', mode: 0o600 });
    return { ok: true, name: path.basename(result.filePath) };
  } catch {
    return { ok: false, error: 'FILE_WRITE_FAILED' };
  }
});

ipcMain.handle('zara:launch-app', async (event, appId) => {
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

  const approved = await confirmNativeAction(
    'Open Windows application',
    `Allow ZARA to open ${appId === 'notepad' ? 'Notepad' : 'Calculator'}?`,
    'Only this approved application will be opened. ZARA will not run arbitrary commands.',
    'Open app',
  );
  if (!approved) return { ok: false, error: 'CANCELLED' };

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
    const approved = await confirmNativeAction(
      'Open external website',
      `Open ${target.hostname} in your default browser?`,
      'The website will open outside ZARA.',
      'Open website',
    );
    if (!approved) return { ok: false, error: 'CANCELLED' };
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
  storedProviderKeys = await loadEncryptedProviderKeys();
  if (storedProviderKeys.omniroute) process.env.OMNIROUTE_API_KEY = storedProviderKeys.omniroute;
  if (storedProviderKeys.freellmapi) process.env.FREELLMAPI_API_KEY = storedProviderKeys.freellmapi;
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
