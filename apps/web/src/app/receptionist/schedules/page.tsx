'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronDown, ChevronUp, Plus, Trash2, Save,
  Loader2, Calendar, Clock, AlertTriangle, User,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
interface Schedule {
  id?: string;
  day_of_week: number;       // 0=Sun ... 6=Sat
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

interface Doctor {
  id: string;
  full_name: string;
  specialization?: string;
}

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOT_DURATIONS = [5,10,15,20,30];

const AVATAR_COLORS = [
  { bg:'#e1f5ee',tc:'#0f6e56' }, { bg:'#e6f1fb',tc:'#185fa5' },
  { bg:'#fbeaf0',tc:'#993556' }, { bg:'#eeedfe',tc:'#534ab7' },
  { bg:'#faeeda',tc:'#854f0b' }, { bg:'#eaf3de',tc:'#3b6d11' },
];

const initials = (n: string) =>
  n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

// ── Doctor card ───────────────────────────────────────────────
function DoctorScheduleCard({ doctor, idx }: { doctor: Doctor; idx: number }) {
  const [open, setOpen]         = useState(false);
  const [tab, setTab]           = useState<'schedule'|'leaves'>('schedule');
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [leaves, setLeaves]     = useState<Leave[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState<number|null>(null);
  const [newLeave, setNewLeave] = useState({ leave_date:'', reason:'' });
  const [addingLeave, setAddingLeave] = useState(false);

  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        api.get(`/availability/${doctor.id}`),
        api.get(`/availability/${doctor.id}/leaves`),
      ]);
      setSchedule(sRes.data || []);
      setLeaves(lRes.data || []);
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const getDay = (dow: number) => schedule.find(s => s.day_of_week === dow);

  const toggleDay = async (dow: number) => {
    const existing = getDay(dow);
    setSaving(dow);
    try {
      if (existing?.is_active) {
        // Deactivate
        await api.post(`/availability/${doctor.id}`, {
          ...existing, is_active: false,
        });
      } else {
        // Activate with defaults
        await api.post(`/availability/${doctor.id}`, {
          day_of_week: dow,
          start_time: '09:00',
          end_time: '17:00',
          slot_duration_mins: 20,
          max_patients_per_slot: 1,
          is_active: true,
          ...(existing ?? {}),
        });
      }
      await load();
    } catch {
      toast.error('Failed to update');
    } finally {
      setSaving(null);
    }
  };

