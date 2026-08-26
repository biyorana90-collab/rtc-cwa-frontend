import { io, Socket } from 'socket.io-client';

// Base backend URL
const BASE_URL = 'https://rtc-cwa-backend-production.up.railway.app';

export const SOCKET_URL = BASE_URL;

export const createSocket = (): Socket => {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
  });
};