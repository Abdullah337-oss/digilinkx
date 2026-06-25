const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function normalizeApiBaseUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let normalized = url.trim();
  normalized = normalized.replace(/(\b\d{1,3}(?:\.\d{1,3}){3})[.:](\d+)(?=\/|$)/g, '$1:$2');

  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'http://' + normalized;
  }

  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.replace(/\/api\/?$/i, '');

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname;
    if (parsed.protocol === 'https:' && hostname.endsWith('.onrender.com') && parsed.port === '5000') {
      parsed.port = '';
    }
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    if (!parsed.port && parsed.protocol === 'http:' && (isLocalhost || isIpv4)) {
      parsed.port = '5000';
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch (_) {
    return '';
  }
}

function getServerIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function setupIpcHandlers() {
  ipcMain.handle('get-app-config', () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'app-config.json');
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw || '{}');
    } catch {
      return { remoteApiUrl: '', sharedDbPath: '' };
    }
  });

  ipcMain.handle('save-app-config', (_event, config) => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'app-config.json');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const nextConfig = {
      remoteApiUrl: normalizeApiBaseUrl(config?.remoteApiUrl),
      sharedDbPath: config?.sharedDbPath || '',
    };
    const tmpPath = `${configPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(nextConfig, null, 2), 'utf8');
    fs.renameSync(tmpPath, configPath);
    process.env.REMOTE_API_URL = nextConfig.remoteApiUrl || '';
    process.env.SHARED_DB_PATH = nextConfig.sharedDbPath || '';
    return nextConfig;
  });

  ipcMain.handle('get-server-ip', () => {
    return getServerIpAddress();
  });

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('discover-server', async () => {
    const { discoverServer } = require('./discovery');
    const found = await discoverServer(3000);
    return found;
  });
}

module.exports = { setupIpcHandlers };
