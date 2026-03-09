'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  in_precheck: 'Pre-check',
  precheck_done: 'Pre-check Done',
  in_consultation: 'With Doctor',
  consultation_done: 'Consult Done',
  dispensing: 'Dispensing',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-700',
  in_precheck: 'bg-blue-100 text-blue-700',
  precheck_done: 'bg-indigo-100 text-indigo-700',
  in_consultation: 'bg-purple-100 text-purple-700',
  consultation_done: 'bg-teal-100 text-teal-700',
  dispensing: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-500',
};

export default function QueueMonitorPage() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [updating, setUpdating] = useState<string | null>(null);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = async () => {
    try {
      const r = await axios.get(`${API}/queue/today`, { headers: headers() });
      setQueue(r.data || []);
      setLastUpdated(new Date());
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);

  const markNoShow = async (id: string) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/queue/${id}/status`, { status: 'no_show' }, { headers: headers() });
      await load();
    } catch { }
    finally { setUpdating(null); }
  };

  const markCancelled = async (id: string) => {
    setUpdating(id);
    try {
      await axios.patch(`${API}/queue/${id}/status`, { status: 'cancelled' }, { headers: headers() });
      await load();
    } catch { }
    finally { setUpdating(null); }
  };

  const active = queue.filter(q => !['completed', 'cancelled', 'no_show'].includes(q.status));
  const done = queue.filter(q => ['completed', 'cancelled', 'no_show'].includes(q.status));

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Queue Monitor</h1>
          <p className="text-xs text-slate-400 mt-0.5">Last updated: {format(lastUpdated, 'hh:mm:ss a')} · Auto-refreshes every 20s</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#00475a] border border-slate-200 px-3 py-1.5 rounded-lg hover:border-[#00475a] transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading queue...</span>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Active · {active.length} patients</h2>
            </div>
            {active.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No active patients</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                    <th className="text-left px-5 py-3">Token</th>
                    <th className="text-left px-5 py-3">Patient</th>
                    <th className="text-left px-5 py-3 hidden md:table-cell">Complaint</th>
                    <th className="text-left px-5 py-3 hidden lg:table-cell">Doctor</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(q => (
                    <tr key={q.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-black text-[#00475a] text-base">#{q.token_number}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{q.patient?.full_name || '—'}</p>
                        <p className="text-xs text-slate-400">{q.patient?.mobile}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-500 hidden md:table-cell max-w-[150px] truncate">{q.chief_complaint || '—'}</td>
                      <td className="px-5 py-3 text-slate-500 hidden lg:table-cell">{q.doctor?.full_name ? `Dr. ${q.doctor.full_name}` : '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-500'}`}>
                          {STATUS_LABEL[q.status] || q.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {['waiting'].includes(q.status) && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => markNoShow(q.id)}
                              disabled={updating === q.id}
                              className="text-xs text-slate-500 hover:text-amber-600 border border-slate-200 hover:border-amber-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              No Show
                            </button>
                            <button
                              onClick={() => markCancelled(q.id)}
                              disabled={updating === q.id}
                              className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {done.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-500">Completed / Cancelled · {done.length}</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {done.map(q => (
                    <tr key={q.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-2.5 font-bold text-slate-300">#{q.token_number}</td>
                      <td className="px-5 py-2.5 text-slate-400">{q.patient?.full_name || '—'}</td>
                      <td className="px-5 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-500'}`}>
                          {STATUS_LABEL[q.status] || q.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
