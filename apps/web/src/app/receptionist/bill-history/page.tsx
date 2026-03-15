'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, Download, Eye, Loader2, Receipt,
  TrendingUp, Clock, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => '₹' + n(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-IN', {
  hour: '2-digit', minute: '2-digit',
});

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Paid',    color: 'bg-green-50 text-green-700 border-green-200' },
  paid:      { label: 'Paid',    color: 'bg-green-50 text-green-700 border-green-200' },
  draft:     { label: 'Draft',   color: 'bg-slate-50 text-slate-600 border-slate-200' },
  void:      { label: 'Void',    color: 'bg-red-50 text-red-600 border-red-200' },
  credit:    { label: 'Credit',  color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const PM_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit',
};

export default function BillHistoryPage() {
  const router = useRouter();
  const [bills, setBills]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [total, setTotal]     = useState(0);
  const [summary, setSummary] = useState<any>(null);

  // Filters
  const [search, setSearch]       = useState('');
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState('');

  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (dateFilter)    params.set('date', dateFilter);
      if (statusFilter)  params.set('status', statusFilter);

      const [billsRes, summaryRes] = await Promise.all([
        api.get(`/clinic-bills?${params}`),
        api.get(`/clinic-bills/summary?date=${dateFilter}`).catch(() => ({ data: null })),
      ]);

      setBills(billsRes.data?.data || []);
      setTotal(billsRes.data?.total || 0);
      setSummary(summaryRes.data);
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [page, dateFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const filtered = bills.filter(b => {
    if (!search) return true;
    return (
      b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient?.mobile?.includes(search)
    );
  });

  const patientName = (b: any) => {
    if (b.patient?.first_name) {
      return `${b.patient.first_name} ${b.patient.last_name ?? ''}`.trim();
    }
    return b.patient?.full_name ?? '—';
  };

  // Summary stats from bills if API summary not available
  const stats = summary ?? {
    total_bills:     bills.length,
    total_collected: bills.filter(b => ['confirmed','paid'].includes(b.status))
                         .reduce((s, b) => s + n(b.total_amount), 0),
    pending_count:   bills.filter(b => b.status === 'draft').length,
    total_discounts: bills.reduce((s, b) =>
      s + n(b.vip_discount_amount) + n(b.extra_discount_amt), 0),
  };

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bill history</h1>
          <p className="text-sm text-slate-500 mt-1">View and search all bills</p>
        </div>
        <button
          onClick={() => router.push('/receptionist/billing')}
          className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-medium rounded-xl hover:bg-[#003d4d] transition-colors"
        >
          <Receipt className="w-4 h-4" /> New bill
        </button>
      </div>

      {/* Daily summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Bills today',      value: stats.total_bills,     icon: Receipt,       color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Collected',        value: fmt(stats.total_collected), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pending',          value: stats.pending_count,   icon: Clock,         color: 'text-amber-600',  bg: 'bg-amber-50' },
          { label: 'Total discounts',  value: fmt(stats.total_discounts), icon: CheckCircle2, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white border border-slate-100 rounded-xl p-4">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-lg font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bill no. or patient..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] bg-white"
        >
          <option value="">All status</option>
          <option value="confirmed">Paid</option>
          <option value="draft">Draft</option>
          <option value="void">Void</option>
        </select>
      </div>

      {/* Bills table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">Bill no.</div>
          <div className="col-span-3">Patient</div>
          <div className="col-span-2">Time</div>
          <div className="col-span-1">Mode</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-20" />
            No bills found for this date
          </div>
        ) : (
          filtered.map(bill => {
            const status = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.draft;
            const hasDiscount = n(bill.vip_discount_amount) + n(bill.extra_discount_amt) > 0;
            return (
              <div
                key={bill.id}
                className="grid grid-cols-12 gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors items-center"
              >
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-[#00475a]">{bill.bill_number}</p>
                </div>
                <div className="col-span-3 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{patientName(bill)}</p>
                  {hasDiscount && (
                    <p className="text-xs text-amber-600">
                      Disc: {fmt(n(bill.vip_discount_amount) + n(bill.extra_discount_amt))}
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">{fmtTime(bill.created_at)}</p>
                </div>
                <div className="col-span-1">
                  <span className="text-xs text-slate-500">
                    {PM_LABELS[bill.payment_mode] ?? bill.payment_mode}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-bold text-slate-900">{fmt(bill.total_amount)}</p>
                </div>
                <div className="col-span-1 flex justify-end gap-1">
                  <button
                    onClick={() => router.push(`/receptionist/bill-history/${bill.id}`)}
                    className="p-1.5 text-slate-400 hover:text-[#00475a] transition-colors"
                    title="View bill"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">
            Showing {(page-1)*LIMIT + 1}–{Math.min(page*LIMIT, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p-1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setPage(p => p+1)}
              disabled={page * LIMIT >= total}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
