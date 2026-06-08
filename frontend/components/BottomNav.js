'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(pathname);
  if (isAuthPage) return null;

  const isActive = (path) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .mobile-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 64px;
          background-color: rgba(30, 32, 38, 0.96);
          backdrop-filter: blur(8px);
          border-top: 1px solid var(--border-color);
          display: none;
          justify-content: space-around;
          align-items: center;
          z-index: 999;
          padding-bottom: env(safe-area-inset-bottom);
        }

        .mobile-nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          font-size: 10px;
          font-weight: 500;
          text-decoration: none;
          flex: 1;
          height: 100%;
          transition: color 0.15s ease;
          gap: 4px;
        }

        .mobile-nav-item:hover, .mobile-nav-item.active {
          color: var(--primary);
        }

        .mobile-nav-icon {
          width: 20px;
          height: 20px;
          stroke: currentColor;
          fill: none;
        }

        .mobile-nav-item.active .mobile-nav-icon {
          fill: rgba(240, 185, 11, 0.1);
        }

        /* Adjust bottom margin on all pages so content doesn't get hidden under bottom nav on mobile */
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex;
          }
          main, .main-content {
            margin-bottom: 64px !important;
          }
        }
      `}} />

      <nav className="mobile-bottom-nav">
        {/* Home */}
        <Link href="/" className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`}>
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </Link>

        {/* Markets */}
        <Link href="/markets" className={`mobile-nav-item ${isActive('/markets') ? 'active' : ''}`}>
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Markets</span>
        </Link>

        {/* Trade */}
        <Link href="/trade/BTCUSDT?view=trade" className={`mobile-nav-item ${isActive('/trade') ? 'active' : ''}`}>
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          <span>Trade</span>
        </Link>

        {/* P2P */}
        <Link href="/p2p" className={`mobile-nav-item ${isActive('/p2p') ? 'active' : ''}`}>
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>P2P</span>
        </Link>

        {/* Wallet (Assets) */}
        <Link href="/wallet" className={`mobile-nav-item ${isActive('/wallet') ? 'active' : ''}`}>
          <svg className="mobile-nav-icon" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
          <span>Assets</span>
        </Link>
      </nav>
    </>
  );
}
