'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminSettings() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('INFO'); // INFO, WARNING, DANGER

  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Settings State
  const [autoApproveDeposits, setAutoApproveDeposits] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/admin/announcements');
      setAnnouncements(res.data.announcements || []);
    } catch (err) {
      console.error('Failed to load announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const res = await api.get('/admin/settings');
      setAutoApproveDeposits(res.data.settings?.auto_approve_deposits === 'true');
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchSettings();
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      await api.post('/admin/announcements', { title, content, type });
      setFormSuccess('Announcement published!');
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      alert('Announcement deleted');
      fetchAnnouncements();
    } catch (err) {
      alert('Failed to delete announcement');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');
    setSavingSettings(true);
    try {
      await api.post('/admin/settings', {
        settings: {
          auto_approve_deposits: String(autoApproveDeposits)
        }
      });
      setSettingsSuccess('System configurations updated successfully!');
    } catch (err) {
      setSettingsError(err.response?.data?.error || 'Failed to update system settings');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        Announcements & Settings Manager
      </h1>

      <div className="grid-split-2-1">
        
        {/* Left Side: Create / Post announcements */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
          <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '20px' }}>
            Publish Site Announcement
          </h3>

          {formSuccess && <div style={{ color: 'var(--success)', fontSize: '13px', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{formSuccess}</div>}
          {formError && <div style={{ color: 'var(--danger)', fontSize: '13px', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{formError}</div>}

          <form onSubmit={handleCreateAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Announcement Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="System maintenance, etc..."
                style={{
                  width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '4px', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Announcement Body</label>
              <textarea
                rows="4"
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write message to users..."
                style={{
                  width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)', borderRadius: '4px', outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>Category Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}>
                <option value="INFO">INFORMATION (Blue)</option>
                <option value="WARNING">WARNING (Yellow)</option>
                <option value="DANGER">CRITICAL / DANGER (Red)</option>
              </select>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>
              {submitting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </form>
        </div>

        {/* Right Side: Settings & Active announcements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* System Settings Options */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '20px' }}>
              System Configurations
            </h3>
            {settingsSuccess && <div style={{ color: 'var(--success)', fontSize: '13px', backgroundColor: 'rgba(14, 203, 129, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{settingsSuccess}</div>}
            {settingsError && <div style={{ color: 'var(--danger)', fontSize: '13px', backgroundColor: 'rgba(246, 70, 93, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '16px' }}>{settingsError}</div>}
            
            {settingsLoading ? (
              <div style={{ color: 'var(--text-secondary)' }}>Loading system preferences...</div>
            ) : (
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    id="autoApproveDeposits"
                    checked={autoApproveDeposits}
                    onChange={(e) => setAutoApproveDeposits(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="autoApproveDeposits" style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                    Auto-Approve Crypto Deposits
                  </label>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                  When enabled, user deposit simulations will be processed automatically and credit the user's wallet immediately.
                </p>
                <button type="submit" disabled={savingSettings} className="btn-secondary" style={{ padding: '10px', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                  {savingSettings ? 'Saving...' : 'Apply Configurations'}
                </button>
              </form>
            )}
          </div>

          {/* Active announcements list */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '20px' }}>
              Active Announcements
            </h3>

            {loading ? (
              <div style={{ color: 'var(--text-secondary)' }}>Loading announcements...</div>
            ) : announcements.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>No announcements posted.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {announcements.map((ann) => (
                  <div key={ann.id} style={{
                    padding: '16px', border: '1px solid var(--border-color)', borderRadius: '6px',
                    backgroundColor: ann.type === 'DANGER' ? 'rgba(246, 70, 93, 0.05)' : ann.type === 'WARNING' ? 'rgba(240, 185, 11, 0.05)' : 'var(--bg-tertiary)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{
                        fontWeight: 'bold', fontSize: '14px',
                        color: ann.type === 'DANGER' ? 'var(--danger)' : ann.type === 'WARNING' ? 'var(--warning)' : 'var(--text-primary)'
                      }}>
                        {ann.title}
                      </span>
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} style={{
                        background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '14px'
                      }}>
                        Delete
                      </button>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                      {ann.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
