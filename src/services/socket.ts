import { io, Socket } from 'socket.io-client';

// Hardcoded direct URL to your Railway backend
export const SOCKET_URL = 'https://rtc-cwa-backend-production.up.railway.app';

export const createSocket = (): Socket => {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
  });
};