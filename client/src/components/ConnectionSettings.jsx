import React, { useState, useEffect } from 'react';
import '../styles/ConnectionSettings.css';

function ConnectionSettings({ onClose }) {
  const [mode, setMode] = useState('standalone');
  const [serverUrl, setServerUrl] = useState('');
  const [serverIp, setServerIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      if (window.electronAPI) {
        const config = await window.electronAPI.getAppConfig();
        if (config.remoteApiUrl) {
          setMode('client');
          setServerUrl(config.remoteApiUrl);
        }
        const ip = await window.electronAPI.getServerIp();
        setServerIp(ip);
      }
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveryResult(null);
    try {
      if (window.electronAPI) {
        const found = await window.electronAPI.discoverServer();
        if (found) {
          const url = `http://${found.ip}:${found.port}`;
          setDiscoveryResult({ success: true, url });
          setMode('client');
          setServerUrl(url);
        } else {
          setDiscoveryResult({ success: false });
        }
      }
    } catch (err) {
      setDiscoveryResult({ success: false, error: err.message });
    } finally {
      setDiscovering(false);
    }
  };

  const handleSave = async () => {
    setUrlError('');
    let url = mode === 'client' ? serverUrl.trim() : '';

    if (mode === 'client' && url) {
      // Robustly fix dot or other separator before port: 192.168.1.52.5000 → 192.168.1.52:5000
      url = url.replace(/(\b\d{1,3}(?:\.\d{1,3}){3})[.:](\d+)(?=\/|$)/g, '$1:$2');

      // Add http:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
      }

      // Remove trailing slashes and /api
      url = url.replace(/\/+$/, '');
      url = url.replace(/\/api\/?$/i, '');

      // Validate and ensure port 5000
      try {
        const parsed = new URL(url);
        if (!parsed.hostname) {
          setUrlError('Invalid server address');
          return;
        }
        if (!parsed.port) {
          url = `${parsed.protocol}//${parsed.hostname}:5000`;
        } else {
          url = `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
        }
      } catch (_) {
        setUrlError('Invalid format. Enter the server IP, e.g. 192.168.1.52:5000');
        return;
      }
    }

    setSaving(true);
    try {
      const config = {
        remoteApiUrl: url,
        sharedDbPath: '',
      };
      if (window.electronAPI) {
        await window.electronAPI.saveAppConfig(config);
        setSaved(true);
        if (mode === 'client') {
          setTimeout(() => {
            if (window.electronAPI?.restartApp) {
              window.electronAPI.restartApp();
            }
          }, 1000);
        } else {
          setTimeout(() => onClose(), 1500);
        }
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="connection-settings-overlay" onClick={onClose}>
      <div className="connection-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="connection-settings-header">
          <div className="connection-settings-avatar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h3>Connection</h3>
          <button className="connection-settings-close" onClick={onClose}>&times;</button>
        </div>

        <div className="connection-settings-body">
          {saved && <div className="connection-settings-success">Settings saved! Restart the app to apply.</div>}

          <div className="current-status">
            <div className="status-label">Current mode:</div>
            <div className="status-value">
              {mode === 'standalone' ? 'Standalone Server' : `Connected to ${serverUrl}`}
            </div>
          </div>

          {mode === 'standalone' && serverIp && (
            <div className="server-info">
              <div className="server-info-label">Your LAN IP (for auto-discovery):</div>
              <div className="server-info-ip">{serverIp}:{window.location.port || '5000'}</div>
            </div>
          )}

          <button
            className="btn-discover"
            onClick={handleDiscover}
            disabled={discovering}
          >
            {discovering ? 'Searching...' : 'Find Servers on Network'}
          </button>

          {discoveryResult && (
            <div className={`discovery-result ${discoveryResult.success ? 'success' : 'error'}`}>
              {discoveryResult.success
                ? `Server found at ${discoveryResult.url}`
                : discoveryResult.error || 'No server found on network'}
            </div>
          )}

          <div className="manual-fallback">
            <div className="manual-fallback-label">Or enter server address manually:</div>
            <div className="mode-selector">
              <div
                className={`mode-card ${mode === 'standalone' ? 'active' : ''}`}
                onClick={() => setMode('standalone')}
              >
                <div className="mode-card-title">Run as Server</div>
                <div className="mode-card-desc">Operate independently with a local database.</div>
              </div>
              <div
                className={`mode-card ${mode === 'client' ? 'active' : ''}`}
                onClick={() => setMode('client')}
              >
                <div className="mode-card-title">Connect to Server</div>
                <div className="mode-card-desc">Connect to an existing server on your network.</div>
              </div>
            </div>

            {mode === 'client' && (
              <div className="form-group">
                <label>Server URL</label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => { setServerUrl(e.target.value); setUrlError(''); }}
                  placeholder="192.168.1.50:5000"
                />
                {urlError && <div className="url-error">{urlError}</div>}
              </div>
            )}

            <button
              className="btn-save-settings"
              onClick={handleSave}
              disabled={saving || (mode === 'client' && !serverUrl)}
            >
              {saving ? 'Saving...' : 'Save & Restart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectionSettings;
