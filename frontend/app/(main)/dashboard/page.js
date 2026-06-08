'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';
import { subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';
import Link from 'next/link';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const { fmt, fmtLarge, currency, getCurrencyInfo } = useCurrency();
  const router = useRouter();
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [prices, setPrices] = useState({});
  const [dataLoading, setDataLoading] = useState(true);

  // Auth Protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Fetch initial data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const [walletsRes, txRes, ordersRes, tickersRes] = await Promise.all([
          api.get('/wallet'),
          api.get('/wallet/transactions?limit=5'),
          api.get('/orders?status=OPEN&limit=5'),
          api.get('/markets/tickers')
        ]);

        setWallets(walletsRes.data.wallets || []);
        setTransactions(txRes.data.transactions || []);
        setOrders(ordersRes.data.orders || []);

        const pricesMap = {};
        tickersRes.data.tickers.forEach(t => {
          pricesMap[t.symbol] = t.price;
        });
        setPrices(pricesMap);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();

    // Subscribe to live price updates
    const unsubscribe = subscribeToAllTickers((update) => {
      setPrices(prev => ({
        ...prev,
        [update.symbol]: update.price
      }));
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  if (loading || !user || dataLoading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Loading your dashboard...
        </div>
        <Footer />
      </div>
    );
  }

  // Calculate portfolio balance
  let totalUSD = 0;
  wallets.forEach(w => {
    if (w.coin === 'USDT') {
      totalUSD += w.balance;
    } else {
      const price = prices[`${w.coin}USDT`] || 0;
      totalUSD += w.balance * price;
    }
  });

  const btcPrice = prices['BTCUSDT'] || 65000;
  const totalBTC = totalUSD / btcPrice;

  // Handle Cancel Order
  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      // Refresh wallet
      const walletsRes = await api.get('/wallet');
      setWallets(walletsRes.data.wallets);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Welcome Banner */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Welcome back, {user.username || user.email}!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Account Status:{' '}
              <span style={{
                color: user.kycStatus === 'APPROVED' ? 'var(--success)' : 'var(--warning)',
                fontWeight: '600',
                backgroundColor: user.kycStatus === 'APPROVED' ? 'rgba(14, 203, 129, 0.1)' : 'rgba(240, 185, 11, 0.1)',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {user.kycStatus === 'APPROVED' ? 'KYC Verified' : 'KYC Pending Review'}
              </span>
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/wallet" className="btn-primary" style={{ padding: '10px 20px', textDecoration: 'none', borderRadius: '4px', fontSize: '14px' }}>
              Deposit Fund
            </Link>
            <Link href="/trade/BTCUSDT" className="btn-secondary" style={{ padding: '10px 20px', textDecoration: 'none', borderRadius: '4px', fontSize: '14px' }}>
              Trade Spot
            </Link>
          </div>
        </div>

        {/* Portfolio Balance and Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '30px',
          marginBottom: '32px'
        }}>
          
          {/* Balance card */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: '500' }}>
              Estimated Balance
            </h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {fmt(totalUSD, { minDecimals: 2, maxDecimals: 2 })}
              </span>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                {currency}
              </span>
            </div>
            <div style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              ≈ {totalBTC.toFixed(6)} BTC
            </div>
            
            {/* Asset Progress Bars */}
            <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '16px', fontWeight: '600' }}>
              Asset Allocation
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {wallets.filter(w => w.balance > 0).slice(0, 4).map(w => {
                const price = w.coin === 'USDT' ? 1 : prices[`${w.coin}USDT`] || 0;
                const value = w.balance * price;
                const percentage = totalUSD > 0 ? (value / totalUSD) * 100 : 0;
                return (
                  <div key={w.coin}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CoinIcon coin={w.coin} size={16} />
                        {w.coin}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{percentage.toFixed(1)}% ({fmt(value, { minDecimals: 2 })})</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, backgroundColor: 'var(--primary)', height: '100%' }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User profile / security card */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '20px', fontWeight: 'bold' }}>
                Account Security
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Two-Factor Auth (2FA)</span>
                  <span style={{ color: user.twoFAEnabled ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                    {user.twoFAEnabled ? 'Enabled' : 'Disabled (Recommended to Enable)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Email Verified</span>
                  <span style={{ color: user.emailVerified ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                    {user.emailVerified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Referral Code</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {user.referralCode || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Refer your friends to earn 20% commission rebate on all their trading fees in real-time. Invite link:
                <br />
                <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '11px' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${user.referralCode}` : `http://localhost:3000/register?ref=${user.referralCode}`}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Orders & Activity */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
          gap: '30px'
        }}>
          
          {/* Open Orders */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Open Orders
              </h3>
              <Link href="/trade/BTCUSDT" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
                Go to trading screen
              </Link>
            </div>

            {orders.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
                No active open orders.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {orders.map(order => (
                  <div key={order.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          color: order.side === 'BUY' ? 'var(--success)' : 'var(--danger)',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>{order.side}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px' }}>{order.pair}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '3px' }}>{order.type}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Price: {fmt(order.price)} | Amount: {order.amount}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: 'rgba(246, 70, 93, 0.1)',
                        border: '1px solid var(--danger)',
                        color: 'var(--danger)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                Recent Transactions
              </h3>
              <Link href="/wallet" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
                View All
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
                No recent transaction history.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {transactions.map(tx => (
                  <div key={tx.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{
                          color: tx.type === 'DEPOSIT' || (tx.type === 'TRADE' && tx.note?.includes('BUY')) ? 'var(--success)' : 'var(--danger)',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>{tx.type}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px' }}>{tx.coin}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: tx.type === 'DEPOSIT' ? 'var(--success)' : 'var(--text-primary)',
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Fee: {tx.fee}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
