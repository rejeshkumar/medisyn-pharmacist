'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Plus, Trash2, Loader2, CalendarX, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AvailabilityProps {
  doctorId: string;
  doctorName: string;
  canEdit: boolean;
}

interface Schedule {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  max_patients_per_slot: number;
  is_active: boolean;
}

interface Leave {
  id: string;
  leave_date: string;
  reason?: string;
}

export default function AvailabilityManager({ doctorId, doctorName, canEdit }: AvailabilityProps) {
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [tab, setTab] = useState<'schedule' | 'leaves'>('schedule');
  const [newLeave, setNewLeave] = useState({ leave_date: '', reason: '' });
  const [addingLeave, setAddingLeave] = useState(false);
  // Local edits per day before saving
  const [edits, setEdits] = useState<Record<number, Partial<Schedule>>>({});

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        axios.get(`${API}/availability/${doctorId}`, { headers: headers() }),
        axios.get(`${API}/availability/${doctorId}/leaves`, { headers: headers() }),
      ]);
      setSchedule(sRes.data || []);
      setLeaves(lRes.data || []);
    } catch {
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (doctorId) load(); }, [doctorId]);

  const getDay = (dayOfWeek: number): Schedule | undefined =>
    schedule.find(s => s.day_of_week === dayOfWeek);

  const getEdit = (day: number, field: keyof Schedule, fallback: any) =>
    edits[day]?.[field] !== undefined ? edits[day][field] : fallback;

  const setEdit = (day: number, field: keyof Schedule, value: any) =>
    setEdits(e => ({ ...e, [day]: { ...e[day], [field]: value } }));

  const saveDay = async (dayOfWeek: number) => {
    const existing = getDay(dayOfWeek);
    const edit = edits[dayOfWeek] || {};
    setSaving(dayOfWeek);
    try {
      await axios.post(`${API}/availability/${doctorId}`, {
        day_of_week: dayOfWeek,
        start_time: edit.start_time ?? existing?.start_time ?? '09:00',
        end_time: edit.end_time ?? existing?.end_time ?? '17:00',
        slot_duration_mins: edit.slot_duration_mins ?? existing?.slot_duration_mins ?? 10,
        max_patients_per_slot: edit.max_patients_per_slot ?? existing?.max_patients_per_slot ?? 1,
        is_active: true,
      }, { headers: headers() });
      setEdits(e => { const n = { ...e }; delete n[dayOfWeek]; return n; });
      await load();
      toast.success(`${DAYS[dayOfWeek]} schedule saved`);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const removeDay = async (dayOfWeek: number) => {
    setSaving(dayOfWeek);
    try {
      await axios.delete(`${API}/availability/${doctorId}/day/${dayOfWeek}`, { headers: headers() });
      await load();
      toast.success(`${DAYS[dayOfWeek]} removed`);
    } catch {
      toast.error('Failed to remove');
    } finally {
      setSaving(null);
    }
  };

  const addLeave = async () => {
    if (!newLeave.leave_date) { toast.error('Select a date'); return; }
    setAddingLeave(true);
    try {
      await axios.post(`${API}/availability/${doctorId}/leaves`, newLeave, { headers: headers() });
      setNewLeave({ leave_date: '', reason: '' });
      await load();
      toast.success('Leave added');
    } catch {
      toast.error('Failed to add leave');
    } finally {
      setAddingLeave(false);
    }
  };

  const removeLeave = async (leaveId: string) => {
    try {
      await axios.delete(`${API}/availability/${doctorId}/leaves/${leaveId}`, { headers: headers() });
      await load();
      toast.success('Leave removed');
    } catch {
      toast.error('Failed to remove leave');
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const formatLeaveDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading...</span>
    </div>
  );

  return (
    <div className="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        {(['schedule', 'leaves'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'schedule' ? '📅 Weekly Schedule' : '🗓 Leave / Off Days'}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 mb-3">Set your working hours for each day. Days not configured show as unavailable to patients.</p>
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const existing = getDay(day);
            const isSaving = saving === day;
            const hasUnsaved = !!edits[day];

            return (
              <div key={day} className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${existing ? 'border-slate-100' : 'border-dashed border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  {/* Day badge */}
                  <div className={`w-12 text-center text-xs font-bold py-1.5 rounded-lg flex-shrink-0 ${existing ? 'bg-teal-50 text-[#00475a]' : 'bg-slate-50 text-slate-400'}`}>
                    {DAY_SHORT[day]}
                  </div>

                  {existing ? (
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {canEdit ? (
                          <>
                            <div className="flex items-center gap-2">
                              <input type="time"
                                value={String(getEdit(day, 'start_time', existing.start_time))}
                                onChange={e => setEdit(day, 'start_time', e.target.value)}
                                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                              <span className="text-slate-400 text-sm">to</span>
                              <input type="time"
                                value={String(getEdit(day, 'end_time', existing.end_time))}
                                onChange={e => setEdit(day, 'end_time', e.target.value)}
                                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                            </div>
                            <select
                              value={Number(getEdit(day, 'slot_duration_mins', existing.slot_duration_mins))}
                              onChange={e => setEdit(day, 'slot_duration_mins', parseInt(e.target.value))}
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20">
                              <option value={10}>10 min slots</option>
                              <option value={15}>15 min slots</option>
                              <option value={20}>20 min slots</option>
                              <option value={30}>30 min slots</option>
                            </select>
                            <select
                              value={Number(getEdit(day, 'max_patients_per_slot', existing.max_patients_per_slot))}
                              onChange={e => setEdit(day, 'max_patients_per_slot', parseInt(e.target.value))}
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20">
                              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} pt{n > 1 ? 's' : ''}/slot</option>)}
                            </select>
                          </>
                        ) : (
                          <span className="text-sm text-slate-600">
                            {existing.start_time} – {existing.end_time} · {existing.slot_duration_mins} min · {existing.max_patients_per_slot} pt/slot
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2 mt-2">
                          {hasUnsaved && (
                            <button onClick={() => saveDay(day)} disabled={isSaving}
                              className="flex items-center gap-1.5 text-xs bg-[#00475a] text-white px-3 py-1.5 rounded-lg hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              Save {DAYS[day]}
                            </button>
                          )}
                          {!hasUnsaved && (
                            <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Active</span>
                          )}
                          <button onClick={() => removeDay(day)} disabled={isSaving}
                            className="ml-auto text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />Not working
                      </span>
                      {canEdit && (
                        <button onClick={() => saveDay(day)} disabled={isSaving}
                          className="flex items-center gap-1 text-xs text-[#00475a] border border-[#00475a]/30 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors disabled:opacity-50">
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Add {DAYS[day]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'leaves' && (
        <div>
          {canEdit && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <CalendarX className="w-4 h-4 text-[#00475a]" />Add Leave / Holiday / Off Day
              </h3>
              <div className="flex gap-3 flex-wrap">
                <input type="date" value={newLeave.leave_date} min={today} max={maxDate}
                  onChange={e => setNewLeave(l => ({ ...l, leave_date: e.target.value }))}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                <input value={newLeave.reason} onChange={e => setNewLeave(l => ({ ...l, reason: e.target.value }))}
                  placeholder="Reason e.g. Public holiday, Personal leave..."
                  className="flex-1 min-w-40 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                <button onClick={addLeave} disabled={addingLeave}
                  className="flex items-center gap-2 bg-[#00475a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                  {addingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </div>
          )}

          {leaves.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 text-sm">
              <CalendarX className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No leaves or off days scheduled
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.map(l => (
                <div key={l.id} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{formatLeaveDate(l.leave_date)}</p>
                    {l.reason && <p className="text-xs text-slate-400 mt-0.5">{l.reason}</p>}
                  </div>
                  {canEdit && (
                    <button onClick={() => removeLeave(l.id)} className="text-slate-300 hover:text-red-500 transition-colors ml-4">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
