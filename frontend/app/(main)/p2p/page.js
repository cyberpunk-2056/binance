'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/websocket';
import CoinIcon from '@/components/CoinIcon';

export default function P2P() {
  const { user, loading } = useAuth();
  const { fmt, currency, getCurrencyInfo, rates } = useCurrency();
  const router = useRouter();

  // Active Ads & Filters
  const [ads, setAds] = useState([]);
  const [adCoin, setAdCoin] = useState('USDT');
  const [adType, setAdType] = useState('BUY'); // BUY or SELL
  const [adsLoading, setAdsLoading] = useState(true);

  // Active P2P Order / Chat Room
  const [myOrders, setMyOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const chatBottomRef = useRef(null);

  // Modal States
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [showBuySellModal, setShowBuySellModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState(null);
  const [tradeAmount, setTradeAmount] = useState('');

  // Create Ad Form State
  const [newAd, setNewAd] = useState({
    type: 'BUY', coin: 'USDT', currency: 'USD', price: '', minAmount: '', maxAmount: '', totalAmount: '', paymentMethod: 'Bank Transfer', terms: ''
  });

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load Ads and User Orders
  const loadAds = async () => {
    try {
      const res = await api.get(`/p2p/ads?type=${adType}&coin=${adCoin}`);
      setAds(res.data.ads || []);
    } catch (err) {
      console.error('Failed to load P2P ads:', err);
    } finally {
      setAdsLoading(false);
    }
  };

  const loadMyOrders = async () => {
    if (!user) return;
    try {
      const res = await api.get('/p2p/orders');
      setMyOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to load user P2P orders:', err);
    }
  };

  useEffect(() => {
    loadAds();
  }, [adCoin, adType]);

  useEffect(() => {
    loadMyOrders();
  }, [user]);

  // Socket connection for active order chats
  useEffect(() => {
    if (!activeOrder) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('subscribe', [`p2p_${activeOrder.id}`]);

    const handleChat = (data) => {
      setActiveOrder((prev) => {
        if (prev && prev.id === data.chat.orderId) {
          // Prevent duplicates
          if (prev.chats.some((c) => c.id === data.chat.id)) return prev;
          return { ...prev, chats: [...prev.chats, data.chat] };
        }
        return prev;
      });
    };

    const handleStatus = (data) => {
      setActiveOrder((prev) => {
        if (prev && prev.id === data.orderId) {
          return { ...prev, status: data.status };
        }
        return prev;
      });
      loadMyOrders();
    };

    socket.on('p2p_chat', handleChat);
    socket.on('p2p_status', handleStatus);

    // Scroll to bottom
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    return () => {
      socket.emit('unsubscribe', [`p2p_${activeOrder.id}`]);
      socket.off('p2p_chat', handleChat);
      socket.off('p2p_status', handleStatus);
    };
  }, [activeOrder]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeOrder?.chats]);

  const selectOrder = async (orderId) => {
    try {
      const res = await api.get(`/p2p/orders/${orderId}`);
      setActiveOrder(res.data.order);
    } catch (err) {
      alert('Failed to load order info');
    }
  };

  // Submit Ad Creation
  const handleCreateAdSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const priceInUSD = parseFloat(newAd.price) / (rates[currency] || 1);
      const payload = {
        ...newAd,
        price: priceInUSD,
        currency: currency
      };
      await api.post('/p2p/ads', payload);
      setFormSuccess('Ad posted successfully!');
      loadAds();
      setTimeout(() => setShowCreateAd(false), 2000);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Ad creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Trade Order Execution
  const handlePlaceTradeSubmit = async (e) => {
    e.preventDefault();
    if (!user) { router.push('/login'); return; }

    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await api.post('/p2p/orders', { adId: selectedAd.id, amount: parseFloat(tradeAmount) });
      setFormSuccess('Trade initiated successfully!');
      loadMyOrders();
      selectOrder(res.data.order.id);
      setTimeout(() => {
        setShowBuySellModal(false);
        setTradeAmount('');
      }, 2000);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to place trade');
    } finally {
      setSubmitting(false);
    }
  };

  // Send Chat message
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    try {
      const msg = chatMessage;
      setChatMessage('');
      await api.post(`/p2p/orders/${activeOrder.id}/chat`, { message: msg });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Update Status
  const handleUpdateStatus = async (status) => {
    if (!confirm(`Are you sure you want to change order status to ${status}?`)) return;
    try {
      await api.put(`/p2p/orders/${activeOrder.id}/status`, { status });
      setActiveOrder(prev => ({ ...prev, status }));
      loadMyOrders();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
              P2P Trade Desk
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Buy and sell crypto directly with other users via bank transfer and local wallets.
            </p>
          </div>
          <button
            onClick={() => {
              if (!user) {
                router.push('/login');
              } else {
                setFormError('');
                setFormSuccess('');
                setNewAd({
                  type: 'BUY',
                  coin: 'USDT',
                  currency: currency,
                  price: '',
                  minAmount: '',
                  maxAmount: '',
                  totalAmount: '',
                  paymentMethod: 'Bank Transfer',
                  terms: ''
                });
                setShowCreateAd(true);
              }
            }}
            className="btn-primary"
            style={{ padding: '12px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: '600' }}
          >
            Post Trade Ad
          </button>
        </div>

        {/* Filters and Active Orders Row */}
        <div className="grid-split-p2p">
          
          {/* Main Ad lists Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top filters */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setAdType('BUY')} style={{
                  padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  backgroundColor: adType === 'BUY' ? 'rgba(14, 203, 129, 0.1)' : 'transparent',
                  color: adType === 'BUY' ? 'var(--success)' : 'var(--text-secondary)', fontWeight: 'bold'
                }}>
                  Buy Crypto
                </button>
                <button onClick={() => setAdType('SELL')} style={{
                  padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  backgroundColor: adType === 'SELL' ? 'rgba(246, 70, 93, 0.1)' : 'transparent',
                  color: adType === 'SELL' ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 'bold'
                }}>
                  Sell Crypto
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {['USDT', 'BTC', 'ETH', 'BNB'].map((coin) => (
                  <button key={coin} onClick={() => setAdCoin(coin)} style={{
                    padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    backgroundColor: adCoin === coin ? 'var(--bg-tertiary)' : 'transparent',
                    color: adCoin === coin ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: '600'
                  }}>
                    {coin}
                  </button>
                ))}
              </div>
            </div>

            {/* Ads List Card */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              {adsLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading ads...</div>
              ) : ads.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>No ads posted currently. Be the first to post!</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        <th style={{ padding: '16px 24px' }}>Merchant</th>
                        <th style={{ padding: '16px 24px' }}>Price</th>
                        <th style={{ padding: '16px 24px' }}>Available / Limit</th>
                        <th style={{ padding: '16px 24px' }}>Payment Method</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Trade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.map((ad) => (
                        <tr key={ad.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-primary)' }}>
                          <td style={{ padding: '18px 24px' }}>
                            <div style={{ fontWeight: 'bold' }}>{ad.username}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Member since {new Date(ad.userCreatedAt).toLocaleDateString()}</div>
                          </td>
                          <td style={{ padding: '18px 24px' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                              {fmt(ad.price, { minDecimals: 2 })}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{currency} / {ad.coin}</div>
                          </td>
                          <td style={{ padding: '18px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <CoinIcon coin={ad.coin} size={16} />
                              <span>Available: {ad.availableAmount} {ad.coin}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Limit: {fmt(ad.minAmount)} – {fmt(ad.maxAmount)}</div>
                          </td>
                          <td style={{ padding: '18px 24px' }}>
                            <span style={{ backgroundColor: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                              {ad.paymentMethod}
                            </span>
                          </td>
                          <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                            <button
                              onClick={() => { setSelectedAd(ad); setFormError(''); setFormSuccess(''); setShowBuySellModal(true); }}
                              className={adType === 'BUY' ? 'btn-primary' : 'btn-secondary'}
                              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              {adType === 'BUY' ? `Buy ${ad.coin}` : `Sell ${ad.coin}`}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: My Active Trades / History */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px',
            maxHeight: '500px', overflowY: 'auto'
          }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '20px' }}>My P2P Trades</h3>
            
            {!user ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                Log in to view active trades.
              </div>
            ) : myOrders.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                No active P2P trades.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myOrders.map((order) => {
                  const isSeller = order.sellerId === user.id;
                  const partyName = isSeller ? order.buyerUsername : order.sellerUsername;
                  const sideText = isSeller ? 'Sell' : 'Buy';
                  
                  return (
                    <div
                      key={order.id}
                      onClick={() => selectOrder(order.id)}
                      style={{
                        padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer',
                        backgroundColor: activeOrder?.id === order.id ? 'var(--bg-tertiary)' : 'transparent',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={(e) => { if (activeOrder?.id !== order.id) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      onMouseLeave={(e) => { if (activeOrder?.id !== order.id) e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: isSeller ? 'var(--danger)' : 'var(--success)' }}>
                          {sideText} {order.coin}
                        </span>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          {order.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Trader: <strong>{partyName}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Amt: {order.amount} {order.coin} | Total: {fmt(order.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Escrow Workspace (Active selected order chat & status controls) */}
        {activeOrder && (
          <div className="grid-split-escrow" style={{
            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '24px'
          }}>
            {/* Left: Escrow workflow status */}
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '16px' }}>
                Escrow Order ID: <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--primary)' }}>{activeOrder.id}</span>
              </h3>
              
              <div style={{
                backgroundColor: 'var(--bg-tertiary)', padding: '20px', borderRadius: '6px', border: '1px solid var(--border-color)',
                marginBottom: '24px'
              }}>
                <div className="escrow-stats-grid">
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Asset Amount:</span>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>{activeOrder.amount} {activeOrder.coin}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Total fiat value:</span>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>{fmt(activeOrder.total)} {currency}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Rate (Price):</span>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px' }}>{fmt(activeOrder.price, { minDecimals: 2 })} / {activeOrder.coin}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Payment terms:</span>
                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px' }}>Bank Wire Transfer</div>
                  </div>
                </div>
              </div>

              {/* Status details step indicator */}
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Escrow Workflow</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--success)' }}></div>
                  <div style={{ flex: 1, height: '4px', backgroundColor: ['PAID', 'COMPLETED'].includes(activeOrder.status) ? 'var(--success)' : 'var(--bg-tertiary)' }}></div>
                  <div style={{ flex: 1, height: '4px', backgroundColor: activeOrder.status === 'COMPLETED' ? 'var(--success)' : 'var(--bg-tertiary)' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  <span>1. Placed</span>
                  <span>2. Paid</span>
                  <span>3. Released</span>
                </div>
              </div>

              {/* Status actions */}
              <div style={{ display: 'flex', gap: '16px' }}>
                {/* Buyer Controls */}
                {activeOrder.buyerId === user.id && activeOrder.status === 'PENDING' && (
                  <>
                    <button onClick={() => handleUpdateStatus('PAID')} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                      I Have Paid
                    </button>
                    <button onClick={() => handleUpdateStatus('CANCELLED')} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Cancel Order
                    </button>
                  </>
                )}

                {/* Seller Controls */}
                {activeOrder.sellerId === user.id && activeOrder.status === 'PAID' && (
                  <>
                    <button onClick={() => handleUpdateStatus('COMPLETED')} className="btn-primary" style={{ padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'var(--success)' }}>
                      Release Crypto Assets
                    </button>
                    <button onClick={() => handleUpdateStatus('DISPUTED')} className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                      Open Dispute
                    </button>
                  </>
                )}

                {activeOrder.status === 'COMPLETED' && (
                  <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '16px' }}>
                    ✓ Order completed. Asset has been transferred from escrow to funding wallet.
                  </div>
                )}

                {activeOrder.status === 'CANCELLED' && (
                  <div style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '16px' }}>
                    ✗ Order cancelled by buyer. Funds returned to seller.
                  </div>
                )}

                {activeOrder.status === 'DISPUTED' && (
                  <div style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '16px' }}>
                    ⚠️ Order in dispute. Admin is reviewing evidence in chat.
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live Chat Box */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                Chat with {activeOrder.sellerId === user.id ? activeOrder.buyerUsername : activeOrder.sellerUsername}
              </div>

              {/* Message History */}
              <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeOrder.chats?.map((chat) => {
                  const isMe = chat.senderId === user.id;
                  return (
                    <div key={chat.id} style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      backgroundColor: isMe ? 'rgba(240, 185, 11, 0.15)' : 'var(--bg-tertiary)',
                      border: `1px solid ${isMe ? 'var(--primary)' : 'var(--border-color)'}`,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      maxWidth: '80%'
                    }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                        {chat.senderUsername} • {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{chat.message}</div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} style={{ borderTop: '1px solid var(--border-color)', display: 'flex' }}>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  style={{ flex: 1, padding: '12px', backgroundColor: 'var(--bg-secondary)', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
                />
                <button type="submit" style={{ padding: '12px 20px', border: 'none', backgroundColor: 'var(--primary)', color: 'var(--bg-primary)', fontWeight: 'bold', cursor: 'pointer' }}>
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Buy / Sell modal */}
      {showBuySellModal && selectedAd && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '32px', width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {adType === 'BUY' ? 'Buy' : 'Sell'} {selectedAd.coin}
              </h3>
              <button onClick={() => setShowBuySellModal(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {formSuccess ? (
              <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formSuccess}</div>
            ) : formError ? (
              <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formError}</div>
            ) : null}

            <form onSubmit={handlePlaceTradeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Price rate:</span>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {fmt(selectedAd.price, { minDecimals: 2 })} {currency} / {selectedAd.coin}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>
                  Amount to Trade ({selectedAd.coin})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={`Min ${selectedAd.minAmount} - Max ${selectedAd.maxAmount}`}
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value)}
                  style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                  Total Cost: {fmt((parseFloat(tradeAmount || 0) * selectedAd.price), { minDecimals: 2 })} {currency}
                </span>
              </div>

              <div style={{ border: '1px dashed var(--border-color)', padding: '12px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <strong>Terms of Trade:</strong><br />
                {selectedAd.terms || 'No terms provided by merchant.'}
              </div>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '14px', fontSize: '16px', fontWeight: '600' }}>
                {submitting ? 'Initiating trade...' : 'Confirm Order'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create Ad Modal */}
      {showCreateAd && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '32px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Post P2P Advertisement</h3>
              <button onClick={() => setShowCreateAd(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {formSuccess ? (
              <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formSuccess}</div>
            ) : formError ? (
              <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '16px', borderRadius: '4px', marginBottom: '20px' }}>{formError}</div>
            ) : null}

            <form onSubmit={handleCreateAdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Ad Type</label>
                  <select value={newAd.type} onChange={(e) => setNewAd({ ...newAd, type: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                    <option value="BUY">Buy (I want to buy)</option>
                    <option value="SELL">Sell (I want to sell)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Crypto Coin</label>
                  <select value={newAd.coin} onChange={(e) => setNewAd({ ...newAd, coin: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                    <option value="USDT">USDT</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="BNB">BNB</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Price ({currency} Rate)</label>
                  <input type="number" step="any" required value={newAd.price} onChange={(e) => setNewAd({ ...newAd, price: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  {currency !== 'USD' && newAd.price && (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                      ≈ ${(parseFloat(newAd.price) / (rates[currency] || 1)).toFixed(4)} USD
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Total Volume (Amount)</label>
                  <input type="number" step="any" required value={newAd.totalAmount} onChange={(e) => setNewAd({ ...newAd, totalAmount: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Min Limit (Crypto Amount)</label>
                  <input type="number" step="any" required value={newAd.minAmount} onChange={(e) => setNewAd({ ...newAd, minAmount: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Max Limit (Crypto Amount)</label>
                  <input type="number" step="any" required value={newAd.maxAmount} onChange={(e) => setNewAd({ ...newAd, maxAmount: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Payment Method</label>
                <select value={newAd.paymentMethod} onChange={(e) => setNewAd({ ...newAd, paymentMethod: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Revolut">Revolut</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Apple Pay">Apple Pay</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '6px' }}>Terms of Trade (Instructions)</label>
                <textarea rows="3" value={newAd.terms} onChange={(e) => setNewAd({ ...newAd, terms: e.target.value })} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', outline: 'none' }} />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '12px', fontSize: '16px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Posting...' : 'Post Ad'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
