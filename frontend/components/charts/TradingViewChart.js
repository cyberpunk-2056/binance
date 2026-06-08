'use client';
import { useState, useEffect, useRef } from 'react';

const INTERVALS = [
  { label: '1m',  tv: '1' },
  { label: '3m',  tv: '3' },
  { label: '5m',  tv: '5' },
  { label: '15m', tv: '15' },
  { label: '30m', tv: '30' },
  { label: '1H',  tv: '60' },
  { label: '4H',  tv: '240' },
  { label: '1D',  tv: 'D' },
  { label: '1W',  tv: 'W' },
];

const CHART_TYPES = [
  {
    label: 'Candlestick',
    style: '1',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="4" y="4" width="2" height="8" rx="0.5"/>
        <rect x="5" y="2" width="0.5" height="2"/>
        <rect x="5" y="12" width="0.5" height="2"/>
        <rect x="9" y="2" width="2" height="6" rx="0.5"/>
        <rect x="10" y="1" width="0.5" height="1"/>
        <rect x="10" y="8" width="0.5" height="3"/>
      </svg>
    )
  },
  {
    label: 'Line',
    style: '2',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="1,12 5,8 9,10 13,4 15,6"/>
      </svg>
    )
  },
  {
    label: 'Area',
    style: '3',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.8">
        <path d="M1,13 L1,9 L5,5 L9,7 L13,2 L15,4 L15,13 Z" fillOpacity="0.4"/>
        <polyline points="1,9 5,5 9,7 13,2 15,4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )
  },
  {
    label: 'Bar',
    style: '0',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="3" y="3" width="0.5" height="10"/>
        <rect x="1" y="6" width="2.5" height="0.5"/>
        <rect x="3" y="10" width="2.5" height="0.5"/>
        <rect x="9" y="2" width="0.5" height="9"/>
        <rect x="7" y="5" width="2.5" height="0.5"/>
        <rect x="9" y="8" width="2.5" height="0.5"/>
      </svg>
    )
  },
];

