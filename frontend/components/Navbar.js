'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCurrency, CURRENCIES, LANGUAGES } from '@/lib/currency-context';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';

/* ─── Globe SVG icon (matches Binance style) ─── */
const GlobeIcon = ({ size = 20, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

/* ─── Scrollable column with search + list (used for both Language & Currency) ─── */
function PrefsColumn({ title, items, selectedCode, onSelect, searchVal, onSearch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
      {/* heading */}
      <div style={{ padding: '20px 20px 14px', fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
        {title}
      </div>

      {/* search */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '12px', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={searchVal}
            onChange={e => onSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 34px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
          />
        </div>
      </div>

      {/* list */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '0 8px 12px' }}>
        {items.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            No results
          </div>
        )}
        {items.map(item => {
          const isSelected = item.code === selectedCode;
          return (
            <button
              key={item.code}
              onClick={() => onSelect(item.code)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: isSelected ? '600' : '400',
                color: isSelected ? '#F0B90B' : 'var(--text-primary)',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { currency, setCurrency, language, setLanguage, fmt, getCurrencyInfo } = useCurrency();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [currSearch, setCurrSearch] = useState('');
  const prefRef = useRef(null);

  const isActive = (path) => pathname === path ? 'active' : '';
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);

  const [displayTickers, setDisplayTickers] = useState([
    { symbol: 'BTCUSDT', price: 68250.5, change: 2.45 },
    { symbol: 'ETHUSDT', price: 3820.75, change: -1.2 },
    { symbol: 'BNBUSDT', price: 595.2, change: 0.85 },
    { symbol: 'SOLUSDT', price: 168.45, change: 5.12 },
    { symbol: 'ADAUSDT', price: 0.475, change: -2.3 },
    { symbol: 'XRPUSDT', price: 0.518, change: 0.42 },
    { symbol: 'DOGEUSDT', price: 0.142, change: 8.75 },
    { symbol: 'DOTUSDT', price: 6.85, change: 1.15 },
    { symbol: 'AVAXUSDT', price: 33.15, change: -3.05 },
    { symbol: 'LINKUSDT', price: 16.4, change: 2.65 },
    { symbol: 'UNIUSDT', price: 7.85, change: -0.95 },
    { symbol: 'LTCUSDT', price: 82.5, change: 0.5 }
  ]);

  /* fetch initial tickers + subscribe to WS updates */
  useEffect(() => {
    if (isAuthPage) return;
    let active = true;
    const fetchInitialTickers = async () => {
      try {
        const res = await api.get('/markets/tickers');
        if (active) {
          const list = res.data.tickers || [];
          const targets = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'AVAXUSDT', 'DOGEUSDT', 'LINKUSDT', 'UNIUSDT', 'LTCUSDT'];
          const filtered = list.filter(t => targets.includes(t.symbol));
          if (filtered.length > 0) setDisplayTickers(filtered);
        }
      } catch (err) { console.error('Failed to load marquee tickers:', err); }
    };
    fetchInitialTickers();
    const unsubscribe = subscribeToAllTickers((update) => {
      if (!active) return;
      setDisplayTickers(prev => prev.map(t => (t.symbol === update.symbol ? { ...t, ...update } : t)));
    });
    return () => { active = false; if (unsubscribe) unsubscribe(); };
  }, [pathname, isAuthPage]);

  /* close prefs dropdown on outside click */
  useEffect(() => {
    const handleClick = (e) => {
      if (prefRef.current && !prefRef.current.contains(e.target)) {
        setPrefOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* filtered lists */
  const filteredLangs = LANGUAGES.filter(l => l.label.toLowerCase().includes(langSearch.toLowerCase()));
  const filteredCurrs = CURRENCIES.filter(c =>
    c.label.toLowerCase().includes(currSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(currSearch.toLowerCase())
  );

  const currInfo = getCurrencyInfo();
  const langInfo = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <>
      <header className="navbar-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: '64px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Left: logo + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link href="/" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--primary)">
              <path d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.716-2.716z" />
            </svg>
            <span>Binance</span>
          </Link>

          <nav className="desktop-nav" style={{ display: 'flex', gap: '20px' }}>
            <Link href="/markets" className={`nav-link ${isActive('/markets')}`} style={{ color: pathname === '/markets' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}>
              Markets
            </Link>
            <Link href="/trade/BTCUSDT" className={`nav-link ${pathname?.startsWith('/trade') ? 'active' : ''}`} style={{ color: pathname?.startsWith('/trade') ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}>
              Trade
            </Link>
            <Link href="/p2p" className={`nav-link ${isActive('/p2p')}`} style={{ color: pathname === '/p2p' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500', transition: 'color 0.2s' }}>
              P2P
            </Link>
          </nav>
        </div>

        {/* Right: user menu + globe button */}
        <div className="desktop-user-menu" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <>
              {user.role === 'ADMIN' && (
                <Link href="/admin" style={{ color: 'var(--warning)', textDecoration: 'none', fontSize: '14px', fontWeight: '600', border: '1px solid var(--warning)', padding: '6px 12px', borderRadius: '4px', backgroundColor: 'rgba(240, 185, 11, 0.1)', transition: 'all 0.2s' }}>
                  Admin Panel
                </Link>
              )}
              <Link href="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                Dashboard
              </Link>
              <Link href="/wallet" style={{ color: pathname === '/wallet' ? 'var(--primary)' : 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                Wallet
              </Link>
              <div style={{ height: '32px', width: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }} title={user.email}>
                {user.username ? user.username[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <button onClick={logout} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '14px', cursor: 'pointer' }}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                Log In
              </Link>
              <Link href="/register" className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px', textDecoration: 'none', borderRadius: '4px', textAlign: 'center' }}>
                Register
              </Link>
            </>
          )}

          {/* ── Globe / Language+Currency button ── */}
          {!isAuthPage && (
            <div ref={prefRef} style={{ position: 'relative' }}>
              <button
                id="pref-globe-btn"
                onClick={() => { setPrefOpen(p => !p); setLangSearch(''); setCurrSearch(''); }}
                title={`${langInfo.label} · ${currInfo.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  color: prefOpen ? '#F0B90B' : 'var(--text-secondary)',
                  transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                  backgroundColor: prefOpen ? 'rgba(240,185,11,0.08)' : 'transparent',
                  borderColor: prefOpen ? '#F0B90B' : 'var(--border-color)',
                }}
                onMouseEnter={e => { if (!prefOpen) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; } }}
                onMouseLeave={e => { if (!prefOpen) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
              >
                <GlobeIcon size={17} color="currentColor" />
                <span style={{ fontSize: '12px', fontWeight: '600', lineHeight: 1 }}>{currInfo.symbol} {currency}</span>
              </button>

              {/* ── Dropdown panel ── */}
              {prefOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '560px',
                  backgroundColor: '#1E2026',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
                  zIndex: 9999,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Two-column body */}
                  <div style={{ display: 'flex', height: '400px' }}>
                    <PrefsColumn
                      title="Language"
                      items={filteredLangs}
                      selectedCode={language}
                      onSelect={(code) => { setLanguage(code); }}
                      searchVal={langSearch}
                      onSearch={setLangSearch}
                    />

                    {/* Vertical divider */}
                    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0, margin: '16px 0' }} />

                    <PrefsColumn
                      title="Currency"
                      items={filteredCurrs}
                      selectedCode={currency}
                      onSelect={(code) => { setCurrency(code); }}
                      searchVal={currSearch}
                      onSearch={setCurrSearch}
                    />
                  </div>

                  {/* Footer: confirm/close */}
                  <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={() => setPrefOpen(false)}
                      style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#F0B90B', color: '#000', fontWeight: '700', fontSize: '13px', cursor: 'pointer', transition: 'opacity 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile burger */}
        <button
          className="mobile-burger-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{ display: 'none', background: 'none', color: 'var(--text-primary)', fontSize: '24px', cursor: 'pointer', border: 'none', outline: 'none' }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="mobile-nav-drawer" style={{
          backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px',
          display: 'flex', flexDirection: 'column', gap: '16px',
          position: 'absolute', top: '64px', left: 0, right: 0, zIndex: 99, boxShadow: 'var(--shadow-md)'
        }}>
          <Link href="/markets" onClick={() => setMobileOpen(false)} style={{ color: pathname === '/markets' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Markets</Link>
          <Link href="/trade/BTCUSDT" onClick={() => setMobileOpen(false)} style={{ color: pathname?.startsWith('/trade') ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Trade</Link>
          <Link href="/p2p" onClick={() => setMobileOpen(false)} style={{ color: pathname === '/p2p' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>P2P</Link>

          {/* Mobile: Language & Currency quick selects */}
          {!isAuthPage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Language</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {LANGUAGES.slice(0, 8).map(l => (
                    <button key={l.code} onClick={() => setLanguage(l.code)} style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', backgroundColor: language === l.code ? '#F0B90B' : 'var(--bg-tertiary)', color: language === l.code ? '#000' : 'var(--text-secondary)' }}>
                      {l.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Currency</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['USD', 'INR', 'EUR', 'GBP', 'JPY', 'AUD'].map(c => {
                    const ci = CURRENCIES.find(x => x.code === c);
                    return (
                      <button key={c} onClick={() => setCurrency(c)} style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', backgroundColor: currency === c ? '#F0B90B' : 'var(--bg-tertiary)', color: currency === c ? '#000' : 'var(--text-secondary)' }}>
                        {ci?.symbol} {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', width: '100%', margin: '4px 0' }} />
          {user ? (
            <>
              {user.role === 'ADMIN' && (
                <Link href="/admin" onClick={() => setMobileOpen(false)} style={{ color: 'var(--warning)', textDecoration: 'none', fontSize: '14px', fontWeight: '600', border: '1px solid var(--warning)', padding: '6px 12px', borderRadius: '4px', backgroundColor: 'rgba(240, 185, 11, 0.1)', textAlign: 'center' }}>Admin Panel</Link>
              )}
              <Link href="/" onClick={() => setMobileOpen(false)} style={{ color: pathname === '/' ? 'var(--primary)' : 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Dashboard</Link>
              <Link href="/wallet" onClick={() => setMobileOpen(false)} style={{ color: pathname === '/wallet' ? 'var(--primary)' : 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Wallet</Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                <div style={{ height: '32px', width: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                  {user.username ? user.username[0].toUpperCase() : user.email[0].toUpperCase()}
                </div>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{user.email}</span>
              </div>
              <button onClick={() => { logout(); setMobileOpen(false); }} className="btn-secondary" style={{ padding: '10px', fontSize: '14px', width: '100%', cursor: 'pointer' }}>Log Out</button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', fontWeight: '500', textAlign: 'center', padding: '8px' }}>Log In</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="btn-primary" style={{ padding: '10px', fontSize: '14px', textDecoration: 'none', borderRadius: '4px', textAlign: 'center' }}>Register</Link>
            </>
          )}
        </div>
      )}

      {/* Live Ticker Marquee */}
      {!isAuthPage && (
        <div className="marquee-wrapper">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .marquee-wrapper {
              overflow: hidden; white-space: nowrap; display: flex;
              background-color: #0b0d10; border-bottom: 1px solid var(--border-color);
              height: 36px; align-items: center; font-size: 13px;
              position: relative; font-family: var(--font-mono), monospace;
            }
            .marquee-content {
              display: inline-flex; gap: 40px; padding-left: 20px;
              animation: marquee 35s linear infinite;
            }
            .marquee-wrapper:hover .marquee-content { animation-play-state: paused; }
            .marquee-item {
              display: inline-flex; align-items: center; gap: 8px;
              color: var(--text-primary); text-decoration: none; cursor: pointer; transition: color 0.2s;
            }
            .marquee-item:hover { color: var(--primary); }
          `}} />
          <div className="marquee-content">
            {[...displayTickers, ...displayTickers].map((t, idx) => {
              const isPositive = t.change >= 0;
              const base = t.symbol.replace('USDT', '');
              return (
                <Link href={`/trade/${t.symbol}`} key={`m-${idx}-${t.symbol}`} className="marquee-item">
                  <CoinIcon coin={base} size={16} />
                  <span style={{ fontWeight: '600' }}>{base}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{fmt(t.price, { maxDecimals: 4 })}</span>
                  <span style={{ color: isPositive ? 'var(--success)' : 'var(--danger)', fontWeight: '500' }}>
                    {isPositive ? '+' : ''}{t.change?.toFixed(2)}%
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
