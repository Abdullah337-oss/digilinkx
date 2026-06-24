import axios from 'axios';

const normalizeApiBaseUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  let normalized = url.trim();
  normalized = normalized.replace(/(\b\d{1,3}(?:\.\d{1,3}){3})[.:](\d+)(?=\/|$)/g, '$1:$2');

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
};

const remoteApiBaseUrl = typeof window !== 'undefined' && window.appConfig?.apiBaseUrl
  ? normalizeApiBaseUrl(window.appConfig.apiBaseUrl)
  : null;

axios.defaults.baseURL = remoteApiBaseUrl || '';

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.error === 'Token expired' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return axios(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
          throw new Error('No token');
        }

        const response = await axios.post('/api/users/refresh-token', {}, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });

        const newToken = response.data.token;
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify({
          id: response.data.userId,
          username: response.data.username,
          email: response.data.email,
          role: response.data.role || 'viewer',
        }));

        processQueue(null, newToken);

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
