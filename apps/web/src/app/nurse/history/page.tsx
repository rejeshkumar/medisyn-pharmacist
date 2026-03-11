'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Loader2, RefreshCw, Calendar, CheckCircle2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const patientName = (p: any) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';

const STATUS_COLOR: Record<string, string> = {
  precheck_done:     'bg-indigo-100 text-indigo-700',
  in_consultation:   'bg-purple-100 text-purple-700',
  consultation_done: 'bg-teal-100 text-teal-700',
  completed:         'bg-green-100 text-green-700',
  cancelled:         'bg-red-100 text-red-600',
  no_show:           'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  precheck_done:     'Pre-check Done',
  in_consultation:   'With Doctor',
  consultation_done: 'Consult Done',
  completed:         'Completed',
  cancelled:         'Cancelled',
  no_show:           'No Show',
};

const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = subDays(new Date(), i);
  return { label: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : format(d, 'dd MMM'), value: format(d, 'yyyy-MM-dd') };
});

export default function NurseHistoryPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedDate, setSelectedDate] = useState(DATES[0].value);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = async (date: string) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/queue/today?date=${date}`, { headers: headers() });
      const all: any[] = r.data || [];
      // History shows entries that have had pre-check done
      setEntries(all.filter(q => !['waiting', 'in_precheck'].includes(q.status)));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Pre-check History</h1>
          <p className="text-xs text-slate-400 mt-0.5">Completed pre-checks by date</p>
        </div>
        <button
          onClick={() => load(selectedDate)}
          className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-pink-400 hover:text-pink-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Date picker */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {DATES.map(d => (
          <button
            key={d.value}
            onClick={() => handleDateChange(d.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors flex-shrink-0 ${
              selectedDate === d.value
                ? 'bg-pink-600 text-white border-pink-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {d.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-pink-600">{entries.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Pre-checks Completed</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-2xl font-bold text-green-600">
            {entries.filter(e => e.status === 'completed').length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Fully Completed</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm text-slate-400">No pre-checks found for this date</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(q => (
            <div key={q.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                <span className="text-base font-black text-slate-500">#{q.token_number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{patientName(q.patient)}</p>
                <p className="text-xs text-slate-400 truncate">
                  {q.patient?.mobile} · {q.chief_complaint || 'No complaint noted'}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-500'}`}>
                {STATUS_LABEL[q.status] || q.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
