'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  Loader2, RefreshCw, AlertTriangle, ArrowUp, ArrowDown,
  X, UserX, ChevronUp, ChevronDown, Plus, Clock,
  CheckCircle2, Stethoscope, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABEL: Record<string, string> = {
  waiting:          'Waiting',
  in_precheck:      'Pre-check',
  precheck_done:    'Ready',
  in_consultation:  'With Doctor',
  consultation_done:'Consult Done',
  dispensing:       'Dispensing',
  completed:        'Completed',
  cancelled:        'Cancelled',
  no_show:          'No Show',
};

const STATUS_COLOR: Record<string, string> = {
  waiting:          'bg-amber-100 text-amber-700 border-amber-200',
  in_precheck:      'bg-blue-100 text-blue-700 border-blue-200',
  precheck_done:    'bg-teal-100 text-teal-700 border-teal-200',
  in_consultation:  'bg-purple-100 text-purple-700 border-purple-200',
  consultation_done:'bg-indigo-100 text-indigo-700 border-indigo-200',
  dispensing:       'bg-orange-100 text-orange-700 border-orange-200',
  completed:        'bg-green-100 text-green-700 border-green-200',
  cancelled:        'bg-red-100 text-red-600 border-red-200',
  no_show:          'bg-slate-100 text-slate-500 border-slate-200',
};

