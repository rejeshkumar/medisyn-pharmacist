'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Clock, LogIn, LogOut, Loader2, CheckCircle2,
  AlertTriangle, Calendar, Star,
} from 'lucide-react';

const LEAVE_COLORS: Record<string, string> = {
  CL: 'bg-blue-50 text-blue-700 border-blue-200',
  SL: 'bg-red-50 text-red-700 border-red-200',
  EL: 'bg-green-50 text-green-700 border-green-200',
  LOP: 'bg-gray-50 text-gray-700 border-gray-200',
  ML: 'bg-pink-50 text-pink-700 border-pink-200',
  CO: 'bg-purple-50 text-purple-700 border-purple-200',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  present:  { label: 'Present',     color: 'text-green-700 bg-green-50 border-green-200' },
  absent:   { label: 'Absent',      color: 'text-red-700 bg-red-50 border-red-200' },
  on_leave: { label: 'On Leave',    color: 'text-amber-700 bg-amber-50 border-amber-200' },
  half_day: { label: 'Half Day',    color: 'text-blue-700 bg-blue-50 border-blue-200' },
  late:     { label: 'Late',        color: 'text-orange-700 bg-orange-50 border-orange-200' },
  holiday:  { label: 'Holiday',     color: 'text-teal-700 bg-teal-50 border-teal-200' },
};

