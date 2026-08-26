import axios from 'axios';

// Read from environment variable with fallback to Railway production URL
const rawApiUrl =
  (import.meta as any).env?.VITE_API_URL ||
  'https://rtc-cwa-backend-production.up.railway.app';

// Clean URL: strip trailing slashes and redundant protocol prefixes
const cleanApiUrl = rawApiUrl
  .replace(/\/+$/, '')
  .replace(/^https?:\/\//, '');

const API = axios.create({
  baseURL: `https://${cleanApiUrl}/api`,
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