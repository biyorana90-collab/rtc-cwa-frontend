import axios from 'axios';

const rawUrl = (import.meta as any).env?.VITE_SOCKET_URL || (import.meta as any).env?.VITE_BACKEND_URL || 'https://rtc-cwa-backend-production.up.railway.app';
const cleanBaseUrl = rawUrl.replace(/\/+$/, '');

const API = axios.create({
  baseURL: `${cleanBaseUrl}/api`,
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;