function fmt(t: string) {
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function AttendancePage() {
  const [status, setStatus]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [checking, setChecking] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'CL',
    from_date: '',
    to_date: '',
    reason: '',
    is_half_day: false,
    half_day_part: 'morning',
  });
  const [applyingLeave, setApplyingLeave] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/hr/today');
      setStatus(r.data);
    } catch {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCheckIn = async () => {
    setChecking(true);
    try {
      const r = await api.post('/hr/attendance/check-in', {});
      toast.success(r.data.message);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Check-in failed');
    } finally {
      setChecking(false);
    }
  };

  const handleCheckOut = async () => {
    setChecking(true);
    try {
      const r = await api.post('/hr/attendance/check-out', {});
      toast.success(r.data.message);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Check-out failed');
    } finally {
      setChecking(false);
    }
  };

  const handleApplyLeave = async () => {
    if (!leaveForm.from_date) { toast.error('Select from date'); return; }
    setApplyingLeave(true);
    try {
      await api.post('/hr/leaves', {
        ...leaveForm,
        to_date: leaveForm.to_date || leaveForm.from_date,
      });
      toast.success('Leave request submitted');
      setShowLeaveForm(false);
      setLeaveForm({ leave_type: 'CL', from_date: '', to_date: '', reason: '', is_half_day: false, half_day_part: 'morning' });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to apply leave');
    } finally {
      setApplyingLeave(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  const att     = status?.attendance;
  const roster  = status?.roster;
  const balances = status?.leave_balances ?? [];
  const leaves  = status?.active_leaves ?? [];

  const hasCheckedIn  = !!att?.check_in_time;
  const hasCheckedOut = !!att?.check_out_time;
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Date header */}
      <div className="text-center mb-6">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Today</p>
        <h1 className="text-lg font-bold text-slate-900">{todayStr}</h1>
        <p className="text-2xl font-mono font-bold text-[#00475a] mt-1">
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      {/* Today's shift */}
      {roster && (
        <div
          className="rounded-xl p-4 mb-4 border-2"
          style={{ borderColor: roster.color ?? '#00475a', background: (roster.color ?? '#00475a') + '15' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Today's shift</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{roster.name}</p>
              <p className="text-sm text-slate-500">{roster.start_time} – {roster.end_time}</p>
            </div>
            <Clock className="w-8 h-8 opacity-30" />
          </div>
        </div>
      )}

      {/* Active leave warning */}
      {leaves.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {leaves[0].leave_type} — {leaves[0].status === 'pending' ? 'Pending approval' : 'Approved leave'}
            </p>
            <p className="text-xs text-amber-600">
              {new Date(leaves[0].from_date).toLocaleDateString('en-IN')} →{' '}
              {new Date(leaves[0].to_date).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Attendance status card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Attendance</h2>
          {att?.status && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CONFIG[att.status]?.color ?? ''}`}>
              {STATUS_CONFIG[att.status]?.label ?? att.status}
            </span>
          )}
        </div>

        {/* Check-in/out times */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`p-3 rounded-xl text-center ${hasCheckedIn ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-xs text-slate-400 mb-1">Check-in</p>
            <p className={`text-base font-bold ${hasCheckedIn ? 'text-green-700' : 'text-slate-300'}`}>
              {hasCheckedIn ? fmt(att.check_in_time) : '--:--'}
            </p>
            {att?.is_late && (
              <p className="text-[10px] text-orange-600 mt-0.5">
                {att.late_minutes}m late
              </p>
            )}
          </div>
          <div className={`p-3 rounded-xl text-center ${hasCheckedOut ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'}`}>
            <p className="text-xs text-slate-400 mb-1">Check-out</p>
            <p className={`text-base font-bold ${hasCheckedOut ? 'text-blue-700' : 'text-slate-300'}`}>
              {hasCheckedOut ? fmt(att.check_out_time) : '--:--'}
            </p>
            {hasCheckedOut && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {Number(att.working_hours).toFixed(1)}h worked
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {!hasCheckedIn ? (
          <button
            onClick={handleCheckIn}
            disabled={checking}
            className="w-full py-4 bg-[#00475a] text-white rounded-xl font-bold text-base hover:bg-[#003d4d] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Check In
          </button>
        ) : !hasCheckedOut ? (
          <button
            onClick={handleCheckOut}
            disabled={checking}
            className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold text-base hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
            Check Out
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">
              Day complete — {Number(att.working_hours).toFixed(1)} hours
            </span>
          </div>
        )}
      </div>

      {/* Leave balances */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Leave balance</h2>
          <button
            onClick={() => setShowLeaveForm(true)}
            className="text-xs font-semibold text-[#00475a] hover:underline"
          >
            Apply leave
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {balances.map((b: any) => (
            <div key={b.leave_type} className={`p-3 rounded-xl border ${LEAVE_COLORS[b.leave_type] ?? 'bg-slate-50 border-slate-200 text-slate-700'}`}>
              <p className="text-xs font-bold">{b.leave_type}</p>
              <p className="text-xl font-black mt-0.5">{Number(b.available_days).toFixed(1)}</p>
              <p className="text-[10px] opacity-60">of {Number(b.total_days)} days</p>
              {Number(b.pending_days) > 0 && (
                <p className="text-[10px] opacity-60">{Number(b.pending_days)} pending</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Apply leave form */}
      {showLeaveForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h3 className="font-bold text-slate-900 mb-4">Apply for leave</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Leave type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={e => setLeaveForm(p => ({ ...p, leave_type: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] bg-white"
                >
                  {balances.map((b: any) => (
                    <option key={b.leave_type} value={b.leave_type}>
                      {b.leave_type} — {Number(b.available_days).toFixed(1)} days available
                    </option>
                  ))}
                  <option value="LOP">LOP — Loss of Pay</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">From date</label>
                  <input type="date" value={leaveForm.from_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setLeaveForm(p => ({ ...p, from_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">To date</label>
                  <input type="date" value={leaveForm.to_date || leaveForm.from_date}
                    min={leaveForm.from_date || new Date().toISOString().split('T')[0]}
                    onChange={e => setLeaveForm(p => ({ ...p, to_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={leaveForm.is_half_day}
                  onChange={e => setLeaveForm(p => ({ ...p, is_half_day: e.target.checked }))}
                  className="w-4 h-4 accent-[#00475a]" />
                <span className="text-sm text-slate-700">Half day</span>
                {leaveForm.is_half_day && (
                  <select
                    value={leaveForm.half_day_part}
                    onChange={e => setLeaveForm(p => ({ ...p, half_day_part: e.target.value }))}
                    className="ml-2 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                )}
              </label>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Reason</label>
                <textarea value={leaveForm.reason}
                  onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                  rows={2} placeholder="Reason for leave..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowLeaveForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
                  Cancel
                </button>
                <button onClick={handleApplyLeave} disabled={applyingLeave}
                  className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {applyingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
