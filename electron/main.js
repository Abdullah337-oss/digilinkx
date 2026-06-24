const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setAppUserModelId('com.digilinks.todo');

let mainWindow;
let clientAssetServer = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function logStartup(message, error) {
  try {
    const logPath = path.join(app.getPath('userData'), 'startup.log');
    const details = error ? `\n${error.stack || error.message || error}` : '';
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}${details}\n`);
  } catch (_) {
  }
}

process.on('uncaughtException', (err) => {
  logStartup('Uncaught exception', err);
  dialog.showErrorBox('Digilinkx Todo App failed to start', err.stack || err.message || String(err));
  app.quit();
});

process.on('unhandledRejection', (err) => {
  logStartup('Unhandled rejection', err);
});

function findBundledConfig() {
  const candidates = [
    path.join(path.dirname(process.execPath), 'app-config.json'),
    path.join(path.dirname(process.resourcesPath), 'app-config.json'),
    path.join(__dirname, '..', 'app-config.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

function loadAppConfig() {
  const userDataPath = app.getPath('userData');
  const configPath = path.join(userDataPath, 'app-config.json');
  let config = {};

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(raw || '{}');
    } catch (err) {
      console.warn('Failed to read app config file:', err.message);
      config = {};
    }
  } else {
    const bundledPath = findBundledConfig();
    if (bundledPath) {
      try {
        const raw = fs.readFileSync(bundledPath, 'utf8');
        config = JSON.parse(raw || '{}');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Imported bundled config from:', bundledPath);
      } catch (err) {
        console.warn('Failed to import bundled config:', err.message);
        config = {};
      }
    }
    if (!config.remoteApiUrl && !config.sharedDbPath) {
      const defaultConfig = { remoteApiUrl: '', sharedDbPath: '' };
      try {
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      } catch (err) {
        console.warn('Failed to create default app config file:', err.message);
      }
      config = defaultConfig;
    }
  }

  return config;
}

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let normalized = url.trim();
  // Robustly fix cases where a dot was used before the port (e.g. 192.168.1.52.5000)
  // and handle inputs with or without protocol. Converts any "." or ":" separator
  // following an IPv4 address into a colon when appropriate.
  normalized = normalized.replace(/(\b\d{1,3}(?:\.\d{1,3}){3})[.:](\d+)(?=\/|$)/g, '$1:$2');

  // Add http:// if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'http://' + normalized;
  }

  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.toLowerCase().endsWith('/api')) {
    normalized = normalized.slice(0, -4);
  }
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Parse with URL constructor and add default port 5000 where missing.
  try {
    const parsed = new URL(normalized);
    const protocol = parsed.protocol || 'http:';
    const hostname = parsed.hostname;
    const port = parsed.port || '5000';
    normalized = `${protocol}//${hostname}:${port}`;
  } catch (_) {
    return null;
  }

  return normalized || null;
}

