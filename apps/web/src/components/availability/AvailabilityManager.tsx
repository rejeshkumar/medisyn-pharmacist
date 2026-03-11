'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Plus, Trash2, Loader2, CalendarX, Check, X, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays, parseISO } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

// Quick presets for common patterns
const PRESETS = [
  { label: 'Full Day',      start: '09:00', end: '18:00' },
  { label: 'Morning',       start: '09:00', end: '13:00' },
  { label: 'Afternoon',     start: '13:00', end: '18:00' },
  { label: 'Half Day',      start: '09:00', end: '14:00' },
];

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
  const [leaves, setLeaves]     = useState<Leave[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<number | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [newLeave, setNewLeave] = useState({ leave_date: '', reason: '' });
  const [addingLeave, setAddingLeave] = useState(false);

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

  const saveDay = async (dayOfWeek: number, data: Partial<Schedule>) => {
    setSaving(dayOfWeek);
    try {
      await axios.post(`${API}/availability/${doctorId}`, {
        day_of_week: dayOfWeek,
        start_time: '09:00',
        end_time: '18:00',
        slot_duration_mins: 10,
        max_patients_per_slot: 1,
        is_active: true,
        ...data,
      }, { headers: headers() });
      await load();
      toast.success(`${DAYS[dayOfWeek]} schedule saved`);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(null);
      setEditingDay(null);
    }
  };

  const removeDay = async (dayOfWeek: number) => {
    setSaving(dayOfWeek);
    try {
      await axios.delete(`${API}/availability/${doctorId}/day/${dayOfWeek}`, { headers: headers() });
      await load();
      toast.success(`${DAYS[dayOfWeek]} marked as off`);
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
      toast.success('Off day added');
    } catch {
      toast.error('Failed to add');
    } finally {
      setAddingLeave(false);
    }
  };

  const removeLeave = async (leaveId: string) => {
    try {
      await axios.delete(`${API}/availability/${doctorId}/leaves/${leaveId}`, { headers: headers() });
      await load();
      toast.success('Off day removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const today  = format(new Date(), 'yyyy-MM-dd');
  const maxDate = format(addDays(new Date(), 90), 'yyyy-MM-dd');

  // Count active days
  const activeDays = schedule.filter(s => s.is_active).length;

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading...</span>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── SECTION 1: Weekly recurring schedule ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Weekly Schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">Repeats every week · {activeDays} of 7 days active</p>
          </div>
          <div className="flex gap-1">
            {DAY_ORDER.map(day => {
              const active = !!getDay(day);
              return (
                <div key={day} title={DAYS[day]}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${
                    active ? 'bg-[#00475a] text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                  {DAY_SHORT[day][0]}
                </div>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {DAY_ORDER.map(day => {
            const existing = getDay(day);
            const isSaving = saving === day;
            const isEditing = editingDay === day;

            return (
              <div key={day} className="px-5 py-4">
                <div className="flex items-center gap-3">

                  {/* Day label */}
                  <div className={`w-14 text-xs font-bold flex-shrink-0 ${existing ? 'text-[#00475a]' : 'text-slate-400'}`}>
                    {DAYS[day]}
                  </div>

                  {existing ? (
                    /* ── Active day ─────────────────────────────────── */
                    <div className="flex-1">
                      {isEditing ? (
                        /* Expanded edit form */
                        <div className="space-y-3">
                          {/* Presets */}
                          <div className="flex gap-2 flex-wrap">
                            {PRESETS.map(p => (
                              <button key={p.label}
                                onClick={() => saveDay(day, { ...existing, start_time: p.start, end_time: p.end })}
                                className="px-3 py-1 text-xs rounded-lg border border-[#00475a]/30 text-[#00475a] hover:bg-teal-50 font-medium transition-colors">
                                {p.label} <span className="text-slate-400">({p.start}–{p.end})</span>
                              </button>
                            ))}
                          </div>

                          {/* Custom time */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <input type="time" defaultValue={existing.start_time}
                              id={`start-${day}`}
                              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20" />
                            <span className="text-slate-400 text-sm">to</span>
                            <input type="time" defaultValue={existing.end_time}
                              id={`end-${day}`}
                              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20" />
                            <select defaultValue={existing.slot_duration_mins}
                              id={`slot-${day}`}
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20">
                              <option value={10}>10 min slots</option>
                              <option value={15}>15 min slots</option>
                              <option value={20}>20 min slots</option>
                              <option value={30}>30 min slots</option>
                            </select>
                            <select defaultValue={existing.max_patients_per_slot}
                              id={`max-${day}`}
                              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20">
                              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} patient{n>1?'s':''}/slot</option>)}
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const s = (document.getElementById(`start-${day}`) as HTMLInputElement)?.value;
                                const e = (document.getElementById(`end-${day}`) as HTMLInputElement)?.value;
                                const slot = parseInt((document.getElementById(`slot-${day}`) as HTMLSelectElement)?.value);
                                const max = parseInt((document.getElementById(`max-${day}`) as HTMLSelectElement)?.value);
                                saveDay(day, { ...existing, start_time: s, end_time: e, slot_duration_mins: slot, max_patients_per_slot: max });
                              }}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#00475a] text-white rounded-lg text-xs font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Save
                            </button>
                            <button onClick={() => setEditingDay(null)}
                              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                              <X className="w-3 h-3" /> Cancel
                            </button>
                            <button onClick={() => removeDay(day)} disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors ml-auto">
                              <X className="w-3 h-3" /> Mark as Off
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Collapsed summary row */
                        <button onClick={() => canEdit && setEditingDay(day)}
                          className={`flex items-center gap-3 w-full text-left rounded-lg transition-colors ${canEdit ? 'hover:bg-slate-50 px-2 py-1 -mx-2' : ''}`}>
                          <Clock className="w-3.5 h-3.5 text-[#00475a] flex-shrink-0" />
                          <span className="text-sm text-slate-700 font-medium">
                            {existing.start_time} – {existing.end_time}
                          </span>
                          <span className="text-xs text-slate-400">{existing.slot_duration_mins} min · {existing.max_patients_per_slot} patient/slot</span>
                          <span className="ml-auto flex items-center gap-1 text-xs text-[#00475a] bg-teal-50 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Available
                          </span>
                          {canEdit && <ChevronDown className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                        </button>
                      )}
                    </div>
                  ) : (
                    /* ── Inactive day ────────────────────────────────── */
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-slate-400 flex items-center gap-1.5">
                        <X className="w-3.5 h-3.5 text-slate-300" />Not available
                      </span>
                      {canEdit && (
                        <div className="flex gap-2">
                          {PRESETS.slice(0, 3).map(p => (
                            <button key={p.label}
                              onClick={() => saveDay(day, { start_time: p.start, end_time: p.end })}
                              disabled={isSaving}
                              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-500 hover:border-[#00475a]/40 hover:text-[#00475a] disabled:opacity-50 transition-colors">
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin inline" /> : null} {p.label}
                            </button>
                          ))}
                          <button
                            onClick={() => saveDay(day, { start_time: '09:00', end_time: '18:00' })}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-xs rounded-lg bg-teal-50 border border-[#00475a]/20 text-[#00475a] font-medium hover:bg-teal-100 disabled:opacity-50 transition-colors">
                            <Plus className="w-3 h-3 inline mr-0.5" />Enable
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SECTION 2: One-time off days ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <CalendarX className="w-4 h-4 text-rose-500" /> One-time Off Days
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Specific dates when the doctor is unavailable (overrides weekly schedule)</p>
        </div>

        {canEdit && (
          <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
            <p className="text-xs font-medium text-slate-500 mb-3">Add a specific off date</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date</label>
                <input type="date" value={newLeave.leave_date} min={today} max={maxDate}
                  onChange={e => setNewLeave(l => ({ ...l, leave_date: e.target.value }))}
                  className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-xs text-slate-400 mb-1 block">Reason (optional)</label>
                <input value={newLeave.reason} onChange={e => setNewLeave(l => ({ ...l, reason: e.target.value }))}
                  placeholder="e.g. Personal, Conference, Holiday..."
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
              </div>
              <button onClick={addLeave} disabled={addingLeave || !newLeave.leave_date}
                className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors">
                {addingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Off Day
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          {leaves.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No specific off days scheduled</p>
          ) : (
            <div className="space-y-2">
              {leaves.map(l => {
                const d = parseISO(l.leave_date + 'T00:00:00');
                const isPast = l.leave_date < today;
                return (
                  <div key={l.id}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                      isPast ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-rose-50/50 border-rose-100'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPast ? 'bg-slate-400' : 'bg-rose-500'}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{format(d, 'EEEE, d MMMM yyyy')}</p>
                        {l.reason && <p className="text-xs text-slate-400">{l.reason}</p>}
                      </div>
                      {isPast && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Past</span>}
                    </div>
                    {canEdit && (
                      <button onClick={() => removeLeave(l.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: Quick help ──────────────────────────────────────── */}
      <div className="bg-teal-50/50 rounded-2xl border border-teal-100 px-5 py-4 text-sm text-slate-600 space-y-1.5">
        <p className="font-semibold text-[#00475a] text-sm">How it works</p>
        <p>• <strong>Weekly Schedule</strong> — Set which days and hours the doctor is available every week (recurring)</p>
        <p>• <strong>Off a full day every week</strong> — Leave that day as "Not available" (e.g. every Saturday off)</p>
        <p>• <strong>Morning or Afternoon only</strong> — Click a day and choose "Morning" or "Afternoon" preset</p>
        <p>• <strong>One-time off day</strong> — Use "One-time Off Days" for a specific date (e.g. this Sunday only)</p>
      </div>
    </div>
  );
}
