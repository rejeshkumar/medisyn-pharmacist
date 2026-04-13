'use client';
// Place at: apps/web/src/app/(dashboard)/day-close/page.tsx

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircle, AlertTriangle, Clock, Loader2,
  ChevronDown, RefreshCw, Banknote, Smartphone,
  TrendingUp, TrendingDown, X, Check, Info,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

function fmt(n: number | string) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function diffColor(diff: number) {
  if (Math.abs(diff) < 1) return 'text-green-600';
  if (diff > 0) return 'text-blue-600';
  return 'text-red-600';
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; icon: any }> = {
    open:                  { label: 'Open',               color: 'bg-gray-100 text-gray-600',   icon: Clock },
    pharmacist_submitted:  { label: 'Pharmacist Submitted', color: 'bg-blue-100 text-blue-700',   icon: Clock },
    owner_approved:        { label: 'Approved',            color: 'bg-green-100 text-green-700', icon: CheckCircle },
  };
  const s = map[status] || map.open;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>
      <Icon className="w-3.5 h-3.5" />{s.label}
    </span>
  );
}

// ── Cash Count Component ────────────────────────────────────────────────────
function CashCounter({ value, onChange }: { value: Record<number, number>; onChange: (v: Record<number, number>) => void }) {
  const total = DENOMINATIONS.reduce((s, d) => s + d * (value[d] || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {DENOMINATIONS.map(d => (
          <div key={d} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-gray-500 w-10">₹{d}</span>
            <span className="text-gray-300 text-xs">×</span>
            <input
              type="number" min="0"
              value={value[d] || ''}
              onChange={e => onChange({ ...value, [d]: Number(e.target.value) || 0 })}
              className="w-full text-sm font-medium text-center bg-transparent outline-none"
              placeholder="0"
            />
            {(value[d] || 0) > 0 && (
              <span className="text-xs text-[#00475a] font-medium shrink-0">
                ={fmt(d * value[d])}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center p-3 bg-[#00475a]/5 rounded-xl border border-[#00475a]/20">
        <span className="text-sm font-semibold text-gray-700">Total Cash Count</span>
        <span className="text-lg font-bold text-[#00475a]">{fmt(total)}</span>
      </div>
    </div>
  );
}

// ── Pharmacist View ─────────────────────────────────────────────────────────
function PharmacistView({ data, date, onSubmit, submitting }: any) {
  const [mode, setMode] = useState<'denomination'|'total'>('denomination');
  const [denoms, setDenoms] = useState<Record<number, number>>({});
  const [totalCash, setTotalCash] = useState('');
  const [upiCounted, setUpiCounted] = useState('');
  const [notes, setNotes] = useState('');

  const cashCounted = mode === 'denomination'
    ? DENOMINATIONS.reduce((s, d) => s + d * (denoms[d] || 0), 0)
    : Number(totalCash) || 0;

  const systemCash = (data?.system_cash || 0) + (data?.other_cash || 0);
  const systemUpi  = (data?.system_upi  || 0) + (data?.other_upi  || 0);
  const cashDiff   = cashCounted - systemCash;
  const upiDiff    = (Number(upiCounted) || 0) - systemUpi;

  const alreadySubmitted = !!data?.pharmacist_submitted_at;

  if (alreadySubmitted) return (
    <div className="space-y-4">
      <div className="p-5 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-4">
        <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
        <div>
          <p className="font-bold text-green-900">Shift Closed Successfully</p>
          <p className="text-sm text-green-700 mt-0.5">
            Submitted at {new Date(data.pharmacist_submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-green-600 mt-1">
            Cash: {fmt(data.pharmacist_cash_counted)} · UPI: {fmt(data.pharmacist_upi_counted)}
          </p>
        </div>
      </div>
      <div className="p-4 bg-white rounded-2xl border border-gray-100 text-sm text-gray-500 text-center">
        Waiting for owner to review and approve
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* System totals for reference */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-blue-50 rounded-2xl">
          <p className="text-xs text-blue-600 font-medium mb-1">System Cash Sales</p>
          <p className="text-2xl font-bold text-blue-900">{fmt(systemCash)}</p>
          <p className="text-xs text-blue-500 mt-1">{data?.bill_count || 0} bills today</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-2xl">
          <p className="text-xs text-purple-600 font-medium mb-1">System UPI Sales</p>
          <p className="text-2xl font-bold text-purple-900">{fmt(systemUpi)}</p>
          <p className="text-xs text-purple-500 mt-1">Expected in bank</p>
        </div>
      </div>

      {/* Cash Count */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-green-600" /> Cash Count
          </h3>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setMode('denomination')}
              className={`px-3 py-1.5 text-xs font-medium ${mode==='denomination' ? 'bg-[#00475a] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              By Denomination
            </button>
            <button onClick={() => setMode('total')}
              className={`px-3 py-1.5 text-xs font-medium ${mode==='total' ? 'bg-[#00475a] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              Total Only
            </button>
          </div>
        </div>

        {mode === 'denomination'
          ? <CashCounter value={denoms} onChange={setDenoms} />
          : (
            <div className="space-y-2">
              <label className="text-sm text-gray-600">Total cash in drawer</label>
              <input type="number" className="input w-full text-xl font-bold"
                placeholder="₹0" value={totalCash}
                onChange={e => setTotalCash(e.target.value)} />
            </div>
          )
        }

        {cashCounted > 0 && (
          <div className="mt-3 flex justify-between items-center p-3 rounded-xl bg-gray-50">
            <span className="text-sm text-gray-600">Difference vs system</span>
            <span className={`font-bold ${diffColor(cashDiff)}`}>
              {cashDiff > 0 ? '+' : ''}{fmt(cashDiff)}
              {Math.abs(cashDiff) < 1 ? ' ✅' : cashDiff > 0 ? ' (excess)' : ' (short)'}
            </span>
          </div>
        )}
      </div>

      {/* UPI Count */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-purple-600" /> UPI Received Today
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          Check your PhonePe / GPay app and enter total UPI received today
        </p>
        <input type="number" className="input w-full text-xl font-bold"
          placeholder="₹0" value={upiCounted}
          onChange={e => setUpiCounted(e.target.value)} />
        {upiCounted && (
          <div className="mt-3 flex justify-between items-center p-3 rounded-xl bg-gray-50">
            <span className="text-sm text-gray-600">Difference vs system</span>
            <span className={`font-bold ${diffColor(upiDiff)}`}>
              {upiDiff > 0 ? '+' : ''}{fmt(upiDiff)}
              {Math.abs(upiDiff) < 1 ? ' ✅' : upiDiff > 0 ? ' (excess)' : ' (short)'}
            </span>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Notes (optional)</label>
        <textarea className="input w-full h-20 resize-none" placeholder="Any discrepancies, missing cash, change given..."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <button
        onClick={() => onSubmit({
          cash_counted: cashCounted,
          upi_counted: Number(upiCounted) || 0,
          notes,
          denominations: mode === 'denomination'
            ? DENOMINATIONS.map(d => ({ denomination: d, count: denoms[d] || 0 })).filter(d => d.count > 0)
            : [],
        })}
        disabled={submitting || cashCounted === 0}
        className="w-full py-4 bg-[#00475a] text-white rounded-2xl font-bold text-base disabled:opacity-50">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '🔒 Close My Shift'}
      </button>
    </div>
  );
}

// ── Receptionist View ───────────────────────────────────────────────────────
function ReceptionistView({ data, date, onSubmit, submitting }: any) {
  const [mode, setMode] = useState<'denomination'|'total'>('total');
  const [denoms, setDenoms] = useState<Record<number, number>>({});
  const [totalCash, setTotalCash] = useState('');
  const [upiCounted, setUpiCounted] = useState('');
  const [notes, setNotes] = useState('');

  const cashCounted = mode === 'denomination'
    ? DENOMINATIONS.reduce((s, d) => s + d * (denoms[d] || 0), 0)
    : Number(totalCash) || 0;

  const alreadySubmitted = !!data?.receptionist_submitted_at;

  if (alreadySubmitted) return (
    <div className="p-5 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-4">
      <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
      <div>
        <p className="font-bold text-green-900">Submitted Successfully</p>
        <p className="text-sm text-green-700 mt-0.5">
          Cash: {fmt(data.receptionist_cash_counted)} · UPI: {fmt(data.receptionist_upi_counted)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <p className="text-sm font-semibold text-amber-800 mb-1">Other Income Today</p>
        <p className="text-xs text-amber-600">
          Cash: {fmt(data?.other_cash || 0)} · UPI: {fmt(data?.other_upi || 0)}
        </p>
        <p className="text-xs text-amber-500 mt-1">
          From consultation, lab, dressing entries in Financial → Daily Cash Summary
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Cash Count</h3>
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => setMode('denomination')}
              className={`px-3 py-1.5 text-xs font-medium ${mode==='denomination' ? 'bg-[#00475a] text-white' : 'text-gray-500'}`}>
              By Denomination
            </button>
            <button onClick={() => setMode('total')}
              className={`px-3 py-1.5 text-xs font-medium ${mode==='total' ? 'bg-[#00475a] text-white' : 'text-gray-500'}`}>
              Total Only
            </button>
          </div>
        </div>
        {mode === 'denomination'
          ? <CashCounter value={denoms} onChange={setDenoms} />
          : <input type="number" className="input w-full text-xl font-bold"
              placeholder="₹0" value={totalCash}
              onChange={e => setTotalCash(e.target.value)} />
        }
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3">UPI Received</h3>
        <input type="number" className="input w-full" placeholder="₹0"
          value={upiCounted} onChange={e => setUpiCounted(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Notes</label>
        <textarea className="input w-full h-20 resize-none" placeholder="Any notes..."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <button
        onClick={() => onSubmit({
          cash_counted: cashCounted,
          upi_counted: Number(upiCounted) || 0,
          notes,
          denominations: mode === 'denomination'
            ? DENOMINATIONS.map(d => ({ denomination: d, count: denoms[d] || 0 })).filter(d => d.count > 0)
            : [],
        })}
        disabled={submitting || cashCounted === 0}
        className="w-full py-4 bg-[#00475a] text-white rounded-2xl font-bold disabled:opacity-50">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '✅ Submit My Count'}
      </button>
    </div>
  );
}

// ── Owner Review View ───────────────────────────────────────────────────────
function OwnerView({ data, date, onApprove, submitting }: any) {
  const [bankUpi, setBankUpi] = useState('');
  const [cashDeposited, setCashDeposited] = useState('');
  const [depositRef, setDepositRef] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closingBank, setClosingBank] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');

  const systemUpi = (data?.system_upi || 0) + (data?.other_upi || 0);
  const bankUpiNum = Number(bankUpi) || 0;
  const upiDiff = bankUpiNum - systemUpi;
  const upiMatched = Math.abs(upiDiff) < 5;

  const pharmacistCash = Number(data?.pharmacist_cash_counted || 0);
  const receptionistCash = Number(data?.receptionist_cash_counted || 0);
  const totalSubmittedCash = pharmacistCash + receptionistCash;

  const alreadyApproved = data?.status === 'owner_approved';

  if (alreadyApproved) return (
    <div className="space-y-4">
      <div className="p-5 bg-green-50 border border-green-200 rounded-2xl">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <p className="font-bold text-green-900">Day Approved & Locked</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Closing Cash:</span> <span className="font-bold">{fmt(data.closing_cash)}</span></div>
          <div><span className="text-gray-500">Closing Bank:</span> <span className="font-bold">{fmt(data.closing_bank)}</span></div>
          <div><span className="text-gray-500">UPI Matched:</span> <span className={`font-bold ${data.bank_upi_matched ? 'text-green-600' : 'text-red-600'}`}>{data.bank_upi_matched ? '✅ Yes' : '❌ No'}</span></div>
          <div><span className="text-gray-500">Approved:</span> <span className="font-bold">{new Date(data.owner_approved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Submissions status */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-4 rounded-2xl border ${data?.pharmacist_submitted_at ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <p className="text-xs font-semibold mb-1 text-gray-600">Pharmacist</p>
          {data?.pharmacist_submitted_at
            ? <>
                <p className="font-bold text-green-800">{fmt(data.pharmacist_cash_counted)}</p>
                <p className="text-xs text-green-600">Cash submitted ✅</p>
                <p className="text-xs text-green-600">UPI: {fmt(data.pharmacist_upi_counted)}</p>
              </>
            : <p className="text-amber-700 text-sm font-medium">⏳ Not submitted yet</p>
          }
        </div>
        <div className={`p-4 rounded-2xl border ${data?.receptionist_submitted_at ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className="text-xs font-semibold mb-1 text-gray-600">Receptionist</p>
          {data?.receptionist_submitted_at
            ? <>
                <p className="font-bold text-green-800">{fmt(data.receptionist_cash_counted)}</p>
                <p className="text-xs text-green-600">Cash submitted ✅</p>
              </>
            : <p className="text-gray-500 text-sm">Not submitted</p>
          }
        </div>
      </div>

      {/* System totals */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3">System Totals</h3>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Pharmacy Cash Sales',    value: data?.system_cash || 0 },
            { label: 'Pharmacy UPI Sales',     value: data?.system_upi || 0 },
            { label: 'Other Income (Cash)',    value: data?.other_cash || 0 },
            { label: 'Other Income (UPI)',     value: data?.other_upi || 0 },
            { label: 'Total Expenses',         value: -(data?.total_expenses || 0) },
          ].map(row => (
            <div key={row.label} className="flex justify-between">
              <span className="text-gray-500">{row.label}</span>
              <span className={`font-medium ${row.value < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(Math.abs(row.value))}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <span className="font-bold">Staff Submitted Cash</span>
            <span className="font-bold text-[#00475a]">{fmt(totalSubmittedCash)}</span>
          </div>
        </div>
      </div>

      {/* UPI Bank Reconciliation */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-purple-600" /> UPI Bank Reconciliation
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Enter total UPI credited in Canara Bank today (from bank CSV or app)
        </p>
        <div className="flex items-center gap-3 mb-3">
          <input type="number" className="input flex-1" placeholder="Bank UPI credit ₹"
            value={bankUpi} onChange={e => setBankUpi(e.target.value)} />
          {bankUpi && (
            <span className={`text-sm font-bold px-3 py-2 rounded-lg ${upiMatched ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {upiMatched ? '✅ Match' : `⚠️ Diff: ${fmt(Math.abs(upiDiff))}`}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400">
          System expects: {fmt(systemUpi)} UPI today
        </div>
      </div>

      {/* Cash deposit to bank */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-blue-600" /> Cash Deposited to Bank
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" className="input" placeholder="Amount ₹"
            value={cashDeposited} onChange={e => setCashDeposited(e.target.value)} />
          <input className="input" placeholder="Deposit slip reference"
            value={depositRef} onChange={e => setDepositRef(e.target.value)} />
        </div>
      </div>

      {/* Closing balances */}
      <div className="bg-white rounded-2xl border border-[#00475a]/20 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Closing Balances</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Closing Cash in Hand</label>
            <input type="number" className="input w-full text-lg font-bold"
              placeholder="₹0" value={closingCash}
              onChange={e => setClosingCash(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Expected: {fmt((data?.system_cash || 0) + (data?.other_cash || 0) - (data?.total_expenses || 0) - Number(cashDeposited || 0))}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bank Balance</label>
            <input type="number" className="input w-full text-lg font-bold"
              placeholder="₹0" value={closingBank}
              onChange={e => setClosingBank(e.target.value)} />
            <p className="text-xs text-gray-400 mt-1">
              Opening: {fmt(data?.opening_bank || 0)} + UPI + Deposit
            </p>
          </div>
        </div>
      </div>

      {/* Owner notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="text-sm font-medium text-gray-700 block mb-2">Owner Notes</label>
        <textarea className="input w-full h-20 resize-none"
          placeholder="Any discrepancies, explanations..."
          value={ownerNotes} onChange={e => setOwnerNotes(e.target.value)} />
      </div>

      <button
        onClick={() => onApprove({
          bank_upi_credit: Number(bankUpi) || 0,
          cash_deposited_to_bank: Number(cashDeposited) || 0,
          deposit_reference: depositRef,
          closing_cash: Number(closingCash) || 0,
          closing_bank: Number(closingBank) || 0,
          owner_notes: ownerNotes,
        })}
        disabled={submitting || !closingCash}
        className="w-full py-4 bg-[#00475a] text-white rounded-2xl font-bold text-base disabled:opacity-50">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '✅ Approve & Lock Day'}
      </button>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function DayClosePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [role, setRole] = useState<'pharmacist'|'receptionist'|'owner'>('pharmacist');

  // Get user role from localStorage/token
  useEffect(() => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role;
        if (userRole === 'owner' || userRole === 'super_admin') setRole('owner');
        else if (userRole === 'receptionist') setRole('receptionist');
        else setRole('pharmacist');
      }
    } catch {}
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['day-close', date],
    queryFn: () => api.get(`/financial/day-close/${date}`).then(r => r.data),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const pharmacistMutation = useMutation({
    mutationFn: (body: any) => api.post(`/financial/day-close/${date}/pharmacist-submit`, body),
    onSuccess: () => { toast.success('Shift closed successfully!'); qc.invalidateQueries({ queryKey: ['day-close', date] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit'),
  });

  const receptionistMutation = useMutation({
    mutationFn: (body: any) => api.post(`/financial/day-close/${date}/receptionist-submit`, body),
    onSuccess: () => { toast.success('Submitted successfully!'); qc.invalidateQueries({ queryKey: ['day-close', date] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit'),
  });

  const ownerMutation = useMutation({
    mutationFn: (body: any) => api.post(`/financial/day-close/${date}/owner-approve`, body),
    onSuccess: () => { toast.success('Day approved and locked!'); qc.invalidateQueries({ queryKey: ['day-close', date] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to approve'),
  });

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">End of Day</h1>
          <p className="text-xs text-gray-500 mt-0.5">Close and reconcile daily accounts</p>
        </div>
        <div className="flex items-center gap-2">
          {data && <StatusBadge status={data.status} />}
          <button onClick={() => refetch()} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Date picker */}
      <input type="date" className="input w-full"
        value={date} onChange={e => setDate(e.target.value)} />

      {/* Opening balance */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">Opening Cash</p>
            <p className="text-lg font-bold text-gray-900">{fmt(data.opening_cash)}</p>
            <p className="text-xs text-gray-400">Carried from yesterday</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500">Opening Bank</p>
            <p className="text-lg font-bold text-gray-900">{fmt(data.opening_bank)}</p>
            <p className="text-xs text-gray-400">Yesterday closing</p>
          </div>
        </div>
      )}

      {/* Role switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
        {([
          { key: 'pharmacist',   label: '💊 Pharmacist' },
          { key: 'receptionist', label: '📋 Receptionist' },
          { key: 'owner',        label: '👤 Owner' },
        ] as const).map(r => (
          <button key={r.key} onClick={() => setRole(r.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-all ${
              role === r.key ? 'bg-[#00475a] text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading
        ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#00475a]" /></div>
        : role === 'pharmacist'
          ? <PharmacistView data={data} date={date}
              onSubmit={pharmacistMutation.mutate}
              submitting={pharmacistMutation.isPending} />
          : role === 'receptionist'
            ? <ReceptionistView data={data} date={date}
                onSubmit={receptionistMutation.mutate}
                submitting={receptionistMutation.isPending} />
            : <OwnerView data={data} date={date}
                onApprove={ownerMutation.mutate}
                submitting={ownerMutation.isPending} />
      }
    </div>
  );
}
