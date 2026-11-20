'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zaraDesktop', Object.freeze({
  isDesktop: true,
  launchApp: (appId) => ipcRenderer.invoke('zara:launch-app', appId),
  openExternal: (url) => ipcRenderer.invoke('zara:open-external', url),
}));
