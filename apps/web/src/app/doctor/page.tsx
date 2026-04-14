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
    <div className="p-4 max-w-3xl mx-auto">
      {urgentModal && <MarkUrgentModal entry={urgentModal} onConfirm={handleMarkUrgent} onClose={() => setUrgentModal(null)} />}
      {noShowModal && <NoShowModal entry={noShowModal} onConfirm={handleNoShow} onClose={() => setNoShowModal(null)} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Good morning, Dr. {firstName} 👋</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <button onClick={loadData} className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-[#00475a]">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                <Icon className={cn('w-4 h-4', s.color)} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Queue — ALL patients visible to doctor */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4" /> Today's Queue
          </h2>
          <p className="text-xs text-slate-400">Tap 🚨 to prioritise · 👻 to mark no-show</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        ) : actionable.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
            <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No patients in queue yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actionable.map((entry, idx) => {
              const isReady  = entry.status === 'precheck_done';
              const isActive = entry.status === 'in_consultation';
              const patientName = entry.patient?.full_name || `${entry.patient?.first_name||''} ${entry.patient?.last_name||''}`.trim() || 'Unknown';
              return (
                <div key={entry.id} className={cn(
                  'bg-white rounded-xl border p-4 flex items-center gap-3 transition-all',
                  isActive ? 'border-purple-200 shadow-sm bg-purple-50/30' : isReady ? 'border-teal-200' : 'border-slate-100',
                )}>
                  {/* Position number */}
                  <div className="text-xs text-slate-300 font-bold w-4 text-center">{idx+1}</div>

                  {/* Token */}
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0',
                    isActive ? 'bg-purple-100 text-purple-700' : isReady ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600')}>
                    {entry.token_number}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate text-sm">
                      {patientName}
                      {entry.is_urgent && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">URGENT</span>}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{entry.chief_complaint||'No complaint noted'} · {entry.visit_type||'consultation'}</p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0', STATUS_STYLE[entry.status]||STATUS_STYLE['waiting'])}>
                    {STATUS_LABEL[entry.status]||entry.status}
                  </span>

                  {/* Doctor override actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    {entry.status === 'waiting' && (
                      <button onClick={() => setUrgentModal(entry)}
                        className="text-lg leading-none px-1 py-0.5 rounded hover:bg-red-50" title="Mark urgent">
                        🚨
                      </button>
                    )}
                    {['waiting','precheck_done'].includes(entry.status) && (
                      <button onClick={() => setNoShowModal(entry)}
                        className="p-1.5 rounded border border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600"
                        title="Mark no show">
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Call button */}
                  {(isReady || isActive) && (
                    <button onClick={() => handleCall(entry)} disabled={calling === entry.id}
                      className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0',
                        isActive ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-[#00475a] text-white hover:bg-[#003d4d]',
                        calling===entry.id ? 'opacity-50' : '')}>
                      {calling===entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      {isActive ? 'Resume' : 'Call'} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Completed Today
          </h2>
          <div className="space-y-2">
            {done.map(entry => {
              const patientName = entry.patient?.full_name || `${entry.patient?.first_name||''} ${entry.patient?.last_name||''}`.trim() || 'Unknown';
              return (
                <div key={entry.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 opacity-50">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">{entry.token_number}</div>
                  <p className="flex-1 text-sm text-slate-600 truncate">{patientName}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', STATUS_STYLE[entry.status]||STATUS_STYLE['completed'])}>
                    {STATUS_LABEL[entry.status]||entry.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
