const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appConfig', {
  apiBaseUrl: process.env.REMOTE_API_URL || null,
});

contextBridge.exposeInMainWorld('electronAPI', {
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  saveAppConfig: (config) => ipcRenderer.invoke('save-app-config', config),
  getServerIp: () => ipcRenderer.invoke('get-server-ip'),
  restartApp: () => ipcRenderer.invoke('restart-app'),
  discoverServer: () => ipcRenderer.invoke('discover-server'),
});
