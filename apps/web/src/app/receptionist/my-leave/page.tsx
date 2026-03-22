'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Loader2, CheckCircle2, XCircle,
  Clock, Calendar, ChevronDown, ChevronUp, X,
} from 'lucide-react';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave',
  LOP: 'Loss of Pay', CO: 'Comp Off',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'Pending approval', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  approved:  { label: 'Approved',         color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  rejected:  { label: 'Rejected',         color: 'bg-red-50 text-red-600 border-red-200',       icon: XCircle },
  cancelled: { label: 'Cancelled',        color: 'bg-slate-50 text-slate-500 border-slate-200', icon: XCircle },
};

const LEAVE_COLORS: Record<string, string> = {
  CL: 'bg-blue-50 text-blue-700 border-blue-200',
  SL: 'bg-red-50 text-red-700 border-red-200',
  EL: 'bg-green-50 text-green-700 border-green-200',
  LOP:'bg-gray-50 text-gray-600 border-gray-200',
  CO: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function MyLeavePage() {
  const [leaves, setLeaves]     = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applyingLeave, setApplyingLeave] = useState(false);
  const [statusFilter, setStatusFilter]   = useState('all');

  const [form, setForm] = useState({
    leave_type: 'CL', from_date: '', to_date: '',
    reason: '', is_half_day: false, half_day_part: 'morning',
  });

  const load = useCallback(async () => {
    try {
      const [leavesRes, balRes] = await Promise.all([
        api.get('/hr/leaves'),
        api.get('/hr/leave-balance'),
      ]);
      setLeaves(leavesRes.data || []);
      setBalances(balRes.data || []);
    } catch {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyLeave = async () => {
    if (!form.from_date) { toast.error('Select from date'); return; }
    setApplyingLeave(true);
    try {
      await api.post('/hr/leaves', {
        ...form,
        to_date: form.to_date || form.from_date,
      });
      toast.success('Leave request submitted — pending approval');
      setShowForm(false);
      setForm({ leave_type:'CL', from_date:'', to_date:'', reason:'', is_half_day:false, half_day_part:'morning' });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to submit');
    } finally {
      setApplyingLeave(false);
    }
  };

  const cancelLeave = async (id: string) => {
    try {
      await api.patch(`/hr/leaves/${id}/reject`, { note: 'Cancelled by employee' });
      toast.success('Leave cancelled');
      await load();
    } catch { toast.error('Failed to cancel'); }
  };

  const filtered = statusFilter === 'all'
    ? leaves
    : leaves.filter(l => l.status === statusFilter);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">My Leaves</h1>
          <p className="text-xs text-slate-400">Requests and balances</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d] transition-colors">
          <Plus className="w-4 h-4" /> Apply leave
        </button>
      </div>

      {/* Leave balances */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {balances.filter(b => b.leave_type !== 'LOP').map((b: any) => (
          <div key={b.leave_type} className={`p-3 rounded-xl border text-center ${LEAVE_COLORS[b.leave_type] ?? 'bg-slate-50 border-slate-200'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide">{b.leave_type}</p>
            <p className="text-2xl font-black mt-0.5">{Number(b.available_days).toFixed(0)}</p>
            <p className="text-[10px] opacity-60">/ {Number(b.total_days)} days</p>
            {Number(b.pending_days) > 0 && (
              <p className="text-[10px] opacity-60">{Number(b.pending_days)} pending</p>
            )}
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {['all','pending','approved','rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 transition-all ${
              statusFilter === s
                ? 'bg-[#00475a] text-white border-[#00475a]'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s === 'pending' && leaves.filter(l=>l.status==='pending').length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 px-1.5 rounded-full text-[10px]">
                {leaves.filter(l=>l.status==='pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leave list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm text-slate-400">No {statusFilter === 'all' ? '' : statusFilter} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l: any) => {
            const cfg = STATUS_CONFIG[l.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={l.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${LEAVE_COLORS[l.leave_type] ?? ''}`}>
                        {l.leave_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {LEAVE_TYPE_LABELS[l.leave_type] ?? l.leave_type}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(l.from_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                      {l.from_date !== l.to_date && (
                        <> → {new Date(l.to_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {Number(l.days_count)} day{Number(l.days_count) > 1 ? 's' : ''}
                      {l.is_half_day && ` (${l.half_day_part} half day)`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                </div>

                {l.reason && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-2">"{l.reason}"</p>
                )}

                {l.rejection_note && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">
                    Note: {l.rejection_note}
                  </p>
                )}

                {l.approved_by_name && (
                  <p className="text-xs text-slate-400">
                    {l.status === 'approved' ? 'Approved' : 'Rejected'} by {l.approved_by_name}
                    {l.approved_at && ` · ${new Date(l.approved_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`}
                  </p>
                )}

                {l.status === 'pending' && (
                  <button onClick={() => cancelLeave(l.id)}
                    className="mt-2 text-xs text-red-500 hover:underline">
                    Cancel request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Apply leave modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Apply for leave</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Leave type</label>
                <select value={form.leave_type}
                  onChange={e => setForm(p=>({...p,leave_type:e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#00475a]">
                  {balances.map((b: any) => (
                    <option key={b.leave_type} value={b.leave_type}>
                      {LEAVE_TYPE_LABELS[b.leave_type] ?? b.leave_type} — {Number(b.available_days).toFixed(1)} days left
                    </option>
                  ))}
                  <option value="LOP">Loss of Pay (LOP)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">From date</label>
                  <input type="date" value={form.from_date} min={minDate}
                    onChange={e => setForm(p=>({...p,from_date:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">To date</label>
                  <input type="date" value={form.to_date||form.from_date} min={form.from_date||minDate}
                    onChange={e => setForm(p=>({...p,to_date:e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_half_day}
                  onChange={e => setForm(p=>({...p,is_half_day:e.target.checked}))}
                  className="w-4 h-4 accent-[#00475a]" />
                <span className="text-sm text-slate-700">Half day</span>
                {form.is_half_day && (
                  <select value={form.half_day_part}
                    onChange={e => setForm(p=>({...p,half_day_part:e.target.value}))}
                    className="ml-1 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white">
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                  </select>
                )}
              </label>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(p=>({...p,reason:e.target.value}))}
                  rows={2} placeholder="Reason for leave (recommended)..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#00475a]" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  ⏰ Leave must be applied at least 1 day in advance. Your request goes to the owner for approval.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
                  Cancel
                </button>
                <button onClick={applyLeave} disabled={applyingLeave}
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
