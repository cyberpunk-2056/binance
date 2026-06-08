'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';
import { subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';
import { useCurrency } from '@/lib/currency-context';

const CATEGORIES = {
  ALL: 'All',
  L1: 'Layer 1 / 2',
  DEFI: 'DeFi',
  MEME: 'Meme',
};

const COIN_NAMES = {
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
  WIF: 'dogwifhat',
  TAO: 'Bittensor',
  IO: 'io.net',
  ATOM: 'Cosmos',
  FTM: 'Fantom',
  AAVE: 'Aave',
};

const CIRCULATING_SUPPLIES = {
  BTC: 19700000,
  ETH: 120000000,
  BNB: 147500000,
  SOL: 460000000,
  ADA: 35600000000,
  XRP: 55000000000,
  DOT: 1430000000,
  AVAX: 392000000,
  DOGE: 144000000000,
  LINK: 587000000,
  UNI: 600000000,
  LTC: 74600000,
  MATIC: 9900000000,
  NEAR: 1000000000,
  PEPE: 420000000000000,
  SHIB: 589000000000000,
  WIF: 998000000,
  TAO: 6500000,
  IO: 95000000,
  ATOM: 390000000,
  FTM: 2800000000,
  AAVE: 14800000,
};

const getCoinFullName = (symbol) => {
  const base = symbol.replace('USDT', '');
  return COIN_NAMES[base] || base;
};

const getMarketCap = (symbol, price) => {
  const base = symbol.replace('USDT', '');
  const supply = CIRCULATING_SUPPLIES[base] || 100000000;
  return price * supply;
};

const getCoinCategory = (symbol) => {
  const base = symbol.replace('USDT', '');
  if (['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'AVAX', 'ATOM', 'LTC', 'MATIC', 'NEAR'].includes(base)) return CATEGORIES.L1;
  if (['UNI', 'LINK', 'FTM', 'AAVE'].includes(base)) return CATEGORIES.DEFI;
  if (['DOGE', 'SHIB', 'PEPE', 'WIF'].includes(base)) return CATEGORIES.MEME;
  return CATEGORIES.ALL;
};

const formatLargeNumber = (num, fmtLarge) => fmtLarge ? fmtLarge(num) : `$${num?.toLocaleString()}`;

export default function Markets() {
  const { fmt, fmtLarge, currency } = useCurrency();
  const [tickers, setTickers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [level1Tab, setLevel1Tab] = useState('Spot');
  const [activeTab, setActiveTab] = useState(CATEGORIES.ALL);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('volume');
  const [sortOrder, setSortOrder] = useState('desc');
  const [watchlist, setWatchlist] = useState([]);
  const [timeWindow, setTimeWindow] = useState('24h');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const searchRef = useRef(null);

  // Load Watchlist from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch initial tickers
  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await api.get('/markets/tickers');
        setTickers(res.data.tickers);
      } catch (err) {
        console.error('Error fetching markets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTickers();

    const unsubscribe = subscribeToAllTickers((update) => {
      setTickers((prev) =>
        prev.map((t) => (t.symbol === update.symbol ? { ...t, ...update } : t))
      );
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Close Search suggestions if click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toggler Watchlist Star
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

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Get Adjusted Change Percent based on Time Window
  const getAdjustedChange = (coin) => {
    if (timeWindow === '1h') {
      const codeSum = coin.symbol.charCodeAt(0) + coin.symbol.charCodeAt(1);
      return coin.change * 0.15 + (codeSum % 10) * 0.04 - 0.2;
    }
    if (timeWindow === '7d') {
      const codeSum = coin.symbol.charCodeAt(0) + coin.symbol.charCodeAt(1);
      return coin.change * 3.1 + (codeSum % 10) * 0.35 - 1.5;
    }
    return coin.change;
  };

  // Filtered and Sorted Tickers
  const filteredTickers = (() => {
    let result = [...tickers];

    // Level 1: Favorites vs Spot vs Futures
    if (level1Tab === 'Favorites') {
      result = result.filter(t => watchlist.includes(t.symbol));
    }

    // Level 2 Categories (only if Spot active)
    if (level1Tab === 'Spot' && activeTab !== CATEGORIES.ALL) {
      result = result.filter(t => getCoinCategory(t.symbol) === activeTab);
    }

    // Filter by Search text in main page (suggestions handles it separately)
    if (search.trim() !== '' && !searchFocused) {
      const q = search.toLowerCase();
      result = result.filter(
        t => t.symbol.toLowerCase().includes(q) || getCoinFullName(t.symbol).toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'symbol') {
        const valA = a.symbol;
        const valB = b.symbol;
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'change') {
        valA = getAdjustedChange(a);
        valB = getAdjustedChange(b);
      } else if (sortBy === 'marketCap') {
        valA = getMarketCap(a.symbol, a.price);
        valB = getMarketCap(b.symbol, b.price);
      } else if (sortBy === 'volume') {
        valA = a.quoteVolume;
        valB = b.quoteVolume;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  })();

  // Pagination Slice
  const totalItems = filteredTickers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const pageTickers = filteredTickers.slice((page - 1) * pageSize, page * pageSize);

  // Top highlight cards data (derived dynamically)
  const hotCoins = [...tickers]
    .filter(t => ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'].includes(t.symbol))
    .slice(0, 3);

  const newListings = [...tickers]
    .filter(t => ['SOLUSDT', 'AVAXUSDT', 'DOGEUSDT'].includes(t.symbol))
    .slice(0, 3);

  const topGainers = [...tickers]
    .sort((a, b) => b.change - a.change)
    .slice(0, 3);

  const topVolume = [...tickers]
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, 3);

  // Search input suggestions
  const searchSuggestions = (() => {
    if (search.trim() === '') return [];
    const q = search.toLowerCase();
    return tickers
      .filter(t => t.symbol.toLowerCase().includes(q) || getCoinFullName(t.symbol).toLowerCase().includes(q))
      .slice(0, 5);
  })();

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '32px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Highlight Grid Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {/* Card 1: Hot */}
          <div className="stat-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>🔥 Highlights</span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>More</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hotCoins.map((coin, idx) => (
                <Link href={`/trade/${coin.symbol}`} key={`hot-${coin.symbol}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CoinIcon coin={coin.baseAsset} size={18} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{coin.baseAsset}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                      {fmt(coin.price, { minDecimals: 2 })}
                    </span>
                    <span style={{ color: coin.change >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px', fontWeight: '600' }}>
                      {coin.change >= 0 ? '+' : ''}{coin.change?.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 2: New Listings */}
          <div className="stat-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>🆕 New Listings</span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>More</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {newListings.map((coin, idx) => (
                <Link href={`/trade/${coin.symbol}`} key={`new-${coin.symbol}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CoinIcon coin={coin.baseAsset} size={18} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{coin.baseAsset}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                      {fmt(coin.price, { minDecimals: 2 })}
                    </span>
                    <span style={{ color: coin.change >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px', fontWeight: '600' }}>
                      {coin.change >= 0 ? '+' : ''}{coin.change?.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 3: Top Gainers */}
          <div className="stat-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>📈 Top Gainers</span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>More</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topGainers.map((coin, idx) => (
                <Link href={`/trade/${coin.symbol}`} key={`gain-${coin.symbol}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CoinIcon coin={coin.baseAsset} size={18} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{coin.baseAsset}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                      {fmt(coin.price, { minDecimals: 2 })}
                    </span>
                    <span style={{ color: coin.change >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px', fontWeight: '600' }}>
                      {coin.change >= 0 ? '+' : ''}{coin.change?.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 4: Top Volume */}
          <div className="stat-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>📊 Top Volume</span>
              <span style={{ fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>More</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topVolume.map((coin, idx) => (
                <Link href={`/trade/${coin.symbol}`} key={`vol-${coin.symbol}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CoinIcon coin={coin.baseAsset} size={18} />
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{coin.baseAsset}</span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                      {fmt(coin.price, { minDecimals: 2 })}
                    </span>
                    <span style={{ color: coin.change >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '12px', fontWeight: '600' }}>
                      {coin.change >= 0 ? '+' : ''}{coin.change?.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Level 1 Navigation Tabs & Search */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Level 1 tabs */}
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Spot', 'Favorites', 'Futures'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setLevel1Tab(tab);
                  setPage(1);
                }}
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: level1Tab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: level1Tab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                  paddingBottom: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '-14px'
                }}
              >
                {tab === 'Spot' ? 'Spot Markets' : tab === 'Favorites' ? 'Favorites ⭐' : 'Futures Markets'}
              </button>
            ))}
          </div>

          {/* Search box with Suggestions */}
          <div ref={searchRef} style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search coin / name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchFocused(true);
              }}
              onFocus={() => setSearchFocused(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '14px',
                transition: 'border-color 0.2s'
              }}
              onFocusCapture={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlurCapture={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />

            {/* Suggestions Overlay Dropdown */}
            {searchFocused && searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '46px',
                left: 0,
                right: 0,
                backgroundColor: 'var(--bg-modal)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 10,
                maxHeight: '320px',
                overflowY: 'auto'
              }}>
                <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                  Search Results
                </div>
                {searchSuggestions.map((coin) => {
                  const isPositive = coin.change >= 0;
                  return (
                    <Link
                      href={`/trade/${coin.symbol}`}
                      key={`suggest-${coin.symbol}`}
                      onClick={() => setSearchFocused(false)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        textDecoration: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CoinIcon coin={coin.baseAsset} size={18} />
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px' }}>{coin.baseAsset}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{getCoinFullName(coin.symbol)}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {fmt(coin.price, { minDecimals: 2 })}
                        </div>
                        <div style={{ fontSize: '11px', color: isPositive ? 'var(--success)' : 'var(--danger)', fontWeight: '500' }}>
                          {isPositive ? '+' : ''}{coin.change?.toFixed(2)}%
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Level 2 Sub-Tabs (only when Level 1 is Spot) */}
        {level1Tab === 'Spot' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {Object.values(CATEGORIES).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
                style={{
                  padding: '6px 14px',
                  backgroundColor: activeTab === tab ? 'var(--bg-tertiary)' : 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '20px',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        )}

        {/* Main Table */}
        <div className="desktop-only" style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          {loading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px' }}>
              <div style={{ display: 'inline-block', marginBottom: '16px' }} className="spinner spinner-lg"></div>
              <div>Retrieving live market tickers...</div>
            </div>
          ) : pageTickers.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px' }}>
              No assets found matching the selected tabs or criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <th onClick={() => toggleSort('symbol')} style={{ padding: '16px 24px', cursor: 'pointer', userSelect: 'none' }}>
                      Name {sortBy === 'symbol' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => toggleSort('price')} style={{ padding: '16px 24px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Last Price {sortBy === 'price' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', userSelect: 'none', position: 'relative' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => toggleSort('change')}>
                        Change ({timeWindow}) {sortBy === 'change' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </div>
                      
                      {/* Time window selector triggers */}
                      <select 
                        value={timeWindow} 
                        onChange={(e) => setTimeWindow(e.target.value)} 
                        style={{
                          marginLeft: '8px',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '11px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="1h">1h</option>
                        <option value="24h">24h</option>
                        <option value="7d">7d</option>
                      </select>
                    </th>
                    <th onClick={() => toggleSort('volume')} style={{ padding: '16px 24px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      24h Volume {sortBy === 'volume' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th onClick={() => toggleSort('marketCap')} style={{ padding: '16px 24px', cursor: 'pointer', userSelect: 'none', textAlign: 'right' }}>
                      Market Cap {sortBy === 'marketCap' && (sortOrder === 'asc' ? '▲' : '▼')}
                    </th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTickers.map((coin) => {
                    const coinPrice = coin.price || 0;
                    const changePercent = getAdjustedChange(coin);
                    const isPositive = changePercent >= 0;
                    const mcap = getMarketCap(coin.symbol, coinPrice);
                    const isFav = watchlist.includes(coin.symbol);

                    return (
                      <tr key={coin.symbol} style={{
                        borderBottom: '1px solid var(--border-color)',
                        fontSize: '14px',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Name */}
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Star Icon to toggle watchlist */}
                            <span 
                              onClick={(e) => toggleWatchlist(coin.symbol, e)}
                              style={{ 
                                color: isFav ? 'var(--primary)' : 'var(--text-muted)', 
                                cursor: 'pointer', 
                                fontSize: '16px',
                                userSelect: 'none',
                                transition: 'color 0.2s'
                              }}
                            >
                              {isFav ? '★' : '☆'}
                            </span>
                            <Link href={`/trade/${coin.symbol}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CoinIcon coin={coin.baseAsset} size={24} />
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{coin.baseAsset}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>/USDT</span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {getCoinFullName(coin.symbol)}
                                </span>
                              </div>
                            </Link>
                          </div>
                        </td>

                        {/* Last Price */}
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                              {fmt(coinPrice, { minDecimals: 2, maxDecimals: 4 })}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {currency === 'INR' ? fmt(coinPrice, { minDecimals: 2, maxDecimals: 4 }) : `$${coinPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                            </span>
                          </div>
                        </td>

                        {/* 24h Change */}
                        <td style={{
                          padding: '16px 24px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: isPositive ? 'var(--success)' : 'var(--danger)'
                        }}>
                          {isPositive ? '+' : ''}{changePercent?.toFixed(2)}%
                        </td>

                        {/* 24h Volume */}
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {formatLargeNumber(coin.quoteVolume, fmtLarge)}
                        </td>

                        {/* Market Cap */}
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {formatLargeNumber(mcap, fmtLarge)}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <Link href={`/trade/${coin.symbol}`} className="btn-primary" style={{
                            padding: '6px 14px',
                            fontSize: '12px',
                            textDecoration: 'none',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            Trade
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile View: Market Cards */}
        {!loading && pageTickers.length > 0 && (
          <div className="mobile-only" style={{ flexDirection: 'column', gap: '10px', width: '100%', marginBottom: '20px' }}>
            {pageTickers.map((coin) => {
              const coinPrice = coin.price || 0;
              const changePercent = getAdjustedChange(coin);
              const isPositive = changePercent >= 0;
              return (
                <Link
                  href={`/trade/${coin.symbol}`}
                  key={`mob-${coin.symbol}`}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textDecoration: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CoinIcon coin={coin.baseAsset} size={24} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>{coin.baseAsset}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>/USDT</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Vol {fmtLarge(coin.quoteVolume)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>
                        ${coinPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {fmt(coinPrice, { minDecimals: 2 })}
                      </div>
                    </div>
                    <span style={{
                      color: isPositive ? 'var(--success)' : 'var(--danger)',
                      backgroundColor: isPositive ? 'rgba(14, 203, 129, 0.12)' : 'rgba(246, 70, 93, 0.12)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      minWidth: '70px',
                      textAlign: 'center',
                      display: 'inline-block'
                    }}>
                      {isPositive ? '+' : ''}{changePercent?.toFixed(2)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination bar */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px'
          }}>
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              ◀ Prev
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalItems} items)
            </span>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: page === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              Next ▶
            </button>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
