'use client';
import { useState, useEffect } from 'react';

export default function CoinIcon({ coin, size = 24 }) {
  const symbol = coin.toUpperCase();
  const [src, setSrc] = useState(`https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`);
  const [error, setError] = useState(false);

  // Reset error when coin changes
  useEffect(() => {
    setSrc(`https://assets.coincap.io/assets/icons/${coin.toLowerCase()}@2x.png`);
    setError(false);
  }, [coin]);

  if (error) {
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: `${size * 0.5}px`,
        userSelect: 'none'
      }}>
        {symbol[0]}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={symbol}
      width={size}
      height={size}
      onError={() => setError(true)}
      style={{ borderRadius: '50%', objectFit: 'cover' }}
    />
  );
}
