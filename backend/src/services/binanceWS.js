const WebSocket = require('ws');

// Binance WebSocket streams to subscribe to
const TICKER_STREAMS = [
  'btcusdt@ticker', 'ethusdt@ticker', 'bnbusdt@ticker',
  'solusdt@ticker', 'adausdt@ticker', 'dogeusdt@ticker',
  'xrpusdt@ticker', 'dotusdt@ticker', 'maticusdt@ticker',
  'ltcusdt@ticker', 'linkusdt@ticker', 'avaxusdt@ticker',
  'uniusdt@ticker', 'atomusdt@ticker', 'ftmusdt@ticker'
];

let binanceWS = null;
let reconnectTimer = null;

const initBinanceWS = (io) => {
  const connect = () => {
    try {
      const streams = TICKER_STREAMS.join('/');
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      
      binanceWS = new WebSocket(wsUrl);

      binanceWS.on('open', () => {
        console.log('✅ Connected to Binance WebSocket');
      });

      binanceWS.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.data && parsed.stream) {
            const ticker = parsed.data;
            const symbol = ticker.s; // e.g. BTCUSDT
            
            const update = {
              symbol,
              price: parseFloat(ticker.c),
              change: parseFloat(ticker.P),
              priceChange: parseFloat(ticker.p),
              high: parseFloat(ticker.h),
              low: parseFloat(ticker.l),
              volume: parseFloat(ticker.v),
              quoteVolume: parseFloat(ticker.q)
            };

            // Broadcast to all connected clients
            io.emit('ticker_update', update);
            // Also broadcast to symbol-specific room
            io.to(`ticker_${symbol}`).emit('ticker', update);
          }
        } catch (e) {}
      });

      binanceWS.on('error', (err) => {
        console.error('Binance WS error:', err.message);
      });

      binanceWS.on('close', () => {
        console.log('⚠️  Binance WS closed. Reconnecting in 5s...');
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 5000);
      });

      // Ping every 30s to keep alive
      const pingInterval = setInterval(() => {
        if (binanceWS.readyState === WebSocket.OPEN) {
          binanceWS.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

    } catch (err) {
      console.error('Failed to connect to Binance WS:', err.message);
      reconnectTimer = setTimeout(connect, 10000);
    }
  };

  connect();
};

const closeBinanceWS = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (binanceWS) binanceWS.close();
};

module.exports = { initBinanceWS, closeBinanceWS };
