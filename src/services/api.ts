import axios from 'axios';

// Cast import.meta to 'any' to resolve TypeScript 'env does not exist on ImportMeta' error
const metaEnv = (import.meta as any).env || {};

// Get base URL from environment or default production domain
let rawUrl =
  metaEnv.VITE_API_URL ||
  metaEnv.VITE_API_BASE_URL ||
  'https://rtc-cwa-backend-production.up.railway.app';

// 1. Clean stray quotes, brackets, underscores at domain boundaries, or whitespace
rawUrl = String(rawUrl)
  .replace(/[\[\]'"]/g, '')
  .trim();

// 2. Remove accidental trailing underscores or non-domain characters
rawUrl = rawUrl.replace(/_+$|\/+$/, '');

// 3. Ensure proper https:// protocol
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl}`;
}

// 4. Clean trailing slashes and redundant /api path suffixes
const cleanUrl = rawUrl.replace(/\/+$/, '').replace(/\/api$/, '');

const API = axios.create({
  baseURL: `${cleanUrl}/api`,
  timeout: 15000,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;