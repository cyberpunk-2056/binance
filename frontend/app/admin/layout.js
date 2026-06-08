'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function AdminLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || user.role !== 'ADMIN') {
        router.push('/dashboard');
      } else {
        setAuthorized(true);
      }
    }
  }, [user, loading, router]);

  if (loading || !authorized) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: '16px'
      }}>
        Verifying Admin Privileges...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Banner */}
      <div className="admin-top-banner" style={{
        height: '60px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: 'var(--primary)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--primary)">
              <path d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.716-2.716z" />
            </svg>
            <span>Binance</span>
          </Link>
          <span style={{
            backgroundColor: 'var(--warning)',
            color: 'var(--bg-primary)',
            fontSize: '11px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '3px'
          }}>
            ADMIN AREA
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="admin-user-email" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Logged in: <strong>{user.email}</strong></span>
          <Link href="/dashboard" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px', textDecoration: 'none', borderRadius: '4px' }}>
            Back to Client App
          </Link>
        </div>
      </div>

      {/* Main split */}
      <div className="admin-main-split" style={{ flex: 1, display: 'flex' }}>
        
        {/* Sidebar */}
        <aside className="admin-sidebar" style={{
          width: '240px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 12px',
          gap: '10px'
        }}>
          <Link href="/admin" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            📊 Statistics
          </Link>

          <Link href="/admin/users" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            👥 User Manager
          </Link>

          <Link href="/admin/p2p" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            🔄 P2P Trades
          </Link>

          <Link href="/admin/transactions" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            💸 System Ledger
          </Link>

          <Link href="/admin/settings" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            🔔 Announcements
          </Link>

          <Link href="/admin/logs" style={{
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '600',
            padding: '10px 16px',
            borderRadius: '4px',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            🛡️ Audit Logs
          </Link>
        </aside>

        {/* Content Panel */}
        <main className="admin-content-panel" style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          {children}
        </main>

      </div>
    </div>
  );
}
