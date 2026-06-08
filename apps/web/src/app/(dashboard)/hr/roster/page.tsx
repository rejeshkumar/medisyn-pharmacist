'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, Loader2, Save, Users, X, CheckSquare, Square,
} from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];

const ROLE_BADGE: Record<string, string> = {
  doctor:       'bg-teal-50 text-teal-700 border-teal-200',
  pharmacist:   'bg-purple-50 text-purple-700 border-purple-200',
  receptionist: 'bg-blue-50 text-blue-700 border-blue-200',
  nurse:        'bg-pink-50 text-pink-700 border-pink-200',
  office_manager:'bg-slate-50 text-slate-600 border-slate-200',
  assistant:    'bg-slate-50 text-slate-600 border-slate-200',
};

const AVATAR_COLOR: Record<string, string> = {
  doctor:       'bg-teal-100 text-teal-700',
  pharmacist:   'bg-purple-100 text-purple-700',
  receptionist: 'bg-blue-100 text-blue-700',
  nurse:        'bg-pink-100 text-pink-700',
  office_manager:'bg-slate-100 text-slate-600',
  assistant:    'bg-slate-100 text-slate-600',
};

const DAY_SETS: Record<string, number[]> = {
  'All days':       [0,1,2,3,4,5,6],
  'Mon–Fri only':   [0,1,2,3,4],
  'Weekends only':  [5,6],
  'Mon, Wed, Fri':  [0,2,4],
  'Tue, Thu, Sat':  [1,3,5],
};

const ROLES = ['All','doctor','pharmacist','receptionist','nurse'];

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0,0,0,0);
  return m;
}

const pad = (n: number) => String(n).padStart(2,'0');
const dateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const initials = (name: string) =>
  name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();

