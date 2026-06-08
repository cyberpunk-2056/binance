import { io } from 'socket.io-client';

let socket;

export const getSocket = () => {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    socket = io(backendUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to Socket.io backend');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.io backend');
    });
  }

  return socket;
};

export const subscribeToTicker = (symbol, callback) => {
  const s = getSocket();
  if (!s) return;

  s.emit('subscribe', [`ticker_${symbol}`]);
  s.on('ticker', callback);

  return () => {
    s.emit('unsubscribe', [`ticker_${symbol}`]);
    s.off('ticker', callback);
  };
};

export const subscribeToAllTickers = (callback) => {
  const s = getSocket();
  if (!s) return;

  s.on('ticker_update', callback);

  return () => {
    s.off('ticker_update', callback);
  };
};
