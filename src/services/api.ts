import axios from 'axios';

// Ensure the base URL resolves to your backend domain
const rawUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'https://rtc-cwa-backend-production.up.railway.app';

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