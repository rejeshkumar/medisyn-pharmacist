'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Users, CheckCircle, Clock, Activity } from 'lucide-react';

export default function NursePage() {
  const router = useRouter();
  const { data: queue, refetch } = useQuery({
    queryKey: ['nurse-queue'],
    queryFn: () => api.get('/queue?date=today&limit=50').then(r => r.data).catch(() => []),
    refetchInterval: 15000,
  });

  const needsPrecheck = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting' && !q.precheck_done) : [];
  const precheckDone  = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'precheck_done' || q.precheck_done).length : 0;
  const completed     = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;
  const total         = Array.isArray(queue) ? queue.length : 0;

  return (
    <div style={{ padding: '24px', background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Nurse Station</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · Updated '}{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={() => refetch()}
          style={{ background: 'white', color: '#374151', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ↻ Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>🏥</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Total Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>{total}</div>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>Patients</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#fee2e2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>💉</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Pending Pre-check</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{needsPrecheck.length}</div>
          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 500 }}>Need vitals</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>📋</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Pre-check Done</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{precheckDone}</div>
          <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>Vitals recorded</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>✅</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{completed}</div>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Done today</span>
        </div>
      </div>

      {/* Pre-check Queue Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Needs Pre-check</span>
          {needsPrecheck.length > 0 && (
            <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>
              {needsPrecheck.length} patients
            </span>
          )}
        </div>
        {needsPrecheck.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>#</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Complaint</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Time</th>
                <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {needsPrecheck.map((q: any, i: number) => (
                <tr key={q.id} style={{ borderTop: '0.5px solid #f3f4f6', cursor: 'pointer' }}
                  onClick={() => router.push(`/nurse/precheck/${q.id}`)}>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                        {(q.patient_name || q.patient?.first_name || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>
                        {q.patient_name || `${q.patient?.first_name || ''} ${q.patient?.last_name || ''}`.trim()}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.chief_complaint || 'Consultation'}</td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>
                    {q.created_at ? new Date(q.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Walk-in'}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                      Record vitals →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>All pre-checks done!</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No vitals pending</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'AI Care Plans', emoji: '🤖', href: '/ai-care', bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Patient History', emoji: '👥', href: '/patients', bg: '#dbeafe', color: '#2563eb' },
        ].map(({ label, emoji, href, bg, color }) => (
          <button key={label} onClick={() => router.push(href)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 16, cursor: 'pointer' }}>
            <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emoji}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
