'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zaraDesktop', Object.freeze({
  isDesktop: true,
  getProviderKeyStatus: () => ipcRenderer.invoke('zara:get-provider-key-status'),
  saveProviderKey: (providerId, apiKey) => ipcRenderer.invoke('zara:save-provider-key', providerId, apiKey),
  clearProviderKey: (providerId) => ipcRenderer.invoke('zara:clear-provider-key', providerId),
  launchApp: (appId) => ipcRenderer.invoke('zara:launch-app', appId),
  openExternal: (url) => ipcRenderer.invoke('zara:open-external', url),
  openTextFile: () => ipcRenderer.invoke('zara:open-text-file'),
  saveTextFile: (suggestedName, content) => ipcRenderer.invoke('zara:save-text-file', suggestedName, content),
}));
