'use client';
import { useEffect, useState, use } from 'react';
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


/* Binance-style percentage slider */
function BinanceSlider({ value, onChange, color }) {
  const pcts = [0, 25, 50, 75, 100];
  return (
    <div style={{ padding: '8px 0', position: 'relative' }}>
      <div style={{ position: 'relative', height: '14px', display: 'flex', alignItems: 'center' }}>
        {/* Track Background */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', backgroundColor: '#383f4a', borderRadius: '1px' }} />
        {/* Track Fill */}
        <div style={{ position: 'absolute', left: 0, width: value + '%', height: '2px', backgroundColor: color, borderRadius: '1px' }} />
        
        {/* Diamonds for all ticks */}
        {pcts.map(p => {
          const isFilled = p <= value;
          return (
            <div
              key={p}
              onClick={() => onChange(p)}
              style={{
                position: 'absolute',
                left: p + '%',
                top: '50%',
                width: '8px',
                height: '8px',
                backgroundColor: isFilled ? color : '#1e2026',
                border: `1.5px solid ${isFilled ? color : '#474f59'}`,
                transform: 'translate(-50%, -50%) rotate(45deg)',
                cursor: 'pointer',
                zIndex: 2,
                transition: 'all 0.15s',
              }}
            />
          );
        })}

        {/* Floating handle if value is custom (not one of the main ticks) */}
        {!pcts.includes(value) && (
          <div
            style={{
              position: 'absolute',
              left: value + '%',
              top: '50%',
              width: '10px',
              height: '10px',
              backgroundColor: color,
              border: '1.5px solid #fff',
              transform: 'translate(-50%, -50%) rotate(45deg)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Range Input overlay for interactions */}
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            margin: 0,
            padding: 0,
            zIndex: 4,
          }}
        />
      </div>
    </div>
  );
}

export default function Trade({ params }) {
  const resolvedParams = use(params);
  const rawPair = resolvedParams.pair || 'BTCUSDT';
  const pair = rawPair.toUpperCase();
  const baseAsset = pair.replace('USDT', '');
  
  const { user, loading } = useAuth();
  const { fmt, currency } = useCurrency();
  const router = useRouter();

  // Price & Stats States
  const [ticker, setTicker] = useState({
    price: 0, change: 0, high: 0, low: 0, volume: 0
  });
  const [liveChartPrice, setLiveChartPrice] = useState(null);
  const [activePriceDirection, setActivePriceDirection] = useState(null); // 'up' | 'down' | null

  useEffect(() => {
    if (!activePriceDirection) return;
    const timer = setTimeout(() => {
      setActivePriceDirection(null);
    }, 800);
    return () => clearTimeout(timer);
  }, [activePriceDirection]);

  // Order Book & Recent Trades
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [] });
  const [trades, setTrades] = useState([]);
  const [watchlistTickers, setWatchlistTickers] = useState([]);

  // Markets watchlist panel states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMarketTab, setActiveMarketTab] = useState('USDT'); // '★', 'USDT', 'L1', 'MEME'
  const [favorites, setFavorites] = useState([]);
  const [sortKey, setSortKey] = useState(null); // 'pair', 'price', 'change'
  const [sortDirection, setSortDirection] = useState(null); // 'asc', 'desc'
  const [priceDirections, setPriceDirections] = useState({}); // symbol -> 'up' | 'down'

  // Load favorites from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('binance_favorites');
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse favorites:', e);
      }
    }
  }, []);

  const toggleFavorite = (symbol, e) => {
    e.preventDefault();
    e.stopPropagation();
    let updated;
    if (favorites.includes(symbol)) {
      updated = favorites.filter(f => f !== symbol);
    } else {
      updated = [...favorites, symbol];
    }
    setFavorites(updated);
    localStorage.setItem('binance_favorites', JSON.stringify(updated));
  };

  const handleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  const getFilteredTickers = () => {
    let list = [...watchlistTickers];

    // Filter by Tab
    if (activeMarketTab === '★') {
      list = list.filter(t => favorites.includes(t.symbol));
    } else if (activeMarketTab === 'L1') {
      list = list.filter(t => LAYER_1.includes(t.baseAsset));
    } else if (activeMarketTab === 'MEME') {
      list = list.filter(t => MEMES.includes(t.baseAsset));
    }

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.symbol.toLowerCase().includes(q) || 
        t.baseAsset.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey && sortDirection) {
      list.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'pair') {
          valA = a.baseAsset;
          valB = b.baseAsset;
        } else if (sortKey === 'price') {
          valA = a.price;
          valB = b.price;
        } else if (sortKey === 'change') {
          valA = a.change;
          valB = b.change;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  };

  // Trading Forms
  const [tradeMode, setTradeMode] = useState('Spot'); // Spot, Cross, Isolated, Grid
  const [tradeType, setTradeType] = useState('Market'); // Limit, Market, Stop Limit
  const [mobileTradeSide, setMobileTradeSide] = useState('BUY');
  const [priceInput, setPriceInput] = useState('');
  const [buyAmountInput, setBuyAmountInput] = useState('');  // coin qty — used for Limit/StopLimit BUY
  const [buyTotalInput, setBuyTotalInput] = useState('');    // USDT    — used for Market BUY
  const [sellAmountInput, setSellAmountInput] = useState('');
  const [buyPct, setBuyPct] = useState(0);   // 0-100 slider
  const [sellPct, setSellPct] = useState(0); // 0-100 slider
  const [wallets, setWallets] = useState({});
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderError, setOrderError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Bottom Tabs
  const [userOrders, setUserOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [bottomTab, setBottomTab] = useState('OPEN'); // 'OPEN' | 'HISTORY'
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Fetch initial info
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
        setOrderBook(depthRes.data);
        setTrades(tradesRes.data.trades);
        
        setWatchlistTickers(watchlistRes.data.tickers);

        // Fetch wallet balances if logged in
        if (user) {
          const [walletRes, openOrdersRes, historyRes] = await Promise.all([
            api.get('/wallet'),
            api.get(`/orders?status=OPEN&limit=50`),
            api.get(`/orders?status=FILLED&limit=50`)
          ]);
          
          const walletMap = {};
          walletRes.data.wallets.forEach(w => {
            walletMap[w.coin] = w.balance;
          });
          setWallets(walletMap);
          setUserOrders(openOrdersRes.data.orders || []);
          setOrderHistory(historyRes.data.orders || []);
        }
      } catch (err) {
        console.error('Failed to load initial trade screen data:', err);
      }
    };

    fetchInitialData();

    // Subscribe to WebSocket updates for this symbol
    const unsubscribe = subscribeToTicker(pair, (update) => {
      setTicker((prev) => {
        const direction = update.price > prev.price ? 'up' : update.price < prev.price ? 'down' : null;
        if (direction) {
          setActivePriceDirection(direction);
        }
        return update;
      });
      setLiveChartPrice({
        price: update.price,
        time: Date.now()
      });
      
      // Update trades feed with simulated live fill sometimes
      if (Math.random() > 0.6) {
        setTrades(prev => [
          {
            id: Math.random().toString(),
            price: update.price,
            amount: parseFloat((Math.random() * 0.5 + 0.01).toFixed(4)),
            side: Math.random() > 0.5 ? 'BUY' : 'SELL',
            time: Date.now()
          },
          ...prev.slice(0, 49)
        ]);
      }
    });

    // Subscribe to all tickers updates to keep watchlist prices live
    const unsubscribeAll = subscribeToAllTickers((update) => {
      setWatchlistTickers((prev) =>
        prev.map((t) => {
          if (t.symbol === update.symbol) {
            const direction = update.price > t.price ? 'up' : update.price < t.price ? 'down' : null;
            if (direction) {
              setPriceDirections(prevDir => ({
                ...prevDir,
                [update.symbol]: direction
              }));
              setTimeout(() => {
                setPriceDirections(prevDir => {
                  const copy = { ...prevDir };
                  delete copy[update.symbol];
                  return copy;
                });
              }, 800);
            }
            return { ...t, ...update };
          }
          return t;
        })
      );
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeAll) unsubscribeAll();
    };
  }, [pair, user]);

  const handleOrderSubmit = async (side) => {
    if (!user) {
      router.push('/login');
      return;
    }

    setOrderError('');
    setOrderSuccess('');
    setSubmitting(true);

    try {
      const typeMap   = { 'Limit': 'LIMIT', 'Market': 'MARKET', 'Stop Limit': 'STOP_LIMIT' };
      const orderType = typeMap[tradeType] || 'MARKET';
      const isMarket  = tradeType === 'Market';
      const limitPrice = parseFloat(priceInput);

      let coinQty;

      if (side === 'BUY') {
        if (isMarket) {
          // User entered USDT total → convert to coin quantity at current price
          const usdtAmt = parseFloat(buyTotalInput);
          if (!usdtAmt || usdtAmt <= 0) { setOrderError('Enter a valid USDT amount'); setSubmitting(false); return; }
          if (usdtAmt < 5) { setOrderError('Minimum order is 5 USDT'); setSubmitting(false); return; }
          if (!ticker.price || ticker.price <= 0) { setOrderError('Market price unavailable, please retry'); setSubmitting(false); return; }
          coinQty = usdtAmt / ticker.price;
        } else {
          // LIMIT / STOP_LIMIT — user enters coin quantity directly
          coinQty = parseFloat(buyAmountInput);
          if (!coinQty || coinQty <= 0) { setOrderError('Enter a valid coin amount'); setSubmitting(false); return; }
          if (!limitPrice || limitPrice <= 0) { setOrderError('Enter a valid limit price'); setSubmitting(false); return; }
          if (coinQty * limitPrice < 1) { setOrderError('Order total must be at least 1 USDT'); setSubmitting(false); return; }
        }
      } else {
        // SELL — always coin quantity
        coinQty = parseFloat(sellAmountInput);
        if (!coinQty || coinQty <= 0) { setOrderError('Enter a valid coin amount'); setSubmitting(false); return; }
        if (!isMarket && (!limitPrice || limitPrice <= 0)) { setOrderError('Enter a valid limit price'); setSubmitting(false); return; }
        const sellTotal = (isMarket ? ticker.price : limitPrice) * coinQty;
        if (sellTotal < 1) { setOrderError('Order total must be at least 1 USDT'); setSubmitting(false); return; }
      }

      const payload = {
        pair,
        type: orderType,
        side,
        price: isMarket ? ticker.price : limitPrice,
        amount: coinQty,
        marketPrice: ticker.price,
      };

      const res = await api.post('/orders', payload);
      setOrderSuccess(res.data.message);

      // Refresh wallet & order lists
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
      setBottomTab('HISTORY');
      if (side === 'BUY') { setBuyAmountInput(''); setBuyTotalInput(''); setBuyPct(0); }
      else { setSellAmountInput(''); setSellPct(0); }
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
      // Refresh wallets
      const walletRes = await api.get('/wallet');
      const walletMap = {};
      walletRes.data.wallets.forEach(w => {
        walletMap[w.coin] = w.balance;
      });
      setWallets(walletMap);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const isPositive = ticker.change >= 0;

  const renderBuyForm = (isMobile = false) => {
    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: isMobile ? '8px 0' : '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Price field */}
        <div style={{
          backgroundColor: '#2b3139',
          borderRadius: '4px',
          padding: '10px 14px',
          border: '1px solid #474f59',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#848e9c', minWidth: '40px' }}>Price</span>
          {tradeType === 'Market' ? (
            <span style={{ fontSize: '14px', color: '#5e6673', fontWeight: '500' }}>Market Price</span>
          ) : (
            <input
              type="number"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                textAlign: 'right',
                color: '#eaecef',
                fontSize: '14px',
                fontWeight: '600',
                padding: 0
              }}
            />
          )}
          {!isMobile && tradeType !== 'Market' && (
            <span style={{ fontSize: '14px', color: '#848e9c', marginLeft: '4px' }}>USDT</span>
          )}
        </div>

        {/* Amount (Limit: coin qty) OR Total (Market: USDT) */}
        {tradeType !== 'Market' ? (
          <div style={{
            backgroundColor: '#2b3139',
            borderRadius: '4px',
            padding: '10px 14px',
            border: '1px solid #474f59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#848e9c', minWidth: '40px' }}>Amount</span>
            <input
              type="number"
              value={buyAmountInput}
              onChange={e => setBuyAmountInput(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                textAlign: 'right',
                color: '#eaecef',
                fontSize: '14px',
                fontWeight: '600',
                padding: 0
              }}
            />
            <span style={{ fontSize: '14px', color: '#eaecef', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              {baseAsset} ▾
            </span>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#2b3139',
            borderRadius: '4px',
            padding: '10px 14px',
            border: '1px solid #474f59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px', color: '#848e9c', minWidth: '40px' }}>Total</span>
            <input
              type="number"
              value={buyTotalInput}
              onChange={e => setBuyTotalInput(e.target.value)}
              placeholder="Minimum 5"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                textAlign: 'right',
                color: '#eaecef',
                fontSize: '14px',
                fontWeight: '600',
                padding: 0
              }}
            />
            <span style={{ fontSize: '14px', color: '#eaecef', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
              USDT ▾
            </span>
          </div>
        )}

        {/* Slider — sets percentage of available USDT */}
        <BinanceSlider value={buyPct} onChange={v => {
          setBuyPct(v);
          const usdt = wallets['USDT'] || 0;
          if (tradeType === 'Market') {
            setBuyTotalInput(((v / 100) * usdt).toFixed(2));
          } else {
            const lp = parseFloat(priceInput) || ticker.price;
            if (lp > 0) setBuyAmountInput(((v / 100) * usdt / lp).toFixed(6));
          }
        }} color="#0ecb81" />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none', marginTop: '4px' }}>
          <input type="checkbox" style={{
            accentColor: '#f0b90b',
            width: '14px',
            height: '14px',
            cursor: 'pointer',
          }} />
          Slippage Tolerance
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {/* Available balance line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', userSelect: 'none' }}>
              Avbl <span style={{ fontSize: '8px' }}>▼</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{ color: '#eaecef', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '500' }}
                onClick={() => {
                  const usdt = wallets['USDT'] || 0;
                  if (tradeType === 'Market') {
                    setBuyTotalInput(usdt.toFixed(2)); setBuyPct(100);
                  } else {
                    const lp = parseFloat(priceInput) || ticker.price;
                    if (lp > 0) { setBuyAmountInput((usdt / lp).toFixed(6)); setBuyPct(100); }
                  }
                }}
              >
                {(wallets['USDT'] || 0).toFixed(8)} USDT
              </span>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#f0b90b',
                color: '#1e2026',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                userSelect: 'none',
              }}>
                +
              </div>
            </div>
          </div>

          {/* Max Buy line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', cursor: 'pointer' }}>Max Buy</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '500' }}>
              {ticker.price > 0 ? ((wallets['USDT'] || 0) / ticker.price).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : '0'} {baseAsset}
            </span>
          </div>

          {/* Est. Fee line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', borderBottom: '1px dotted #848e9c', cursor: 'pointer', paddingBottom: '1px' }}>Est. Fee</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '500' }}>0.1%</span>
          </div>
        </div>

        <button
          onClick={() => handleOrderSubmit('BUY')} disabled={submitting}
          style={{
            backgroundColor: '#0ecb81',
            border: 'none',
            color: '#fff',
            padding: '12px',
            borderRadius: '4px',
            fontWeight: '700',
            fontSize: '14px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'background 0.15s',
            marginTop: '8px',
          }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#0db572'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0ecb81'; }}
        >
          {submitting ? 'Placing...' : `Buy ${baseAsset}`}
        </button>
      </div>
    );
  };

  const renderSellForm = (isMobile = false) => {
    return (
      <div style={{ backgroundColor: 'var(--bg-secondary)', padding: isMobile ? '8px 0' : '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Price field */}
        <div style={{
          backgroundColor: '#2b3139',
          borderRadius: '4px',
          padding: '10px 14px',
          border: '1px solid #474f59',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#848e9c', minWidth: '40px' }}>Price</span>
          {tradeType === 'Market' ? (
            <span style={{ fontSize: '14px', color: '#5e6673', fontWeight: '500' }}>Market Price</span>
          ) : (
            <input
              type="number"
              value={priceInput}
              onChange={e => setPriceInput(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                textAlign: 'right',
                color: '#eaecef',
                fontSize: '14px',
                fontWeight: '600',
                padding: 0
              }}
            />
          )}
          {!isMobile && tradeType !== 'Market' && (
            <span style={{ fontSize: '14px', color: '#848e9c', marginLeft: '4px' }}>USDT</span>
          )}
        </div>

        {/* Amount — always coin qty for sell */}
        <div style={{
          backgroundColor: '#2b3139',
          borderRadius: '4px',
          padding: '10px 14px',
          border: '1px solid #474f59',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px', color: '#848e9c', minWidth: '40px' }}>Amount</span>
          <input
            type="number"
            value={sellAmountInput}
            onChange={e => setSellAmountInput(e.target.value)}
            placeholder="0.00"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              textAlign: 'right',
              color: '#eaecef',
              fontSize: '14px',
              fontWeight: '600',
              padding: 0
            }}
          />
          <span style={{ fontSize: '14px', color: '#eaecef', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
            {baseAsset} ▾
          </span>
        </div>

        {/* Slider — sets percentage of available base coin */}
        <BinanceSlider value={sellPct} onChange={v => {
          setSellPct(v);
          const coinBal = wallets[baseAsset] || 0;
          setSellAmountInput(((v / 100) * coinBal).toFixed(6));
        }} color="#f6465d" />

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#848e9c', cursor: 'pointer', userSelect: 'none', marginTop: '4px' }}>
          <input type="checkbox" style={{
            accentColor: '#f0b90b',
            width: '14px',
            height: '14px',
            cursor: 'pointer',
          }} />
          Slippage Tolerance
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {/* Available balance line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', userSelect: 'none' }}>
              Avbl <span style={{ fontSize: '8px' }}>▼</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{ color: '#eaecef', cursor: 'pointer', fontFamily: 'monospace', fontWeight: '500' }}
                onClick={() => { setSellAmountInput((wallets[baseAsset] || 0).toFixed(6)); setSellPct(100); }}
              >
                {(wallets[baseAsset] || 0).toFixed(8)} {baseAsset}
              </span>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#f0b90b',
                color: '#1e2026',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                userSelect: 'none',
              }}>
                +
              </div>
            </div>
          </div>

          {/* Max Sell line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', cursor: 'pointer' }}>Max Sell</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '500' }}>
              ≈ {((wallets[baseAsset] || 0) * (tradeType === 'Market' ? ticker.price : (parseFloat(priceInput) || ticker.price))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </span>
          </div>

          {/* Est. Fee line */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: '#848e9c', borderBottom: '1px dotted #848e9c', cursor: 'pointer', paddingBottom: '1px' }}>Est. Fee</span>
            <span style={{ color: '#eaecef', fontFamily: 'monospace', fontWeight: '500' }}>0.1%</span>
          </div>
        </div>

        <button
          onClick={() => handleOrderSubmit('SELL')} disabled={submitting}
          style={{
            backgroundColor: '#f6465d',
            border: 'none',
            color: '#fff',
            padding: '12px',
            borderRadius: '4px',
            fontWeight: '700',
            fontSize: '14px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            width: '100%',
            transition: 'background 0.15s',
            marginTop: '8px',
          }}
          onMouseEnter={e => { if (!submitting) e.currentTarget.style.backgroundColor = '#d63850'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f6465d'; }}
        >
          {submitting ? 'Placing...' : `Sell ${baseAsset}`}
        </button>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Header bar stats */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '40px',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CoinIcon coin={baseAsset} size={24} />
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{baseAsset}</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/USDT</span>
        </div>

        <div>
          <div
            key={`hdr-${activePriceDirection}-${ticker.price}`}
            className={activePriceDirection === 'up' ? 'price-header-up' : activePriceDirection === 'down' ? 'price-header-down' : ''}
            style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {fmt(ticker.price, { minDecimals: 2, maxDecimals: 4 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Last Price
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
            {isPositive ? '+' : ''}{ticker.change?.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            24h Change
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {fmt(ticker.high, { minDecimals: 2, maxDecimals: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            24h High
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {fmt(ticker.low, { minDecimals: 2, maxDecimals: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            24h Low
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
            {ticker.volume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            24h Volume({baseAsset})
          </div>
        </div>
      </div>

      {/* Main trading terminal grid */}
      <div className="trading-grid">
        
        {/* Left Column: Order Book */}
        <div className="trading-left-col">
          <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '12px' }}>Order Book</h3>
          
          {/* Asks (Sells) - Red */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'flex-end', gap: '3px', marginBottom: '8px' }}>
            {orderBook.asks?.slice(0, 10).map((ask, idx) => (
              <div
                key={`ask-${idx}`}
                onClick={() => setPriceInput(ask.price?.toFixed(2))}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', transition: 'background-color 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: 'var(--danger)' }}>{ask.price?.toFixed(2)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{ask.amount?.toFixed(4)}</span>
                <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{(ask.price * ask.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Current Spread Price */}
          <div style={{
            borderTop: '1px solid var(--border-color)',
            borderBottom: '1px solid var(--border-color)',
            padding: '8px 0',
            margin: '8px 0',
            textAlign: 'center',
          }}>
            <span
              key={`spread-${activePriceDirection}-${ticker.price}`}
              className={activePriceDirection === 'up' ? 'price-flash-up' : activePriceDirection === 'down' ? 'price-flash-down' : ''}
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)',
                display: 'inline-block',
              }}
            >
              ${ticker.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {currency !== 'USD' && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                ≈ {fmt(ticker.price)}
              </div>
            )}
          </div>

          {/* Bids (Buys) - Green */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {orderBook.bids?.slice(0, 10).map((bid, idx) => (
              <div
                key={`bid-${idx}`}
                onClick={() => setPriceInput(bid.price?.toFixed(2))}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', cursor: 'pointer', padding: '2px 4px', borderRadius: '4px', transition: 'background-color 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ color: 'var(--success)' }}>{bid.price?.toFixed(2)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{bid.amount?.toFixed(4)}</span>
                <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{(bid.price * bid.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Center Column: Chart & Trading Forms */}
        <div className="trading-center-col">
          {/* Chart — toolbar is built inside TradingViewChart */}
          <div style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
            <TradingViewChart symbol={pair} />
          </div>

          {/* ── Binance-style Buy / Sell Panel ── */}
          <div style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {/* Row 1: Spot / Cross / Isolated / Grid + Fee badge */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 16px', borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex' }}>
                {['Spot', 'Cross', 'Isolated', 'Grid'].map(mode => {
                  const isAct = tradeMode === mode;
                  return (
                    <button key={mode} onClick={() => setTradeMode(mode)} style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: isAct ? '2.5px solid #f0b90b' : '2.5px solid transparent',
                      color: isAct ? '#eaecef' : '#848e9c',
                      fontWeight: isAct ? '700' : '500',
                      fontSize: '14px',
                      padding: '14px 12px 11px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}>
                      {mode}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Yellow badge with serrated badge percent SVG */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid #f0b90b',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: '#f0b90b',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'rgba(240, 185, 11, 0.06)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f0b90b" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M12 2l1.5 1.5L15.5 3l1 2 2 .5.5 2 2 1v2.5l-1 2 1 2v2.5l-2 1-.5 2-2 .5-1 2-2-1-1.5 1.5L12 22l-1.5-1.5L8.5 21l-1-2-2-.5-.5-2-2-1v-2.5l1-2-1-2v-2.5l2-1 .5-2 2-.5 1-2 2 1 1.5-1.5z" fill="rgba(240, 185, 11, 0.1)"/>
                    <path d="M15 9l-6 6M9.5 9.5h.01M14.5 14.5h.01" stroke="#f0b90b" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  0% trading fee on this pair
                </div>
                <span style={{
                  fontSize: '12px',
                  color: '#848e9c',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <line x1="19" y1="5" x2="5" y2="19" />
                    <circle cx="6.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                  Fee Level
                </span>
              </div>
            </div>

            {/* Row 2: Limit / Market / Stop Limit */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {['Limit', 'Market', 'Stop Limit'].map(type => {
                  const isAct = tradeType === type;
                  return (
                    <button key={type} onClick={() => setTradeType(type)} style={{
                      background: 'none',
                      border: 'none',
                      color: isAct ? '#eaecef' : '#848e9c',
                      fontWeight: isAct ? '700' : '500',
                      fontSize: '13px',
                      padding: '4px 0',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                      {type}{type === 'Stop Limit' ? ' ▾' : ''}
                    </button>
                  );
                })}
                {/* Clean Info Icon */}
                <span style={{
                  fontSize: '12px',
                  color: '#848e9c',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '1px solid #848e9c',
                  fontWeight: '600',
                  lineHeight: 1
                }}>i</span>
              </div>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <span style={{
                  fontSize: '12px',
                  color: '#848e9c',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Recurring
                </span>
                <span style={{
                  fontSize: '12px',
                  color: '#848e9c',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  Buy with EUR
                </span>
              </div>
            </div>

            {orderSuccess && <div style={{ color: 'var(--success)', fontSize: '12px', padding: '6px 16px', backgroundColor: 'rgba(14,203,129,0.08)' }}>{orderSuccess}</div>}
            {orderError && <div style={{ color: 'var(--danger)', fontSize: '12px', padding: '6px 16px', backgroundColor: 'rgba(246,70,93,0.08)' }}>{orderError}</div>}

            {/* Desktop View: Side-by-side forms */}
            <div className="desktop-only" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-color)' }}>
              {renderBuyForm(false)}
              {renderSellForm(false)}
            </div>

            {/* Mobile View: Toggle tabs + 60/40 Split Form & Compact Order Book */}
            <div className="mobile-only" style={{ flexDirection: 'column', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', width: '100%', boxSizing: 'border-box' }}>
              
              {/* Buy / Sell Tabs */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', width: '100%' }}>
                <button
                  onClick={() => setMobileTradeSide('BUY')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    backgroundColor: mobileTradeSide === 'BUY' ? '#0ecb81' : 'var(--bg-tertiary)',
                    color: mobileTradeSide === 'BUY' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                    border: 'none',
                    outline: 'none',
                  }}
                >
                  Buy
                </button>
                <button
                  onClick={() => setMobileTradeSide('SELL')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    backgroundColor: mobileTradeSide === 'SELL' ? '#f6465d' : 'var(--bg-tertiary)',
                    color: mobileTradeSide === 'SELL' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                    border: 'none',
                    outline: 'none',
                  }}
                >
                  Sell
                </button>
              </div>

              {/* Grid split: 60% Form, 40% Order Book */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '14px', alignItems: 'start', width: '100%' }}>
                
                {/* Form (60%) */}
                <div style={{ overflow: 'hidden' }}>
                  {mobileTradeSide === 'BUY' ? renderBuyForm(true) : renderSellForm(true)}
                </div>

                {/* Compact Order Book (40%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', justifyContent: 'space-between', overflow: 'hidden' }}>
                  
                  {/* Asks (Red) */}
                  <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px' }}>
                    {orderBook.asks?.slice(0, 5).map((ask, idx) => (
                      <div
                        key={`mob-ask-${idx}`}
                        onClick={() => setPriceInput(ask.price?.toFixed(2))}
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', transition: 'background-color 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ color: 'var(--danger)', fontWeight: '500' }}>{ask.price?.toFixed(2)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{ask.amount?.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Spread Price & Conversion */}
                  <div style={{
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '6px 0',
                    margin: '6px 0',
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: ticker.change >= 0 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {ticker.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {currency !== 'USD' && (
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        ≈ {fmt(ticker.price)}
                      </div>
                    )}
                  </div>

                  {/* Bids (Green) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {orderBook.bids?.slice(0, 5).map((bid, idx) => (
                      <div
                        key={`mob-bid-${idx}`}
                        onClick={() => setPriceInput(bid.price?.toFixed(2))}
                        style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', borderRadius: '3px', transition: 'background-color 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ color: 'var(--success)', fontWeight: '500' }}>{bid.price?.toFixed(2)}</span>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{bid.amount?.toFixed(3)}</span>
                      </div>
                    ))}
                  </div>

                </div>

              </div>

            </div>
          </div>
        </div>

        {/* Right Column: Watchlist & Recent Trades */}
        <div className="trading-right-col">
          {/* Watchlist */}
          <div style={{
            height: '420px',
            display: 'flex',
            flexDirection: 'column',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            marginBottom: '12px'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Search Pair..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  paddingLeft: '32px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <span style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}>
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Market Tabs */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', overflowX: 'auto' }}>
              {['★', 'USDT', 'Layer 1', 'Memes'].map((tab) => {
                const tabValue = tab === 'Layer 1' ? 'L1' : tab === 'Memes' ? 'MEME' : tab;
                const isAct = activeMarketTab === tabValue;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveMarketTab(tabValue)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isAct ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isAct ? 'bold' : 'normal',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                      whiteSpace: 'nowrap',
                      borderBottom: isAct ? '2px solid var(--primary)' : 'none'
                    }}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Headers with Sort Indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', padding: '6px 4px', borderBottom: '1px solid var(--border-color)' }}>
              <div onClick={() => handleSort('pair')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '38%' }}>
                Pair {sortKey === 'pair' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
              <div onClick={() => handleSort('price')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '32%', justifyContent: 'flex-end', textAlign: 'right' }}>
                Price {sortKey === 'price' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
              <div onClick={() => handleSort('change')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', width: '30%', justifyContent: 'flex-end', textAlign: 'right' }}>
                Change {sortKey === 'change' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </div>
            </div>

            {/* Pairs List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
              {getFilteredTickers().length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                  No pairs found.
                </div>
              ) : (
                getFilteredTickers().map((w) => {
                  const isPositive = w.change >= 0;
                  const isFav = favorites.includes(w.symbol);
                  const isCurrent = w.symbol === pair;
                  const direction = priceDirections[w.symbol];

                  return (
                    <div
                      key={w.symbol}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 4px',
                        borderRadius: '4px',
                        backgroundColor: isCurrent ? 'var(--bg-tertiary)' : 'transparent',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onClick={() => router.push(`/trade/${w.symbol}`)}
                    >
                      {/* Pair Symbol & Favorite Star */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '38%', overflow: 'hidden' }}>
                        <span
                          onClick={(e) => toggleFavorite(w.symbol, e)}
                          style={{
                            color: isFav ? 'var(--primary)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            userSelect: 'none'
                          }}
                        >
                          {isFav ? '★' : '☆'}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', display: 'flex', alignItems: 'baseline', gap: '2px', whiteSpace: 'nowrap' }}>
                          {w.baseAsset}
                          <span style={{ color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 'normal' }}>/USDT</span>
                        </span>
                      </div>

                      {/* Price with flash animation */}
                      <div style={{ width: '32%', textAlign: 'right', fontFamily: 'monospace' }}>
                        <span
                          key={`${w.symbol}-${direction}-${w.price}`}
                          className={direction === 'up' ? 'watchlist-price-up' : direction === 'down' ? 'watchlist-price-down' : ''}
                          style={{ color: direction ? undefined : 'var(--text-primary)' }}
                        >
                          {w.price < 1 ? w.price?.toFixed(4) : w.price?.toFixed(2)}
                        </span>
                      </div>

                      {/* 24h Change */}
                      <div style={{ color: isPositive ? 'var(--success)' : 'var(--danger)', width: '30%', textAlign: 'right', fontWeight: '500', fontFamily: 'monospace' }}>
                        {isPositive ? '+' : ''}{w.change?.toFixed(2)}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Trades */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '12px' }}>Recent Trades</h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {trades.slice(0, 30).map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: t.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{t.price?.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.amount?.toFixed(4)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(t.time).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── Bottom Tabbed Orders Panel (Binance-style) ── */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
        {/* Tab Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 16px',
          gap: '4px',
        }}>
          {['Open Orders', 'Order History'].map(tab => {
            const isTab = (tab === 'Open Orders' ? 'OPEN' : 'HISTORY') === (bottomTab || 'OPEN');
            return (
              <button
                key={tab}
                onClick={() => setBottomTab(tab === 'Open Orders' ? 'OPEN' : 'HISTORY')}
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: isTab ? '600' : '400',
                  color: isTab ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: isTab ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                {tab}
                {tab === 'Open Orders' && userOrders.length > 0 && (
                  <span style={{
                    marginLeft: '6px',
                    backgroundColor: 'var(--primary)',
                    color: '#000',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 6px',
                  }}>
                    {userOrders.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div style={{ overflowX: 'auto', minHeight: '120px' }}>
          {(bottomTab === 'OPEN' || !bottomTab) && (
            userOrders.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.4">
                  <rect x="8" y="12" width="32" height="4" rx="2" fill="currentColor"/>
                  <rect x="8" y="22" width="24" height="4" rx="2" fill="currentColor"/>
                  <rect x="8" y="32" width="16" height="4" rx="2" fill="currentColor"/>
                </svg>
                No open orders
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Date', 'Pair', 'Type', 'Side', 'Price', 'Amount', 'Filled', 'Action'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userOrders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', fontWeight: '600' }}>{order.pair}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{order.type}</td>
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{order.side}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(4)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.filled?.toFixed(4)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          style={{
                            padding: '4px 12px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)',
                            borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--danger)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--danger)'; }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {bottomTab === 'HISTORY' && (
            orderHistory.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.4">
                  <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                  <path d="M24 14v10l6 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                No order history
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Date', 'Pair', 'Type', 'Side', 'Price', 'Amount', 'Filled', 'Status'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', fontWeight: '600' }}>{order.pair}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{order.type}</td>
                      <td style={{ padding: '10px 16px', fontWeight: '600', color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)' }}>{order.side}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(4)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.filled?.toFixed(4)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: order.status === 'FILLED' ? 'rgba(14,203,129,0.12)' : order.status === 'CANCELLED' ? 'rgba(246,70,93,0.12)' : 'rgba(240,185,11,0.12)',
                          color: order.status === 'FILLED' ? 'var(--success)' : order.status === 'CANCELLED' ? 'var(--danger)' : 'var(--primary)',
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
