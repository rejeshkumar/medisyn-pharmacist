'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Loader2, RefreshCw, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const patientName = (p: any) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';

const STATUS_COLOR: Record<string, string> = {
  waiting:          'bg-amber-100 text-amber-700',
  in_precheck:      'bg-blue-100 text-blue-700',
  precheck_done:    'bg-indigo-100 text-indigo-700',
  in_consultation:  'bg-purple-100 text-purple-700',
  consultation_done:'bg-teal-100 text-teal-700',
  completed:        'bg-green-100 text-green-700',
};

const STATUS_LABEL: Record<string, string> = {
  waiting:          'Waiting',
  in_precheck:      'Pre-check In Progress',
  precheck_done:    'Pre-check Done',
  in_consultation:  'With Doctor',
  consultation_done:'Consult Done',
  completed:        'Completed',
};

export default function NurseDashboard() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = async () => {
    try {
      const r = await axios.get(`${API}/queue/today`, { headers: headers() });
      setQueue(r.data || []);
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  // Nurse sees: waiting + in_precheck (needs attention)
  const pending = queue.filter(q => ['waiting', 'in_precheck'].includes(q.status));
  const done = queue.filter(q => ['precheck_done', 'in_consultation', 'consultation_done', 'completed'].includes(q.status));

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nurse Station</h1>
          <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')} · Updated {format(lastUpdated, 'hh:mm a')}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-pink-400 hover:text-pink-600 transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Pending Pre-check</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-green-600">{done.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Pre-check Done</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-slate-600">{queue.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total Today</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading queue...</span>
        </div>
      ) : (
        <>
          {/* Pending pre-check */}
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />Needs Pre-check · {pending.length}
          </h2>
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 p-6 text-center text-slate-400 text-sm mb-6">All pre-checks done!</div>
          ) : (
            <div className="space-y-2 mb-6">
              {pending.map(q => (
                <Link key={q.id} href={`/nurse/precheck/${q.id}`}
                  className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-pink-300 hover:shadow-md transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-black text-pink-600">#{q.token_number}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{patientName(q.patient)}</p>
                    <p className="text-xs text-slate-400">{q.patient?.mobile} · {q.chief_complaint || 'No complaint noted'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[q.status]}`}>
                      {STATUS_LABEL[q.status]}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-pink-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Done — still clickable to edit vitals */}
          {done.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-green-500" />Pre-check Completed · {done.length}
              </h2>
              <div className="space-y-2">
                {done.map(q => (
                  <Link key={q.id} href={`/nurse/precheck/${q.id}`}
                    className="bg-white rounded-xl border border-slate-50 px-5 py-3 flex items-center gap-4 hover:border-pink-200 hover:opacity-100 transition-all group opacity-70">
                    <span className="text-sm font-bold text-slate-400">#{q.token_number}</span>
                    <span className="text-sm text-slate-500 flex-1">{patientName(q.patient)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABEL[q.status] || q.status}
                    </span>
                    <span className="text-xs text-slate-300 group-hover:text-pink-400 transition-colors">Edit vitals</span>
                    <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-pink-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
