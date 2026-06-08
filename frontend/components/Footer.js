import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-primary)',
      borderTop: '1px solid var(--border-color)',
      padding: '40px 24px',
      color: 'var(--text-secondary)',
      fontSize: '14px',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: '40px',
        textAlign: 'left',
        marginBottom: '40px'
      }}>
        <div style={{ flex: '1 1 300px' }}>
          <div style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'var(--primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--primary)">
              <path d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.716-2.716z" />
            </svg>
            <span>Binance</span>
          </div>
          <p style={{ lineHeight: '1.6', fontSize: '13px' }}>
            Trade and manage your crypto assets with the world's most advanced simulated cryptocurrency platform. Real market data, real charts, and high performance order books.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '60px', flexWrap: 'wrap' }}>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '14px' }}>Products</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <li><Link href="/markets" style={{ color: 'inherit', textDecoration: 'none' }}>Markets</Link></li>
              <li><Link href="/trade/BTCUSDT" style={{ color: 'inherit', textDecoration: 'none' }}>Spot Trading</Link></li>
              <li><Link href="/p2p" style={{ color: 'inherit', textDecoration: 'none' }}>P2P Trading</Link></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '14px' }}>Services</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <li><Link href="/wallet" style={{ color: 'inherit', textDecoration: 'none' }}>Funding Wallet</Link></li>
              <li><Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>User Dashboard</Link></li>
              <li><Link href="/admin" style={{ color: 'inherit', textDecoration: 'none' }}>Admin Console</Link></li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '14px' }}>Support</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <li><a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Help Center</a></li>
              <li><a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>API Documentation</a></li>
              <li><a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Fees Schedule</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div style={{
        borderTop: '1px solid var(--border-color)',
        paddingTop: '20px',
        fontSize: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1200px',
        margin: '0 auto',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>© 2026 Binance. All rights reserved. Simulated trading platform.</div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}
