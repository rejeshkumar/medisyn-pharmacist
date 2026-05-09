'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  AlertTriangle, Clock, CreditCard, Banknote, ArrowUpRight,
  Package, BarChart3, Users, ChevronRight, Plus, Edit2, X,
} from 'lucide-react';

// ── Expense categories matching your Google Sheet ──────────
const EXPENSE_CATEGORIES = [
  'PHARMACY PURCHASES',
  'CONSULTATION FEE',
  'STAFF SALARY',
  'DAILY CHITTI',
  'FUEL EXPENSES',
  'MEDICINE RETURN',
  'CLINIC MISC PURCHASES',
  'MARKETING AND PURCHASE',
  'RENT',
  'ELECTRICITY',
  'TELEPHONE',
  'STATIONERY',
  'INSURANCE',
  'LICENCE FEE',
  'BANK CHARGES',
  'MISCELLANEOUS',
];

const PAYMENT_MODES = ['CASH', 'CHEQUE CLEARED', 'RTGS', 'UPI', 'NOT PAID'];
const PAID_BY_OPTIONS = ['PHARMACY', 'CANARABANK', 'OWNER'];

function fmt(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtCompact(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

function daysAgo(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff}d ago`;
}

function StatCard({ icon: Icon, label, value, sub, variant = 'default' }: {
  icon: any; label: string; value: string; sub?: string; variant?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}) {
  const colors = {
    default: 'bg-gray-50 text-gray-700',
    green:   'bg-emerald-50 text-emerald-700',
    red:     'bg-red-50 text-red-700',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[variant]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 opacity-60" />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

function SectionHead({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {action && (
        <button onClick={action.onClick} className="text-xs text-[#00475a] hover:underline flex items-center gap-1">
          {action.label} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const m = (mode || '').toLowerCase();
  const styles: Record<string, string> = {
    cash:            'bg-green-100 text-green-700',
    upi:             'bg-blue-100 text-blue-700',
    gpay:            'bg-blue-100 text-blue-700',
    cheque:          'bg-amber-100 text-amber-700',
    'cheque cleared':'bg-amber-100 text-amber-700',
    rtgs:            'bg-purple-100 text-purple-700',
    card:            'bg-pink-100 text-pink-700',
    'not paid':      'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[m] || 'bg-gray-100 text-gray-600'}`}>
      {mode?.toUpperCase() || 'CASH'}
    </span>
  );
}

