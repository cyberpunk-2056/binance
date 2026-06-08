'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';
import { subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';

const COIN_FULL_NAMES = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  BNB: 'BNB',
  SOL: 'Solana',
  ADA: 'Cardano',
  XRP: 'XRP',
  DOT: 'Polkadot',
  AVAX: 'Avalanche',
  DOGE: 'Dogecoin',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  LTC: 'Litecoin',
  MATIC: 'Polygon',
  NEAR: 'Near Protocol',
  PEPE: 'Pepe',
  SHIB: 'Shiba Inu',
};

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { fmt, currency, rates } = useCurrency();
  const router = useRouter();

  // Landing states
  const [tickers, setTickers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Logged-in dashboard states
  const [wallets, setWallets] = useState([]);
  const [prices, setPrices] = useState({});
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('Hot'); // Favorites, Hot, New, Gainers, Volume
  const [cryptoToggle, setCryptoToggle] = useState('Crypto'); // Crypto, Futures
  const [watchlist, setWatchlist] = useState([]);
  const [searchVal, setSearchVal] = useState('');

  // Load Watchlist from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Fetch initial tickers
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await api.get('/markets/tickers');
        setTickers(res.data.tickers || []);
        
        const pricesMap = {};
        res.data.tickers.forEach(t => {
          pricesMap[t.symbol] = t.price;
        });
        setPrices(pricesMap);
      } catch (err) {
        console.error('Error fetching tickers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickers();

    // Subscribe to live updates
    const unsubscribe = subscribeToAllTickers((update) => {
      setTickers((prev) =>
        prev.map((t) => (t.symbol === update.symbol ? { ...t, ...update } : t))
      );
      setPrices(prev => ({
        ...prev,
        [update.symbol]: update.price
      }));
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch Wallets for logged-in user
  useEffect(() => {
    if (!user) return;
    const fetchWallets = async () => {
      try {
        const res = await api.get('/wallet');
        setWallets(res.data.wallets || []);
      } catch (err) {
        console.error('Error fetching wallets:', err);
      }
    };
    fetchWallets();
  }, [user]);

  // Calculate portfolio balance & 24h PNL
  let totalUSD = 0;
  let prevUSD = 0;
  wallets.forEach(w => {
    const coinPrice = w.coin === 'USDT' ? 1 : (prices[`${w.coin}USDT`] || 0);
    const coinTicker = tickers.find(t => t.symbol === `${w.coin}USDT`);
    const coinChg = coinTicker ? coinTicker.change : 0;
    
    const balanceVal = w.balance;
    const currentVal = balanceVal * coinPrice;
    totalUSD += currentVal;

    const prevPrice = coinPrice / (1 + coinChg / 100);
    const prevVal = balanceVal * prevPrice;
    prevUSD += prevVal;
  });

  const pnlUSD = totalUSD - prevUSD;
  const pnlPercent = prevUSD > 0 ? (pnlUSD / prevUSD) * 100 : 0;

  // Toggle watchlist helper
  const toggleWatchlist = (symbol, e) => {
    e.stopPropagation();
    e.preventDefault();
    let updated;
    if (watchlist.includes(symbol)) {
      updated = watchlist.filter(s => s !== symbol);
    } else {
      updated = [...watchlist, symbol];
    }
    setWatchlist(updated);
    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  // Filter lists based on tab choice
  const getFilteredTickers = () => {
    let list = [...tickers];
    if (searchVal.trim() !== '') {
      const q = searchVal.toLowerCase();
      list = list.filter(t => t.symbol.toLowerCase().includes(q) || (COIN_FULL_NAMES[t.baseAsset] || '').toLowerCase().includes(q));
    }

    if (activeTab === 'Favorites') {
      return list.filter(t => watchlist.includes(t.symbol));
    } else if (activeTab === 'Hot') {
      return list.filter(t => ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'].includes(t.symbol));
    } else if (activeTab === 'New') {
      return list.filter(t => ['SOLUSDT', 'AVAXUSDT', 'DOGEUSDT'].includes(t.symbol));
    } else if (activeTab === 'Gainers') {
      return list.sort((a, b) => b.change - a.change).slice(0, 8);
    } else if (activeTab === 'Volume') {
      return list.sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, 8);
    }
    return list;
  };

  if (authLoading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        Loading Binance...
      </div>
    );
  }

  // LOGGED-IN: Render full Binance mobile/desktop dashboard mockup
  if (user) {
    const listToRender = getFilteredTickers();
    const isPnlPositive = pnlUSD >= 0;

    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />

        <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '24px 16px 80px' }}>
          {/* Header Area with Search & Profile */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
              fontWeight: '700', cursor: 'pointer'
            }} onClick={() => router.push('/profile')}>
              {user.username ? user.username[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            
            {/* Search inputs matching "SEI hot search" banner */}
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="🔥 Search coin, pair, and trend..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                style={{
                  width: '100%', padding: '12px 16px 12px 40px', backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: '24px', color: 'var(--text-primary)',
                  fontSize: '14px', outline: 'none'
                }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: '16px', top: '14px' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px' }} className="grid-split-2-1">
            
            {/* Balance + Actions Card */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>
                <span>Est. Total Value ({currency})</span>
                <button onClick={() => setBalanceVisible(!balanceVisible)} style={{ background: 'none', color: 'var(--text-secondary)', fontSize: '16px', display: 'flex', alignItems: 'center' }}>
                  {balanceVisible ? '👁️' : '🙈'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {balanceVisible ? fmt(totalUSD) : '••••••'}
                  <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500' }}>{currency}</span>
                </div>
                <button onClick={() => router.push('/wallet')} className="btn-primary" style={{ padding: '10px 24px', borderRadius: '20px', fontSize: '14px', fontWeight: '700' }}>
                  Add Funds
                </button>
              </div>

              {/* 24h PNL row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Today's PNL:</span>
                <span style={{ color: isPnlPositive ? 'var(--success)' : 'var(--red)', fontWeight: '700' }}>
                  {isPnlPositive ? '+' : ''}{balanceVisible ? fmt(pnlUSD) : '••••'} ({isPnlPositive ? '+' : ''}{pnlPercent.toFixed(2)}%)
                </span>
                <span style={{ color: isPnlPositive ? 'var(--success)' : 'var(--red)' }}>
                  {isPnlPositive ? '▲' : '▼'}
                </span>
              </div>

              {/* Shortcuts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '28px', textAlign: 'center' }}>
                <Link href="/wallet" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💰</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Assets</span>
                </Link>
                <Link href="/trade/BTCUSDT" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🔄</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Convert</span>
                </Link>
                <Link href="/p2p" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>👥</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>P2P</span>
                </Link>
                <Link href="/markets" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📈</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Markets</span>
                </Link>
                <Link href="/profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>⚙️</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>Profile</span>
                </Link>
              </div>
            </div>

            {/* P2P Quick Cards / Recommend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', cursor: 'pointer' }} onClick={() => router.push('/p2p')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <strong>P2P Desk</strong>
                  <span>➔</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>Buy/Sell Crypto with {currency}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>UPI, Bank Transfer, PayPal</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', cursor: 'pointer' }} onClick={() => router.push('/trade/BTCUSDT')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <strong>Instant Convert</strong>
                  <span>➔</span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>Zero-fee conversions</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ref Rate: {fmt(prices['BTCUSDT'] || 65000)} / BTC</div>
              </div>
            </div>
          </div>

          {/* Market Tab Row */}
          <div style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              {['Favorites', 'Hot', 'New', 'Gainers', 'Volume'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    paddingBottom: '12px', fontSize: '15px', fontWeight: '700',
                    color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'none', cursor: 'pointer'
                  }}
                >
                  {tab === 'New' ? 'New Listings' : tab === 'Gainers' ? 'Top Gainers' : tab === 'Volume' ? 'Top Volume' : tab}
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', padding: '2px', marginLeft: '12px' }}>
              {['Crypto', 'Futures'].map(t => (
                <button
                  key={t}
                  onClick={() => setCryptoToggle(t)}
                  style={{
                    padding: '4px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '10px',
                    backgroundColor: cryptoToggle === t ? 'var(--bg-tertiary)' : 'transparent',
                    color: cryptoToggle === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: 'none', cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Live Markets List */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
            {listToRender.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No markets found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      <th style={{ padding: '12px 20px' }}>Name</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>Last Price</th>
                      <th style={{ padding: '12px 20px', textAlign: 'right' }}>24h chg%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listToRender.map(coin => {
                      const isFav = watchlist.includes(coin.symbol);
                      const isPos = coin.change >= 0;
                      return (
                        <tr
                          key={coin.symbol}
                          onClick={() => router.push(`/trade/${coin.symbol}`)}
                          style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                onClick={(e) => toggleWatchlist(coin.symbol, e)}
                                style={{ color: isFav ? 'var(--primary)' : 'var(--text-muted)', fontSize: '16px', cursor: 'pointer' }}
                              >
                                {isFav ? '★' : '☆'}
                              </span>
                              <CoinIcon coin={coin.baseAsset} size={22} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>{coin.baseAsset}</strong>
                                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>/USDT</span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{COIN_FULL_NAMES[coin.baseAsset] || coin.baseAsset}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                {fmt(coin.price, { minDecimals: 2 })}
                              </span>
                              {currency !== 'USD' && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  ${coin.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <span style={{
                              color: isPos ? 'var(--success)' : 'var(--danger)',
                              backgroundColor: isPos ? 'rgba(14, 203, 129, 0.12)' : 'rgba(246, 70, 93, 0.12)',
                              padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', display: 'inline-block', minWidth: '70px', textAlign: 'center'
                            }}>
                              {isPos ? '+' : ''}{coin.change?.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // VISITORS: Render the premium hero landing page
  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      {/* Hero Section */}
      <section style={{
        padding: '80px 24px',
        background: 'radial-gradient(circle at top right, rgba(240, 185, 11, 0.1), transparent 50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: '800',
          color: 'var(--text-primary)',
          lineHeight: '1.2',
          marginBottom: '20px',
          maxWidth: '800px'
        }}>
          Buy, Trade, and Hold Cryptocurrencies on <span style={{ color: 'var(--primary)' }}>Binance</span>
        </h1>
        <p style={{
          fontSize: '18px',
          color: 'var(--text-secondary)',
          marginBottom: '40px',
          maxWidth: '600px',
          lineHeight: '1.6'
        }}>
          Experience the ultimate simulated cryptocurrency trading terminal. Real-time TradingView charts, instant spot orders, P2P Escrow desk, and detailed portfolios.
        </p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '60px' }}>
          <Link href="/register" className="btn-primary" style={{ padding: '12px 32px', fontSize: '16px', textDecoration: 'none', borderRadius: '4px' }}>
            Get Started
          </Link>
          <Link href="/trade/BTCUSDT" className="btn-secondary" style={{ padding: '12px 32px', fontSize: '16px', textDecoration: 'none', borderRadius: '4px' }}>
            Trade Now
          </Link>
        </div>

        {/* Live Top Coins Grid */}
        <div style={{ width: '100%', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '24px', textAlign: 'left' }}>Trending Markets</h2>
          
          {loading ? (
            <div style={{ color: 'var(--text-secondary)' }}>Loading markets...</div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              width: '100%'
            }}>
              {tickers.slice(0, 6).map((coin) => {
                const isPositive = coin.change >= 0;
                return (
                  <Link href={`/trade/${coin.symbol}`} key={coin.symbol} style={{ textDecoration: 'none' }}>
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <CoinIcon coin={coin.baseAsset} size={20} />
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{coin.baseAsset}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/USDT</span>
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {fmt(coin.price, { minDecimals: 2 })}
                        </div>
                      </div>
                      <div style={{
                        color: isPositive ? 'var(--success)' : 'var(--danger)',
                        fontWeight: '600',
                        fontSize: '14px',
                        backgroundColor: isPositive ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '4px'
                      }}>
                        {isPositive ? '+' : ''}{coin.change?.toFixed(2)}%
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '80px 24px',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '60px' }}>
            Why Trade on Binance?
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '40px'
          }}>
            <div style={{ textBottom: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>⚡</div>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px' }}>Real-time WS Engine</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Powered by direct Binance WebSocket streams. Instant price updates, sub-second candle feeds, and millisecond trade tracking.
              </p>
            </div>
            <div style={{ textBottom: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>🛡️</div>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px' }}>P2P Escrow Workspace</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Buy and sell crypto directly with other users via peer-to-peer advertisements. Interactive live chat and secure escrow workflow.
              </p>
            </div>
            <div style={{ textBottom: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '20px' }}>📊</div>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px' }}>Advanced Candlesticks</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                State-of-the-art interactive charts powered by Lightweight Charts. Draw, analyze, switch timeframes, and inspect metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
