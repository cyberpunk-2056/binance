'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';
import { subscribeToAllTickers } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';

export default function Wallet() {
  const { user, loading } = useAuth();
  const { fmt, currency } = useCurrency();
  const router = useRouter();
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [prices, setPrices] = useState({});
  const [tickers, setTickers] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Modal States
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  // Form States
  const [selectedCoin, setSelectedCoin] = useState('USDT');
  const [depositAmount, setDepositAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFrom, setTransferFrom] = useState('Spot');
  const [transferTo, setTransferTo] = useState('Funding');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auth Protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      const [walletsRes, txRes, tickersRes] = await Promise.all([
        api.get('/wallet'),
        api.get('/wallet/transactions'),
        api.get('/markets/tickers')
      ]);
      setWallets(walletsRes.data.wallets || []);
      setTransactions(txRes.data.transactions || []);
      setTickers(tickersRes.data.tickers || []);
      
      const pricesMap = {};
      tickersRes.data.tickers.forEach(t => {
        pricesMap[t.symbol] = t.price;
      });
      setPrices(pricesMap);
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();

    const unsubscribe = subscribeToAllTickers((update) => {
      setPrices(prev => ({
        ...prev,
        [update.symbol]: update.price
      }));
      setTickers(prev => prev.map(t => t.symbol === update.symbol ? { ...t, ...update } : t));
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
          Loading your wallets...
        </div>
        <Footer />
      </div>
    );
  }

  // Calculate portfolio balance
  let totalUSD = 0;
  let prevUSD = 0;
  wallets.forEach(w => {
    const totalBalance = w.balance + (w.lockedBalance || 0);
    const coinPrice = w.coin === 'USDT' ? 1 : (prices[`${w.coin}USDT`] || 0);
    const coinTicker = tickers.find(t => t.symbol === `${w.coin}USDT`);
    const coinChg = coinTicker ? coinTicker.change : 0;

    const currentVal = totalBalance * coinPrice;
    totalUSD += currentVal;

    const prevPrice = coinPrice / (1 + coinChg / 100);
    const prevVal = totalBalance * prevPrice;
    prevUSD += prevVal;
  });

  const pnlUSD = totalUSD - prevUSD;
  const pnlPercent = prevUSD > 0 ? (pnlUSD / prevUSD) * 100 : 0;

  const btcPrice = prices['BTCUSDT'] || 65000;
  const totalBTC = totalUSD / btcPrice;

  // Selected Wallet Info
  const activeWallet = wallets.find(w => w.coin === selectedCoin) || {};

  // Form Submissions
  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      await api.post('/wallet/deposit', { coin: selectedCoin, amount: parseFloat(depositAmount) });
      setFormSuccess(`Simulated deposit of ${depositAmount} ${selectedCoin} submitted and pending admin approval.`);
      await fetchWalletData();
      setTimeout(() => setShowDeposit(false), 3000);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Deposit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      await api.post('/wallet/withdraw', { coin: selectedCoin, amount: parseFloat(withdrawAmount), address: withdrawAddress });
      setFormSuccess(`Simulated withdrawal of ${withdrawAmount} ${selectedCoin} initiated and pending admin approval.`);
      await fetchWalletData();
      setTimeout(() => setShowWithdraw(false), 3000);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Withdrawal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      setFormError('Invalid amount');
      return;
    }
    setFormSuccess(`Successfully transferred ${transferAmount} ${selectedCoin} from ${transferFrom} to ${transferTo} wallet!`);
    setTimeout(() => setShowTransfer(false), 2000);
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Wallet Overview Panel */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '32px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          <div>
            <h2 style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>
              Fiat and Spot Balance
            </h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {fmt(totalUSD, { minDecimals: 2, maxDecimals: 2 })}
              </span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>{currency}</span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              ≈ {totalBTC.toFixed(6)} BTC
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Today's PNL:</span>
              <span style={{ color: pnlUSD >= 0 ? 'var(--success)' : 'var(--red)', fontWeight: '700' }}>
                {pnlUSD >= 0 ? '+' : ''}{fmt(pnlUSD)} ({pnlUSD >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => { setSelectedCoin('USDT'); setFormError(''); setFormSuccess(''); setShowDeposit(true); }} className="btn-primary" style={{ padding: '12px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              Deposit
            </button>
            <button onClick={() => { setSelectedCoin('USDT'); setFormError(''); setFormSuccess(''); setShowWithdraw(true); }} className="btn-secondary" style={{ padding: '12px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              Withdraw
            </button>
            <button onClick={() => { setSelectedCoin('USDT'); setFormError(''); setFormSuccess(''); setShowTransfer(true); }} className="btn-secondary" style={{ padding: '12px 24px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              Transfer
            </button>
          </div>
        </div>

        {/* Coins Balances Table */}
        <div className="desktop-only" style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginBottom: '40px',
          overflow: 'hidden'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
            Asset Balances
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '16px 24px' }}>Asset</th>
                  <th style={{ padding: '16px 24px' }}>Deposit Address</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Balance</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Available Balance</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Locked Balance</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>{currency} Value</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => {
                  const price = wallet.coin === 'USDT' ? 1 : prices[`${wallet.coin}USDT`] || 0;
                  const totalBalance = wallet.balance + (wallet.lockedBalance || 0);
                  const usdValue = totalBalance * price;
                  return (
                    <tr key={wallet.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CoinIcon coin={wallet.coin} size={20} />
                        {wallet.coin}
                      </td>
                      <td style={{ padding: '16px 24px', fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {wallet.address || 'N/A'}
                        {wallet.address && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(wallet.address); alert('Address copied!'); }}
                            style={{
                              marginLeft: '8px',
                              padding: '2px 6px',
                              fontSize: '10px',
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--primary)',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {totalBalance?.toFixed(wallet.coin === 'BTC' ? 6 : 2)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-primary)' }}>
                        {wallet.balance?.toFixed(wallet.coin === 'BTC' ? 6 : 2)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--warning)' }}>
                        {(wallet.lockedBalance || 0)?.toFixed(wallet.coin === 'BTC' ? 6 : 2)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {fmt(usdValue, { minDecimals: 2, maxDecimals: 2 })}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={() => { setSelectedCoin(wallet.coin); setFormError(''); setFormSuccess(''); setShowDeposit(true); }} className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '3px', cursor: 'pointer' }}>
                          Deposit
                        </button>
                        <button onClick={() => { setSelectedCoin(wallet.coin); setFormError(''); setFormSuccess(''); setShowWithdraw(true); }} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '3px', cursor: 'pointer' }}>
                          Withdraw
                        </button>
                        <Link href={`/trade/${wallet.coin === 'USDT' ? 'BTCUSDT' : `${wallet.coin}USDT`}`} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '3px', textDecoration: 'none' }}>
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile View: Asset Cards */}
        <div className="mobile-only" style={{ flexDirection: 'column', gap: '12px', marginBottom: '40px', width: '100%' }}>
          {wallets.map((wallet) => {
            const price = wallet.coin === 'USDT' ? 1 : prices[`${wallet.coin}USDT`] || 0;
            const totalBalance = wallet.balance + (wallet.lockedBalance || 0);
            const usdValue = totalBalance * price;
            
            const assetNames = {
              USDT: 'TetherUS',
              BTC: 'Bitcoin',
              ETH: 'Ethereum',
              BNB: 'BNB',
              SOL: 'Solana',
              BONK: 'Bonk'
            };

            return (
              <div 
                key={wallet.id} 
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CoinIcon coin={wallet.coin} size={32} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>{wallet.coin}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{assetNames[wallet.coin] || wallet.coin}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '15px' }}>
                    {totalBalance?.toFixed(wallet.coin === 'BTC' ? 6 : 2)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {fmt(usdValue, { minDecimals: 2, maxDecimals: 2 })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Transaction History Panel */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '24px'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '20px' }}>
            Full Transaction History
          </h3>
          {transactions.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
              No transactions recorded.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <th style={{ padding: '12px' }}>Transaction ID</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Asset</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Fee</th>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-primary)' }}>{tx.id}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          fontWeight: 'bold',
                          color: tx.type === 'DEPOSIT' ? 'var(--success)' : 'var(--danger)'
                        }}>{tx.type}</span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{tx.coin}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>{tx.fee}</td>
                      <td style={{ padding: '12px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          color: tx.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)',
                          fontWeight: '600'
                        }}>{tx.status}</span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '11px' }}>{tx.note || tx.txHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Deposit Modal */}
      {showDeposit && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Simulate Crypto Deposit</h3>
              <button onClick={() => setShowDeposit(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            
            {formSuccess ? (
              <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formSuccess}</div>
            ) : formError ? (
              <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formError}</div>
            ) : null}

            <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Select Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                >
                  {wallets.map(w => <option key={w.coin} value={w.coin}>{w.coin}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Deposit Address</label>
                <div style={{
                  padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>{activeWallet.address || 'Loading...'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Deposit Amount (Simulated)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '14px', fontSize: '16px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Depositing...' : 'Confirm Deposit'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Simulate Crypto Withdrawal</h3>
              <button onClick={() => setShowWithdraw(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {formSuccess ? (
              <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formSuccess}</div>
            ) : formError ? (
              <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formError}</div>
            ) : null}

            <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Select Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                >
                  {wallets.map(w => <option key={w.coin} value={w.coin}>{w.coin}</option>)}
                </select>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                  Available Balance: {activeWallet.balance} {selectedCoin}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Destination Wallet Address</label>
                <input
                  type="text"
                  required
                  placeholder="Enter external crypto address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Withdraw Amount</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '14px', fontSize: '16px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '32px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Simulate Internal Transfer</h3>
              <button onClick={() => setShowTransfer(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {formSuccess ? (
              <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formSuccess}</div>
            ) : formError ? (
              <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formError}</div>
            ) : null}

            <form onSubmit={handleTransferSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>From</label>
                  <select
                    value={transferFrom}
                    onChange={(e) => { setTransferFrom(e.target.value); setTransferTo(e.target.value === 'Spot' ? 'Funding' : 'Spot'); }}
                    style={{
                      width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                    }}
                  >
                    <option value="Spot">Spot Wallet</option>
                    <option value="Funding">Funding Wallet</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>To</label>
                  <select
                    value={transferTo}
                    onChange={(e) => { setTransferTo(e.target.value); setTransferFrom(e.target.value === 'Spot' ? 'Funding' : 'Spot'); }}
                    style={{
                      width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                    }}
                  >
                    <option value="Funding">Funding Wallet</option>
                    <option value="Spot">Spot Wallet</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Select Asset</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                >
                  {wallets.map(w => <option key={w.coin} value={w.coin}>{w.coin}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>Transfer Amount</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  style={{
                    width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '14px'
                  }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '14px', fontSize: '16px', fontWeight: '600' }}>
                Confirm Transfer
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
