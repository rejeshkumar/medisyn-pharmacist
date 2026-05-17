'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, UserPlus, Bell, FileText, Users, Clock, CheckCircle } from 'lucide-react';

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const { data: queue, refetch } = useQuery({
    queryKey: ['queue-today'],
    queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []),
    refetchInterval: 30000
  });

  const waiting   = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting').length : 0;
  const inConsult = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation').length : 0;
  const done      = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;
  const total     = Array.isArray(queue) ? queue.length : 0;

  const statusColor = (status: string) => {
    if (status === 'waiting') return { bg: '#fef3c7', color: '#d97706' };
    if (status === 'in_consultation') return { bg: '#dbeafe', color: '#2563eb' };
    if (status === 'completed') return { bg: '#dcfce7', color: '#16a34a' };
    return { bg: '#f3f4f6', color: '#6b7280' };
  };

  return (
    <div style={{ padding: '24px', background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Reception</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => router.push('/receptionist/book-appointment')}
          style={{ background: '#00b8a0', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} /> Book Appointment
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Users size={18} color="white" />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Total Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>{total}</div>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>Patients</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#fef9ee' }} />
          <div style={{ width: 36, height: 36, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Clock size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Waiting</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d97706', marginBottom: 6 }}>{waiting}</div>
          <span style={{ fontSize: 10, color: '#d97706', fontWeight: 500 }}>In queue</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#eff6ff' }} />
          <div style={{ width: 36, height: 36, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <FileText size={18} color="#2563eb" />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>In Consult</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb', marginBottom: 6 }}>{inConsult}</div>
          <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>With doctor</span>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#f0fdf4' }} />
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <CheckCircle size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Done</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>{done}</div>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Completed</span>
        </div>
      </div>

      {/* Queue + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>

        {/* Today's Queue */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #f3f4f6' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Today's Queue</span>
            <button onClick={() => router.push('/receptionist/book-appointment')}
              style={{ fontSize: 12, color: '#00b8a0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>+ Add patient</button>
          </div>
          {Array.isArray(queue) && queue.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Token</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Visit Type</th>
                  <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.slice(0, 8).map((q: any, i: number) => {
                  const s = statusColor(q.status);
                  return (
                    <tr key={q.id} style={{ borderTop: '0.5px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>#{q.token_number || i + 1}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e1f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b8a0', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {(q.patient_name || q.patient?.first_name || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{q.patient_name || `${q.patient?.first_name} ${q.patient?.last_name || ''}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.visit_type || 'Consultation'}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                          {q.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
              <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>No patients in queue</p>
              <button onClick={() => router.push('/receptionist/book-appointment')}
                style={{ marginTop: 8, fontSize: 12, color: '#00b8a0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                Book first appointment →
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '16px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Quick Actions</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Book Appointment', icon: Calendar, href: '/receptionist/book-appointment', bg: '#e1f5ee', color: '#007a6e' },
                { label: 'New Patient', icon: UserPlus, href: '/receptionist/patients', bg: '#dbeafe', color: '#2563eb' },
                { label: 'Follow-ups', icon: Bell, href: '/receptionist/followups', bg: '#ede9fe', color: '#7c3aed' },
                { label: 'Bills', icon: FileText, href: '/receptionist/bill-history', bg: '#fef3c7', color: '#d97706' },
              ].map(({ label, icon: Icon, href, bg, color }) => (
                <button key={label} onClick={() => router.push(href)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 8px', background: bg, borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}>
                  <Icon size={20} color={color} />
                  <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '16px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Queue Monitor</p>
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Live updates every 30s</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, textAlign: 'center', background: '#fef3c7', borderRadius: 10, padding: '10px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{waiting}</div>
                <div style={{ fontSize: 10, color: '#d97706', fontWeight: 500 }}>Waiting</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: '#dbeafe', borderRadius: 10, padding: '10px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{inConsult}</div>
                <div style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>In Consult</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: '#dcfce7', borderRadius: 10, padding: '10px 0' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{done}</div>
                <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Done</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