// ── ADD EXPENSE FORM ────────────────────────────────────────
// Maps 1:1 with your Google Sheet columns:
// Date | Particulars | Expense Type | Payment Mode | Paid By | Amount | Voucher Received
function AddExpenseForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'PHARMACY PURCHASES',
    description: '',
    amount: '',
    payment_mode: 'CASH',
    paid_by: 'PHARMACY',
    vendor_name: '',
    reference_no: '',
    voucher_amount: '',
  });

  const resetForm = () => setForm({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'PHARMACY PURCHASES',
    description: '',
    amount: '',
    payment_mode: 'CASH',
    paid_by: 'PHARMACY',
    vendor_name: '',
    reference_no: '',
    voucher_amount: '',
  });

  const handleSave = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      await api.post('/financial/expenses', {
        expense_date: form.expense_date,
        category: form.category,
        description: form.description,
        amount: parseFloat(form.amount),
        payment_mode: form.payment_mode,
        paid_by: form.paid_by,
        vendor_name: form.vendor_name || null,
        reference_no: form.reference_no || null,
        voucher_amount: form.voucher_amount ? parseFloat(form.voucher_amount) : null,
      });
      resetForm();
      setOpen(false);
      onSuccess();
    } catch {
      alert('Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 flex items-center gap-1.5 font-medium">
        <Plus className="w-3.5 h-3.5" /> Add expense
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-red-500" /> New expense
        </h4>
        <button onClick={() => { setOpen(false); resetForm(); }}
          className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>

      {/* Row 1: Date, Category, Description */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Date</label>
          <input type="date" value={form.expense_date}
            onChange={e => setForm({ ...form, expense_date: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Expense type</label>
          <select value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] outline-none">
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Particulars (description)</label>
          <input value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="e.g., KAIRALI PHARMA & SURGICALS (28/04/2026)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none" />
        </div>
      </div>

      {/* Row 2: Amount, Payment Mode, Paid By, Vendor */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Amount (₹)</label>
          <input type="number" value={form.amount}
            onChange={e => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Payment mode</label>
          <select value={form.payment_mode}
            onChange={e => setForm({ ...form, payment_mode: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] outline-none">
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Paid by</label>
          <select value={form.paid_by}
            onChange={e => setForm({ ...form, paid_by: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] outline-none">
            {PAID_BY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Vendor name</label>
          <input value={form.vendor_name}
            onChange={e => setForm({ ...form, vendor_name: e.target.value })}
            placeholder="e.g., LINK PHARMA"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] focus:ring-1 focus:ring-[#00475a] outline-none" />
        </div>
      </div>

      {/* Row 3: Reference, Voucher, Save */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Reference no. (optional)</label>
          <input value={form.reference_no}
            onChange={e => setForm({ ...form, reference_no: e.target.value })}
            placeholder="Cheque/UPI ref"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] outline-none" />
        </div>
        <div>
          <label className="text-[11px] text-gray-500 font-medium block mb-1">Voucher received (₹)</label>
          <input type="number" value={form.voucher_amount}
            onChange={e => setForm({ ...form, voucher_amount: e.target.value })}
            placeholder="Optional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00475a] outline-none" />
        </div>
        {form.voucher_amount && form.amount && (
          <div className="flex items-end">
            <div className={`text-xs font-medium px-3 py-2 rounded-lg ${
              parseFloat(form.voucher_amount) - parseFloat(form.amount) === 0
                ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              Diff: {fmt(parseFloat(form.voucher_amount) - parseFloat(form.amount))}
            </div>
          </div>
        )}
        <div className="flex items-end">
          <button onClick={handleSave}
            disabled={saving || !form.description || !form.amount}
            className="w-full bg-[#00475a] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#003d4d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving...' : 'Save expense'}
          </button>
        </div>
      </div>

      {/* Quick help mapping */}
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <strong className="text-gray-500">Google Sheet mapping:</strong> Date = Date • Particulars = Description • Expense Type = Category • Payment Mode = Mode • Paid By = Paid By • Amount = Amount • Voucher Received = Voucher amount
        </p>
      </div>
    </div>
  );
}

// ── Vendor terms editor modal ───────────────────────────
function VendorTermsModal({ onClose }: { onClose: () => void }) {
  const { data: terms = [], refetch } = useQuery({
    queryKey: ['vendor-terms'],
    queryFn: () => api.get('/owner-dashboard/vendor-terms').then(r => r.data),
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ credit_days: 0, payment_mode: 'CASH', notes: '' });

  const handleSave = async (id: string) => {
    await api.patch(`/owner-dashboard/vendor-terms/${id}`, form);
    setEditId(null);
    refetch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="px-5 py-4 bg-[#00475a] flex items-center justify-between">
          <h3 className="text-white font-semibold">Vendor payment terms</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white text-sm">Close</button>
        </div>
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Vendor</th>
                <th className="text-center px-2 py-2 text-xs text-gray-500 font-medium">Credit days</th>
                <th className="text-center px-2 py-2 text-xs text-gray-500 font-medium">Mode</th>
                <th className="text-left px-2 py-2 text-xs text-gray-500 font-medium">Notes</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(terms as any[]).map((t: any) => (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-blue-50/50">
                  <td className="px-4 py-2 font-medium text-gray-900 text-xs">{t.supplier_name}</td>
                  {editId === t.id ? (
                    <>
                      <td className="px-2 py-2 text-center">
                        <input type="number" value={form.credit_days} onChange={e => setForm({ ...form, credit_days: parseInt(e.target.value) || 0 })}
                          className="w-16 text-center border rounded px-1 py-0.5 text-xs" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                          className="border rounded px-1 py-0.5 text-xs">
                          <option>CASH</option><option>CHEQUE</option><option>RTGS</option><option>UPI</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                          className="w-full border rounded px-1 py-0.5 text-xs" />
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => handleSave(t.id)} className="text-xs text-green-600 font-medium">Save</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-2 text-center">
                        <span className={`text-xs font-bold ${t.credit_days > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                          {t.credit_days > 0 ? `${t.credit_days}d` : 'COD'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center"><ModeBadge mode={t.payment_mode} /></td>
                      <td className="px-2 py-2 text-xs text-gray-400 truncate max-w-[120px]">{t.notes || '—'}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => { setEditId(t.id); setForm({ credit_days: t.credit_days, payment_mode: t.payment_mode, notes: t.notes || '' }); }}
                          className="text-gray-400 hover:text-gray-600"><Edit2 className="w-3 h-3" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ──────────────────────────────────────
export default function OwnerFinancialDashboard() {
  const [showTerms, setShowTerms] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get('/owner-dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00475a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = data || { today: {}, mtd: {}, payment_modes: [], vendor_payables: { overdue: [], upcoming_7d: [] }, top_vendors_mtd: [], top_margin_medicines: [], recent_sales: [], recent_expenses: [] };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financial command center</h1>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddExpenseForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['owner-dashboard'] })} />
          <button onClick={() => setShowTerms(true)}
            className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5" /> Vendor terms
          </button>
        </div>
      </div>

      {/* ── TODAY'S SNAPSHOT ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Today revenue" value={fmt(d.today.revenue)} sub={`${d.today.bill_count} bills`} variant="green" />
        <StatCard icon={TrendingDown} label="Today expenses" value={fmt(d.today.expenses)} sub={`${d.today.expense_count} entries`} variant="red" />
        <StatCard icon={DollarSign} label="Today net" value={fmt(d.today.net_profit)} variant={d.today.net_profit >= 0 ? 'green' : 'red'} />
        <StatCard icon={AlertTriangle} label="Vendor payables" value={fmt(d.vendor_payables.total_outstanding)}
          sub={`${d.vendor_payables.vendor_count} vendors`} variant="amber" />
      </div>

      {/* ── MTD OVERVIEW ───────────────────────────────────── */}
      <SectionHead title="Month to date" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={TrendingUp} label="MTD revenue" value={fmtCompact(d.mtd.revenue)} sub={`${d.mtd.bill_count} bills`} variant="green" />
        <StatCard icon={ShoppingCart} label="Purchase cost" value={fmtCompact(d.mtd.purchase_cost)} variant="blue" />
        <StatCard icon={BarChart3} label="Gross margin" value={fmtCompact(d.mtd.gross_margin)} variant={d.mtd.gross_margin >= 0 ? 'green' : 'red'} />
        <StatCard icon={TrendingDown} label="Operating expense" value={fmtCompact(d.mtd.expenses)} sub={`${d.mtd.expense_count} entries`} variant="red" />
        <StatCard icon={DollarSign} label="Net profit" value={fmtCompact(d.mtd.net_profit)} variant={d.mtd.net_profit >= 0 ? 'green' : 'red'} />
      </div>

      {/* ── PAYMENT MODE SPLIT ─────────────────────────────── */}
      {d.payment_modes?.length > 0 && (
        <>
          <SectionHead title="Revenue by payment mode (MTD)" />
          <div className="flex gap-2 flex-wrap">
            {d.payment_modes.map((m: any) => (
              <div key={m.mode} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <ModeBadge mode={m.mode} />
                <span className="text-sm font-semibold text-gray-700">{fmt(m.amount)}</span>
                <span className="text-xs text-gray-400">{m.count} bills</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── OVERDUE PAYABLES (URGENT) ──────────────────────── */}
      {d.vendor_payables.overdue?.length > 0 && (
        <>
          <SectionHead title="Overdue vendor payments" />
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="space-y-2">
              {d.vendor_payables.overdue.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-sm font-medium text-red-800">{v.supplier_name}</span>
                    {v.preferred_mode && <ModeBadge mode={v.preferred_mode} />}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-red-700">{fmt(v.balance)}</span>
                    <span className="text-xs text-red-500 ml-2">due {daysAgo(v.oldest_due)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── UPCOMING DUES (NEXT 7 DAYS) ───────────────────── */}
      {d.vendor_payables.upcoming_7d?.length > 0 && (
        <>
          <SectionHead title="Due this week" />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="space-y-2">
              {d.vendor_payables.upcoming_7d.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">{v.supplier_name}</span>
                    {v.preferred_mode && <ModeBadge mode={v.preferred_mode} />}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-700">{fmt(v.amount)}</span>
                    <span className="text-xs text-amber-500 ml-2">
                      {v.days_until_due === 0 ? 'today' : `in ${v.days_until_due}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── BOTTOM GRID: TOP VENDORS + TOP MARGINS ─────────── */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" /> Top vendor spend (MTD)
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(d.top_vendors_mtd || []).map((v: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-800">{v.supplier_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{v.invoice_count} inv</span>
                  {v.credit_days > 0 && <span className="text-[10px] text-blue-500 ml-1">({v.credit_days}d credit)</span>}
                </div>
                <span className="text-sm font-bold text-gray-700">{fmtCompact(v.total_spend)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" /> Top margin medicines (MTD)
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(d.top_margin_medicines || []).map((m: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium text-gray-800 truncate max-w-[200px] block">{m.medicine_name}</span>
                  <span className="text-xs text-gray-400">{m.total_qty} sold • Rev {fmtCompact(m.total_revenue)}</span>
                </div>
                <span className="text-sm font-bold text-green-600">+{fmtCompact(m.margin)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECENT ACTIVITY ────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Recent sales</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(d.recent_sales || []).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div>
                  <span className="text-xs font-mono text-gray-500">{s.bill_number}</span>
                  <span className="text-xs text-gray-400 ml-2">{s.customer_name || 'Walk-in'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ModeBadge mode={s.payment_mode} />
                  <span className="text-sm font-semibold text-gray-700">{fmt(s.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Recent expenses</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {(d.recent_expenses || []).map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-2">
                <div>
                  <span className="text-xs font-medium text-gray-700">{e.description}</span>
                  <span className="text-[10px] text-gray-400 ml-1">{e.category}</span>
                </div>
                <span className="text-sm font-semibold text-red-600">-{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTerms && <VendorTermsModal onClose={() => setShowTerms(false)} />}
    </div>
  );
}
