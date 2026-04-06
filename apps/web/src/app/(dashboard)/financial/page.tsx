'use client';
// Place at: apps/web/src/app/(dashboard)/financial/page.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Users, Wallet, AlertTriangle, CheckCircle, Plus,
  Loader2, X, ChevronDown, RefreshCw, ArrowUpRight,
  ArrowDownRight, Building2, CreditCard, Smartphone,
  Banknote, ReceiptText,
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Internet', 'Phone',
  'Salary', 'Contract Staff', 'Cleaning', 'Maintenance',
  'Packaging', 'Stationery', 'Printing', 'Bank Charges',
  'Insurance', 'Licence Fee', 'Marketing', 'Miscellaneous',
];

const TABS = [
  { key: 'dashboard', label: 'Daily P&L' },
  { key: 'pnl',       label: 'Monthly P&L' },
  { key: 'expenses',  label: 'Expenses' },
  { key: 'payables',  label: 'Supplier Payables' },
  { key: 'salaries',  label: 'Salaries' },
  { key: 'upi',       label: 'UPI Reconciliation' },
];

function fmt(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({ label, value, sub, color = 'gray', trend }: any) {
  const colors: Record<string, string> = {
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    blue:   'bg-blue-50 text-blue-700',
    amber:  'bg-amber-50 text-amber-700',
    teal:   'bg-teal-50 text-teal-700',
    gray:   'bg-gray-50 text-gray-700',
  };
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Daily P&L Tab ──────────────────────────────────────────────────────────
function DailyPnL() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['financial-dashboard', date],
    queryFn: () => api.get(`/financial/dashboard?date=${date}`).then(r => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#00475a]" /></div>;

  const d = data || {};
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={() => refetch()} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Revenue breakdown */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Revenue</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Revenue" value={fmt(d.revenue?.total)} sub={`${d.revenue?.bills || 0} bills`} color="teal" />
          <StatCard label="Cash" value={fmt(d.revenue?.cash)} color="green" />
          <StatCard label="UPI" value={fmt(d.revenue?.upi)} color="blue" />
          <StatCard label="Card" value={fmt(d.revenue?.card)} color="blue" />
        </div>
      </div>

      {/* P&L */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Profit & Loss</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Cost of Goods" value={fmt(d.cogs)} sub="Purchase price × qty sold" color="amber" />
          <StatCard label="Gross Profit" value={fmt(d.gross_profit)} sub={`${d.gross_margin || 0}% margin`} color={d.gross_profit >= 0 ? 'green' : 'red'} />
          <StatCard label="Expenses" value={fmt(d.expenses)} color="amber" />
          <StatCard label="Net Profit" value={fmt(d.net_profit)} color={d.net_profit >= 0 ? 'green' : 'red'} />
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {d.revenue?.discounts > 0 && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <TrendingDown className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Discounts Given</p>
              <p className="text-xs text-amber-600">{fmt(d.revenue?.discounts)} revenue lost to discounts today</p>
            </div>
          </div>
        )}
        {d.supplier_payable > 0 && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">Supplier Payable</p>
              <p className="text-xs text-red-600">{fmt(d.supplier_payable)} outstanding to suppliers</p>
            </div>
          </div>
        )}
        {d.upi_pending > 0 && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">UPI Settlement Pending</p>
              <p className="text-xs text-blue-600">{fmt(d.upi_pending)} UPI collections not yet reconciled</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Monthly P&L Tab ────────────────────────────────────────────────────────
function MonthlyPnL() {
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo]     = useState(now.toISOString().split('T')[0]);

  const { data, isLoading } = useQuery({
    queryKey: ['financial-pnl', from, to],
    queryFn: () => api.get(`/financial/pnl?from=${from}&to=${to}`).then(r => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#00475a]" /></div>;

  const s = data?.summary || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      {/* P&L Summary */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">P&L Summary</h3>
        <div className="space-y-3">
          {[
            { label: 'Total Revenue', value: s.total_revenue, color: 'text-teal-700', bold: false },
            { label: 'Cost of Goods Sold', value: -s.total_cogs, color: 'text-red-600', bold: false },
            { label: 'Gross Profit', value: s.gross_profit, color: s.gross_profit >= 0 ? 'text-green-700' : 'text-red-700', bold: true, sub: `${s.gross_margin}% margin` },
            { label: 'Operating Expenses', value: -s.total_expenses, color: 'text-red-600', bold: false },
            { label: 'Net Profit', value: s.net_profit, color: s.net_profit >= 0 ? 'text-green-700' : 'text-red-700', bold: true, sub: `${s.net_margin}% margin` },
          ].map((row, i) => (
            <div key={i} className={`flex items-center justify-between py-2 ${row.bold ? 'border-t border-gray-200 pt-3' : ''}`}>
              <span className={`text-sm ${row.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                {row.label}
                {row.sub && <span className="ml-2 text-xs text-gray-400">{row.sub}</span>}
              </span>
              <span className={`text-sm font-semibold ${row.color}`}>
                {row.value >= 0 ? '+' : ''}{fmt(Math.abs(row.value))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses by category */}
      {data?.expenses_by_category?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Expenses by Category</h3>
          <div className="space-y-2">
            {data.expenses_by_category.map((e: any) => (
              <div key={e.category} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700">{e.category}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{e.count} entries</span>
                  <span className="text-sm font-semibold text-red-600">{fmt(e.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top medicines by margin */}
      {data?.top_medicines?.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Top Medicines by Profit</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Medicine</th>
                  <th className="text-right py-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right py-2 font-medium text-gray-500">Revenue</th>
                  <th className="text-right py-2 font-medium text-gray-500">Cost</th>
                  <th className="text-right py-2 font-medium text-gray-500">Profit</th>
                  <th className="text-right py-2 font-medium text-gray-500">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.top_medicines.slice(0, 15).map((m: any) => (
                  <tr key={m.brand_name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2">
                      <p className="font-medium text-gray-900 text-xs">{m.brand_name}</p>
                      {m.category && <p className="text-xs text-gray-400">{m.category}</p>}
                    </td>
                    <td className="py-2 text-right text-gray-600">{m.qty_sold}</td>
                    <td className="py-2 text-right text-gray-700">{fmt(m.revenue)}</td>
                    <td className="py-2 text-right text-gray-500">{fmt(m.cost)}</td>
                    <td className="py-2 text-right text-green-700 font-medium">{fmt(m.gross_profit)}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(m.margin_pct) >= 30 ? 'bg-green-100 text-green-700' : Number(m.margin_pct) >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {m.margin_pct}%
                      </span>
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

// ── Expenses Tab ───────────────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo]     = useState(now.toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ expense_date: now.toISOString().split('T')[0], category: 'Rent', description: '', amount: '', payment_mode: 'cash', vendor_name: '', reference_no: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: () => api.get(`/financial/expenses?from=${from}&to=${to}`).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/expenses', data),
    onSuccess: () => { toast.success('Expense added'); setShowForm(false); qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['financial-dashboard'] }); },
    onError: () => toast.error('Failed to add expense'),
  });

  const total = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
          {expenses?.length > 0 && <span className="text-sm font-semibold text-red-600">{fmt(total)} total</span>}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      : !expenses?.length ? (
        <div className="text-center py-16 text-gray-400">
          <ReceiptText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No expenses recorded for this period</p>
          <p className="text-xs mt-1">Click "Add Expense" to record rent, electricity, etc.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mode</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(e.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{e.category}</span></td>
                  <td className="px-4 py-3 text-gray-700">{e.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.vendor_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{e.payment_mode}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                <td className="px-4 py-3 text-right font-bold text-red-700">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Expense</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description *</label>
                <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. March rent payment" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount (₹) *</label>
                  <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" min={0} />
                </div>
                <div>
                  <label className="label">Payment Mode</label>
                  <select className="input" value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}>
                    {['cash','upi','bank_transfer','cheque'].map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Vendor Name</label>
                  <input className="input" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} placeholder="e.g. KSEB" />
                </div>
                <div>
                  <label className="label">Reference No.</label>
                  <input className="input" value={form.reference_no} onChange={e => set('reference_no', e.target.value)} placeholder="Cheque/UPI ref" />
                </div>
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => addMutation.mutate(form)}
                disabled={addMutation.isPending || !form.description || !form.amount}
                className="btn-primary flex-1 disabled:opacity-50">
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Add Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payables Tab ───────────────────────────────────────────────────────────
function PayablesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplier_name: '', entry_type: 'invoice', amount: '', entry_date: new Date().toISOString().split('T')[0], due_date: '', reference_no: '', notes: '', payment_mode: 'bank_transfer' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const { data: payables, isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: () => api.get('/financial/payables').then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/supplier-ledger', data),
    onSuccess: () => { toast.success('Entry added'); setShowForm(false); qc.invalidateQueries({ queryKey: ['payables'] }); },
  });

  const total = (payables || []).reduce((s: number, p: any) => s + Number(p.balance), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {payables?.length > 0 && (
            <p className="text-sm text-gray-500">Total outstanding: <span className="font-bold text-red-600">{fmt(total)}</span></p>
          )}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      : !payables?.length ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No supplier payables recorded</p>
          <p className="text-xs mt-1">Add invoice entries when you receive stock on credit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payables.map((p: any) => (
            <div key={p.supplier_name} className={`card flex items-center gap-4 ${p.overdue_count > 0 ? 'border-red-200' : ''}`}>
              <div className="w-10 h-10 bg-[#00475a]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#00475a]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{p.supplier_name}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  <span>Invoiced: {fmt(p.total_invoiced)}</span>
                  <span>Paid: {fmt(p.total_paid)}</span>
                  {p.overdue_count > 0 && (
                    <span className="text-red-600 font-medium">⚠️ {p.overdue_count} overdue</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-bold ${Number(p.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(p.balance)}
                </p>
                <p className="text-xs text-gray-400">outstanding</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold">Add Supplier Entry</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Supplier Name *</label>
                <input className="input" value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)} placeholder="e.g. RR Pharma" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Entry Type</label>
                  <select className="input" value={form.entry_type} onChange={e => set('entry_type', e.target.value)}>
                    <option value="invoice">Invoice (I owe)</option>
                    <option value="payment">Payment (I paid)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Amount (₹) *</label>
                  <input type="number" className="input" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.entry_date} onChange={e => set('entry_date', e.target.value)} />
                </div>
                {form.entry_type === 'invoice' && (
                  <div>
                    <label className="label">Due Date</label>
                    <input type="date" className="input" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
                  </div>
                )}
              </div>
              <div>
                <label className="label">Reference / Invoice No.</label>
                <input className="input" value={form.reference_no} onChange={e => set('reference_no', e.target.value)} placeholder="Invoice or payment ref" />
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending || !form.supplier_name || !form.amount} className="btn-primary flex-1 disabled:opacity-50">
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null} Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Salaries Tab ───────────────────────────────────────────────────────────
function SalariesTab() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<any>({});

  const { data: staff, isLoading } = useQuery({
    queryKey: ['salaries', month],
    queryFn: () => api.get(`/financial/salaries?month=${month}`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/financial/salaries', data),
    onSuccess: () => { toast.success('Salary saved'); setEditId(null); qc.invalidateQueries({ queryKey: ['salaries'] }); },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.patch(`/financial/salaries/${id}/mark-paid`, data),
    onSuccess: () => { toast.success('Marked as paid'); qc.invalidateQueries({ queryKey: ['salaries'] }); },
  });

  const totalPayable = (staff || []).filter((s: any) => s.status !== 'paid').reduce((sum: number, s: any) => sum + Number(s.net_salary || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} />
          {totalPayable > 0 && <span className="text-sm text-red-600 font-medium">Pending: {fmt(totalPayable)}</span>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Basic</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Allowances</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Deductions</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(staff || []).map((s: any) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize text-xs">{s.role}</td>
                  {editId === s.id ? (
                    <>
                      <td className="px-4 py-2"><input type="number" className="input w-24 text-right" value={form.basic_salary||0} onChange={e => setForm((f: any) => ({...f, basic_salary: e.target.value}))} /></td>
                      <td className="px-4 py-2"><input type="number" className="input w-24 text-right" value={form.allowances||0} onChange={e => setForm((f: any) => ({...f, allowances: e.target.value}))} /></td>
                      <td className="px-4 py-2"><input type="number" className="input w-24 text-right" value={form.deductions||0} onChange={e => setForm((f: any) => ({...f, deductions: e.target.value}))} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-[#00475a]">
                        {fmt(Number(form.basic_salary||0) + Number(form.allowances||0) - Number(form.deductions||0))}
                      </td>
                      <td colSpan={2} className="px-4 py-2">
                        <div className="flex gap-2">
                          <button onClick={() => saveMutation.mutate({ ...form, user_id: s.id, employee_name: s.full_name, payment_month: month })} className="btn-primary text-xs px-3 py-1.5">Save</button>
                          <button onClick={() => setEditId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-right text-gray-700">{s.basic_salary ? fmt(s.basic_salary) : '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{s.allowances ? fmt(s.allowances) : '—'}</td>
                      <td className="px-4 py-3 text-right text-red-500">{s.deductions ? fmt(s.deductions) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{s.net_salary ? fmt(s.net_salary) : '—'}</td>
                      <td className="px-4 py-3">
                        {s.status === 'paid'
                          ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Paid</span>
                          : s.net_salary
                          ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pending</span>
                          : <span className="text-xs text-gray-300">Not set</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setEditId(s.id); setForm({ basic_salary: s.basic_salary||0, allowances: s.allowances||0, deductions: s.deductions||0 }); }} className="text-xs text-[#00475a] hover:underline">Edit</button>
                          {s.payment_id && s.status !== 'paid' && (
                            <button onClick={() => markPaidMutation.mutate({ id: s.payment_id, data: { payment_date: new Date().toISOString().split('T')[0] } })} className="text-xs text-green-600 hover:underline">Mark Paid</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── UPI Reconciliation Tab ─────────────────────────────────────────────────
function UpiTab() {
  const qc = useQueryClient();
  const now = new Date();
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [to, setTo]     = useState(now.toISOString().split('T')[0]);

  const { data: settlements, isLoading } = useQuery({
    queryKey: ['upi-settlements', from, to],
    queryFn: () => api.get(`/financial/upi-settlements?from=${from}&to=${to}`).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => id
      ? api.patch(`/financial/upi-settlements/${id}`, data)
      : api.post('/financial/upi-settlements', data),
    onSuccess: () => { toast.success('Settlement updated'); qc.invalidateQueries({ queryKey: ['upi-settlements'] }); },
  });

  const totalExpected  = (settlements || []).reduce((s: number, r: any) => s + r.expected_amount, 0);
  const totalSettled   = (settlements || []).filter((r: any) => r.settled_amount).reduce((s: number, r: any) => s + Number(r.settled_amount), 0);
  const totalPending   = (settlements || []).filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + r.expected_amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      {settlements?.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Expected from UPI" value={fmt(totalExpected)} color="blue" />
          <StatCard label="Bank Credited" value={fmt(totalSettled)} color="green" />
          <StatCard label="Pending Reconciliation" value={fmt(totalPending)} color={totalPending > 0 ? 'amber' : 'green'} />
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>
      : !settlements?.length ? (
        <div className="text-center py-16 text-gray-400">
          <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No UPI sales in this period</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Bills</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Expected</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Bank Credit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Difference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">App</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {settlements.map((row: any) => (
                <tr key={row.date} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{new Date(row.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.bill_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{fmt(row.expected_amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.settled_amount ? fmt(row.settled_amount) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {row.difference != null
                      ? <span className={`text-xs font-semibold ${Number(row.difference) < 0 ? 'text-red-600' : Number(row.difference) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {Number(row.difference) > 0 ? '+' : ''}{fmt(row.difference)}
                        </span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{row.upi_app || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      row.status === 'reconciled' ? 'bg-green-100 text-green-700'
                      : row.status === 'disputed' ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.status === 'pending' && (
                      <button
                        onClick={() => {
                          const amount = prompt(`Enter bank credit amount for ${row.date}:`, String(row.expected_amount));
                          const app = prompt('UPI app (PhonePe/GPay/Paytm):', 'PhonePe');
                          const ref = prompt('Bank reference number:', '');
                          if (amount) updateMutation.mutate({
                            id: row.settlement_id,
                            data: { settlement_date: row.date, settled_amount: Number(amount), upi_app: app, bank_reference: ref, expected_amount: row.expected_amount }
                          });
                        }}
                        className="text-xs text-[#00475a] hover:underline font-medium">
                        Reconcile
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FinancialPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial</h1>
          <p className="text-sm text-slate-400 mt-0.5">P&L · Expenses · Payables · Salaries · UPI reconciliation</p>
        </div>
      </div>

      <div className="flex border-b border-slate-100 bg-white flex-shrink-0 px-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
              tab === t.key ? 'border-[#00475a] text-[#00475a]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'dashboard' && <DailyPnL />}
        {tab === 'pnl'       && <MonthlyPnL />}
        {tab === 'expenses'  && <ExpensesTab />}
        {tab === 'payables'  && <PayablesTab />}
        {tab === 'salaries'  && <SalariesTab />}
        {tab === 'upi'       && <UpiTab />}
      </div>
    </div>
  );
}
