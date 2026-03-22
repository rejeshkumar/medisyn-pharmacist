'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, Clock, Loader2,
  Download, Calendar, TrendingUp, Users,
} from 'lucide-react';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  CL: 'Casual Leave', SL: 'Sick Leave', EL: 'Earned Leave',
  LOP: 'Loss of Pay', ML: 'Maternity Leave', CO: 'Comp Off',
};

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  cancelled:'bg-slate-50 text-slate-500 border-slate-200',
};

export default function LeaveManagementPage() {
  const [tab, setTab]           = useState<'leaves' | 'payroll'>('leaves');
  const [leaves, setLeaves]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Payroll state
  const now = new Date();
  const [payYear, setPayYear]   = useState(now.getFullYear());
  const [payMonth, setPayMonth] = useState(now.getMonth() + 1);
  const [report, setReport]     = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/hr/leaves?status=${statusFilter}`);
      setLeaves(r.data || []);
    } catch {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  const approve = async (id: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/hr/leaves/${id}/approve`, {});
      toast.success('Leave approved');
      await loadLeaves();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: string, note: string) => {
    setActionLoading(id);
    try {
      await api.patch(`/hr/leaves/${id}/reject`, { note });
      toast.success('Leave rejected');
      setRejectingId(null);
      setRejectNote('');
      await loadLeaves();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const loadReport = async () => {
    setLoadingReport(true);
    try {
      const r = await api.get(`/hr/payroll-report?year=${payYear}&month=${payMonth}`);
      setReport(r.data);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  };

  const exportCSV = () => {
    window.open(
      `/api/hr/payroll-report/export?year=${payYear}&month=${payMonth}`,
      '_blank'
    );
  };

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun',
                       'Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab header */}
      <div className="flex border-b border-slate-100 bg-white flex-shrink-0">
        {[
          { key: 'leaves',  label: 'Leave requests', icon: Calendar },
          { key: 'payroll', label: 'Payroll report',  icon: TrendingUp },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#00475a] text-[#00475a]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Leave requests ──────────────────────────────────────────── */}
      {tab === 'leaves' && (
        <div className="flex-1 overflow-auto p-4">
          {/* Status filter */}
          <div className="flex gap-2 mb-4">
            {['pending','approved','rejected','cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  statusFilter === s
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
            </div>
          ) : leaves.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No {statusFilter} leave requests</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {leaves.map((leave: any) => (
                <div key={leave.id} className="bg-white border border-slate-100 rounded-xl p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-900">{leave.full_name}</p>
                        <span className="text-xs text-slate-400 capitalize">{leave.role}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[#00475a]">
                          {LEAVE_TYPE_LABELS[leave.leave_type] ?? leave.leave_type}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600">
                          {new Date(leave.from_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}
                          {leave.from_date !== leave.to_date && (
                            <> → {new Date(leave.to_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</>
                          )}
                        </span>
                        <span className="text-xs font-medium text-slate-700">
                          ({Number(leave.days_count)} day{Number(leave.days_count) > 1 ? 's' : ''})
                        </span>
                        {leave.is_half_day && (
                          <span className="text-xs text-slate-500">· Half day ({leave.half_day_part})</span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_COLORS[leave.status]}`}>
                      {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                    </span>
                  </div>

                  {/* Reason */}
                  {leave.reason && (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3">
                      "{leave.reason}"
                    </p>
                  )}

                  {/* Rejection note */}
                  {leave.rejection_note && (
                    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                      Rejection note: {leave.rejection_note}
                    </p>
                  )}

                  {/* Approved by */}
                  {leave.approved_by_name && (
                    <p className="text-xs text-slate-400 mb-2">
                      {leave.status === 'approved' ? 'Approved' : 'Rejected'} by {leave.approved_by_name}
                    </p>
                  )}

                  {/* Reject inline form */}
                  {rejectingId === leave.id && (
                    <div className="mb-3 flex gap-2">
                      <input type="text" value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)}
                        placeholder="Rejection reason (optional)"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-red-400" />
                      <button onClick={() => reject(leave.id, rejectNote)}
                        disabled={!!actionLoading}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600 disabled:opacity-50">
                        Confirm
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectNote(''); }}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Action buttons — only for pending */}
                  {leave.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => approve(leave.id)}
                        disabled={actionLoading === leave.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === leave.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button onClick={() => setRejectingId(leave.id)}
                        className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payroll report ──────────────────────────────────────────── */}
      {tab === 'payroll' && (
        <div className="flex-1 overflow-auto p-4">
          {/* Controls */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <select value={payYear} onChange={e => setPayYear(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] bg-white">
              {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
            </select>
            <select value={payMonth} onChange={e => setPayMonth(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] bg-white">
              {MONTH_NAMES.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <button onClick={loadReport} disabled={loadingReport}
              className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d] disabled:opacity-50">
              {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate'}
            </button>
            {report && (
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>

          {report && (
            <>
              <p className="text-xs text-slate-400 mb-3">
                {MONTH_NAMES[payMonth-1]} {payYear} · {report.total_working_days} working days
                ({report.from} to {report.to})
              </p>

              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total staff',     value: report.staff.length,                                        icon: Users },
                  { label: 'Avg attendance',  value: (report.staff.reduce((s: number, r: any) => s + r.present_days, 0) / report.staff.length).toFixed(1) + 'd', icon: CheckCircle2 },
                  { label: 'Total leave days',value: report.staff.reduce((s: number, r: any) => s + r.leave_days, 0), icon: Calendar },
                  { label: 'Total LOP days',  value: report.staff.reduce((s: number, r: any) => s + r.lop_days, 0).toFixed(1), icon: XCircle },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-white border border-slate-100 rounded-xl p-4">
                      <Icon className="w-4 h-4 text-[#00475a] mb-2" />
                      <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-500">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Staff table */}
              <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        {['Name','Role','Present','Half Day','Leave','LOP','Late','Hours','CL Left','SL Left'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.staff.map((s: any, i: number) => (
                        <tr key={s.user_id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                          <td className="px-3 py-2.5 font-medium text-slate-800 border-b border-slate-50 whitespace-nowrap">{s.full_name}</td>
                          <td className="px-3 py-2.5 text-slate-500 capitalize border-b border-slate-50">{s.role}</td>
                          <td className="px-3 py-2.5 text-center font-semibold text-green-700 border-b border-slate-50">{s.present_days}</td>
                          <td className="px-3 py-2.5 text-center text-blue-600 border-b border-slate-50">{s.half_days}</td>
                          <td className="px-3 py-2.5 text-center text-amber-600 border-b border-slate-50">{s.leave_days}</td>
                          <td className={`px-3 py-2.5 text-center font-semibold border-b border-slate-50 ${s.lop_days > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {Number(s.lop_days).toFixed(1)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-orange-500 border-b border-slate-50">{s.late_count}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 border-b border-slate-50">{Number(s.total_hours).toFixed(1)}h</td>
                          <td className="px-3 py-2.5 text-center text-blue-600 border-b border-slate-50">{Number(s.cl_balance ?? 0).toFixed(1)}</td>
                          <td className="px-3 py-2.5 text-center text-red-600 border-b border-slate-50">{Number(s.sl_balance ?? 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
