'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Inspector States
  const [selectedUser, setSelectedUser] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [kycStatusInput, setKycStatusInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const [roleInput, setRoleInput] = useState('');

  // Balance Form State
  const [adjustCoin, setAdjustCoin] = useState('USDT');
  const [adjustBalance, setAdjustBalance] = useState('');
  const [adjustLockedBalance, setAdjustLockedBalance] = useState('');
  const [adjustAddress, setAdjustAddress] = useState('');

  // Auto-fill wallet configurations when user or selected coin changes
  useEffect(() => {
    if (selectedUser) {
      const wallet = selectedUser.wallets?.find(w => w.coin === adjustCoin);
      if (wallet) {
        setAdjustBalance(String(wallet.balance || 0));
        setAdjustLockedBalance(String(wallet.lockedBalance || 0));
        setAdjustAddress(wallet.address || '');
      } else {
        setAdjustBalance('0');
        setAdjustLockedBalance('0');
        setAdjustAddress('0x9F04b2b03D9B87b2EA9087AcdA92d96F5f17BEBd');
      }
    }
  }, [adjustCoin, selectedUser]);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get(`/admin/users?search=${search}`);
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load user manager database listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const inspectUser = async (userId) => {
    setInspectorLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setSelectedUser(res.data.user);
      setKycStatusInput(res.data.user.kycStatus);
      setStatusInput(res.data.user.status);
      setRoleInput(res.data.user.role);
    } catch (err) {
      alert('Failed to inspect user details');
    } finally {
      setInspectorLoading(false);
    }
  };

  // Submit User Info Update
  const handleUpdateUserInfo = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await api.put(`/admin/users/${selectedUser.id}`, {
        status: statusInput,
        role: roleInput,
        kycStatus: kycStatusInput
      });
      setFormSuccess('User profile details updated successfully!');
      // Refresh inspector and main list
      inspectUser(selectedUser.id);
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update user profile info');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Balance Adjustment
  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const bal = adjustBalance === '' ? 0 : parseFloat(adjustBalance);
    const lck = adjustLockedBalance === '' ? 0 : parseFloat(adjustLockedBalance);
    if (bal < 0 || lck < 0) {
      setFormError('Balances cannot be negative');
      return;
    }
    setSubmitting(true);

    try {
      await api.put(`/admin/users/${selectedUser.id}/balance`, {
        coin: adjustCoin,
        balance: bal,
        lockedBalance: lck,
        address: adjustAddress
      });
      setFormSuccess(`Wallet settings for ${adjustCoin} updated: Available = ${bal}, Locked = ${lck}, Address = ${adjustAddress}!`);
      // Refresh user wallets
      inspectUser(selectedUser.id);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to adjust balance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        User Management Directory
      </h1>

      <div className="grid-split-2-1">
        
        {/* Left Side: Users List & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <input
              type="text"
              placeholder="Search users by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '14px'
              }}
            />
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading directory...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matches found in database.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 18px' }}>User Details</th>
                      <th style={{ padding: '12px 18px' }}>Role</th>
                      <th style={{ padding: '12px 18px' }}>KYC</th>
                      <th style={{ padding: '12px 18px' }}>Status</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        onClick={() => inspectUser(u.id)}
                        style={{
                          borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer',
                          backgroundColor: selectedUser?.id === u.id ? 'var(--bg-tertiary)' : 'transparent',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => { if (selectedUser?.id !== u.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                        onMouseLeave={(e) => { if (selectedUser?.id !== u.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{ fontWeight: '600', color: u.role === 'ADMIN' ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 'bold',
                            color: u.kycStatus === 'APPROVED' ? 'var(--success)' : u.kycStatus === 'REJECTED' ? 'var(--danger)' : 'var(--warning)'
                          }}>
                            {u.kycStatus}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span style={{
                            fontSize: '11px', fontWeight: 'bold',
                            color: u.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)'
                          }}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button onClick={(e) => { e.stopPropagation(); inspectUser(u.id); }} style={{
                            padding: '4px 8px', fontSize: '12px', border: '1px solid var(--primary)', borderRadius: '4px',
                            color: 'var(--primary)', backgroundColor: 'transparent', cursor: 'pointer'
                          }}>
                            Inspect
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

        {/* Right Side: User Inspector & Balance Adjustments */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px',
          minHeight: '400px'
        }}>
          {inspectorLoading ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '100px' }}>Loading profile audit details...</div>
          ) : !selectedUser ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', paddingTop: '100px' }}>
              Select a user from the directory list to audit profiles, change security roles, process KYC limits, or adjust coin balances.
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '8px' }}>
                Auditing: {selectedUser.username}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px', fontFamily: 'monospace' }}>
                Database ID: {selectedUser.id}
              </p>

              {formSuccess && <div style={{ color: 'var(--success)', fontSize: '13px', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{formSuccess}</div>}
              {formError && <div style={{ color: 'var(--danger)', fontSize: '13px', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{formError}</div>}

              {/* Status form */}
              <form onSubmit={handleUpdateUserInfo} style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>Account Status</label>
                    <select value={statusInput} onChange={(e) => setStatusInput(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="BANNED">BANNED</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>KYC Status</label>
                    <select value={kycStatusInput} onChange={(e) => setKycStatusInput(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px' }}>Security Role</label>
                  <select value={roleInput} onChange={(e) => setRoleInput(e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px', fontSize: '13px', fontWeight: 'bold' }}>
                  Update User Profile Settings
                </button>
              </form>

              {/* Wallet balances summary & adjust form */}
              <div>
                <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '12px' }}>Spot Balance Audits</h4>
                
                {/* List wallet balances */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                  {selectedUser.wallets?.map(w => (
                    <div key={w.coin} style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{w.coin}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                          {w.address || 'No Address'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', textAlign: 'right', flexShrink: 0 }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Available</div>
                           <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{w.balance?.toFixed(w.coin === 'BTC' ? 5 : 2)}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Locked</div>
                          <div style={{ fontWeight: 'bold', color: 'var(--warning)' }}>{(w.lockedBalance || 0)?.toFixed(w.coin === 'BTC' ? 5 : 2)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Balance Adjuster Form */}
                <form onSubmit={handleAdjustBalance} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Override Coin / Create Wallet</span>
                  
                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <select value={adjustCoin} onChange={(e) => setAdjustCoin(e.target.value)} style={{ width: '120px', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                        {['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOGE', 'XRP', 'DOT', 'AVAX', 'LINK', 'MATIC'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        {selectedUser.wallets?.some(w => w.coin === adjustCoin) ? 'Existing Wallet' : 'Will Initialize New Wallet'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="New Available Balance"
                        value={adjustBalance}
                        onChange={(e) => setAdjustBalance(e.target.value)}
                        style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                      />
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="New Locked Balance"
                        value={adjustLockedBalance}
                        onChange={(e) => setAdjustLockedBalance(e.target.value)}
                        style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input
                        type="text"
                        required
                        placeholder="Deposit Wallet Address"
                        value={adjustAddress}
                        onChange={(e) => setAdjustAddress(e.target.value)}
                        style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={submitting} className="btn-secondary" style={{ padding: '10px', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    Confirm Wallet Adjustment
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
