// src/socket.js
// Single shared socket.io-client instance for the whole app.
import { io } from 'socket.io-client';

const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

export default socket;