export default function RosterPage() {
  const [view, setView] = useState<'grid' | 'bulk'>('grid');
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [staff, setStaff]   = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [roster, setRoster] = useState<Record<string, any>>({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('All');
  const [editCell, setEditCell] = useState<string | null>(null);

  // Bulk assign state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkShiftId, setBulkShiftId] = useState('');
  const [bulkDaySet, setBulkDaySet] = useState('All days');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [search, setSearch] = useState('');

  const weekDates = getWeekDates(monday);
  const fromDate  = dateStr(weekDates[0]);
  const toDate    = dateStr(weekDates[6]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, shiftsRes, rosterRes] = await Promise.all([
        api.get('/users?limit=200'),
        api.get('/hr/shifts'),
        api.get(`/hr/roster?from=${fromDate}&to=${toDate}`),
      ]);
      const allStaff = (staffRes.data?.data || staffRes.data || [])
        .filter((u: any) => u.role !== 'owner');
      setStaff(allStaff);
      setShifts(shiftsRes.data || []);
      const map: Record<string, any> = {};
      (rosterRes.data || []).forEach((r: any) => {
        map[`${r.user_id}_${r.roster_date?.split('T')[0]}`] = r;
      });
      setRoster(map);
      setDirty(new Set());
    } catch {
      toast.error('Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  const navWeek = (delta: number) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + delta * 7);
    setMonday(d);
  };

  const setCell = (userId: string, date: string, shiftId: string | null) => {
    const key = `${userId}_${date}`;
    setRoster(prev => ({
      ...prev,
      [key]: shiftId ? { ...prev[key], shift_id: shiftId, user_id: userId, roster_date: date } : null,
    }));
    setDirty(prev => new Set([...prev, key]));
    setEditCell(null);
  };

  const saveAll = async () => {
    if (dirty.size === 0) { toast.success('No changes'); return; }
    setSaving(true);
    try {
      const entries = [...dirty]
        .map(key => roster[key])
        .filter(Boolean)
        .map(r => ({
          user_id:     r.user_id,
          shift_id:    r.shift_id,
          roster_date: r.roster_date?.split('T')[0],
          is_week_off: r.is_week_off ?? false,
        }));
      if (entries.length > 0) await api.post('/hr/roster/bulk', { entries });
      toast.success(`${dirty.size} roster entries saved`);
      setDirty(new Set());
      await load();
    } catch {
      toast.error('Failed to save roster');
    } finally {
      setSaving(false);
    }
  };

  // ── Bulk assign ──────────────────────────────────────────────
  const applyBulk = async () => {
    if (selected.size === 0) { toast.error('Select at least one staff member'); return; }
    if (!bulkShiftId) { toast.error('Select a shift to apply'); return; }
    setBulkSaving(true);
    try {
      const dayIndices = DAY_SETS[bulkDaySet] ?? DAY_SETS['All days'];
      const entries: any[] = [];
      selected.forEach(userId => {
        dayIndices.forEach(di => {
          entries.push({
            user_id:     userId,
            shift_id:    bulkShiftId === 'off' ? null : bulkShiftId,
            roster_date: dateStr(weekDates[di]),
            is_week_off: bulkShiftId === 'off',
          });
        });
      });
      await api.post('/hr/roster/bulk', { entries });
      toast.success(`Applied to ${selected.size} staff · ${entries.length} roster entries saved`);
      setSelected(new Set());
      setBulkShiftId('');
      await load();
    } catch {
      toast.error('Failed to apply bulk assignment');
    } finally {
      setBulkSaving(false);
    }
  };

  const filteredStaff = staff
    .filter(s => roleFilter === 'All' || s.role === roleFilter)
    .filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()));

  const allSelected = filteredStaff.length > 0 &&
    filteredStaff.every(s => selected.has(s.id));
  const someSelected = filteredStaff.some(s => selected.has(s.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filteredStaff.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filteredStaff.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const today = dateStr(new Date());
  const shiftMap = Object.fromEntries(shifts.map((s: any) => [s.id, s]));

  // Week label
  const weekLabel = `${weekDates[0].toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${
    weekDates[6].toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0 flex-wrap gap-y-2">
        <Users className="w-5 h-5 text-[#00475a]" />
        <h1 className="font-bold text-slate-900 flex-1">Staff Roster</h1>

        {/* View toggle */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button onClick={() => setView('grid')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>Weekly grid</button>
          <button onClick={() => setView('bulk')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'bulk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>Bulk assign</button>
        </div>

        {/* Role filter (grid view only) */}
        {view === 'grid' && (
          <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
            {ROLES.map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  roleFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {r === 'All' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navWeek(-1)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-36 text-center">{weekLabel}</span>
          <button onClick={() => navWeek(1)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {view === 'grid' && dirty.size > 0 && (
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d] disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save {dirty.size} change{dirty.size > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Shift legend ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-50 bg-slate-50/50 flex-shrink-0 overflow-x-auto">
        <span className="text-xs text-slate-400 shrink-0">Shifts:</span>
        {shifts.map((s: any) => (
          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-white shrink-0"
            style={{ background: s.color || '#00475a' }}>
            {s.name} ({s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)})
          </span>
        ))}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-500 rounded-md text-xs">OFF</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
        </div>
      ) : view === 'grid' ? (

        /* ══════════════════════════════════════════
           WEEKLY GRID VIEW
        ══════════════════════════════════════════ */
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 sticky top-0 z-10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44 border-b border-slate-100">Staff</th>
                {weekDates.map((d, i) => {
                  const isToday = dateStr(d) === today;
                  const isWeekend = i >= 5;
                  return (
                    <th key={i} className={`px-2 py-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-100 min-w-[110px] ${
                      isToday ? 'text-[#00475a] bg-teal-50' : isWeekend ? 'text-slate-400 bg-slate-50/80' : 'text-slate-500'
                    }`}>
                      <div>{DAYS[i]}</div>
                      <div className={`font-bold text-sm mt-0.5 ${isToday ? 'text-[#00475a]' : 'text-slate-700'}`}>
                        {d.getDate()} {d.toLocaleDateString('en-IN',{month:'short'})}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((member, mi) => (
                <tr key={member.id} className={mi % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                  <td className="px-4 py-2.5 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00475a]/10 text-[#00475a] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{member.full_name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold capitalize ${ROLE_BADGE[member.role] ?? ROLE_BADGE.assistant}`}>
                          {member.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  {weekDates.map((d, di) => {
                    const ds = dateStr(d);
                    const key = `${member.id}_${ds}`;
                    const cell = roster[key];
                    const shift = cell?.shift_id ? shiftMap[cell.shift_id] : null;
                    const isDirty = dirty.has(key);
                    const isEditing = editCell === key;
                    const isToday = ds === today;
                    const isWeekendCell = di >= 5;
                    return (
                      <td key={di} className={`px-2 py-2 border-b border-slate-50 text-center relative ${
                        isToday ? 'bg-teal-50/30' : isWeekendCell ? 'bg-slate-50/60' : ''
                      }`}>
                        {isEditing ? (
                          <div className="absolute top-1 left-1 right-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">Select shift</span>
                              <button onClick={() => setEditCell(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {shifts.map((s: any) => (
                              <button key={s.id} onClick={() => setCell(member.id, ds, s.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left mb-0.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color ?? '#00475a' }} />
                                <span className="text-xs font-medium text-slate-700">{s.name}</span>
                                <span className="text-[10px] text-slate-400 ml-auto">{s.start_time?.slice(0,5)}</span>
                              </button>
                            ))}
                            <button onClick={() => setCell(member.id, ds, null)}
                              className="w-full px-2 py-1.5 rounded-lg hover:bg-red-50 text-left">
                              <span className="text-xs text-red-500 font-medium">Day off</span>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setEditCell(key)}
                            className={`w-full min-h-[36px] rounded-lg text-xs font-medium transition-all hover:opacity-80 ${isDirty ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                            style={shift ? {
                              background: shift.color + '25', color: shift.color, border: `1.5px solid ${shift.color}40`,
                            } : {
                              background: '#f8fafc', color: '#94a3b8', border: '1.5px dashed #e2e8f0',
                            }}>
                            {shift ? (
                              <div>
                                <div className="font-semibold">{shift.name}</div>
                                <div className="text-[10px] opacity-70">{shift.start_time?.slice(0,5)}</div>
                              </div>
                            ) : (
                              <span className="text-[11px]">+ Assign</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredStaff.length === 0 && (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">No staff found</div>
          )}
        </div>

      ) : (

        /* ══════════════════════════════════════════
           BULK ASSIGN VIEW
        ══════════════════════════════════════════ */
        <div className="flex-1 overflow-auto">
          <div className="p-4 max-w-4xl">

            {/* Search + role filter */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search staff name..."
                className="flex-1 min-w-48 h-9 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
              />
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {ROLES.map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      roleFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {r === 'All' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk action bar — always visible */}
            <div className={`rounded-xl p-3 mb-4 border transition-all ${
              selected.size > 0
                ? 'bg-teal-50 border-teal-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              {selected.size > 0 ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-semibold text-teal-800 flex-shrink-0">
                    {selected.size} staff selected
                  </p>
                  <select value={bulkShiftId} onChange={e => setBulkShiftId(e.target.value)}
                    className="h-8 border border-teal-300 rounded-lg px-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-[#00475a]">
                    <option value="">Select shift…</option>
                    {shifts.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)})
                      </option>
                    ))}
                    <option value="off">Day off</option>
                  </select>
                  <select value={bulkDaySet} onChange={e => setBulkDaySet(e.target.value)}
                    className="h-8 border border-teal-300 rounded-lg px-2 text-sm bg-white text-slate-700 focus:outline-none focus:border-[#00475a]">
                    {Object.keys(DAY_SETS).map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <button onClick={applyBulk} disabled={bulkSaving || !bulkShiftId}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#00475a] text-white text-sm font-semibold rounded-lg hover:bg-[#003d4d] disabled:opacity-50">
                    {bulkSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Apply to {selected.size} staff →
                  </button>
                  <button onClick={() => setSelected(new Set())}
                    className="text-xs text-teal-600 hover:text-teal-800 underline">
                    Clear selection
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Select staff below → choose a shift and days → tap Apply
                </p>
              )}
            </div>

            {/* Select all row */}
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                {allSelected
                  ? <CheckSquare className="w-4 h-4 text-[#00475a]" />
                  : someSelected
                    ? <CheckSquare className="w-4 h-4 text-slate-400" />
                    : <Square className="w-4 h-4 text-slate-400" />
                }
                {allSelected ? 'Deselect all' : `Select all (${filteredStaff.length})`}
              </button>
              <span className="text-xs text-slate-400 ml-auto">This week's pattern</span>
            </div>

            {/* Staff list */}
            <div className="flex flex-col gap-2">
              {filteredStaff.map(member => {
                const isSelected = selected.has(member.id);
                const weekPattern = weekDates.map(d => {
                  const key = `${member.id}_${dateStr(d)}`;
                  const cell = roster[key];
                  return cell?.shift_id ? shiftMap[cell.shift_id] : null;
                });

                return (
                  <div key={member.id}
                    onClick={() => setSelected(prev => {
                      const next = new Set(prev);
                      isSelected ? next.delete(member.id) : next.add(member.id);
                      return next;
                    })}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-400 bg-teal-50/40'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}>

                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'bg-[#00475a] border-[#00475a]' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLOR[member.role] ?? AVATAR_COLOR.assistant}`}>
                      {initials(member.full_name)}
                    </div>

                    {/* Name + role */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{member.full_name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold capitalize ${ROLE_BADGE[member.role] ?? ROLE_BADGE.assistant}`}>
                        {member.role}
                      </span>
                    </div>

                    {/* Week mini pattern */}
                    <div className="hidden sm:flex gap-1 flex-shrink-0">
                      {weekPattern.map((shift, di) => (
                        <div key={di} className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] text-slate-400 font-medium">{DAY_LABELS[di]}</span>
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold"
                            style={shift
                              ? { background: (shift.color ?? '#00475a') + '30', color: shift.color ?? '#00475a', border: `1px solid ${shift.color ?? '#00475a'}40` }
                              : { background: '#f1f5f9', color: '#94a3b8', border: '1px dashed #e2e8f0' }
                            }
                            title={shift ? shift.name : 'Unassigned'}
                          >
                            {shift ? shift.name.slice(0,1) : '·'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredStaff.length === 0 && (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                No staff found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