function probeLocalDigilinkxServer(port = 5000) {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        timeout: 1500,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body || '{}');
            resolve(data && data.app === 'Digilinkx Todo' ? port : null);
          } catch (_) {
            resolve(null);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

function startPackagedClientServer() {
  return new Promise((resolve, reject) => {
    try {
      const express = require('express');
      const clientApp = express();
      const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
      const indexPath = path.join(clientBuildPath, 'index.html');

      if (!fs.existsSync(indexPath)) {
        reject(new Error(`Packaged client files were not found at ${clientBuildPath}`));
        return;
      }

      clientApp.use(express.static(clientBuildPath));
      clientApp.get('*', (_req, res) => {
        res.sendFile(indexPath);
      });

      const server = clientApp.listen(0, '127.0.0.1', () => {
        clientAssetServer = server;
        resolve(server.address().port);
      });

      server.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

function setupDataPaths() {
  const userDataPath = app.getPath('userData');
  let appConfig = loadAppConfig();
  const rawRemoteApiUrl = appConfig.remoteApiUrl || process.env.REMOTE_API_URL || null;
  const remoteApiUrl = normalizeApiBaseUrl(rawRemoteApiUrl);
  const sharedDbPath = appConfig.sharedDbPath || process.env.SHARED_DB_PATH || null;

  logStartup(`Loaded raw remote API URL: ${rawRemoteApiUrl || '<none>'}; normalized: ${remoteApiUrl || '<invalid>'}`);
  console.log('Loaded raw remote API URL:', rawRemoteApiUrl, 'normalized:', remoteApiUrl);

  if (rawRemoteApiUrl && !remoteApiUrl) {
    logStartup(`Invalid remote API URL in app config: ${rawRemoteApiUrl}`);
  }

  // If URL was normalized differently, persist the fixed version
  if (appConfig.remoteApiUrl && remoteApiUrl && appConfig.remoteApiUrl !== remoteApiUrl) {
    appConfig.remoteApiUrl = remoteApiUrl;
    const configPath = path.join(userDataPath, 'app-config.json');
    try {
      fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2), 'utf8');
    } catch (_) {}
  }

  process.env.NODE_ENV = 'production';
  process.env.REMOTE_API_URL = remoteApiUrl || '';
  process.env.SHARED_DB_PATH = sharedDbPath || '';
  process.env.ALLOW_PORT_FALLBACK = 'true';

  if (!remoteApiUrl) {
    if (!sharedDbPath) {
      process.env.DB_PATH = path.join(userDataPath, 'todo.db');
      process.env.UPLOADS_PATH = path.join(userDataPath, 'uploads');
    } else {
      process.env.UPLOADS_PATH = process.env.SHARED_UPLOADS_PATH || path.join(path.dirname(sharedDbPath), 'uploads');
      process.env.DB_PATH = sharedDbPath;
    }

    if (!fs.existsSync(process.env.UPLOADS_PATH)) {
      fs.mkdirSync(process.env.UPLOADS_PATH, { recursive: true });
    }
  } else {
    console.log('Using remote API backend at:', remoteApiUrl);
    logStartup(`Using remote API backend at: ${remoteApiUrl}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Digilinkx Todo App',
    icon: path.join(__dirname, '../build/icon.png'),
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription);
    logStartup(`Page load failed: ${errorCode} ${errorDescription}`);
  });

  const remoteApiUrl = process.env.REMOTE_API_URL || '';

  if (remoteApiUrl) {
    console.log('Loading packaged client for remote API:', remoteApiUrl);
    logStartup(`Loading packaged client for remote API: ${remoteApiUrl}`);
    startPackagedClientServer()
      .then((clientPort) => {
        mainWindow.loadURL(`http://127.0.0.1:${clientPort}`);
      })
      .catch((err) => {
        logStartup('Failed to load packaged client', err);
        dialog.showErrorBox(
          'Client Error',
          'The app could not load its packaged interface.\n\n' + err.message
        );
        app.quit();
      });
  } else {
    try {
      const server = require('../server/server.js');
      const timeout = setTimeout(() => {
        dialog.showErrorBox('Server Timeout', 'The server is taking too long to start.\n\nPlease restart the app and try again.');
        app.quit();
      }, 15000);
      server.serverReady.then((port) => {
        clearTimeout(timeout);
        mainWindow.loadURL(`http://localhost:${port}`);
      }).catch((err) => {
        clearTimeout(timeout);
        logStartup('Local server failed to start', err);
        if (err && err.code === 'EADDRINUSE') {
          probeLocalDigilinkxServer(5000).then((existingPort) => {
            if (existingPort) {
              logStartup('Reusing existing local Digilinkx server on port 5000');
              mainWindow.loadURL(`http://localhost:${existingPort}`);
              return;
            }

            dialog.showErrorBox('Server Error',
              'Could not start the server on port 5000.\n\n' + err.message +
              '\n\nAnother application is using port 5000. Close that application or change its port, then restart Digilinkx Todo.');
            app.quit();
          });
          return;
        }

        dialog.showErrorBox('Server Error', 'Could not start the local server.\n\n' + err.message);
        app.quit();
      });
    } catch (err) {
      logStartup('Failed to load server module', err);
      dialog.showErrorBox('Server Error', 'Failed to start the server.\n\n' + err.message);
      app.quit();
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const { setupIpcHandlers } = require('./ipcHandlers');
    setupIpcHandlers();

    const initialConfig = loadAppConfig();
    const hasServerConfig = process.env.REMOTE_API_URL || initialConfig.remoteApiUrl;
    if (!hasServerConfig && !initialConfig.sharedDbPath) {
      console.log('No server configured, searching for server on LAN...');
      logStartup('No server configured, searching for server on LAN...');
      const { discoverServer } = require('./discovery');
      const found = await discoverServer(3000);
      if (found) {
        const apiUrl = `http://${found.ip}:${found.port}`;
        console.log('Auto-discovered server at:', apiUrl);
        logStartup(`Auto-discovered server at: ${apiUrl}`);
        initialConfig.remoteApiUrl = apiUrl;
        const configPath = path.join(app.getPath('userData'), 'app-config.json');
        fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), 'utf8');
        app.relaunch();
        app.exit();
        return;
      }
      console.log('No server found on LAN, starting in standalone mode');
      logStartup('No server found on LAN, starting in standalone mode');
    }

    setupDataPaths();
    console.log('Starting Express Server...');
    logStartup('Starting Express server');
    createWindow();
  } catch (err) {
    logStartup('Failed to start server', err);
    console.error('Failed to start server:', err);
    dialog.showErrorBox('Digilinkx Todo App failed to start', err.stack || err.message || String(err));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (clientAssetServer) {
    clientAssetServer.close();
    clientAssetServer = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