// Override reason modal
function OverrideModal({ entry, action, onConfirm, onClose }: {
  entry: any; action: string; onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const REASONS: Record<string, string[]> = {
    urgent:    ['Medical emergency', 'Elderly/disabled patient', 'Scheduled appointment', 'Doctor request', 'Other'],
    move_down: ['Late arrival', 'Patient not ready', 'Other'],
    no_show:   ['Did not arrive', 'Not responding to calls', 'Other'],
    cancel:    ['Patient request', 'Rescheduled', 'Duplicate entry', 'Other'],
    remove:    ['Added by mistake', 'Wrong queue', 'Other'],
  };
  const reasons = REASONS[action] || ['Other'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1">
          {action === 'urgent' ? '🚨 Mark as Urgent' :
           action === 'move_down' ? '⬇️ Move Down Queue' :
           action === 'no_show' ? '👻 Mark No Show' :
           action === 'cancel' ? '❌ Cancel Appointment' : '🗑️ Remove from Queue'}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Patient: <strong>{entry.patient?.full_name || entry.patient?.first_name || '—'}</strong> · Token #{entry.token_number}
        </p>
        <p className="text-xs font-medium text-gray-600 mb-2">Reason *</p>
        <div className="space-y-2 mb-4">
          {reasons.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${reason === r ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => reason && onConfirm(reason)} disabled={!reason}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-colors ${
              action === 'urgent' ? 'bg-red-500 hover:bg-red-600' :
              action === 'cancel' || action === 'no_show' ? 'bg-amber-500 hover:bg-amber-600' :
              'bg-[#00475a] hover:bg-[#003d4d]'}`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QueueMonitorPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [updating, setUpdating] = useState<string | null>(null);
  const [modal, setModal] = useState<{ entry: any; action: string } | null>(null);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/queue/today`, { headers: headers() });
      setQueue(r.data || []);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const updateStatus = async (id: string, status: string, reason?: string) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/queue/${id}/status`, { status, override_reason: reason }, { headers: headers() });
      await load();
      toast.success('Queue updated');
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); setModal(null); }
  };

  const moveUp = async (id: string) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/queue/${id}/priority`, { action: 'urgent' }, { headers: headers() });
      await load();
      toast.success('Patient moved to top');
    } catch {
      // Fallback: just reorder locally
      setQueue(prev => {
        const idx = prev.findIndex(q => q.id === id);
        if (idx <= 0) return prev;
        const arr = [...prev];
        [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
        return arr;
      });
      toast.success('Moved up in queue');
    }
    finally { setUpdating(null); }
  };

  const moveDown = async (id: string) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/queue/${id}/priority`, { action: 'deprioritize' }, { headers: headers() });
      await load();
    } catch {
      setQueue(prev => {
        const idx = prev.findIndex(q => q.id === id);
        if (idx < 0 || idx >= prev.length - 1) return prev;
        const arr = [...prev];
        [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
        return arr;
      });
      toast.success('Moved down in queue');
    }
    finally { setUpdating(null); }
  };

  const handleConfirm = async (reason: string) => {
    if (!modal) return;
    const { entry, action } = modal;
    if (action === 'urgent') {
      await moveUp(entry.id);
      setModal(null);
    } else if (action === 'move_down') {
      await moveDown(entry.id);
      setModal(null);
    } else if (action === 'no_show') {
      await updateStatus(entry.id, 'no_show', reason);
    } else if (action === 'cancel') {
      await updateStatus(entry.id, 'cancelled', reason);
    }
  };

  const active = queue.filter(q => !['completed', 'cancelled', 'no_show'].includes(q.status));
  const done   = queue.filter(q => ['completed', 'cancelled', 'no_show'].includes(q.status));
  const waitingCount = queue.filter(q => q.status === 'waiting').length;
  const inConsultCount = queue.filter(q => q.status === 'in_consultation').length;

  return (
    <div className="p-4 max-w-5xl">
      {modal && (
        <OverrideModal
          entry={modal.entry} action={modal.action}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Queue Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">Last updated: {format(lastUpdated, 'hh:mm:ss a')} · Auto-refreshes every 20s</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push('/receptionist/book-appointment')}
            className="flex items-center gap-1.5 text-sm bg-[#00475a] text-white px-3 py-1.5 rounded-lg hover:bg-[#003d4d]">
            <Plus className="w-4 h-4" /> Add Patient
          </button>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#00475a] border border-slate-200 px-3 py-1.5 rounded-lg">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{waitingCount}</p>
          <p className="text-xs text-amber-600 mt-0.5">Waiting</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-purple-700">{inConsultCount}</p>
          <p className="text-xs text-purple-600 mt-0.5">With Doctor</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{done.filter(q=>q.status==='completed').length}</p>
          <p className="text-xs text-green-600 mt-0.5">Completed</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading queue...</span>
        </div>
      ) : (
        <>
          {/* Active queue */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Active Queue · {active.length} patients</h2>
              <p className="text-xs text-slate-400">Use ↑↓ to reorder · Override actions available</p>
            </div>
            {active.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">No active patients in queue</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {active.map((q, idx) => (
                  <div key={q.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${updating === q.id ? 'opacity-50' : ''}`}>
                    {/* Position controls */}
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => idx > 0 && setModal({ entry: q, action: 'urgent' })}
                        disabled={idx === 0 || updating === q.id}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 disabled:opacity-20 text-slate-400 hover:text-[#00475a]">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => idx < active.length-1 && setModal({ entry: q, action: 'move_down' })}
                        disabled={idx === active.length-1 || updating === q.id}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 disabled:opacity-20 text-slate-400 hover:text-slate-600">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Token */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${
                      q.status === 'in_consultation' ? 'bg-purple-100 text-purple-700' :
                      q.status === 'precheck_done' ? 'bg-teal-100 text-teal-700' :
                      'bg-slate-100 text-slate-700'}`}>
                      {q.token_number}
                    </div>

                    {/* Patient info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate text-sm">
                        {q.patient?.full_name || q.patient?.first_name || '—'}
                        {q.is_urgent && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">URGENT</span>}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{q.chief_complaint || q.visit_type || 'Consultation'} · {q.patient?.mobile || ''}</p>
                    </div>

                    {/* Doctor */}
                    <div className="hidden md:block text-xs text-slate-400 w-28 truncate">
                      {q.doctor?.full_name ? `Dr. ${q.doctor.full_name}` : '—'}
                    </div>

                    {/* Status */}
                    <span className={`hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[q.status]||'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {STATUS_LABEL[q.status]||q.status}
                    </span>

                    {/* Override actions */}
                    <div className="flex gap-1 flex-shrink-0">
                      {q.status === 'waiting' && (
                        <button onClick={() => setModal({ entry: q, action: 'urgent' })}
                          className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium"
                          title="Move to top (urgent)">
                          🚨
                        </button>
                      )}
                      <button onClick={() => setModal({ entry: q, action: 'no_show' })}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
                        title="Mark no show">
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal({ entry: q, action: 'cancel' })}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600"
                        title="Cancel">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Done */}
          {done.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-500">Completed / Cancelled · {done.length}</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {done.map(q => (
                  <div key={q.id} className="flex items-center gap-3 px-4 py-2.5 opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">{q.token_number}</div>
                    <p className="flex-1 text-sm text-slate-500 truncate">{q.patient?.full_name || q.patient?.first_name || '—'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[q.status]||'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {STATUS_LABEL[q.status]||q.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