export default function TradingViewChart({ symbol }) {
  const [activeInterval, setActiveInterval] = useState('60');   // default 1H
  const [activeStyle, setActiveStyle] = useState('1');           // default Candlestick
  const [chartView, setChartView] = useState('tv');             // default 'tv' (TradingView)
  const [showChartMenu, setShowChartMenu] = useState(false);
  const [showIndicMenu, setShowIndicMenu] = useState(false);
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const menuRef = useRef(null);
  const indicRef = useRef(null);

  const tvSymbol = `BINANCE:${symbol}`;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowChartMenu(false);
      if (indicRef.current && !indicRef.current.contains(e.target)) setShowIndicMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Load / reload TradingView advanced widget
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: tvSymbol,
          interval: activeInterval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: activeStyle,
          locale: 'en',
          toolbar_bg: '#1e2026',
          enable_publishing: false,
          allow_symbol_change: false,
          container_id: 'tv_chart_container',
          hide_top_toolbar: true,      // We build our own toolbar
          hide_legend: false,
          hide_side_toolbar: false,
          withdateranges: false,
          save_image: false,
          studies: [],
          overrides: {
            'paneProperties.background': '#1e2026',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': '#2b2f36',
            'paneProperties.horzGridProperties.color': '#2b2f36',
            'symbolWatermarkProperties.transparency': 90,
            'scalesProperties.textColor': '#848e9c',
            'scalesProperties.backgroundColor': '#1e2026',
            'mainSeriesProperties.candleStyle.upColor': '#0ecb81',
            'mainSeriesProperties.candleStyle.downColor': '#f6465d',
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            'mainSeriesProperties.candleStyle.borderUpColor': '#0ecb81',
            'mainSeriesProperties.candleStyle.borderDownColor': '#f6465d',
            'mainSeriesProperties.candleStyle.wickUpColor': '#0ecb81',
            'mainSeriesProperties.candleStyle.wickDownColor': '#f6465d',
          },
          loading_screen: { backgroundColor: '#1e2026', foregroundColor: '#f0b90b' },
        });
      }
    };

    const wrapper = document.createElement('div');
    wrapper.id = 'tv_chart_container';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    containerRef.current.appendChild(wrapper);
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [tvSymbol, activeInterval, activeStyle]);

  const activeChartType = CHART_TYPES.find(c => c.style === activeStyle) || CHART_TYPES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#1e2026' }}>

      {/* ── Binance-style Chart Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '0 12px',
        height: '40px',
        backgroundColor: '#1e2026',
        borderBottom: '1px solid #2b2f36',
        flexShrink: 0,
        overflowX: 'auto',
        userSelect: 'none',
      }}>

        {/* Time Interval Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginRight: '8px' }}>
          {INTERVALS.map(iv => (
            <button
              key={iv.tv}
              onClick={() => setActiveInterval(iv.tv)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: activeInterval === iv.tv ? '700' : '400',
                color: activeInterval === iv.tv ? '#f0b90b' : '#848e9c',
                backgroundColor: activeInterval === iv.tv ? 'rgba(240,185,11,0.1)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (activeInterval !== iv.tv) e.currentTarget.style.color = '#eaecef'; }}
              onMouseLeave={e => { if (activeInterval !== iv.tv) e.currentTarget.style.color = '#848e9c'; }}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#2b2f36', margin: '0 4px', flexShrink: 0 }} />

        {/* View toggles: Original / TradingView / Depth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', marginRight: '8px', flexShrink: 0 }}>
          {['Original', 'TradingView', 'Depth'].map(view => {
            const isAct = (view === 'TradingView' && chartView === 'tv') || 
                          (view === 'Original' && chartView === 'original') || 
                          (view === 'Depth' && chartView === 'depth');
            const viewKey = view === 'TradingView' ? 'tv' : view.toLowerCase();
            return (
              <button
                key={view}
                onClick={() => setChartView(viewKey)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: isAct ? '700' : '400',
                  color: isAct ? '#f0b90b' : '#848e9c',
                  backgroundColor: isAct ? 'rgba(240,185,11,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isAct) e.currentTarget.style.color = '#eaecef'; }}
                onMouseLeave={e => { if (!isAct) e.currentTarget.style.color = '#848e9c'; }}
              >
                {view}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '20px', backgroundColor: '#2b2f36', margin: '0 4px', flexShrink: 0 }} />

        {/* Chart Type Dropdown */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowChartMenu(v => !v); setShowIndicMenu(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 8px',
              fontSize: '12px',
              color: showChartMenu ? '#f0b90b' : '#848e9c',
              backgroundColor: showChartMenu ? 'rgba(240,185,11,0.1)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!showChartMenu) e.currentTarget.style.color = '#eaecef'; }}
            onMouseLeave={e => { if (!showChartMenu) e.currentTarget.style.color = '#848e9c'; }}
          >
            <span style={{ display: 'flex', alignItems: 'center', color: showChartMenu ? '#f0b90b' : '#848e9c' }}>
              {activeChartType.icon}
            </span>
            <span>{activeChartType.label}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ marginLeft: '2px' }}>
              <path d="M5 6.5L1.5 3h7L5 6.5z"/>
            </svg>
          </button>

          {showChartMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              backgroundColor: '#1e2026',
              border: '1px solid #2b2f36',
              borderRadius: '6px',
              padding: '6px',
              zIndex: 100,
              minWidth: '150px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.style}
                  onClick={() => { setActiveStyle(ct.style); setShowChartMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: activeStyle === ct.style ? '#f0b90b' : '#eaecef',
                    backgroundColor: activeStyle === ct.style ? 'rgba(240,185,11,0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (activeStyle !== ct.style) e.currentTarget.style.backgroundColor = '#2b2f36'; }}
                  onMouseLeave={e => { if (activeStyle !== ct.style) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ opacity: 0.8 }}>{ct.icon}</span>
                  {ct.label}
                  {activeStyle === ct.style && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="#f0b90b" style={{ marginLeft: 'auto' }}>
                      <path d="M10 3L5 9 2 6" stroke="#f0b90b" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Indicators Button */}
        <div ref={indicRef} style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowIndicMenu(v => !v); setShowChartMenu(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              fontSize: '12px',
              color: showIndicMenu ? '#f0b90b' : '#848e9c',
              backgroundColor: showIndicMenu ? 'rgba(240,185,11,0.1)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!showIndicMenu) e.currentTarget.style.color = '#eaecef'; }}
            onMouseLeave={e => { if (!showIndicMenu) e.currentTarget.style.color = '#848e9c'; }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="4" cy="10" r="1.5"/>
              <circle cx="10" cy="4" r="1.5"/>
              <line x1="5.06" y1="8.94" x2="8.94" y2="5.06"/>
              <line x1="1" y1="13" x2="3.3" y2="11.5" strokeDasharray="0"/>
              <line x1="10.7" y1="2.5" x2="13" y2="1"/>
            </svg>
            Indicators
          </button>

          {showIndicMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              backgroundColor: '#1e2026',
              border: '1px solid #2b2f36',
              borderRadius: '6px',
              padding: '6px',
              zIndex: 100,
              minWidth: '180px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {['MA (Moving Average)', 'EMA', 'Bollinger Bands', 'MACD', 'RSI', 'Volume', 'Stochastic RSI'].map(ind => (
                <div
                  key={ind}
                  style={{
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: '#eaecef',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2b2f36'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => setShowIndicMenu(false)}
                >
                  {ind}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Fullscreen hint */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 6px',
            color: '#848e9c',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          title="Fullscreen"
          onMouseEnter={e => e.currentTarget.style.color = '#eaecef'}
          onMouseLeave={e => e.currentTarget.style.color = '#848e9c'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/>
          </svg>
        </button>
      </div>

      {/* Depth Chart view */}
      <div style={{ display: chartView === 'depth' ? 'block' : 'none', flex: 1, overflow: 'hidden', backgroundColor: '#161a1e' }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#161a1e', padding: '20px', boxSizing: 'border-box' }}>
          <svg width="100%" height="90%" viewBox="0 0 600 300" preserveAspectRatio="none">
            {/* Bids fill (Green) */}
            <path d="M 0 300 L 0 50 L 100 80 L 180 120 L 220 180 L 270 240 L 270 300 Z" fill="rgba(14,203,129,0.15)" stroke="#0ecb81" strokeWidth="2" />
            {/* Asks fill (Red) */}
            <path d="M 330 300 L 330 240 L 380 180 L 420 120 L 500 80 L 600 50 L 600 300 Z" fill="rgba(246,70,93,0.15)" stroke="#f6465d" strokeWidth="2" />
            
            {/* Grid lines */}
            <line x1="0" y1="280" x2="600" y2="280" stroke="#2b2f36" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
            <line x1="0" y1="200" x2="600" y2="200" stroke="#2b2f36" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
            <line x1="0" y1="120" x2="600" y2="120" stroke="#2b2f36" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
            <line x1="300" y1="0" x2="300" y2="300" stroke="#2b2f36" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
            
            {/* Price labels at bottom */}
            <text x="50" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">62,100</text>
            <text x="150" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">62,500</text>
            <text x="250" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">62,900</text>
            
            <text x="335" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">63,100</text>
            <text x="435" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">63,500</text>
            <text x="535" y="295" fill="#848e9c" fontSize="10" fontFamily="monospace">63,900</text>
          </svg>
          <div style={{ color: '#eaecef', fontSize: '11px', marginTop: '5px', display: 'flex', gap: '20px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#0ecb81', display: 'inline-block', borderRadius: '1px' }}></span>Bids</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '8px', height: '8px', backgroundColor: '#f6465d', display: 'inline-block', borderRadius: '1px' }}></span>Asks</span>
          </div>
        </div>
      </div>

      {/* TradingView Chart Frame */}
      <div
        ref={containerRef}
        style={{ display: chartView !== 'depth' ? 'block' : 'none', flex: 1, overflow: 'hidden', backgroundColor: '#1e2026' }}
      />
    </div>
  );
}
