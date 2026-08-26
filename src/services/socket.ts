import { io, Socket } from 'socket.io-client';

// Get base URL from environment or fallback to production URL
const rawSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL || 'https://rtc-cwa-backend-production.up.railway.app';

// Clean URL: remove trailing slashes and any leading protocols to prevent double protocol bugs
const cleanUrl = rawSocketUrl
  .replace(/\/+$/, '')
  .replace(/^https?:\/\//, '');

export const SOCKET_URL = `https://${cleanUrl}`;

export const createSocket = (): Socket => {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
  });
};