  const saveDay = async (dow: number, data: Partial<Schedule>) => {
    const existing = getDay(dow);
    setSaving(dow);
    try {
      await api.post(`/availability/${doctor.id}`, {
        day_of_week: dow,
        start_time: '09:00',
        end_time: '17:00',
        slot_duration_mins: 20,
        max_patients_per_slot: 1,
        is_active: true,
        ...(existing ?? {}),
        ...data,
      });
      await load();
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const addLeave = async () => {
    if (!newLeave.leave_date) { toast.error('Select a date'); return; }
    setAddingLeave(true);
    try {
      await api.post(`/availability/${doctor.id}/leaves`, newLeave);
      setNewLeave({ leave_date:'', reason:'' });
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
      await api.delete(`/availability/${doctor.id}/leaves/${leaveId}`);
      await load();
      toast.success('Leave removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  // Count active days
  const activeDays = schedule.filter(s => s.is_active).length;

  return (
    <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
          style={{ background: color.bg, color: color.tc }}
        >
          {initials(doctor.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm">{doctor.full_name}</p>
          <p className="text-xs text-slate-500">{doctor.specialization || 'General'}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {open && activeDays > 0 && (
            <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
              {activeDays} day{activeDays > 1 ? 's' : ''} active
            </span>
          )}
          {leaves.length > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
              {leaves.length} leave{leaves.length > 1 ? 's' : ''}
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {[
                  { key:'schedule', label:'Weekly schedule', icon: Calendar },
                  { key:'leaves',   label:'Leaves & holidays', icon: AlertTriangle },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key as any)}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                        tab === t.key
                          ? 'border-[#00475a] text-[#00475a]'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Schedule tab */}
              {tab === 'schedule' && (
                <div className="p-4 space-y-2">
                  {DAYS.map((dayName, dow) => {
                    const day = getDay(dow);
                    const active = day?.is_active ?? false;
                    const isSaving = saving === dow;
                    return (
                      <div
                        key={dow}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          active
                            ? 'border-slate-200 bg-white'
                            : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        {/* Day toggle */}
                        <button
                          onClick={() => toggleDay(dow)}
                          disabled={isSaving}
                          className={`w-10 h-10 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                            active
                              ? 'bg-[#00475a] text-white'
                              : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                          }`}
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : dayName}
                        </button>

                        {active ? (
                          <>
                            {/* Time range */}
                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                              <input
                                type="time"
                                value={day?.start_time ?? '09:00'}
                                onChange={e => saveDay(dow, { start_time: e.target.value })}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white"
                              />
                              <span className="text-xs text-slate-400">to</span>
                              <input
                                type="time"
                                value={day?.end_time ?? '17:00'}
                                onChange={e => saveDay(dow, { end_time: e.target.value })}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white"
                              />
                              {/* Slot duration */}
                              <select
                                value={day?.slot_duration_mins ?? 20}
                                onChange={e => saveDay(dow, { slot_duration_mins: Number(e.target.value) })}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white"
                              >
                                {SLOT_DURATIONS.map(d => (
                                  <option key={d} value={d}>{d} min slots</option>
                                ))}
                              </select>
                              {/* Max patients */}
                              <select
                                value={day?.max_patients_per_slot ?? 1}
                                onChange={e => saveDay(dow, { max_patients_per_slot: Number(e.target.value) })}
                                className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white"
                              >
                                {[1,2,3,4,5].map(n => (
                                  <option key={n} value={n}>{n} pt/slot</option>
                                ))}
                              </select>
                            </div>
                            {/* Computed slots */}
                            {day?.start_time && day?.end_time && (
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {(() => {
                                  const [sh,sm] = (day.start_time).split(':').map(Number);
                                  const [eh,em] = (day.end_time).split(':').map(Number);
                                  const mins = (eh*60+em) - (sh*60+sm);
                                  const slots = Math.floor(mins / (day.slot_duration_mins || 20));
                                  return `${slots} slots`;
                                })()}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Off — click to activate</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Leaves tab */}
              {tab === 'leaves' && (
                <div className="p-4">
                  {/* Existing leaves */}
                  {leaves.length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {leaves.map(l => (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900">
                              {new Date(l.leave_date).toLocaleDateString('en-IN', {
                                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                              })}
                            </p>
                            {l.reason && (
                              <p className="text-xs text-amber-700">{l.reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeLeave(l.id)}
                            className="text-amber-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-4 mb-4">
                      No leaves recorded
                    </p>
                  )}

                  {/* Add leave */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                      Add leave / holiday
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="date"
                        value={newLeave.leave_date}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setNewLeave(p => ({ ...p, leave_date: e.target.value }))}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white"
                      />
                      <input
                        type="text"
                        value={newLeave.reason}
                        onChange={e => setNewLeave(p => ({ ...p, reason: e.target.value }))}
                        placeholder="Reason (e.g. Onam, sick leave)"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a] bg-white min-w-0"
                      />
                      <button
                        onClick={addLeave}
                        disabled={addingLeave || !newLeave.leave_date}
                        className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-medium rounded-lg hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        {addingLeave
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Plus className="w-4 h-4" />}
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DoctorSchedulesPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get('/users?role=doctor&limit=100')
      .then(r => setDoctors(r.data?.data || r.data || []))
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = doctors.filter(d =>
    !search || d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialization ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Doctor schedules</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage weekly availability and leaves for each doctor
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search doctor by name or specialty..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-12 text-sm">No doctors found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc, i) => (
            <DoctorScheduleCard key={doc.id} doctor={doc} idx={i} />
          ))}
        </div>
      )}
    </div>
  );
}
