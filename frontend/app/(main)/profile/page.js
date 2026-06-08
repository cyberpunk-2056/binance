'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { api } from '@/lib/api';

export default function Profile() {
  const { user, loading, reload } = useAuth();
  const router = useRouter();

  // Profile Inputs
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');

  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Sessions
  const [sessions, setSessions] = useState([]);

  // States
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auth Protection
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setPhone(user.phone || '');
    setCountry(user.country || '');

    const fetchSessions = async () => {
      try {
        const res = await api.get('/user/sessions');
        setSessions(res.data.sessions || []);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      }
    };
    fetchSessions();
  }, [user]);

  if (loading || !user) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Loading user settings...
        </div>
        <Footer />
      </div>
    );
  }

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      await api.put('/user/profile', { firstName, lastName, phone, country });
      setFormSuccess('Profile details updated successfully!');
      reload();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      return;
    }
    setSubmitting(true);

    try {
      await api.put('/user/password', { currentPassword, newPassword });
      setFormSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit KYC Review
  const handleSubmitKYC = async () => {
    setFormError('');
    setFormSuccess('');
    try {
      await api.post('/user/kyc');
      setFormSuccess('Simulated identity documents submitted! Verification status pending admin audit.');
      reload();
    } catch (err) {
      setFormError('Failed to submit KYC documents.');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '40px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '32px' }}>
          Account & Profile Settings
        </h1>

        {formSuccess && <div style={{ color: 'var(--success)', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '12px', borderRadius: '4px', marginBottom: '24px', fontSize: '14px' }}>{formSuccess}</div>}
        {formError && <div style={{ color: 'var(--danger)', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '12px', borderRadius: '4px', marginBottom: '24px', fontSize: '14px' }}>{formError}</div>}

        <div className="grid-split-2-1">
          
          {/* Left Panel: Profile settings and Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Profile fields */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '20px' }}>Personal Information</h3>
              
              <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Phone Number</label>
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Country</label>
                    <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', width: '200px' }}>
                  {submitting ? 'Saving...' : 'Save Profile Details'}
                </button>
              </form>
            </div>

            {/* Password fields */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '20px' }}>Change Password</h3>
              
              <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Current Password</label>
                  <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                </div>
                
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Confirm New Password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }} />
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="btn-secondary" style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold', width: '200px' }}>
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>

          </div>

          {/* Right Panel: Identity verification, Sessions, Referral codes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Identity / KYC Review panel */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '16px' }}>Identity Verification (KYC)</h3>
              
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</span>
                <div style={{
                  color: user.kycStatus === 'APPROVED' ? 'var(--success)' : user.kycStatus === 'REJECTED' ? 'var(--danger)' : 'var(--warning)',
                  fontWeight: 'bold', fontSize: '18px', marginTop: '4px'
                }}>
                  {user.kycStatus === 'APPROVED' ? '✓ Verified / Complete' : user.kycStatus === 'PENDING' ? '⏳ Under Admin Review' : '⚠ Action Required: Submit Identity Info'}
                </div>
              </div>

              {user.kycStatus === 'UNVERIFIED' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                    Upload your passport or national ID cards to lift daily deposit limits and access direct P2P advertisements.
                  </p>
                  <button onClick={handleSubmitKYC} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>
                    Submit Identity for Review
                  </button>
                </div>
              )}

              {user.kycStatus === 'PENDING' && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
                  We are auditing your files. Reviews are completed within 1 hour. You can use admin controls to approve KYC instantly.
                </p>
              )}
            </div>

            {/* Active login sessions */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '16px' }}>Active Login Sessions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{s.device || 'Web Browser'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>IP: {s.ip}</div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
