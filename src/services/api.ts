import axios from 'axios';

// Cast import.meta to 'any' to resolve TypeScript 'env does not exist on ImportMeta' error
const metaEnv = (import.meta as any).env || {};

const getValidBaseUrl = (): string => {
  const envUrl = metaEnv.VITE_API_URL || metaEnv.VITE_API_BASE_URL;

  // Validate if env variable is a valid string with the target domain format
  if (
    typeof envUrl === 'string' &&
    envUrl.trim().length > 0 &&
    envUrl.includes('rtc-cwa-backend-production.up.railway.app')
  ) {
    let clean = envUrl.replace(/[\[\]'"]/g, '').trim();
    clean = clean.replace(/_+$|\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean;
  }

  // Hardcoded fallback to guarantee a valid backend connection string
  return 'https://rtc-cwa-backend-production.up.railway.app';
};

const rawUrl = getValidBaseUrl();
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