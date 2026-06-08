const express = require('express');
const https = require('https');
const router = express.Router();

// Helper to fetch from Binance REST API
const fetchBinance = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.binance.com',
      path,
      method: 'GET',
      headers: { 'User-Agent': 'BinanceClone/1.0' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
};

// GET /api/markets/tickers
router.get('/tickers', async (req, res) => {
  try {
    const data = await fetchBinance('/api/v3/ticker/24hr');
    const usdtPairs = data
      .filter(t => t.symbol.endsWith('USDT'))
      .map(t => ({
        symbol: t.symbol,
        baseAsset: t.symbol.replace('USDT', ''),
        price: parseFloat(t.lastPrice),
        change: parseFloat(t.priceChangePercent),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume)
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    res.json({ tickers: usdtPairs });
  } catch (err) {
    console.error('Markets tickers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch market data', tickers: [] });
  }
});

// GET /api/markets/:symbol/klines
router.get('/:symbol/klines', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 200 } = req.query;
    const data = await fetchBinance(
      `/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
    );
    const candles = data.map(k => ({
      time: k[0] / 1000,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    res.json({ candles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch klines', candles: [] });
  }
});

// GET /api/markets/:symbol/depth
router.get('/:symbol/depth', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 20 } = req.query;
    const data = await fetchBinance(
      `/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
    );
    res.json({
      bids: data.bids.map(b => ({ price: parseFloat(b[0]), amount: parseFloat(b[1]) })),
      asks: data.asks.map(a => ({ price: parseFloat(a[0]), amount: parseFloat(a[1]) }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order book', bids: [], asks: [] });
  }
});

// GET /api/markets/:symbol/trades
router.get('/:symbol/trades', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 50 } = req.query;
    const data = await fetchBinance(
      `/api/v3/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`
    );
    const trades = data.map(t => ({
      id: t.id,
      price: parseFloat(t.price),
      amount: parseFloat(t.qty),
      side: t.isBuyerMaker ? 'SELL' : 'BUY',
      time: t.time
    }));
    res.json({ trades });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trades', trades: [] });
  }
});

// GET /api/markets/:symbol/price
router.get('/:symbol/price', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await fetchBinance(`/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`);
    res.json({ price: parseFloat(data.price), symbol: data.symbol });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

module.exports = router;
