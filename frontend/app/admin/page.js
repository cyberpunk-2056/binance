'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        Admin Dashboard
      </h1>

      {/* Grid of stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        
        {/* Total Users */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>TOTAL REGISTERED USERS</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{stats?.users?.total}</div>
          <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '6px' }}>{stats?.users?.active} Active • {stats?.users?.banned} Banned</div>
        </div>

        {/* Spot Orders */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>SPOT TRADING ORDERS</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{stats?.orders?.total}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>{stats?.orders?.filled} Filled / Completed</div>
        </div>

        {/* P2P Trades */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>P2P ESCROW TRADES</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{stats?.p2p?.total}</div>
          <div style={{ fontSize: '12px', color: 'var(--warning)', marginTop: '6px' }}>{stats?.p2p?.pending} Active Escrows</div>
        </div>

        {/* Transactions */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>TOTAL TRANSACTIONS LOGGED</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{stats?.transactions?.total}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>Blockchain + Trade ledgers</div>
        </div>

      </div>

      {/* Row containing recent users and actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
        
        {/* Recent Registered Users */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Recently Joined Users</h3>
            <Link href="/admin/users" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>View All</Link>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Email</th>
                  <th style={{ padding: '12px' }}>Username</th>
                  <th style={{ padding: '12px' }}>Registered At</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recentUsers?.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.email}</td>
                    <td style={{ padding: '12px' }}>{u.username}</td>
                    <td style={{ padding: '12px' }}>{new Date(u.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)',
                        fontWeight: '600',
                        fontSize: '11px',
                        backgroundColor: u.status === 'ACTIVE' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(246, 70, 93, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <Link href={`/admin/users?search=${u.username}`} style={{
                        fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', border: '1px solid var(--primary)',
                        padding: '4px 8px', borderRadius: '4px', backgroundColor: 'transparent'
                      }}>
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
