'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Actions states
  const [submittingId, setSubmittingId] = useState(null);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/transactions?type=${typeFilter}&status=${statusFilter}`);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      console.error('Failed to load transaction log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, statusFilter]);

  const handleApprove = async (txId) => {
    if (!window.confirm('Are you sure you want to APPROVE this transaction?')) return;
    setSubmittingId(txId);
    setFormSuccess('');
    setFormError('');
    try {
      const res = await api.post(`/admin/transactions/${txId}/approve`);
      setFormSuccess(res.data.message || 'Transaction approved successfully');
      await fetchTransactions();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to approve transaction');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleReject = async (txId) => {
    if (!window.confirm('Are you sure you want to REJECT this transaction?')) return;
    setSubmittingId(txId);
    setFormSuccess('');
    setFormError('');
    try {
      const res = await api.post(`/admin/transactions/${txId}/reject`);
      setFormSuccess(res.data.message || 'Transaction rejected successfully');
      await fetchTransactions();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to reject transaction');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        System Transaction Ledger
      </h1>

      {formSuccess && (
        <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '12px 18px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
          ✓ {formSuccess}
        </div>
      )}
      {formError && (
        <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '12px 18px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
          ⚠ {formError}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '30px', alignItems: 'center' }}>
        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['', 'DEPOSIT', 'WITHDRAW', 'TRADE'].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              backgroundColor: typeFilter === t ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: typeFilter === t ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: '600',
              fontSize: '13px'
            }}>
              {t === '' ? 'All Types' : t}
            </button>
          ))}
        </div>

        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px' }}>
          {[
            { label: 'All Statuses', val: '' },
            { label: 'Pending Approvals', val: 'PENDING' },
            { label: 'Completed', val: 'COMPLETED' },
            { label: 'Failed/Rejected', val: 'FAILED' }
          ].map((st) => (
            <button key={st.val} onClick={() => setStatusFilter(st.val)} style={{
              padding: '8px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
              backgroundColor: statusFilter === st.val ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
              color: statusFilter === st.val ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: '600',
              fontSize: '13px'
            }}>
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>No transactions recorded matching the criteria.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 24px' }}>Transaction ID</th>
                  <th style={{ padding: '16px 24px' }}>User</th>
                  <th style={{ padding: '16px 24px' }}>Type</th>
                  <th style={{ padding: '16px 24px' }}>Asset</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Fee</th>
                  <th style={{ padding: '16px 24px' }}>Date</th>
                  <th style={{ padding: '16px 24px' }}>Status</th>
                  <th style={{ padding: '16px 24px' }}>Note</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '11px' }}>{tx.id}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '600' }}>{tx.username}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{tx.email}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        color: tx.type === 'DEPOSIT' ? 'var(--success)' : tx.type === 'WITHDRAW' ? 'var(--danger)' : 'var(--primary)',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        backgroundColor: tx.type === 'DEPOSIT' ? 'rgba(14, 203, 129, 0.1)' : tx.type === 'WITHDRAW' ? 'rgba(246, 70, 93, 0.1)' : 'rgba(240, 185, 11, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>{tx.type}</span>
                    </td>
                    <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{tx.coin}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 'bold' }}>
                      {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.amount}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-secondary)' }}>{tx.fee}</td>
                    <td style={{ padding: '16px 24px' }}>{new Date(tx.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        color: tx.status === 'COMPLETED' ? 'var(--success)' : tx.status === 'PENDING' ? 'var(--warning)' : 'var(--danger)',
                        fontWeight: 'bold',
                        fontSize: '11px',
                        backgroundColor: tx.status === 'COMPLETED' ? 'rgba(14, 203, 129, 0.1)' : tx.status === 'PENDING' ? 'rgba(240, 185, 11, 0.1)' : 'rgba(246, 70, 93, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '3px'
                      }}>{tx.status}</span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-secondary)' }}>{tx.note || tx.txHash}</td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {tx.status === 'PENDING' && (tx.type === 'DEPOSIT' || tx.type === 'WITHDRAW') ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleApprove(tx.id)}
                            disabled={submittingId === tx.id}
                            style={{
                              backgroundColor: 'var(--success)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(tx.id)}
                            disabled={submittingId === tx.id}
                            style={{
                              backgroundColor: 'var(--danger)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
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
