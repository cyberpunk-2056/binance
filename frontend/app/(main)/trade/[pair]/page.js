'use client';
import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TradingViewChart from '@/components/charts/TradingViewChart';
import { api } from '@/lib/api';
import { subscribeToTicker, subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';
import Link from 'next/link';

const LAYER_1 = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'AVAX', 'XRP', 'LTC', 'NEAR', 'LINK', 'TRX', 'MATIC', 'ATOM', 'FIL', 'ETC'];
const MEMES = ['DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BOME', 'MEME', '1000SATS', 'LUNC', 'USTC'];
const PRECISION_OPTIONS = [{ label: '0.01', value: 2 }, { label: '0.1', value: 1 }, { label: '1', value: 0 }, { label: '10', value: -1 }];

/* ─── Binance Diamond Slider ─── */
function BinanceSlider({ value, onChange, color }) {
  const pcts = [0, 25, 50, 75, 100];
  return (
    <div style={{ padding: '8px 0', position: 'relative' }}>
      <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', backgroundColor: '#383f4a', borderRadius: '1px' }} />
        <div style={{ position: 'absolute', left: 0, width: value + '%', height: '2px', backgroundColor: color, borderRadius: '1px' }} />
        {pcts.map(p => {
          const isFilled = p <= value;
          return (
            <div key={p} onClick={() => onChange(p)} style={{
              position: 'absolute', left: p + '%', top: '50%',
              width: '8px', height: '8px',
              backgroundColor: isFilled ? color : '#1e2026',
              border: `1.5px solid ${isFilled ? color : '#474f59'}`,
              transform: 'translate(-50%, -50%) rotate(45deg)',
              cursor: 'pointer', zIndex: 2, transition: 'all 0.15s',
            }} />
          );
        })}
        {!pcts.includes(value) && (
          <div style={{
            position: 'absolute', left: value + '%', top: '50%',
            width: '10px', height: '10px',
            backgroundColor: color, border: '1.5px solid #fff',
            transform: 'translate(-50%, -50%) rotate(45deg)',
            zIndex: 3, pointerEvents: 'none',
          }} />
        )}
        <input type="range" min="0" max="100" step="1" value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', margin: 0, padding: 0, zIndex: 4 }}
        />
      </div>
      {/* Pct labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        {pcts.map(p => (
          <span key={p} onClick={() => onChange(p)} style={{ fontSize: '10px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
            {p}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Order Book Row with depth bar ─── */
function OrderBookRow({ price, amount, total, maxTotal, side, decimals, onClick }) {
  const fillPct = maxTotal > 0 ? Math.min((total / maxTotal) * 100, 100) : 0;
  const priceColor = side === 'ask' ? '#f6465d' : '#0ecb81';
  const fillColor = side === 'ask' ? 'rgba(246,70,93,0.12)' : 'rgba(14,203,129,0.12)';
  const formattedPrice = decimals >= 0 ? price?.toFixed(decimals) : (Math.round(price / Math.pow(10, -decimals)) * Math.pow(10, -decimals)).toFixed(0);

  return (
    <div onClick={onClick} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', padding: '2px 6px', borderRadius: '2px' }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2b2f36'}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Depth fill bar */}
      <div style={{ position: 'absolute', [side === 'ask' ? 'right' : 'right']: 0, top: 0, bottom: 0, width: fillPct + '%', backgroundColor: fillColor, borderRadius: '2px' }} />
      <span style={{ color: priceColor, fontFamily: 'monospace', zIndex: 1, minWidth: '70px' }}>{formattedPrice}</span>
      <span style={{ color: '#eaecef', fontFamily: 'monospace', zIndex: 1, textAlign: 'right', minWidth: '60px' }}>{amount?.toFixed(4)}</span>
      <span style={{ color: '#848e9c', fontFamily: 'monospace', zIndex: 1, textAlign: 'right', minWidth: '60px' }}>{total?.toFixed(2)}</span>
    </div>
  );
}

export default function Trade({ params }) {
  const resolvedParams = use(params);
  const rawPair = resolvedParams.pair || 'BTCUSDT';
  const pair = rawPair.toUpperCase();
  const baseAsset = pair.replace('USDT', '').replace('BTC', '').replace('ETH', '').replace('BNB', '').replace('FDUSD', '') || pair.replace(/USDT$|BTC$|ETH$|BNB$|FDUSD$/, '');

  // Detect quote asset
  const quoteAsset = pair.endsWith('USDT') ? 'USDT' : pair.endsWith('BTC') ? 'BTC' : pair.endsWith('ETH') ? 'ETH' : pair.endsWith('BNB') ? 'BNB' : 'USDT';
  const baseAssetClean = pair.replace(new RegExp(`${quoteAsset}$`), '');

  const { user, loading } = useAuth();
  const { fmt, currency } = useCurrency();
  const router = useRouter();

  // Price & Stats
  const [ticker, setTicker] = useState({ price: 0, change: 0, high: 0, low: 0, volume: 0 });
  const [liveChartPrice, setLiveChartPrice] = useState(null);
  const [activePriceDirection, setActivePriceDirection] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('binance_favorites');
    if (stored) {
      try { const favs = JSON.parse(stored); setIsFavorited(favs.includes(pair)); } catch {}
    }
  }, [pair]);

  const toggleFavoritePair = () => {
    const stored = localStorage.getItem('binance_favorites');
    let favs = [];
    try { favs = JSON.parse(stored || '[]'); } catch {}
    if (isFavorited) { favs = favs.filter(f => f !== pair); } else { favs = [...favs, pair]; }
    localStorage.setItem('binance_favorites', JSON.stringify(favs));
    setIsFavorited(!isFavorited);
  };

  useEffect(() => {
    if (!activePriceDirection) return;
    const timer = setTimeout(() => setActivePriceDirection(null), 800);
    return () => clearTimeout(timer);
  }, [activePriceDirection]);

  // Order Book & Trades
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  const [leftPanelTab, setLeftPanelTab] = useState('book'); // 'book' | 'trades'
  const [obPrecision, setObPrecision] = useState(2); // decimal places for price
  const [showPrecisionMenu, setShowPrecisionMenu] = useState(false);
  const [obViewMode, setObViewMode] = useState('both'); // 'both' | 'asks' | 'bids'

  // Watchlist
  const [watchlistTickers, setWatchlistTickers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMarketTab, setActiveMarketTab] = useState('USDT');
  const [favorites, setFavorites] = useState([]);
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState(null);
  const [priceDirections, setPriceDirections] = useState({});

  useEffect(() => {
    const stored = localStorage.getItem('binance_favorites');
    if (stored) { try { setFavorites(JSON.parse(stored)); } catch {} }
  }, []);

  const toggleFavorite = (symbol, e) => {
    e.preventDefault(); e.stopPropagation();
    const updated = favorites.includes(symbol) ? favorites.filter(f => f !== symbol) : [...favorites, symbol];
    setFavorites(updated);
    localStorage.setItem('binance_favorites', JSON.stringify(updated));
  };

  const handleSort = (key) => {
    if (sortKey !== key) { setSortKey(key); setSortDirection('desc'); }
    else if (sortDirection === 'desc') { setSortDirection('asc'); }
    else { setSortKey(null); setSortDirection(null); }
  };

  const getFilteredTickers = () => {
    let list = [...watchlistTickers];
    const tabQuote = activeMarketTab;
    if (tabQuote === '★') { list = list.filter(t => favorites.includes(t.symbol)); }
    else if (tabQuote === 'L1') { list = list.filter(t => LAYER_1.includes(t.baseAsset)); }
    else if (tabQuote === 'MEME') { list = list.filter(t => MEMES.includes(t.baseAsset)); }
    else if (['USDT', 'BTC', 'ETH', 'BNB', 'FDUSD'].includes(tabQuote)) {
      list = list.filter(t => t.symbol.endsWith(tabQuote));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => t.symbol.toLowerCase().includes(q) || t.baseAsset?.toLowerCase().includes(q));
    }
    if (sortKey && sortDirection) {
      list.sort((a, b) => {
        let valA = sortKey === 'pair' ? a.baseAsset : sortKey === 'price' ? a.price : a.change;
        let valB = sortKey === 'pair' ? b.baseAsset : sortKey === 'price' ? b.price : b.change;
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  };

  // Trading Forms
  const [tradeMode, setTradeMode] = useState('Spot');
  const [tradeType, setTradeType] = useState('Limit');
  const [mobileTradeSide, setMobileTradeSide] = useState('BUY');
  const [priceInput, setPriceInput] = useState('');
  const [stopPriceInput, setStopPriceInput] = useState('');
  const [buyAmountInput, setBuyAmountInput] = useState('');
  const [buyTotalInput, setBuyTotalInput] = useState('');
  const [sellAmountInput, setSellAmountInput] = useState('');
  const [sellTotalInput, setSellTotalInput] = useState('');
  const [buyPct, setBuyPct] = useState(0);
  const [sellPct, setSellPct] = useState(0);
  const [wallets, setWallets] = useState({});
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderError, setOrderError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Advanced order options
  const [timeInForce, setTimeInForce] = useState('GTC'); // GTC | IOC | FOK
  const [showTifMenu, setShowTifMenu] = useState(false);
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [postOnly, setPostOnly] = useState(false);
  const [showBuyAmountMode, setShowBuyAmountMode] = useState('coin'); // 'coin' | 'usdt'

  // Bottom Tabs
  const [userOrders, setUserOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [bottomTab, setBottomTab] = useState('OPEN');
  const [filterByPair, setFilterByPair] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Real-time order book polling
  const obPollRef = useRef(null);

  const fetchOrderBook = async () => {
    try {
      const depthRes = await api.get(`/markets/${pair}/depth`);
      setOrderBook(depthRes.data);
    } catch {}
  };

  // Compute depth bar max totals
  const computeDepthTotals = (orders) => {
    let running = 0;
    return orders.map(o => {
      running += o.price * o.amount;
      return { ...o, total: running };
    });
  };

  const asksWithTotals = computeDepthTotals([...(orderBook.asks || [])].slice(0, 20));
  const bidsWithTotals = computeDepthTotals([...(orderBook.bids || [])].slice(0, 20));
  const maxAskTotal = asksWithTotals.length > 0 ? asksWithTotals[asksWithTotals.length - 1]?.total : 1;
  const maxBidTotal = bidsWithTotals.length > 0 ? bidsWithTotals[bidsWithTotals.length - 1]?.total : 1;

  // Initial fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [tickerRes, depthRes, tradesRes, watchlistRes] = await Promise.all([
          api.get(`/markets/${pair}/price`),
          api.get(`/markets/${pair}/depth`),
          api.get(`/markets/${pair}/trades`),
          api.get('/markets/tickers')
        ]);
        setTicker(prev => ({ ...prev, price: tickerRes.data.price }));
        setPriceInput(tickerRes.data.price?.toString() || '');
        setStopPriceInput(tickerRes.data.price?.toString() || '');
        setOrderBook(depthRes.data);
        setTrades(tradesRes.data.trades || []);
        setWatchlistTickers(watchlistRes.data.tickers || []);

        if (user) {
          const [walletRes, openOrdersRes, historyRes] = await Promise.all([
            api.get('/wallet'),
            api.get(`/orders?status=OPEN&limit=50`),
            api.get(`/orders?status=FILLED&limit=50`)
          ]);
          const walletMap = {};
          walletRes.data.wallets.forEach(w => { walletMap[w.coin] = w.balance; });
          setWallets(walletMap);
          setUserOrders(openOrdersRes.data.orders || []);
          setOrderHistory(historyRes.data.orders || []);
          setTradeHistory((historyRes.data.orders || []).filter(o => o.status === 'FILLED'));
        }
      } catch (err) {
        console.error('Failed to load trade screen:', err);
      }
    };

    fetchInitialData();

    // Poll order book every 1.5 seconds
    obPollRef.current = setInterval(fetchOrderBook, 1500);

    const unsubscribe = subscribeToTicker(pair, (update) => {
      setTicker((prev) => {
        const direction = update.price > prev.price ? 'up' : update.price < prev.price ? 'down' : null;
        if (direction) setActivePriceDirection(direction);
        return update;
      });
      setLiveChartPrice({ price: update.price, time: Date.now() });
      if (Math.random() > 0.5) {
        setTrades(prev => [{
          id: Math.random().toString(),
          price: update.price,
          amount: parseFloat((Math.random() * 0.5 + 0.005).toFixed(4)),
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          time: Date.now()
        }, ...prev.slice(0, 49)]);
      }
    });

    const unsubscribeAll = subscribeToAllTickers((update) => {
      setWatchlistTickers((prev) => prev.map((t) => {
        if (t.symbol === update.symbol) {
          const direction = update.price > t.price ? 'up' : update.price < t.price ? 'down' : null;
          if (direction) {
            setPriceDirections(prevDir => ({ ...prevDir, [update.symbol]: direction }));
            setTimeout(() => {
              setPriceDirections(prevDir => { const copy = { ...prevDir }; delete copy[update.symbol]; return copy; });
            }, 800);
          }
          return { ...t, ...update };
        }
        return t;
      }));
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeAll) unsubscribeAll();
      if (obPollRef.current) clearInterval(obPollRef.current);
    };
  }, [pair, user]);

  // Live total computation
  const buyLiveTotal = (() => {
    if (tradeType === 'Market') return parseFloat(buyTotalInput) || 0;
    const p = parseFloat(priceInput) || ticker.price;
    const a = parseFloat(buyAmountInput) || 0;
    return p * a;
  })();

  const sellLiveTotal = (() => {
    const p = tradeType === 'Market' ? ticker.price : (parseFloat(priceInput) || ticker.price);
    const a = parseFloat(sellAmountInput) || 0;
    return p * a;
  })();

  const handleOrderSubmit = async (side) => {
    if (!user) { router.push('/login'); return; }
    setOrderError(''); setOrderSuccess(''); setSubmitting(true);
    try {
      const typeMap = { 'Limit': 'LIMIT', 'Market': 'MARKET', 'Stop Limit': 'STOP_LIMIT' };
      const orderType = typeMap[tradeType] || 'MARKET';
      const isMarket = tradeType === 'Market';
      const limitPrice = parseFloat(priceInput);
      let coinQty;

      if (side === 'BUY') {
        if (isMarket) {
          const usdtAmt = parseFloat(buyTotalInput);
          if (!usdtAmt || usdtAmt <= 0) { setOrderError('Enter a valid amount'); setSubmitting(false); return; }
          if (usdtAmt < 5) { setOrderError('Minimum order is 5 USDT'); setSubmitting(false); return; }
          if (!ticker.price || ticker.price <= 0) { setOrderError('Market price unavailable'); setSubmitting(false); return; }
          coinQty = usdtAmt / ticker.price;
        } else {
          coinQty = parseFloat(buyAmountInput);
          if (!coinQty || coinQty <= 0) { setOrderError('Enter a valid coin amount'); setSubmitting(false); return; }
          if (!limitPrice || limitPrice <= 0) { setOrderError('Enter a valid limit price'); setSubmitting(false); return; }
          if (coinQty * limitPrice < 1) { setOrderError('Order total must be at least 1 USDT'); setSubmitting(false); return; }
        }
      } else {
        coinQty = parseFloat(sellAmountInput);
        if (!coinQty || coinQty <= 0) { setOrderError('Enter a valid coin amount'); setSubmitting(false); return; }
        if (!isMarket && (!limitPrice || limitPrice <= 0)) { setOrderError('Enter a valid limit price'); setSubmitting(false); return; }
        const sellTotal = (isMarket ? ticker.price : limitPrice) * coinQty;
        if (sellTotal < 1) { setOrderError('Order total must be at least 1 USDT'); setSubmitting(false); return; }
      }

      const payload = {
        pair, type: orderType, side,
        price: isMarket ? ticker.price : limitPrice,
        amount: coinQty,
        marketPrice: ticker.price,
        ...(tradeType === 'Stop Limit' && { stopPrice: parseFloat(stopPriceInput) }),
        ...(tradeType === 'Limit' && { timeInForce }),
      };

      const res = await api.post('/orders', payload);
      setOrderSuccess(res.data.message || 'Order placed successfully!');
      setTimeout(() => setOrderSuccess(''), 4000);

      const [walletRes, openOrdersRes, historyRes] = await Promise.all([
        api.get('/wallet'),
        api.get(`/orders?status=OPEN&limit=50`),
        api.get(`/orders?status=FILLED&limit=50`)
      ]);
      const walletMap = {};
      walletRes.data.wallets.forEach(w => { walletMap[w.coin] = w.balance; });
      setWallets(walletMap);
      setUserOrders(openOrdersRes.data.orders || []);
      setOrderHistory(historyRes.data.orders || []);
      setTradeHistory((historyRes.data.orders || []).filter(o => o.status === 'FILLED'));
      setBottomTab('HISTORY');
      if (side === 'BUY') { setBuyAmountInput(''); setBuyTotalInput(''); setBuyPct(0); }
      else { setSellAmountInput(''); setSellTotalInput(''); setSellPct(0); }
    } catch (err) {
      setOrderError(err.response?.data?.error || 'Order placement failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      await api.delete(`/orders/${orderId}`);
      setUserOrders(prev => prev.filter(o => o.id !== orderId));
      const walletRes = await api.get('/wallet');
      const walletMap = {};
      walletRes.data.wallets.forEach(w => { walletMap[w.coin] = w.balance; });
      setWallets(walletMap);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const isPositive = ticker.change >= 0;
  const usdtBalance = wallets['USDT'] || 0;
  const coinBalance = wallets[baseAssetClean] || 0;

  /* ── Shared form input style ── */
  const inputBoxStyle = {
    backgroundColor: '#2b3139', borderRadius: '4px', padding: '0 12px',
    border: '1px solid #474f59', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '8px', height: '40px',
    transition: 'border-color 0.15s',
  };

  const renderBuyForm = (isMobile = false) => {
    const availableUSDT = usdtBalance;
    const maxBuyCoin = ticker.price > 0 ? availableUSDT / ticker.price : 0;

    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: isMobile ? '8px 0' : '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Available Balance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span style={{ color: '#848e9c', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Avbl <span style={{ fontSize: '8px' }}>▼</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#eaecef', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '500' }}
              onClick={() => {
                if (tradeType === 'Market') { setBuyTotalInput(availableUSDT.toFixed(2)); setBuyPct(100); }
                else { const lp = parseFloat(priceInput) || ticker.price; if (lp > 0) { setBuyAmountInput((availableUSDT / lp).toFixed(6)); setBuyPct(100); } }
              }}>
              {availableUSDT.toFixed(2)} USDT
            </span>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#f0b90b', color: '#1e2026', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>+</div>
          </div>
        </div>

        {/* Stop Price (Stop Limit only) */}
        {tradeType === 'Stop Limit' && (
          <div style={{ ...inputBoxStyle }}>
            <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '50px' }}>Stop</span>
            <input type="number" value={stopPriceInput} onChange={e => setStopPriceInput(e.target.value)} placeholder="Stop Price"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
            <span style={{ fontSize: '12px', color: '#848e9c' }}>USDT</span>
          </div>
        )}

        {/* Price Field */}
        <div style={{ ...inputBoxStyle }} onFocus={e => e.currentTarget.style.borderColor = '#f0b90b'} onBlur={e => e.currentTarget.style.borderColor = '#474f59'}>
          <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '35px' }}>Price</span>
          {tradeType === 'Market' ? (
            <span style={{ fontSize: '13px', color: '#5e6673', fontWeight: '500', flex: 1, textAlign: 'right' }}>Market</span>
          ) : (
            <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder="0.00"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
          )}
          <span style={{ fontSize: '12px', color: '#848e9c' }}>USDT</span>
        </div>

        {/* Amount / Total Field */}
        {tradeType !== 'Market' ? (
          <div style={{ ...inputBoxStyle }}>
            <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '50px' }}>Amount</span>
            <input type="number" value={buyAmountInput} onChange={e => { setBuyAmountInput(e.target.value); const lp = parseFloat(priceInput) || ticker.price; if (lp > 0 && availableUSDT > 0) setBuyPct(Math.min(100, ((parseFloat(e.target.value) || 0) * lp / availableUSDT) * 100)); }}
              placeholder="0.00"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
            <span style={{ fontSize: '12px', color: '#eaecef', cursor: 'pointer' }}>{baseAssetClean} ▾</span>
          </div>
        ) : (
          <div style={{ ...inputBoxStyle }}>
            <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '35px' }}>Total</span>
            <input type="number" value={buyTotalInput} onChange={e => { setBuyTotalInput(e.target.value); if (availableUSDT > 0) setBuyPct(Math.min(100, ((parseFloat(e.target.value) || 0) / availableUSDT) * 100)); }}
              placeholder="Min. 5 USDT"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
            <span style={{ fontSize: '12px', color: '#848e9c' }}>USDT</span>
          </div>
        )}

        {/* Slider */}
        <BinanceSlider value={buyPct} onChange={v => {
          setBuyPct(v);
          if (tradeType === 'Market') {
            setBuyTotalInput(((v / 100) * availableUSDT).toFixed(2));
          } else {
            const lp = parseFloat(priceInput) || ticker.price;
            if (lp > 0) setBuyAmountInput(((v / 100) * availableUSDT / lp).toFixed(6));
          }
        }} color="#0ecb81" />

        {/* Time in Force (Limit only) */}
        {tradeType === 'Limit' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#848e9c' }}>Time in Force</span>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowTifMenu(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #474f59',
                borderRadius: '4px', color: '#eaecef', fontSize: '12px', padding: '3px 8px', cursor: 'pointer'
              }}>{timeInForce} ▾</button>
              {showTifMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, backgroundColor: '#1e2026', border: '1px solid #2b2f36', borderRadius: '6px', zIndex: 200, minWidth: '120px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                  {[['GTC', 'Good Till Cancel'], ['IOC', 'Immediate or Cancel'], ['FOK', 'Fill or Kill']].map(([val, desc]) => (
                    <div key={val} onClick={() => { setTimeInForce(val); setShowTifMenu(false); }}
                      style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', color: timeInForce === val ? '#f0b90b' : '#eaecef', backgroundColor: 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2b2f36'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <div style={{ fontWeight: '600' }}>{val}</div>
                      <div style={{ fontSize: '10px', color: '#848e9c' }}>{desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Post Only (Limit) */}
        {tradeType === 'Limit' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={postOnly} onChange={e => setPostOnly(e.target.checked)} style={{ accentColor: '#f0b90b', width: '13px', height: '13px', cursor: 'pointer' }} />
            Post Only
          </label>
        )}

        {/* TP/SL */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={tpslEnabled} onChange={e => setTpslEnabled(e.target.checked)} style={{ accentColor: '#f0b90b', width: '13px', height: '13px', cursor: 'pointer' }} />
          TP/SL
        </label>

        {tpslEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ ...inputBoxStyle, height: '36px' }}>
              <span style={{ fontSize: '11px', color: '#0ecb81', minWidth: '20px' }}>TP</span>
              <input type="number" value={tpPrice} onChange={e => setTpPrice(e.target.value)} placeholder="Take Profit"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '12px', padding: 0 }} />
              <span style={{ fontSize: '11px', color: '#848e9c' }}>USDT</span>
            </div>
            <div style={{ ...inputBoxStyle, height: '36px' }}>
              <span style={{ fontSize: '11px', color: '#f6465d', minWidth: '20px' }}>SL</span>
              <input type="number" value={slPrice} onChange={e => setSlPrice(e.target.value)} placeholder="Stop Loss"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '12px', padding: 0 }} />
              <span style={{ fontSize: '11px', color: '#848e9c' }}>USDT</span>
            </div>
          </div>
        )}

        {/* Live Total Display */}
        {tradeType !== 'Market' && buyAmountInput && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderTop: '1px solid #2b2f36' }}>
            <span style={{ color: '#848e9c' }}>≈ Total</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '600' }}>{buyLiveTotal.toFixed(2)} USDT</span>
          </div>
        )}

        {/* Fee + Max Buy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c' }}>Max Buy</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace' }}>{maxBuyCoin.toFixed(4)} {baseAssetClean}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', borderBottom: '1px dotted #848e9c', cursor: 'help', paddingBottom: '1px' }}>Est. Fee</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace' }}>0.1%</span>
          </div>
        </div>

        <button onClick={() => handleOrderSubmit('BUY')} disabled={submitting}
          style={{ backgroundColor: '#0ecb81', border: 'none', color: '#fff', padding: '12px', borderRadius: '4px', fontWeight: '700', fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', transition: 'background 0.15s', marginTop: '4px', opacity: submitting ? 0.7 : 1 }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#0db572'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0ecb81'; }}>
          {submitting ? 'Placing...' : `Buy ${baseAssetClean}`}
        </button>
      </div>
    );
  };

  const renderSellForm = (isMobile = false) => {
    const availableCoin = coinBalance;
    const maxSellUSDT = availableCoin * (tradeType === 'Market' ? ticker.price : (parseFloat(priceInput) || ticker.price));

    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: isMobile ? '8px 0' : '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Available Balance */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <span style={{ color: '#848e9c', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Avbl <span style={{ fontSize: '8px' }}>▼</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#eaecef', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '500' }}
              onClick={() => { setSellAmountInput(availableCoin.toFixed(6)); setSellPct(100); }}>
              {availableCoin.toFixed(6)} {baseAssetClean}
            </span>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#f0b90b', color: '#1e2026', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>+</div>
          </div>
        </div>

        {/* Stop Price */}
        {tradeType === 'Stop Limit' && (
          <div style={{ ...inputBoxStyle }}>
            <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '50px' }}>Stop</span>
            <input type="number" value={stopPriceInput} onChange={e => setStopPriceInput(e.target.value)} placeholder="Stop Price"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
            <span style={{ fontSize: '12px', color: '#848e9c' }}>USDT</span>
          </div>
        )}

        {/* Price Field */}
        <div style={{ ...inputBoxStyle }}>
          <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '35px' }}>Price</span>
          {tradeType === 'Market' ? (
            <span style={{ fontSize: '13px', color: '#5e6673', fontWeight: '500', flex: 1, textAlign: 'right' }}>Market</span>
          ) : (
            <input type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder="0.00"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
          )}
          <span style={{ fontSize: '12px', color: '#848e9c' }}>USDT</span>
        </div>

        {/* Amount */}
        <div style={{ ...inputBoxStyle }}>
          <span style={{ fontSize: '12px', color: '#848e9c', minWidth: '50px' }}>Amount</span>
          <input type="number" value={sellAmountInput} onChange={e => { setSellAmountInput(e.target.value); if (availableCoin > 0) setSellPct(Math.min(100, ((parseFloat(e.target.value) || 0) / availableCoin) * 100)); }}
            placeholder="0.00"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '13px', fontWeight: '600', padding: 0 }} />
          <span style={{ fontSize: '12px', color: '#eaecef', cursor: 'pointer' }}>{baseAssetClean} ▾</span>
        </div>

        {/* Slider */}
        <BinanceSlider value={sellPct} onChange={v => {
          setSellPct(v);
          setSellAmountInput(((v / 100) * availableCoin).toFixed(6));
        }} color="#f6465d" />

        {/* Time in Force */}
        {tradeType === 'Limit' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#848e9c' }}>Time in Force</span>
            <button onClick={() => setShowTifMenu(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #474f59', borderRadius: '4px', color: '#eaecef', fontSize: '12px', padding: '3px 8px', cursor: 'pointer' }}>{timeInForce} ▾</button>
          </div>
        )}

        {/* Post Only */}
        {tradeType === 'Limit' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={postOnly} onChange={e => setPostOnly(e.target.checked)} style={{ accentColor: '#f0b90b', width: '13px', height: '13px', cursor: 'pointer' }} />
            Post Only
          </label>
        )}

        {/* TP/SL */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={tpslEnabled} onChange={e => setTpslEnabled(e.target.checked)} style={{ accentColor: '#f0b90b', width: '13px', height: '13px', cursor: 'pointer' }} />
          TP/SL
        </label>

        {tpslEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ ...inputBoxStyle, height: '36px' }}>
              <span style={{ fontSize: '11px', color: '#0ecb81', minWidth: '20px' }}>TP</span>
              <input type="number" value={tpPrice} onChange={e => setTpPrice(e.target.value)} placeholder="Take Profit"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '12px', padding: 0 }} />
              <span style={{ fontSize: '11px', color: '#848e9c' }}>USDT</span>
            </div>
            <div style={{ ...inputBoxStyle, height: '36px' }}>
              <span style={{ fontSize: '11px', color: '#f6465d', minWidth: '20px' }}>SL</span>
              <input type="number" value={slPrice} onChange={e => setSlPrice(e.target.value)} placeholder="Stop Loss"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'right', color: '#eaecef', fontSize: '12px', padding: 0 }} />
              <span style={{ fontSize: '11px', color: '#848e9c' }}>USDT</span>
            </div>
          </div>
        )}

        {/* Live Total */}
        {sellAmountInput && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderTop: '1px solid #2b2f36' }}>
            <span style={{ color: '#848e9c' }}>≈ Total</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '600' }}>{sellLiveTotal.toFixed(2)} USDT</span>
          </div>
        )}

        {/* Max Sell + Fee */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c' }}>Max Sell</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace' }}>≈ {maxSellUSDT.toFixed(2)} USDT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', borderBottom: '1px dotted #848e9c', cursor: 'help', paddingBottom: '1px' }}>Est. Fee</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace' }}>0.1%</span>
          </div>
        </div>

        <button onClick={() => handleOrderSubmit('SELL')} disabled={submitting}
          style={{ backgroundColor: '#f6465d', border: 'none', color: '#fff', padding: '12px', borderRadius: '4px', fontWeight: '700', fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', width: '100%', transition: 'background 0.15s', marginTop: '4px', opacity: submitting ? 0.7 : 1 }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#d63850'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f6465d'; }}>
          {submitting ? 'Placing...' : `Sell ${baseAssetClean}`}
        </button>
      </div>
    );
  };

  /* ── Order Book Panel ── */
  const renderOrderBook = () => {
    const rowsEach = obViewMode === 'both' ? 12 : 20;
    const showAsks = obViewMode !== 'bids';
    const showBids = obViewMode !== 'asks';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* OB Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* View mode icons */}
            {[
              { mode: 'both', d: 'M2 4h6v1H2zm0 2h4v1H2zm0 2h5v1H2zm6-4h4v7H8z', title: 'Both' },
              { mode: 'asks', d: 'M2 4h10v7H2z', title: 'Asks only', color: '#f6465d' },
              { mode: 'bids', d: 'M2 4h10v7H2z', title: 'Bids only', color: '#0ecb81' },
            ].map(({ mode, d, title }) => (
              <button key={mode} onClick={() => setObViewMode(mode)} title={title}
                style={{ width: '22px', height: '22px', background: obViewMode === mode ? 'rgba(240,185,11,0.1)' : 'transparent', border: obViewMode === mode ? '1px solid #f0b90b' : '1px solid transparent', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px' }}>
                <svg viewBox="0 0 12 12" fill="none" width="14" height="14">
                  {mode === 'both' && <>
                    <rect x="1" y="1" width="4" height="5" rx="0.5" fill="#f6465d" opacity="0.7" />
                    <rect x="7" y="1" width="4" height="5" rx="0.5" fill="#0ecb81" opacity="0.7" />
                    <rect x="1" y="7" width="10" height="4" rx="0.5" fill="#848e9c" opacity="0.4" />
                  </>}
                  {mode === 'asks' && <rect x="1" y="1" width="10" height="10" rx="0.5" fill="#f6465d" opacity="0.8" />}
                  {mode === 'bids' && <rect x="1" y="1" width="10" height="10" rx="0.5" fill="#0ecb81" opacity="0.8" />}
                </svg>
              </button>
            ))}
          </div>
          {/* Precision selector */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPrecisionMenu(v => !v)}
              style={{ fontSize: '11px', color: '#848e9c', background: '#2b2f36', border: '1px solid #474f59', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {PRECISION_OPTIONS.find(p => p.value === obPrecision)?.label || '0.01'} ▾
            </button>
            {showPrecisionMenu && (
              <div onClick={() => setShowPrecisionMenu(false)} style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', backgroundColor: '#1e2026', border: '1px solid #2b2f36', borderRadius: '6px', zIndex: 300, minWidth: '80px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                {PRECISION_OPTIONS.map(opt => (
                  <div key={opt.value} onClick={() => { setObPrecision(opt.value); setShowPrecisionMenu(false); }}
                    style={{ padding: '6px 10px', fontSize: '12px', color: obPrecision === opt.value ? '#f0b90b' : '#eaecef', cursor: 'pointer', backgroundColor: 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2b2f36'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#848e9c', padding: '4px 6px', marginBottom: '4px' }}>
          <span>Price (USDT)</span>
          <span>Amount ({baseAssetClean})</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {/* Asks (reversed, highest at top) */}
        {showAsks && (
          <div style={{ flex: obViewMode === 'both' ? 1 : 2, display: 'flex', flexDirection: 'column-reverse', gap: '1px', overflow: 'hidden', marginBottom: obViewMode === 'both' ? '4px' : 0 }}>
            {asksWithTotals.slice(0, rowsEach).map((ask, idx) => (
              <OrderBookRow key={`ask-${idx}`} price={ask.price} amount={ask.amount} total={ask.total}
                maxTotal={maxAskTotal} side="ask" decimals={obPrecision}
                onClick={() => setPriceInput(ask.price?.toFixed(obPrecision >= 0 ? obPrecision : 0))} />
            ))}
          </div>
        )}

        {/* Spread Price */}
        {obViewMode === 'both' && (
          <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '6px 6px', margin: '2px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span key={`spread-${activePriceDirection}-${ticker.price}`}
              className={activePriceDirection === 'up' ? 'price-flash-up' : activePriceDirection === 'down' ? 'price-flash-down' : ''}
              style={{ fontSize: '15px', fontWeight: 'bold', color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)', display: 'inline-block' }}>
              {ticker.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              {currency !== 'USD' && <span style={{ fontSize: '10px', color: '#848e9c' }}>≈ {fmt(ticker.price)}</span>}
              <span style={{ fontSize: '10px', color: ticker.change >= 0 ? '#0ecb81' : '#f6465d' }}>
                {isPositive ? '+' : ''}{ticker.change?.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Bids */}
        {showBids && (
          <div style={{ flex: obViewMode === 'both' ? 1 : 2, display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden' }}>
            {bidsWithTotals.slice(0, rowsEach).map((bid, idx) => (
              <OrderBookRow key={`bid-${idx}`} price={bid.price} amount={bid.amount} total={bid.total}
                maxTotal={maxBidTotal} side="bid" decimals={obPrecision}
                onClick={() => setPriceInput(bid.price?.toFixed(obPrecision >= 0 ? obPrecision : 0))} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Recent Trades Panel ── */
  const renderTrades = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#848e9c', padding: '4px 6px', marginBottom: '4px' }}>
        <span>Price (USDT)</span>
        <span>Amount ({baseAssetClean})</span>
        <span style={{ textAlign: 'right' }}>Time</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {trades.slice(0, 40).map((t, i) => (
          <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 6px' }}>
            <span style={{ color: t.side === 'BUY' ? '#0ecb81' : '#f6465d', fontFamily: 'monospace' }}>{t.price?.toFixed(2)}</span>
            <span style={{ color: '#848e9c', fontFamily: 'monospace' }}>{t.amount?.toFixed(4)}</span>
            <span style={{ color: '#848e9c', fontFamily: 'monospace', textAlign: 'right' }}>
              {new Date(t.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  /* ── Filtered orders for the bottom panel ── */
  const filteredOpenOrders = filterByPair ? userOrders.filter(o => o.pair === pair) : userOrders;
  const filteredHistory = filterByPair ? orderHistory.filter(o => o.pair === pair) : orderHistory;
  const filteredTradeHistory = filterByPair ? tradeHistory.filter(o => o.pair === pair) : tradeHistory;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ── Header Stats Bar ── */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '32px', overflowX: 'auto' }}>

        {/* Pair Name + Favorite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <CoinIcon coin={baseAssetClean} size={24} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{baseAssetClean}</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/{quoteAsset}</span>
              <button onClick={toggleFavoritePair} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isFavorited ? '#f0b90b' : '#848e9c', fontSize: '16px', lineHeight: 1, transition: 'color 0.15s', padding: '0 2px' }}>
                {isFavorited ? '★' : '☆'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#848e9c' }}>Spot</div>
          </div>
        </div>

        {/* Price */}
        <div style={{ flexShrink: 0 }}>
          <div key={`hdr-${activePriceDirection}-${ticker.price}`}
            className={activePriceDirection === 'up' ? 'price-header-up' : activePriceDirection === 'down' ? 'price-header-down' : ''}
            style={{ fontSize: '22px', fontWeight: 'bold', color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: 1.2 }}>
            {ticker.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {currency !== 'USD' && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>≈ {fmt(ticker.price)}</div>}
        </div>

        {/* 24h Change */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
            {isPositive ? '+' : ''}{ticker.change?.toFixed(2)}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>24h Change</div>
        </div>

        {/* 24h High */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {ticker.high?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>24h High</div>
        </div>

        {/* 24h Low */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {ticker.low?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>24h Low</div>
        </div>

        {/* 24h Volume (Base) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {ticker.volume?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>24h Vol({baseAssetClean})</div>
        </div>

        {/* 24h Volume (USDT) */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {((ticker.volume || 0) * (ticker.price || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>24h Vol(USDT)</div>
        </div>
      </div>

      {/* ── Main Trading Grid ── */}
      <div className="trading-grid">

        {/* ── LEFT COLUMN: Order Book / Trades ── */}
        <div className="trading-left-col">
          {/* Tab toggle */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '10px' }}>
            {[['book', 'Order Book'], ['trades', 'Trades']].map(([key, label]) => (
              <button key={key} onClick={() => setLeftPanelTab(key)}
                style={{ flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: leftPanelTab === key ? '700' : '400', color: leftPanelTab === key ? 'var(--text-primary)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: leftPanelTab === key ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {leftPanelTab === 'book' ? renderOrderBook() : renderTrades()}
          </div>
        </div>

        {/* ── CENTER COLUMN: Chart + Forms ── */}
        <div className="trading-center-col">

          {/* TradingView Chart */}
          <div style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <TradingViewChart symbol={pair} />
          </div>

          {/* Buy/Sell Panel */}
          <div style={{ backgroundColor: 'var(--bg-secondary)' }}>

            {/* Row 1: Spot / Cross / Isolated / Grid + Fee badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex' }}>
                {['Spot', 'Cross', 'Isolated', 'Grid'].map(mode => {
                  const isAct = tradeMode === mode;
                  return (
                    <button key={mode} onClick={() => setTradeMode(mode)} style={{
                      background: 'none', border: 'none',
                      borderBottom: isAct ? '2.5px solid #f0b90b' : '2.5px solid transparent',
                      color: isAct ? '#eaecef' : '#848e9c',
                      fontWeight: isAct ? '700' : '500', fontSize: '14px',
                      padding: '12px 12px 9px', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}>{mode}</button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #f0b90b', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', color: '#f0b90b', fontWeight: '600', backgroundColor: 'rgba(240,185,11,0.06)', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0b90b" strokeWidth="2.5">
                    <path d="M12 2l1.5 1.5L15.5 3l1 2 2 .5.5 2 2 1v2.5l-1 2 1 2v2.5l-2 1-.5 2-2 .5-1 2-2-1-1.5 1.5L12 22l-1.5-1.5L8.5 21l-1-2-2-.5-.5-2-2-1v-2.5l1-2-1-2v-2.5l2-1 .5-2 2-.5 1-2 2 1 1.5-1.5z" fill="rgba(240,185,11,0.1)" />
                    <path d="M15 9l-6 6M9.5 9.5h.01M14.5 14.5h.01" stroke="#f0b90b" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  0% fee on this pair
                </div>
                <span style={{ fontSize: '12px', color: '#848e9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>
                  Fee Level
                </span>
              </div>
            </div>

            {/* Row 2: Limit / Market / Stop Limit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                {['Limit', 'Market', 'Stop Limit'].map(type => {
                  const isAct = tradeType === type;
                  return (
                    <button key={type} onClick={() => setTradeType(type)} style={{
                      background: 'none', border: 'none',
                      color: isAct ? '#eaecef' : '#848e9c',
                      fontWeight: isAct ? '700' : '500', fontSize: '13px',
                      padding: '4px 0', cursor: 'pointer', transition: 'all 0.15s',
                    }}>{type}{type === 'Stop Limit' ? ' ▾' : ''}</button>
                  );
                })}
                <span style={{ fontSize: '11px', color: '#848e9c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', border: '1px solid #848e9c', fontWeight: '600', lineHeight: 1 }}>i</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#848e9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                  Recurring
                </span>
                <span style={{ fontSize: '12px', color: '#848e9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                  Buy with Card
                </span>
              </div>
            </div>

            {/* Success / Error banner */}
            {orderSuccess && (
              <div style={{ color: 'var(--success)', fontSize: '12px', padding: '8px 16px', backgroundColor: 'rgba(14,203,129,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {orderSuccess}
              </div>
            )}
            {orderError && (
              <div style={{ color: 'var(--danger)', fontSize: '12px', padding: '8px 16px', backgroundColor: 'rgba(246,70,93,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {orderError}
              </div>
            )}

            {/* Not logged in banner */}
            {!user && (
              <div style={{ padding: '12px 16px', fontSize: '13px', color: '#848e9c', textAlign: 'center', backgroundColor: 'rgba(240,185,11,0.04)', borderTop: '1px solid var(--border-color)' }}>
                <Link href="/login" style={{ color: '#f0b90b', fontWeight: '600' }}>Log In</Link> or <Link href="/register" style={{ color: '#f0b90b', fontWeight: '600' }}>Register</Link> to trade
              </div>
            )}

            {/* Desktop: side-by-side forms */}
            <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-color)' }}>
              {renderBuyForm(false)}
              {renderSellForm(false)}
            </div>

            {/* Mobile: toggle tabs + form */}
            <div className="mobile-only" style={{ flexDirection: 'column', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <button onClick={() => setMobileTradeSide('BUY')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', backgroundColor: mobileTradeSide === 'BUY' ? '#0ecb81' : 'var(--bg-tertiary)', color: mobileTradeSide === 'BUY' ? '#fff' : 'var(--text-secondary)', border: 'none', transition: 'all 0.15s' }}>
                  Buy
                </button>
                <button onClick={() => setMobileTradeSide('SELL')}
                  style={{ flex: 1, padding: '10px 0', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', backgroundColor: mobileTradeSide === 'SELL' ? '#f6465d' : 'var(--bg-tertiary)', color: mobileTradeSide === 'SELL' ? '#fff' : 'var(--text-secondary)', border: 'none', transition: 'all 0.15s' }}>
                  Sell
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '12px', alignItems: 'start' }}>
                <div>{mobileTradeSide === 'BUY' ? renderBuyForm(true) : renderSellForm(true)}</div>
                {/* Compact Order Book */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {(orderBook.asks || []).slice(0, 6).reverse().map((ask, idx) => (
                    <div key={idx} onClick={() => setPriceInput(ask.price?.toFixed(2))}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', cursor: 'pointer', padding: '2px 2px' }}>
                      <span style={{ color: '#f6465d', fontFamily: 'monospace' }}>{ask.price?.toFixed(2)}</span>
                      <span style={{ color: '#848e9c', fontFamily: 'monospace' }}>{ask.amount?.toFixed(3)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '4px 2px', textAlign: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {ticker.price?.toFixed(2)}
                    </span>
                  </div>
                  {(orderBook.bids || []).slice(0, 6).map((bid, idx) => (
                    <div key={idx} onClick={() => setPriceInput(bid.price?.toFixed(2))}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', cursor: 'pointer', padding: '2px 2px' }}>
                      <span style={{ color: '#0ecb81', fontFamily: 'monospace' }}>{bid.price?.toFixed(2)}</span>
                      <span style={{ color: '#848e9c', fontFamily: 'monospace' }}>{bid.amount?.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Watchlist + Recent Trades ── */}
        <div className="trading-right-col">

          {/* Watchlist */}
          <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px', flex: '0 0 auto', maxHeight: '440px' }}>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input type="text" placeholder="Search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 30px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: '#848e9c', fontSize: '11px' }}>🔍</span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', color: '#848e9c', border: 'none', cursor: 'pointer', fontSize: '13px' }}>×</button>
              )}
            </div>

            {/* Quote Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '6px', overflowX: 'auto', gap: '0' }}>
              {['★', 'USDT', 'BTC', 'ETH', 'BNB', 'FDUSD'].map((tab) => {
                const tabValue = tab;
                const isAct = activeMarketTab === tabValue;
                return (
                  <button key={tab} onClick={() => setActiveMarketTab(tabValue)}
                    style={{ background: 'none', border: 'none', borderBottom: isAct ? '2px solid var(--primary)' : '2px solid transparent', color: isAct ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: isAct ? '700' : '400', cursor: 'pointer', fontSize: '11px', padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Column headers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', padding: '4px 4px', borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>
              <div onClick={() => handleSort('pair')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '40%' }}>
                Pair {sortKey === 'pair' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
              </div>
              <div onClick={() => handleSort('price')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '32%', justifyContent: 'flex-end' }}>
                Price {sortKey === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
              </div>
              <div onClick={() => handleSort('change')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '28%', justifyContent: 'flex-end' }}>
                Change {sortKey === 'change' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
              </div>
            </div>

            {/* Pairs List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {getFilteredTickers().length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>No pairs found</div>
              ) : (
                getFilteredTickers().map((w) => {
                  const isPos = w.change >= 0;
                  const isFav = favorites.includes(w.symbol);
                  const isCurrent = w.symbol === pair;
                  const direction = priceDirections[w.symbol];
                  const wBaseAsset = w.baseAsset || w.symbol.replace(/USDT$|BTC$|ETH$|BNB$|FDUSD$/, '');

                  return (
                    <div key={w.symbol}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 4px', borderRadius: '3px', backgroundColor: isCurrent ? 'var(--bg-tertiary)' : 'transparent', fontSize: '12px', cursor: 'pointer', transition: 'background-color 0.1s' }}
                      onClick={() => router.push(`/trade/${w.symbol}`)}
                      onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '40%', overflow: 'hidden' }}>
                        <span onClick={e => toggleFavorite(w.symbol, e)} style={{ color: isFav ? '#f0b90b' : '#5e6673', cursor: 'pointer', fontSize: '11px', userSelect: 'none', flexShrink: 0 }}>
                          {isFav ? '★' : '☆'}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'baseline', gap: '1px' }}>
                          {wBaseAsset}<span style={{ color: '#848e9c', fontSize: '9px' }}>/{w.symbol.replace(wBaseAsset, '') || 'USDT'}</span>
                        </span>
                      </div>
                      <div style={{ width: '32%', textAlign: 'right', fontFamily: 'monospace' }}>
                        <span key={`${w.symbol}-${direction}-${w.price}`}
                          className={direction === 'up' ? 'watchlist-price-up' : direction === 'down' ? 'watchlist-price-down' : ''}
                          style={{ color: direction ? undefined : 'var(--text-primary)', fontSize: '11px' }}>
                          {w.price < 1 ? w.price?.toFixed(4) : w.price?.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ width: '28%', textAlign: 'right' }}>
                        <span style={{ backgroundColor: isPos ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)', color: isPos ? '#0ecb81' : '#f6465d', padding: '2px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: '600' }}>
                          {isPos ? '+' : ''}{w.change?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Trades (right panel) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginBottom: '8px', flexShrink: 0 }}>Recent Trades</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#848e9c', padding: '2px 0', marginBottom: '4px', flexShrink: 0 }}>
              <span>Price (USDT)</span>
              <span>Amount ({baseAssetClean})</span>
              <span>Time</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {trades.slice(0, 35).map((t, i) => (
                <div key={t.id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: t.side === 'BUY' ? 'var(--success)' : 'var(--danger)', fontFamily: 'monospace' }}>{t.price?.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{t.amount?.toFixed(4)}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{new Date(t.time).toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Orders Panel ── */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>

        {/* Tab header */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '0 16px', gap: '0' }}>
          {[
            { key: 'OPEN', label: 'Open Orders', count: filteredOpenOrders.length },
            { key: 'HISTORY', label: 'Order History' },
            { key: 'TRADE', label: 'Trade History' },
            { key: 'FUNDS', label: 'Funds' },
          ].map(({ key, label, count }) => {
            const isTab = bottomTab === key;
            return (
              <button key={key} onClick={() => setBottomTab(key)}
                style={{ padding: '12px 16px', fontSize: '13px', fontWeight: isTab ? '600' : '400', color: isTab ? 'var(--text-primary)' : 'var(--text-secondary)', background: 'none', border: 'none', borderBottom: isTab ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                {label}
                {count > 0 && (
                  <span style={{ marginLeft: '6px', backgroundColor: 'var(--primary)', color: '#000', borderRadius: '10px', fontSize: '11px', fontWeight: '700', padding: '1px 6px' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Filter by pair toggle */}
          {(bottomTab === 'OPEN' || bottomTab === 'HISTORY' || bottomTab === 'TRADE') && (
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={filterByPair} onChange={e => setFilterByPair(e.target.checked)} style={{ accentColor: '#f0b90b', width: '13px', height: '13px', cursor: 'pointer' }} />
              Hide Other Pairs
            </label>
          )}
        </div>

        {/* Tab body */}
        <div style={{ overflowX: 'auto', minHeight: '140px', maxHeight: '280px', overflowY: 'auto' }}>

          {/* Open Orders */}
          {bottomTab === 'OPEN' && (
            filteredOpenOrders.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <rect x="8" y="12" width="32" height="4" rx="2" fill="currentColor" />
                  <rect x="8" y="22" width="24" height="4" rx="2" fill="currentColor" />
                  <rect x="8" y="32" width="16" height="4" rx="2" fill="currentColor" />
                </svg>
                No open orders
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Date', 'Pair', 'Type', 'Side', 'Price', 'Amount', 'Filled', 'Total', 'Action'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOpenOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '11px' }}>{new Date(order.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600' }}>{order.pair}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{order.type}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{order.side}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(6)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.filled?.toFixed(6) || '0.000000'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{((order.price || 0) * (order.amount || 0)).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button onClick={() => handleCancelOrder(order.id)}
                          style={{ padding: '4px 10px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--danger)'; }}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Order History */}
          {bottomTab === 'HISTORY' && (
            filteredHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <path d="M24 14v10l6 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                No order history
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Date', 'Pair', 'Type', 'Side', 'Avg Price', 'Amount', 'Filled', 'Total', 'Status'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 4 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '11px' }}>{new Date(order.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600' }}>{order.pair}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{order.type}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{order.side}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(6)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.filled?.toFixed(6) || order.amount?.toFixed(6)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{((order.price || 0) * (order.amount || 0)).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', backgroundColor: order.status === 'FILLED' ? 'rgba(14,203,129,0.12)' : order.status === 'CANCELLED' ? 'rgba(246,70,93,0.12)' : 'rgba(240,185,11,0.12)', color: order.status === 'FILLED' ? 'var(--success)' : order.status === 'CANCELLED' ? 'var(--danger)' : 'var(--primary)' }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Trade History */}
          {bottomTab === 'TRADE' && (
            filteredTradeHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                  <path d="M8 40L20 28L28 36L40 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                No trade history
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Date', 'Pair', 'Side', 'Price', 'Amount', 'Total', 'Fee', 'Role'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 3 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTradeHistory.map((order) => {
                    const fee = (order.price || 0) * (order.amount || 0) * 0.001;
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '11px' }}>{new Date(order.createdAt).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '600' }}>{order.pair}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '600', color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{order.side}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(6)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{((order.price || 0) * (order.amount || 0)).toFixed(2)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#848e9c' }}>{fee.toFixed(4)} USDT</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <span style={{ color: '#848e9c', fontSize: '11px' }}>{order.type === 'LIMIT' ? 'Maker' : 'Taker'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* Funds */}
          {bottomTab === 'FUNDS' && (
            <div style={{ padding: '0' }}>
              {Object.keys(wallets).length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                    <rect x="6" y="16" width="36" height="26" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
                    <path d="M14 16V12a10 10 0 0 1 20 0v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="24" cy="29" r="3" fill="currentColor" />
                  </svg>
                  {user ? 'No funds found' : 'Log in to view funds'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Coin', 'Total Balance', 'Available', 'In Order', 'BTC Value'].map((h, i) => (
                        <th key={h} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 1 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(wallets).filter(([, bal]) => bal > 0).map(([coin, balance]) => {
                      const btcPrice = watchlistTickers.find(t => t.symbol === 'BTCUSDT')?.price || 1;
                      const coinUsdtPrice = coin === 'USDT' ? 1 : (watchlistTickers.find(t => t.symbol === `${coin}USDT`)?.price || 0);
                      const btcValue = coinUsdtPrice * balance / btcPrice;
                      return (
                        <tr key={coin} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CoinIcon coin={coin} size={20} />
                              <span style={{ fontWeight: '600' }}>{coin}</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{balance.toFixed(8)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#0ecb81' }}>{balance.toFixed(8)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#848e9c' }}>0.00000000</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#848e9c' }}>
                            {btcValue > 0 ? btcValue.toFixed(8) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
