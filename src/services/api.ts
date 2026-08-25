import axios from 'axios';

// Get base domain from env or fallback to Railway production URL
let rawUrl =
  (import.meta as any).env?.VITE_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  'https://rtc-cwa-backend-production.up.railway.app';

// Strip any trailing slashes and trailing /api to standardize
rawUrl = rawUrl.replace(/\/+$/, '').replace(/\/api$/, '');

// Create clean base URL with single /api prefix
const API = axios.create({
  baseURL: `${rawUrl}/api`,
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