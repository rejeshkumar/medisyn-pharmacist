'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { Clock, UserCheck, Stethoscope, CheckCircle2, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  in_precheck: 'Pre-check',
  precheck_done: 'Ready',
  in_consultation: 'In Consultation',
  consultation_done: 'Done',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const STATUS_STYLE: Record<string, string> = {
  waiting: 'text-amber-700 bg-amber-50 border-amber-200',
  in_precheck: 'text-blue-700 bg-blue-50 border-blue-200',
  precheck_done: 'text-teal-700 bg-teal-50 border-teal-200',
  in_consultation: 'text-purple-700 bg-purple-50 border-purple-200',
  consultation_done: 'text-green-700 bg-green-50 border-green-200',
  completed: 'text-gray-600 bg-gray-50 border-gray-200',
  cancelled: 'text-red-600 bg-red-50 border-red-200',
  no_show: 'text-gray-500 bg-gray-50 border-gray-200',
};

export default function DoctorQueuePage() {
  const router = useRouter();
  const user = getUser();
  const [stats, setStats] = useState<any>({});
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, queueRes] = await Promise.all([
        api.get('/queue/today/stats').catch(() => ({ data: {} })),
        api.get(`/queue/today?doctor_id=${(user as any)?.id}`).catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data || {});
      const items = Array.isArray(queueRes.data) ? queueRes.data : (queueRes.data?.items || []);
      setQueue(items);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCall = async (entry: any) => {
    if (entry.status === 'in_consultation') {
      router.push(`/doctor/consult/${entry.id}`);
      return;
    }
    setCalling(entry.id);
    try {
      await api.patch(`/queue/${entry.id}/status`, {
        status: 'in_consultation',
        doctor_id: (user as any)?.id,
      });
      toast.success(`Token ${entry.token_number} called`);
      router.push(`/doctor/consult/${entry.id}`);
    } catch {
      toast.error('Failed to call patient');
    } finally {
      setCalling(null);
    }
  };

  const actionable = queue.filter((e) =>
    ['precheck_done', 'in_consultation', 'waiting'].includes(e.status)
  );
  const done = queue.filter((e) =>
    ['consultation_done', 'completed', 'cancelled', 'no_show'].includes(e.status)
  );

  const firstName =
    (user as any)?.name?.split(' ')[0] ||
    (user as any)?.full_name?.split(' ')[0] ||
    'Doctor';

  const statCards = [
    { label: 'Waiting',     value: stats.waiting || 0,           icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Ready',       value: stats.precheck_done || 0,     icon: UserCheck,    color: 'text-teal-600',   bg: 'bg-teal-50' },
    { label: 'In Progress', value: stats.in_consultation || 0,   icon: Stethoscope,  color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Completed',   value: (stats.completed || 0) + (stats.consultation_done || 0), icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Good morning, Dr. {firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                <Icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Queue */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> My Queue Today
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : actionable.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400">
            <Stethoscope className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No patients in queue yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionable.map((entry) => {
              const isReady = entry.status === 'precheck_done';
              const isActive = entry.status === 'in_consultation';
              const statusStyle = STATUS_STYLE[entry.status] || STATUS_STYLE['waiting'];
              const statusLabel = STATUS_LABEL[entry.status] || entry.status;
              const patientName =
                entry.patient?.full_name ||
                `${entry.patient?.first_name || ''} ${entry.patient?.last_name || ''}`.trim() ||
                entry.patient?.name ||
                'Unknown Patient';

              return (
                <div
                  key={entry.id}
                  className={cn(
                    'bg-white rounded-xl border p-4 flex items-center gap-4 transition-all',
                    isActive ? 'border-purple-200 shadow-sm' : 'border-slate-100',
                    isReady ? 'border-teal-200' : '',
                  )}
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0',
                    isActive ? 'bg-purple-100 text-purple-700' : isReady ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600',
                  )}>
                    {entry.token_number}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{patientName}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {entry.chief_complaint || 'No complaint noted'} · {entry.visit_type}
                    </p>
                  </div>

                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0', statusStyle)}>
                    {statusLabel}
                  </span>

                  {(isReady || isActive) && (
                    <button
                      onClick={() => handleCall(entry)}
                      disabled={calling === entry.id}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0',
                        isActive ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-[#00475a] text-white hover:bg-[#003d4d]',
                        calling === entry.id ? 'opacity-50' : '',
                      )}
                    >
                      {isActive ? 'Resume' : 'Call'}
                      <ArrowRight className="w-3.5 h-3.5" />
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
            <CheckCircle2 className="w-4 h-4" /> Completed
          </h2>
          <div className="space-y-2">
            {done.map((entry) => {
              const statusStyle = STATUS_STYLE[entry.status] || STATUS_STYLE['completed'];
              const statusLabel = STATUS_LABEL[entry.status] || entry.status;
              const patientName =
                entry.patient?.full_name ||
                `${entry.patient?.first_name || ''} ${entry.patient?.last_name || ''}`.trim() ||
                entry.patient?.name ||
                'Unknown';

              return (
                <div key={entry.id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 opacity-60">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-500 flex-shrink-0">
                    {entry.token_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">{patientName}</p>
                    <p className="text-xs text-slate-400 truncate">{entry.chief_complaint || '—'}</p>
                  </div>
                  <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0', statusStyle)}>
                    {statusLabel}
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
