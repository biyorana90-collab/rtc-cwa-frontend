import axios from 'axios';

// Get base URL from environment or fallback to production Railway backend
const rawUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://rtc-cwa-backend-production.up.railway.app';

// Standardize by removing trailing slashes and redundant /api suffixes
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