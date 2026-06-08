'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function P2PManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchOrders = async () => {
    try {
      const res = await api.get(`/admin/p2p?status=${statusFilter}`);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to load P2P orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleForceStatus = async (orderId, status) => {
    if (!confirm(`Force order status to ${status}? This overrides all standard seller/buyer controls.`)) return;
    try {
      await api.put(`/p2p/orders/${orderId}/status`, { status });
      alert('Order status adjusted!');
      fetchOrders();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        P2P Transaction & Escrow Manager
      </h1>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => setStatusFilter('')} style={{
          padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
          backgroundColor: statusFilter === '' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
          color: statusFilter === '' ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: '600'
        }}>
          All Orders
        </button>
        <button onClick={() => setStatusFilter('DISPUTED')} style={{
          padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
          backgroundColor: statusFilter === 'DISPUTED' ? 'rgba(240, 185, 11, 0.1)' : 'var(--bg-secondary)',
          color: statusFilter === 'DISPUTED' ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: '600'
        }}>
          Disputed Only
        </button>
        <button onClick={() => setStatusFilter('PENDING')} style={{
          padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
          backgroundColor: statusFilter === 'PENDING' ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
          color: 'var(--text-secondary)', fontWeight: '600'
        }}>
          Pending Pay
        </button>
        <button onClick={() => setStatusFilter('PAID')} style={{
          padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
          backgroundColor: statusFilter === 'PAID' ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
          color: 'var(--text-secondary)', fontWeight: '600'
        }}>
          Paid (Escrow Active)
        </button>
      </div>

      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading transactions...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>No orders match this criteria.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 24px' }}>Order ID</th>
                  <th style={{ padding: '16px 24px' }}>Seller</th>
                  <th style={{ padding: '16px 24px' }}>Buyer</th>
                  <th style={{ padding: '16px 24px' }}>Asset Amount</th>
                  <th style={{ padding: '16px 24px' }}>Total Price</th>
                  <th style={{ padding: '16px 24px' }}>Date Placed</th>
                  <th style={{ padding: '16px 24px' }}>Status</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Dispute Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '12px' }}>{order.id}</td>
                    <td style={{ padding: '16px 24px' }}>{order.sellerUsername}</td>
                    <td style={{ padding: '16px 24px' }}>{order.buyerUsername}</td>
                    <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{order.amount} {order.coin}</td>
                    <td style={{ padding: '16px 24px' }}>${order.total?.toFixed(2)} USD</td>
                    <td style={{ padding: '16px 24px' }}>{new Date(order.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        color: order.status === 'COMPLETED' ? 'var(--success)' : order.status === 'DISPUTED' ? 'var(--warning)' : order.status === 'CANCELLED' ? 'var(--text-secondary)' : 'var(--text-primary)',
                        fontWeight: 'bold'
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      {['PAID', 'DISPUTED', 'PENDING'].includes(order.status) && (
                        <>
                          <button
                            onClick={() => handleForceStatus(order.id, 'COMPLETED')}
                            style={{
                              padding: '4px 8px', fontSize: '11px', backgroundColor: 'var(--success)', border: 'none', color: 'white',
                              borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer'
                            }}
                          >
                            Release Assets
                          </button>
                          <button
                            onClick={() => handleForceStatus(order.id, 'CANCELLED')}
                            style={{
                              padding: '4px 8px', fontSize: '11px', backgroundColor: 'transparent', border: '1px solid var(--danger)',
                              color: 'var(--danger)', borderRadius: '4px', cursor: 'pointer'
                            }}
                          >
                            Cancel Trade
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
