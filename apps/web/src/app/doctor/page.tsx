'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import {
  Clock, UserCheck, Stethoscope, CheckCircle2, Users,
  ArrowRight, AlertTriangle, ChevronUp, UserX, RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting', in_precheck: 'Pre-check', precheck_done: 'Ready',
  in_consultation: 'In Consultation', consultation_done: 'Done',
  completed: 'Completed', cancelled: 'Cancelled', no_show: 'No Show',
};

const STATUS_STYLE: Record<string, string> = {
  waiting:          'text-amber-700 bg-amber-50 border-amber-200',
  in_precheck:      'text-blue-700 bg-blue-50 border-blue-200',
  precheck_done:    'text-teal-700 bg-teal-50 border-teal-200',
  in_consultation:  'text-purple-700 bg-purple-50 border-purple-200',
  consultation_done:'text-green-700 bg-green-50 border-green-200',
  completed:        'text-gray-600 bg-gray-50 border-gray-200',
  cancelled:        'text-red-600 bg-red-50 border-red-200',
  no_show:          'text-gray-500 bg-gray-50 border-gray-200',
};

// Override confirm modal
function MarkUrgentModal({ entry, onConfirm, onClose }: { entry: any; onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const reasons = ['Medical emergency', 'Severe pain / distress', 'Elderly / critical patient', 'Doctor assessment'];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1">🚨 Mark as Urgent</h3>
        <p className="text-sm text-gray-500 mb-4">
          This will move <strong>{entry.patient?.full_name || entry.patient?.first_name}</strong> to the top of the queue.
        </p>
        <div className="space-y-2 mb-4">
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${reason===r?'border-red-400 bg-red-50 text-red-700 font-medium':'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm">Cancel</button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason}
            className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
            Mark Urgent
          </button>
        </div>
      </div>
    </div>
  );
}

function NoShowModal({ entry, onConfirm, onClose }: { entry: any; onConfirm: (r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const reasons = ['Did not arrive after multiple calls', 'Patient left without consulting', 'Other'];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1">👻 Mark No Show</h3>
        <p className="text-sm text-gray-500 mb-4">Patient: <strong>{entry.patient?.full_name || entry.patient?.first_name}</strong></p>
        <div className="space-y-2 mb-4">
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${reason===r?'border-[#00475a] bg-teal-50 text-[#00475a] font-medium':'border-gray-200 text-gray-600'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm">Cancel</button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason}
            className="flex-1 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DoctorQueuePage() {
  const router = useRouter();
  const user = getUser();
  const [stats, setStats] = useState<any>({});
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);
  const [urgentModal, setUrgentModal] = useState<any>(null);
  const [noShowModal, setNoShowModal] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, queueRes] = await Promise.all([
        api.get('/queue/today/stats').catch(() => ({ data: {} })),
        api.get(`/queue/today`).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data || {});
      const items = Array.isArray(queueRes.data) ? queueRes.data : (queueRes.data?.items || []);
      setQueue(items);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCall = async (entry: any) => {
    if (entry.status === 'in_consultation') { router.push(`/doctor/consult/${entry.id}`); return; }
    setCalling(entry.id);
    try {
      await api.patch(`/queue/${entry.id}/status`, { status: 'in_consultation', doctor_id: (user as any)?.id });
      toast.success(`Token ${entry.token_number} called`);
      router.push(`/doctor/consult/${entry.id}`);
    } catch { toast.error('Failed to call patient'); }
    finally { setCalling(null); }
  };

  const handleMarkUrgent = async (reason: string) => {
    if (!urgentModal) return;
    try {
      await api.patch(`/queue/${urgentModal.id}/priority`, { action: 'urgent', reason });
      toast.success('Patient marked urgent — moved to top');
      await loadData();
    } catch {
      // Fallback — reorder locally
      setQueue(prev => {
        const idx = prev.findIndex(q => q.id === urgentModal.id);
        if (idx <= 0) return prev;
        const arr = [...prev];
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
        return arr;
      });
      toast.success('Moved to top of queue');
    }
    setUrgentModal(null);
  };

  const handleNoShow = async (reason: string) => {
    if (!noShowModal) return;
    try {
      await api.patch(`/queue/${noShowModal.id}/status`, { status: 'no_show', override_reason: reason });
      toast.success('Marked as no show');
      await loadData();
    } catch { toast.error('Failed'); }
    setNoShowModal(null);
  };

  const actionable = queue.filter(e => ['precheck_done','in_consultation','waiting'].includes(e.status));
  const done = queue.filter(e => ['consultation_done','completed','cancelled','no_show'].includes(e.status));
  const firstName = (user as any)?.full_name?.split(' ')[0] || 'Doctor';

  const statCards = [
    { label: 'Waiting',     value: stats.waiting||0,          icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
    { label: 'Ready',       value: stats.precheck_done||0,    icon: UserCheck,    color: 'text-teal-600',   bg: 'bg-teal-50'   },
    { label: 'In Progress', value: stats.in_consultation||0,  icon: Stethoscope,  color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Completed',   value: (stats.completed||0)+(stats.consultation_done||0), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div style={{ padding: '24px', background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      {urgentModal && <MarkUrgentModal entry={urgentModal} onConfirm={handleMarkUrgent} onClose={() => setUrgentModal(null)} />}
      {noShowModal && <NoShowModal entry={noShowModal} onConfirm={handleNoShow} onClose={() => setNoShowModal(null)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Good morning, Dr. {firstName} 👋</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <button onClick={loadData} style={{ background: 'white', color: '#374151', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>👨‍⚕️</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Waiting</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>{stats.waiting||0}</div>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>In queue</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#e1f5ee', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>✅</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Ready</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#00b8a0' }}>{stats.precheck_done||0}</div>
          <span style={{ fontSize: 10, color: '#00b8a0', fontWeight: 500 }}>Pre-check done</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#ede9fe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>🩺</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>In Progress</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#7c3aed' }}>{stats.in_consultation||0}</div>
          <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 500 }}>Consulting</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>🎉</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{(stats.completed||0)+(stats.consultation_done||0)}</div>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Seen today</span>
        </div>
      </div>

      {/* Queue Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Today's Queue</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>🚨 prioritise · 👻 no-show</span>
        </div>
        {loading ? (
          <div style={{ padding: 20 }}>{[1,2,3].map(i => <div key={i} style={{ height: 60, background: '#f3f4f6', borderRadius: 8, marginBottom: 8 }} />)}</div>
        ) : actionable.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🩺</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No patients in queue yet</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>#</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Complaint</th>
                <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Status</th>
                <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {actionable.map((entry, idx) => {
                const isReady  = entry.status === 'precheck_done';
                const isActive = entry.status === 'in_consultation';
                const patientName = entry.patient?.full_name || `${entry.patient?.first_name||''} ${entry.patient?.last_name||''}`.trim() || 'Unknown';
                return (
                  <tr key={entry.id} style={{ borderTop: '0.5px solid #f3f4f6', background: isActive ? '#faf5ff' : 'white' }}>
                    <td style={{ padding: '10px 16px', color: '#9ca3af', fontSize: 12 }}>{idx+1}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: isActive ? '#ede9fe' : isReady ? '#e1f5ee' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: isActive ? '#7c3aed' : isReady ? '#00b8a0' : '#6b7280', flexShrink: 0 }}>
                          {entry.token_number}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {patientName}
                            {entry.is_urgent && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>URGENT</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{entry.visit_type || 'consultation'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{entry.chief_complaint || 'No complaint noted'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: isActive ? '#ede9fe' : isReady ? '#e1f5ee' : '#fef3c7', color: isActive ? '#7c3aed' : isReady ? '#00b8a0' : '#d97706' }}>
                        {STATUS_LABEL[entry.status] || entry.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {entry.status === 'waiting' && (
                          <button onClick={() => setUrgentModal(entry)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} title="Mark urgent">🚨</button>
                        )}
                        {['waiting','precheck_done'].includes(entry.status) && (
                          <button onClick={() => setNoShowModal(entry)} style={{ background: 'none', border: '0.5px solid #e5e7eb', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', fontSize: 13 }} title="No show">👻</button>
                        )}
                        {(isReady || isActive) && (
                          <button onClick={() => handleCall(entry)} disabled={calling === entry.id}
                            style={{ background: isActive ? '#7c3aed' : '#00b8a0', color: 'white', border: 'none', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: calling === entry.id ? 0.5 : 1 }}>
                            {calling === entry.id ? '...' : isActive ? 'Resume' : 'Call →'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '0.5px solid #f3f4f6' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>✅ Completed Today</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', opacity: 0.7 }}>
            <tbody>
              {done.map(entry => {
                const patientName = entry.patient?.full_name || `${entry.patient?.first_name||''} ${entry.patient?.last_name||''}`.trim() || 'Unknown';
                return (
                  <tr key={entry.id} style={{ borderTop: '0.5px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 16px', width: 40 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{entry.token_number}</div>
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: 13, color: '#374151' }}>{patientName}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>{STATUS_LABEL[entry.status]||entry.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
