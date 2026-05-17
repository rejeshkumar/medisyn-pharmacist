'use client';
import toast from 'react-hot-toast';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  AlertTriangle, Clock, CreditCard, Banknote, ArrowUpRight,
  Package, BarChart3, Users, ChevronRight, Plus, Edit2, Pencil, X,
  Calendar, Truck, Filter,
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
    'not_paid':      'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${styles[m] || 'bg-gray-100 text-gray-600'}`}>
      {(mode || '').toUpperCase()}
    </span>
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
        <div className="px-5 py-4 bg-[#00b8a0] flex items-center justify-between">
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


// ══════════════════════════════════════════════════════════════════════════
// EXPENSES TAB (full list with add/edit/delete)
// ══════════════════════════════════════════════════════════════════════════
function ExpensesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
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
    category: 'PHARMACY PURCHASES', description: '', amount: '',
    payment_mode: 'CASH', paid_by: 'PHARMACY', vendor_name: '',
    reference_no: '', voucher_amount: '',
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses-list', dateRange],
    queryFn: () => api.get(`/financial/expenses?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.data),
  });

  const addMut = useMutation({
    mutationFn: (d: any) => api.post('/financial/expenses', d),
    onSuccess: () => {
      toast.success('Expense recorded');
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['owner-dashboard'] });
      qc.invalidateQueries({ queryKey: ['upcoming-payments'] });
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error('Failed to save'),
  });

  const editMut = useMutation({
    mutationFn: (data: any) => api.patch(`/financial/expenses/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setEditingExpense(null); toast.success('Expense updated'); },
    onError: () => toast.error('Failed to update expense'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/expenses/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['owner-dashboard'] });
    },
  });

  const handleSubmit = () => {
    if (!form.description || !form.amount) return toast.error('Description and amount required');
    addMut.mutate({
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
  };

  // Category summary
  const categorySummary = expenses.reduce((acc: any, e: any) => {
    const cat = e.category || 'UNCATEGORIZED';
    if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
    acc[cat].total += Number(e.amount);
    acc[cat].count += 1;
    return acc;
  }, {});
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">

      {/* Edit Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Pencil size={16} className="text-[#00b8a0]" /> Edit Expense</h3>
              <button onClick={() => setEditingExpense(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Date</label>
                  <input type="date" value={editingExpense.expense_date?.slice(0,10)}
                    onChange={e => setEditingExpense((p: any) => ({ ...p, expense_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Amount (₹)</label>
                  <input type="number" value={editingExpense.amount}
                    onChange={e => setEditingExpense((p: any) => ({ ...p, amount: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Description</label>
                <input value={editingExpense.description}
                  onChange={e => setEditingExpense((p: any) => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Category</label>
                  <select value={editingExpense.category}
                    onChange={e => setEditingExpense((p: any) => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Payment Mode</label>
                  <select value={editingExpense.payment_mode}
                    onChange={e => setEditingExpense((p: any) => ({ ...p, payment_mode: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none">
                    {['CASH','UPI','CARD','BANK_TRANSFER','CHEQUE'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Edit reason (for audit)</label>
                <input value={editingExpense.edit_reason || ''}
                  onChange={e => setEditingExpense((p: any) => ({ ...p, edit_reason: e.target.value }))}
                  placeholder="Why are you editing this expense?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#00b8a0] outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditingExpense(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50">Cancel</button>
                <button onClick={() => editMut.mutate(editingExpense)}
                  disabled={editMut.isPending}
                  className="flex-1 py-2.5 bg-[#00b8a0] text-white text-sm font-bold rounded-xl hover:bg-[#009688] disabled:opacity-50">
                  {editMut.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Expenses</h3>
          <p className="text-xs text-gray-500 mt-0.5">Track all operating expenses</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688]">
          <Plus size={14} /> Add Expense
        </button>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
            className="px-2.5 py-1.5 border rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
            className="px-2.5 py-1.5 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-red-500" /> New Expense
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <button onClick={handleSubmit}
                disabled={addMut.isPending || !form.description || !form.amount}
                className="w-full bg-[#00b8a0] text-white text-sm font-medium py-2 rounded-lg hover:bg-[#009688] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {addMut.isPending ? 'Saving...' : 'Save expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border-2 border-[#00b8a0] rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Expenses</p>
          <p className="text-xl font-bold text-[#00b8a0] mt-1">₹{totalExpenses.toLocaleString('en-IN')}</p>
          <p className="text-xs text-gray-400 mt-1">{expenses.length} entries</p>
        </div>
        {Object.entries(categorySummary).sort((a: any, b: any) => b[1].total - a[1].total).slice(0, 3).map(([cat, data]: any) => (
          <div key={cat} className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500 truncate">{cat}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">₹{data.total.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-1">{data.count} entries</p>
          </div>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f9fafb] text-left border-b border-[#e5e7eb]">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Description</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Category</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Amount</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Mode</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Paid By</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No expenses found</td></tr>
              ) : expenses.map((e: any) => (
                <tr key={e.id} className="border-t border-[#f9fafb] hover:bg-[#f0fdf4] transition-colors">
                  <td className="px-4 py-2.5 text-gray-600">{new Date(e.expense_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{e.description}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{e.category}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">₹{Number(e.amount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5"><ModeBadge mode={e.payment_mode} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{e.paid_by || '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingExpense(e)}
                        className="text-gray-400 hover:text-[#00b8a0] p-1 rounded hover:bg-[#e1f5ee] transition-colors" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => { if (confirm('Delete this expense?')) deleteMut.mutate(e.id); }}
                        className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Delete">
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right text-red-600">₹{totalExpenses.toLocaleString('en-IN')}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// PHARMACY PURCHASES TAB
// ══════════════════════════════════════════════════════════════════════════
function PharmacyPurchasesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().split('T')[0],
    vendor_name: '', invoice_no: '', amount: '',
    payment_mode: 'CASH', paid_by: '', credit_period: '',
    is_paid: false, cheque_no: '', reference_no: '', notes: '',
  });
  const [viewMode, setViewMode] = useState<'list'|'summary'>('summary');

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['pharmacy-purchases', dateRange],
    queryFn: () => api.get(`/financial/pharmacy-purchases?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['pharmacy-purchases-summary', dateRange],
    queryFn: () => api.get(`/financial/pharmacy-purchases/summary?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.data),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/financial/vendors').then(r => r.data),
    staleTime: 300_000,
  });

  const addMut = useMutation({
    mutationFn: (d: any) => api.post('/financial/pharmacy-purchases', d),
    onSuccess: () => {
      toast.success('Purchase recorded');
      qc.invalidateQueries({ queryKey: ['pharmacy-purchases'] });
      qc.invalidateQueries({ queryKey: ['upcoming-payments'] });
      qc.invalidateQueries({ queryKey: ['owner-dashboard'] });
      setShowForm(false);
      setForm({ purchase_date: new Date().toISOString().split('T')[0], vendor_name: '', invoice_no: '', amount: '', payment_mode: 'CASH', paid_by: '', credit_period: '', is_paid: false, cheque_no: '', reference_no: '', notes: '' });
    },
    onError: () => toast.error('Failed to save'),
  });

  const editMut = useMutation({
    mutationFn: (data: any) => api.patch(`/financial/expenses/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setEditingExpense(null); toast.success('Expense updated'); },
    onError: () => toast.error('Failed to update expense'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/pharmacy-purchases/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['pharmacy-purchases'] });
      qc.invalidateQueries({ queryKey: ['upcoming-payments'] });
    },
  });

  const handleSubmit = () => {
    if (!form.vendor_name || !form.amount) return toast.error('Vendor and amount required');
    addMut.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const PP_MODES = ['CASH', 'CHEQUE', 'RTGS', 'UPI', 'NOT_PAID'];
  const CREDIT_PERIODS = ['CASH PURCHASE', '7DAYS', '15DAYS', '30DAYS', '60DAYS', '90DAYS'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pharmacy Purchases</h3>
          <p className="text-xs text-gray-500 mt-0.5">Track vendor-wise medicine purchases</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'summary' ? 'bg-[#00b8a0] text-white' : 'text-gray-600'}`}>
              Summary
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-[#00b8a0] text-white' : 'text-gray-600'}`}>
              All Entries
            </button>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688]">
            <Plus size={14} /> Add Purchase
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
            className="px-2.5 py-1.5 border rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
            className="px-2.5 py-1.5 border rounded-lg text-sm" />
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">New Purchase Entry</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Vendor *</label>
              <input list="vendor-list" value={form.vendor_name}
                onChange={e => {
                  const v = e.target.value;
                  setForm(p => ({ ...p, vendor_name: v }));
                  const match = vendors.find((x: any) => x.vendor_name === v);
                  if (match) {
                    setForm(p => ({ ...p, payment_mode: match.payment_mode || 'CASH', credit_period: match.credit_period || '' }));
                  }
                }}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="Type or select vendor" />
              <datalist id="vendor-list">
                {vendors.map((v: any) => <option key={v.id} value={v.vendor_name} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Invoice No</label>
              <input value={form.invoice_no} onChange={e => setForm(p => ({ ...p, invoice_no: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="INV-001" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Payment Mode</label>
              <select value={form.payment_mode} onChange={e => setForm(p => ({ ...p, payment_mode: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white">
                {PP_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Credit Period</label>
              <select value={form.credit_period} onChange={e => setForm(p => ({ ...p, credit_period: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select...</option>
                {CREDIT_PERIODS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Paid By</label>
              <input value={form.paid_by} onChange={e => setForm(p => ({ ...p, paid_by: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="PHARMACY / CB / OWNER" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cheque / Ref No</label>
              <input value={form.reference_no} onChange={e => setForm(p => ({ ...p, reference_no: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_paid} onChange={e => setForm(p => ({ ...p, is_paid: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-[#00475a]" />
                Paid
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="Optional notes..." />
          </div>
          {!form.is_paid && form.credit_period && form.credit_period !== 'CASH PURCHASE' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-700">
              💡 This unpaid purchase will auto-create an upcoming payment due on{' '}
              <strong>
                {(() => {
                  const days = parseInt(form.credit_period) || 0;
                  const due = new Date(form.purchase_date);
                  due.setDate(due.getDate() + days);
                  return due.toLocaleDateString('en-IN');
                })()}
              </strong>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={addMut.isPending}
              className="px-4 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688] disabled:opacity-50">
              {addMut.isPending ? 'Saving...' : 'Save Purchase'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Purchases</p>
            <p className="text-xl font-bold text-gray-900 mt-1">₹{Number(summary.totals?.total_purchases || 0).toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400 mt-1">{summary.totals?.total_invoices || 0} invoices</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-green-700 mt-1">₹{Number(summary.totals?.total_paid || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Unpaid</p>
            <p className="text-xl font-bold text-red-600 mt-1">₹{Number(summary.totals?.total_unpaid || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Vendors Active</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{summary.vendor_summary?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Summary View — Vendor-wise spend table */}
      {viewMode === 'summary' && summary?.vendor_summary && (
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-800">Vendor-wise Spend Analysis</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left border-b border-[#e5e7eb]">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">#</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Total Spend</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Unpaid</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Invoices</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {summary.vendor_summary.map((v: any, i: number) => (
                  <tr key={v.vendor_name} className="border-t border-[#f9fafb] hover:bg-[#f0fdf4] transition-colors">
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{v.vendor_name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">₹{Number(v.total_spend).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">₹{Number(v.paid_amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">{Number(v.unpaid_amount) > 0 ? `₹${Number(v.unpaid_amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-4 py-2.5 text-right">{v.total_invoices}</td>
                    <td className="px-4 py-2.5 text-gray-500">{v.last_purchase_date ? new Date(v.last_purchase_date).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {summary.vendor_summary.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-gray-50 font-semibold">
                    <td colSpan={2} className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right">₹{summary.vendor_summary.reduce((s: number, v: any) => s + Number(v.total_spend), 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-green-700">₹{summary.vendor_summary.reduce((s: number, v: any) => s + Number(v.paid_amount), 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-red-600">₹{summary.vendor_summary.reduce((s: number, v: any) => s + Number(v.unpaid_amount), 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right">{summary.vendor_summary.reduce((s: number, v: any) => s + Number(v.total_invoices), 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Payment Mode Breakup */}
      {viewMode === 'summary' && summary?.mode_breakup && summary.mode_breakup.length > 0 && (
        <div className="bg-white border rounded-xl p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Payment Mode Breakup</h4>
          <div className="flex flex-wrap gap-4">
            {summary.mode_breakup.map((m: any) => (
              <div key={m.payment_mode} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  m.payment_mode === 'CASH' ? 'bg-green-500' :
                  m.payment_mode === 'CHEQUE' ? 'bg-blue-500' :
                  m.payment_mode === 'RTGS' ? 'bg-purple-500' :
                  m.payment_mode === 'UPI' ? 'bg-orange-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-700">{m.payment_mode}: ₹{Number(m.total).toLocaleString('en-IN')} ({m.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View — All entries */}
      {viewMode === 'list' && (
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f9fafb] text-left border-b border-[#e5e7eb]">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Vendor</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Invoice</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Amount</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Mode</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Credit</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No purchases found</td></tr>
                ) : purchases.map((p: any) => (
                  <tr key={p.id} className="border-t border-[#f9fafb] hover:bg-[#f0fdf4] transition-colors">
                    <td className="px-4 py-2.5 text-gray-600">{new Date(p.purchase_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{p.vendor_name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.invoice_no || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        p.payment_mode === 'CASH' ? 'bg-green-50 text-green-700' :
                        p.payment_mode === 'CHEQUE' ? 'bg-blue-50 text-blue-700' :
                        p.payment_mode === 'RTGS' ? 'bg-purple-50 text-purple-700' :
                        p.payment_mode === 'NOT_PAID' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                      }`}>{p.payment_mode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{p.credit_period || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_paid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {p.is_paid ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => { if (confirm('Delete this entry?')) deleteMut.mutate(p.id); }}
                        className="text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// UPCOMING PAYMENTS TAB
// ══════════════════════════════════════════════════════════════════════════
function UpcomingPaymentsTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showPaid, setShowPaid] = useState(false);
  const [showBalanceForm, setShowBalanceForm] = useState(false);
  const [form, setForm] = useState({
    payment_type: '', description: '', amount: '',
    due_date: '', is_urgent: false, notes: '',
  });
  const [balForm, setBalForm] = useState({ cash_balance: '', bank_balance: '', cheque_issued: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-payments', showPaid],
    queryFn: () => api.get(`/financial/upcoming-payments?show_paid=${showPaid}`).then(r => r.data),
  });

  const payments = data?.payments || [];
  const balance = data?.balance || {};

  const addMut = useMutation({
    mutationFn: (d: any) => api.post('/financial/upcoming-payments', d),
    onSuccess: () => { toast.success('Payment added'); qc.invalidateQueries({ queryKey: ['upcoming-payments'] }); setShowForm(false); setForm({ payment_type: '', description: '', amount: '', due_date: '', is_urgent: false, notes: '' }); },
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.patch(`/financial/upcoming-payments/${id}/mark-paid`, d),
    onSuccess: () => {
      toast.success('Marked as paid');
      qc.invalidateQueries({ queryKey: ['upcoming-payments'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-purchases'] });
    },
  });

  const editMut = useMutation({
    mutationFn: (data: any) => api.patch(`/financial/expenses/${data.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); setEditingExpense(null); toast.success('Expense updated'); },
    onError: () => toast.error('Failed to update expense'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/financial/upcoming-payments/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['upcoming-payments'] }); },
  });

  const updateBalMut = useMutation({
    mutationFn: (d: any) => api.post('/financial/cash-bank-balance', d),
    onSuccess: () => { toast.success('Balance updated'); qc.invalidateQueries({ queryKey: ['upcoming-payments'] }); setShowBalanceForm(false); },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Payments</h3>
          <p className="text-xs text-gray-500 mt-0.5">Track vendor payments, rent, and other dues</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} className="rounded" />
            Show paid
          </label>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688]">
            <Plus size={14} /> Add Payment
          </button>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Cash Balance</p>
          <p className="text-lg font-bold text-gray-900 mt-1">₹{Number(balance.cash_balance || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Bank Balance</p>
          <p className="text-lg font-bold text-gray-900 mt-1">₹{Number(balance.bank_balance || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Available</p>
          <p className="text-lg font-bold text-[#00475a] mt-1">₹{Number(balance.total_available || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white border-2 border-[#00b8a0] rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Due</p>
          <p className="text-lg font-bold text-red-600 mt-1">₹{Number(balance.total_due || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className={`border rounded-xl p-4 ${Number(balance.fund_required || 0) > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
          <p className="text-xs text-gray-500">Fund Required</p>
          <p className={`text-lg font-bold mt-1 ${Number(balance.fund_required || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
            ₹{Number(balance.fund_required || 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Update Balance */}
      <div className="flex justify-end">
        <button onClick={() => {
          setBalForm({ cash_balance: String(balance.cash_balance || ''), bank_balance: String(balance.bank_balance || ''), cheque_issued: String(balance.cheque_issued || '') });
          setShowBalanceForm(!showBalanceForm);
        }} className="text-xs text-[#00475a] hover:underline">
          Update cash/bank balance
        </button>
      </div>

      {showBalanceForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Update Balance</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cash Balance (₹)</label>
              <input type="number" value={balForm.cash_balance} onChange={e => setBalForm(p => ({ ...p, cash_balance: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Bank Balance (₹)</label>
              <input type="number" value={balForm.bank_balance} onChange={e => setBalForm(p => ({ ...p, bank_balance: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cheque Issued (₹)</label>
              <input type="number" value={balForm.cheque_issued} onChange={e => setBalForm(p => ({ ...p, cheque_issued: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => updateBalMut.mutate({
              cash_balance: parseFloat(balForm.cash_balance) || 0,
              bank_balance: parseFloat(balForm.bank_balance) || 0,
              cheque_issued: parseFloat(balForm.cheque_issued) || 0,
            })} className="px-4 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688]">
              Save Balance
            </button>
            <button onClick={() => setShowBalanceForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Add Payment Form */}
      {showForm && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">New Upcoming Payment</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Payment Type *</label>
              <input value={form.payment_type} onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="e.g. DRUG LINK, RENT, INTERLINK" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-2.5 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_urgent} onChange={e => setForm(p => ({ ...p, is_urgent: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-red-500" />
                <span className="text-red-600 font-medium">ASAP / Urgent</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => {
              if (!form.payment_type || !form.amount) return toast.error('Type and amount required');
              addMut.mutate({ ...form, amount: parseFloat(form.amount), due_date: form.due_date || null });
            }} disabled={addMut.isPending}
              className="px-4 py-2 bg-[#00b8a0] text-white text-sm rounded-lg hover:bg-[#009688] disabled:opacity-50">
              {addMut.isPending ? 'Saving...' : 'Add Payment'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-800">
            Upcoming Opex & Vendor Payments
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f9fafb] text-left border-b border-[#e5e7eb]">
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Payment</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Amount</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Due Date</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No upcoming payments</td></tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className={`border-t hover:bg-gray-50 ${p.is_urgent && !p.is_paid ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-gray-900">{p.payment_type}</span>
                    {p.description && <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>}
                    {p.source_type === 'pharmacy_purchase' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 ml-1">Auto from purchase</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5">
                    {p.is_urgent && !p.is_paid ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-semibold">ASAP</span>
                    ) : p.due_date ? (
                      <span className={`text-sm ${new Date(p.due_date) < new Date() && !p.is_paid ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                        {new Date(p.due_date).toLocaleDateString('en-IN')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_paid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {p.is_paid ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {!p.is_paid && (
                        <button onClick={() => markPaidMut.mutate({ id: p.id })}
                          className="text-xs text-green-600 hover:text-green-800 font-medium">
                          Mark Paid
                        </button>
                      )}
                      <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(p.id); }}
                        className="text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {payments.filter((p: any) => !p.is_paid).length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-4 py-2.5">Total Due</td>
                  <td className="px-4 py-2.5 text-right text-red-600">
                    ₹{payments.filter((p: any) => !p.is_paid).reduce((s: number, p: any) => s + Number(p.amount), 0).toLocaleString('en-IN')}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════
export default function OwnerFinancialDashboard() {
  const [showTerms, setShowTerms] = useState(false);
  const [activeSection, setActiveSection] = useState<'dashboard'|'expenses'|'purchases'|'upcoming'>('dashboard');
  const [dashPeriod, setDashPeriod] = useState<'daily'|'weekly'|'monthly'|'yearly'|'custom'>('daily');
  const [customRange, setCustomRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['owner-dashboard'],
    queryFn: () => api.get('/owner-dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: dashSummary } = useQuery({
    queryKey: ['dashboard-summary', dashPeriod, customRange],
    queryFn: () => {
      if (dashPeriod === 'custom') {
        return api.get(`/financial/dashboard-summary?period=daily&from=${customRange.from}&to=${customRange.to}`).then(r => r.data);
      }
      return api.get(`/financial/dashboard-summary?period=${dashPeriod}`).then(r => r.data);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00475a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const d = data || { today: {}, mtd: {}, payment_modes: [], vendor_payables: { overdue: [], upcoming_7d: [] }, top_vendors_mtd: [], top_margin_medicines: [], recent_sales: [], recent_expenses: [] };

  const TABS = [
    { key: 'dashboard' as const, label: '📊 Dashboard' },
    { key: 'expenses' as const, label: '💸 Expenses' },
    { key: 'purchases' as const, label: '🏪 Purchases' },
    { key: 'upcoming' as const, label: '📅 Upcoming' },
  ];

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
          <button onClick={() => setShowTerms(true)}
            className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 font-medium">
            <Users className="w-3.5 h-3.5" /> Vendor terms
          </button>
        </div>
      </div>

      {/* ── Section Navigation ─────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              activeSection === s.key
                ? 'bg-white text-[#00475a] shadow-sm font-semibold'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'expenses' ? (
        <ExpensesTab />
      ) : activeSection === 'purchases' ? (
        <PharmacyPurchasesTab />
      ) : activeSection === 'upcoming' ? (
        <UpcomingPaymentsTab />
      ) : (<>

      {/* ── PERIOD FILTER ──────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map(p => (
          <button key={p} onClick={() => setDashPeriod(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              dashPeriod === p
                ? 'bg-[#00b8a0] text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}>
            {p === 'daily' ? 'Today' : p === 'weekly' ? 'This Week' : p === 'monthly' ? 'This Month' : p === 'yearly' ? 'This Year' : 'Custom'}
          </button>
        ))}
        {dashPeriod === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customRange.from} onChange={e => setCustomRange(p => ({ ...p, from: e.target.value }))}
              className="px-2 py-1 border rounded-lg text-xs" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={customRange.to} onChange={e => setCustomRange(p => ({ ...p, to: e.target.value }))}
              className="px-2 py-1 border rounded-lg text-xs" />
          </div>
        )}
      </div>

      {/* ── PERIOD SUMMARY (from dashboard-summary API) ───── */}
      {dashSummary && (
        <div className="bg-gradient-to-r from-[#00475a]/5 to-[#00475a]/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#00475a]">
              {dashPeriod === 'daily' ? "Today's" : dashPeriod === 'weekly' ? 'This Week' : dashPeriod === 'monthly' ? 'This Month' : dashPeriod === 'yearly' ? 'This Year' : 'Custom Range'} Summary
            </h3>
            {dashSummary.start_date && (
              <span className="text-xs text-gray-500">
                {new Date(dashSummary.start_date).toLocaleDateString('en-IN')}
                {dashSummary.start_date !== dashSummary.end_date && ` — ${new Date(dashSummary.end_date).toLocaleDateString('en-IN')}`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase">Revenue</p>
              <p className="text-lg font-bold text-emerald-700">{fmtCompact(dashSummary.revenue?.total || 0)}</p>
              <p className="text-[10px] text-gray-400">{dashSummary.revenue?.total_bills || 0} bills</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase">COGS</p>
              <p className="text-lg font-bold text-blue-700">{fmtCompact(dashSummary.cogs || 0)}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase">Gross Profit</p>
              <p className={`text-lg font-bold ${dashSummary.gross_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCompact(dashSummary.gross_profit || 0)}</p>
              <p className="text-[10px] text-gray-400">{dashSummary.gross_margin || 0}% margin</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase">Expenses</p>
              <p className="text-lg font-bold text-red-600">{fmtCompact(dashSummary.expenses || 0)}</p>
            </div>
            <div className="bg-white rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase">Net Profit</p>
              <p className={`text-lg font-bold ${dashSummary.net_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCompact(dashSummary.net_profit || 0)}</p>
              <p className="text-[10px] text-gray-400">{dashSummary.net_margin || 0}% margin</p>
            </div>
          </div>
        </div>
      )}

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
      </>)}
    </div>
  );
}
