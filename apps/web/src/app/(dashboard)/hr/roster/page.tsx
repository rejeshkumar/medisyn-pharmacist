'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, Loader2, Save, Users, X,
} from 'lucide-react';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
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
  const [monday, setMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [staff, setStaff]   = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [roster, setRoster] = useState<Record<string, any>>({}); // key: userId_date
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState('All');
  const [editCell, setEditCell] = useState<string | null>(null); // userId_date

  const weekDates = getWeekDates(monday);
  const fromDate  = dateStr(weekDates[0]);
  const toDate    = dateStr(weekDates[6]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, shiftsRes, rosterRes] = await Promise.all([
        api.get('/users?limit=100'),
        api.get('/hr/shifts'),
        api.get(`/hr/roster?from=${fromDate}&to=${toDate}`),
      ]);
      const allStaff = (staffRes.data?.data || staffRes.data || [])
        .filter((u: any) => u.role !== 'owner');
      setStaff(allStaff);
      setShifts(shiftsRes.data || []);

      // Build lookup
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
      if (entries.length > 0) {
        await api.post('/hr/roster/bulk', { entries });
      }
      toast.success(`${dirty.size} roster entries saved`);
      setDirty(new Set());
      await load();
    } catch {
      toast.error('Failed to save roster');
    } finally {
      setSaving(false);
    }
  };

  const filteredStaff = roleFilter === 'All'
    ? staff
    : staff.filter(s => s.role === roleFilter);

  const today = dateStr(new Date());

  const shiftMap = Object.fromEntries(shifts.map((s: any) => [s.id, s]));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <Users className="w-5 h-5 text-[#00475a]" />
        <h1 className="font-bold text-slate-900 flex-1">Staff Roster</h1>

        {/* Role filter */}
        <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                roleFilter === r
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r === 'All' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => navWeek(-1)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-36 text-center">
            {weekDates[0].toLocaleDateString('en-IN',{day:'numeric',month:'short'})} –{' '}
            {weekDates[6].toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
          </span>
          <button onClick={() => navWeek(1)}
            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {dirty.size > 0 && (
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d] disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save {dirty.size} change{dirty.size > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Shift legend */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-50 bg-slate-50/50 flex-shrink-0 overflow-x-auto">
        <span className="text-xs text-slate-400 shrink-0">Shifts:</span>
        {shifts.map((s: any) => (
          <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-white shrink-0"
            style={{ background: s.color }}>
            {s.name} ({s.start_time}–{s.end_time})
          </span>
        ))}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-500 rounded-md text-xs">
          OFF
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 sticky top-0 z-10">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44 border-b border-slate-100">
                  Staff
                </th>
                {weekDates.map((d, i) => {
                  const isToday = dateStr(d) === today;
                  return (
                    <th key={i} className={`px-2 py-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-100 min-w-[110px] ${
                      isToday ? 'text-[#00475a] bg-teal-50' : 'text-slate-500'
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
                  {/* Staff name */}
                  <td className="px-4 py-2.5 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#00475a]/10 text-[#00475a] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initials(member.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{member.full_name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{member.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* One cell per day */}
                  {weekDates.map((d, di) => {
                    const ds   = dateStr(d);
                    const key  = `${member.id}_${ds}`;
                    const cell = roster[key];
                    const shift = cell?.shift_id ? shiftMap[cell.shift_id] : null;
                    const isDirty = dirty.has(key);
                    const isEditing = editCell === key;
                    const isToday = ds === today;

                    return (
                      <td key={di} className={`px-2 py-2 border-b border-slate-50 text-center relative ${
                        isToday ? 'bg-teal-50/30' : ''
                      }`}>
                        {isEditing ? (
                          // Shift picker
                          <div className="absolute top-1 left-1 right-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase">Select shift</span>
                              <button onClick={() => setEditCell(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {shifts.map((s: any) => (
                              <button key={s.id}
                                onClick={() => setCell(member.id, ds, s.id)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left mb-0.5"
                              >
                                <span className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: s.color }} />
                                <span className="text-xs font-medium text-slate-700">{s.name}</span>
                                <span className="text-[10px] text-slate-400 ml-auto">{s.start_time}</span>
                              </button>
                            ))}
                            <button onClick={() => setCell(member.id, ds, null)}
                              className="w-full px-2 py-1.5 rounded-lg hover:bg-red-50 text-left">
                              <span className="text-xs text-red-500 font-medium">Day off</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditCell(key)}
                            className={`w-full min-h-[36px] rounded-lg text-xs font-medium transition-all hover:opacity-80 ${
                              isDirty ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                            }`}
                            style={shift ? {
                              background: shift.color + '25',
                              color: shift.color,
                              border: `1.5px solid ${shift.color}40`,
                            } : {
                              background: '#f8fafc',
                              color: '#94a3b8',
                              border: '1.5px dashed #e2e8f0',
                            }}
                          >
                            {shift ? (
                              <div>
                                <div className="font-semibold">{shift.name}</div>
                                <div className="text-[10px] opacity-70">{shift.start_time}</div>
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
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              No staff found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
