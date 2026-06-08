'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/admin/logs');
        setLogs(res.data.logs || []);
      } catch (err) {
        console.error('Failed to load admin logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: '28px', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '24px' }}>
        Admin Audit Logs
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Audit logs tracking all administrative interventions, KYC adjustments, security reviews, and balance alterations.
      </p>

      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading audit trail...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>No audit log events recorded.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '16px 24px' }}>Log ID</th>
                  <th style={{ padding: '16px 24px' }}>Administrator</th>
                  <th style={{ padding: '16px 24px' }}>Action Logged</th>
                  <th style={{ padding: '16px 24px' }}>Target User ID</th>
                  <th style={{ padding: '16px 24px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '11px' }}>{log.id}</td>
                    <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>{log.adminUsername || 'Admin'}</td>
                    <td style={{ padding: '16px 24px', fontWeight: '500', color: 'var(--warning)' }}>{log.action}</td>
                    <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-secondary)' }}>{log.targetUserId || 'System'}</td>
                    <td style={{ padding: '16px 24px' }}>{new Date(log.createdAt).toLocaleString()}</td>
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
