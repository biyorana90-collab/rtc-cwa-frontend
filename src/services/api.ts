import axios from 'axios';

// Function to safely check and sanitize the backend API URL
const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;

  // Check if env variable is valid and contains the full domain
  if (
    typeof envUrl === 'string' && 
    envUrl.trim().length > 0 && 
    envUrl.includes('rtc-cwa-backend-production.up.railway.app')
  ) {
    return envUrl.trim();
  }

  // Default fallback if Vercel env variable is missing or truncated
  return 'https://rtc-cwa-backend-production.up.railway.app';
};

const rawUrl = getBaseUrl();
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