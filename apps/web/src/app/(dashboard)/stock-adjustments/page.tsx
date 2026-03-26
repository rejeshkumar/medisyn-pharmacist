'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowDownCircle, ArrowUpCircle, Search, Loader2,
  AlertTriangle, Package, RotateCcw, Trash2,
  ClipboardCheck, ChevronDown, X, FileText,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
const ADJ_TYPES = [
  {
    key: 'return_to_distributor',
    label: 'Return to Distributor',
    desc: 'Expired or near-expiry stock returned',
    icon: RotateCcw,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    direction: 'decrease',
  },
  {
    key: 'damaged',
    label: 'Damaged / Write-off',
    desc: 'Broken, spilled or temperature-compromised',
    icon: Trash2,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    direction: 'decrease',
  },
  {
    key: 'patient_return',
    label: 'Patient Return',
    desc: 'Customer returned unused medicines',
    icon: ArrowUpCircle,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    direction: 'increase',
  },
  {
    key: 'count_correction',
    label: 'Count Correction',
    desc: 'Physical count differs from system',
    icon: ClipboardCheck,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    direction: 'both',
  },
];

const DAMAGE_CAUSES = [
  'Dropped / broken', 'Temperature breach', 'Water damage',
  'Packaging defect', 'Contamination', 'Other',
];

const RETURN_REASONS = [
  'Expired', 'Near-expiry (< 3 months)', 'Quality issue',
  'Wrong product received', 'Overstocked', 'Other',
];

function daysToExpiry(dateStr: string) {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ── Adjustment form modal ──────────────────────────────────────────────────
function AdjustmentModal({
  batch, medicine, onClose, onSuccess,
}: {
  batch: any; medicine: any; onClose: () => void; onSuccess: () => void;
}) {
  const [adjType, setAdjType]       = useState('return_to_distributor');
  const [qty, setQty]               = useState(1);
  const [direction, setDirection]   = useState<'decrease' | 'increase'>('decrease');
  const [reason, setReason]         = useState('');
  const [customReason, setCustomReason] = useState('');
  const [distName, setDistName]     = useState('');
  const [distRef, setDistRef]       = useState('');
  const [damageCause, setDamageCause] = useState('');
  const [patientName, setPatientName] = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  const currentType = ADJ_TYPES.find(t => t.key === adjType)!;
  const isScheduled = ['H','H1','X'].includes(medicine?.schedule_class);
  const maxQty      = Number(batch?.quantity ?? 0);
  const finalReason = reason === 'Other' ? customReason : reason;

  const qtyAfter = direction === 'decrease'
    ? Math.max(0, maxQty - qty)
    : maxQty + qty;

  const submit = async () => {
    if (!finalReason.trim()) { toast.error('Reason is mandatory'); return; }
    if (adjType === 'return_to_distributor' && !distName.trim()) {
      toast.error('Distributor name is required for returns'); return;
    }
    if (adjType === 'damaged' && !damageCause) {
      toast.error('Please select the cause of damage'); return;
    }
    if (adjType === 'patient_return' && !patientName.trim()) {
      toast.error('Patient name is required for returns'); return;
    }
    if (qty <= 0) { toast.error('Quantity must be at least 1'); return; }
    if (direction === 'decrease' && qty > maxQty) {
      toast.error(`Cannot remove more than current stock (${maxQty})`); return;
    }

    setSaving(true);
    try {
      const r = await api.post('/stock-adjustments', {
        batch_id:         batch.id,
        adjustment_type:  adjType,
        direction,
        qty_adjusted:     qty,
        reason:           finalReason,
        distributor_name: distName || null,
        distributor_ref:  distRef  || null,
        damage_cause:     damageCause || null,
        patient_name:     patientName || null,
        notes:            notes || null,
      });
      toast.success(r.data.message);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  // Sync direction when type changes
  useEffect(() => {
    if (adjType === 'patient_return') setDirection('increase');
    else if (adjType !== 'count_correction') setDirection('decrease');
  }, [adjType]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Stock Adjustment</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {medicine?.brand_name} · Batch {batch?.batch_number}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Current stock info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Current stock</p>
              <p className="text-2xl font-black text-slate-900">{maxQty}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${
              daysToExpiry(batch?.expiry_date) < 30
                ? 'bg-red-50' : daysToExpiry(batch?.expiry_date) < 90
                ? 'bg-amber-50' : 'bg-green-50'
            }`}>
              <p className="text-xs text-slate-400 mb-1">Expiry</p>
              <p className="text-sm font-bold text-slate-700">
                {new Date(batch?.expiry_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
              </p>
              <p className={`text-[10px] font-semibold ${
                daysToExpiry(batch?.expiry_date) < 30 ? 'text-red-600'
                : daysToExpiry(batch?.expiry_date) < 90 ? 'text-amber-600'
                : 'text-green-600'
              }`}>
                {daysToExpiry(batch?.expiry_date)} days left
              </p>
            </div>
            <div className={`rounded-xl p-3 text-center ${
              isScheduled ? 'bg-amber-50' : 'bg-slate-50'
            }`}>
              <p className="text-xs text-slate-400 mb-1">Schedule</p>
              <p className={`text-xl font-black ${isScheduled ? 'text-amber-600' : 'text-slate-500'}`}>
                {medicine?.schedule_class}
              </p>
            </div>
          </div>

          {/* Schedule compliance warning */}
          {isScheduled && adjType === 'return_to_distributor' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <strong>Schedule {medicine?.schedule_class} — Compliance required.</strong>{' '}
                Ensure the distributor provides a written acknowledgement / credit note.
                Record the reference number below.
              </p>
            </div>
          )}

          {/* Adjustment type selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
              Adjustment type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ADJ_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setAdjType(t.key)}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      adjType === t.key
                        ? `${t.border} ${t.bg}`
                        : 'border-slate-100 hover:border-slate-200'
                    }`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${adjType === t.key ? t.color : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-xs font-bold ${adjType === t.key ? t.color : 'text-slate-700'}`}>
                        {t.label}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Count correction direction */}
          {adjType === 'count_correction' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
                Correction direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDirection('decrease')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 ${
                    direction === 'decrease' ? 'border-red-300 bg-red-50' : 'border-slate-100'
                  }`}>
                  <ArrowDownCircle className={`w-4 h-4 ${direction === 'decrease' ? 'text-red-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-semibold ${direction === 'decrease' ? 'text-red-700' : 'text-slate-500'}`}>
                    Decrease
                  </span>
                </button>
                <button onClick={() => setDirection('increase')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 ${
                    direction === 'increase' ? 'border-green-300 bg-green-50' : 'border-slate-100'
                  }`}>
                  <ArrowUpCircle className={`w-4 h-4 ${direction === 'increase' ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-semibold ${direction === 'increase' ? 'text-green-700' : 'text-slate-500'}`}>
                    Increase
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
              Quantity to {direction === 'increase' ? 'add' : 'remove'}
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-2">
                <button onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-lg font-bold">
                  −
                </button>
                <input type="number" value={qty} min={1} max={direction === 'decrease' ? maxQty : 9999}
                  onChange={e => setQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 text-center text-2xl font-black bg-transparent border-none outline-none" />
                <button onClick={() => setQty(qty + 1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-lg font-bold">
                  +
                </button>
              </div>
              <div className="text-sm text-slate-500">
                Stock: <span className="font-bold text-slate-900">{maxQty}</span>
                {' → '}
                <span className={`font-bold ${qtyAfter === 0 ? 'text-red-600' : qtyAfter <= 10 ? 'text-amber-600' : 'text-green-600'}`}>
                  {qtyAfter}
                </span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">
              Reason <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {(adjType === 'return_to_distributor' ? RETURN_REASONS
                : adjType === 'damaged' ? DAMAGE_CAUSES
                : adjType === 'patient_return' ? ['Unused medicines', 'Wrong medicine dispensed', 'Duplicate purchase', 'Other']
                : ['Excess found in count', 'Shortage found in count', 'System error correction', 'Other']
              ).map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`text-xs px-3 py-2 rounded-lg border text-left transition-all ${
                    reason === r
                      ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-semibold'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            {reason === 'Other' && (
              <input type="text" value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Describe the reason..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            )}
          </div>

          {/* Type-specific fields */}
          {adjType === 'return_to_distributor' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Distributor name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={distName} onChange={e => setDistName(e.target.value)}
                  placeholder="e.g. Apollo Pharmacy Distributors"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                  Credit note / reference number
                  {isScheduled && <span className="text-red-500 ml-1">* Required for scheduled drugs</span>}
                </label>
                <input type="text" value={distRef} onChange={e => setDistRef(e.target.value)}
                  placeholder="e.g. CN-2026-0042"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
              </div>
            </div>
          )}

          {adjType === 'damaged' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Cause of damage <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {DAMAGE_CAUSES.map(c => (
                  <button key={c} onClick={() => setDamageCause(c)}
                    className={`text-xs px-3 py-2 rounded-lg border text-left ${
                      damageCause === c
                        ? 'border-red-300 bg-red-50 text-red-700 font-semibold'
                        : 'border-slate-200 text-slate-600'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {adjType === 'patient_return' && (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Patient name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)}
                placeholder="Patient who returned the medicine"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
          )}

          {/* Additional notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
              Additional notes (optional)
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Any additional information..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#00475a]" />
          </div>

          {/* Submit */}
          <button onClick={submit} disabled={saving}
            className={`w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors ${
              currentType.key === 'patient_return' || direction === 'increase'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-[#00475a] hover:bg-[#003d4d]'
            } disabled:opacity-50`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              direction === 'increase'
                ? <ArrowUpCircle className="w-4 h-4" />
                : <ArrowDownCircle className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : `Confirm — ${direction === 'increase' ? 'Add' : 'Remove'} ${qty} unit${qty > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Adjustment history row ──────────────────────────────────────────────────
function AdjRow({ a }: { a: any }) {
  const isIncrease = a.direction === 'increase';
  const typeLabel = ADJ_TYPES.find(t => t.key === a.adjustment_type)?.label ?? a.adjustment_type;
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/50">
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">{a.brand_name}</p>
        <p className="text-xs text-slate-400">{a.batch_number} · Exp {new Date(a.expiry_date).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          a.adjustment_type === 'return_to_distributor' ? 'bg-amber-50 text-amber-700'
          : a.adjustment_type === 'damaged' ? 'bg-red-50 text-red-600'
          : a.adjustment_type === 'patient_return' ? 'bg-green-50 text-green-700'
          : 'bg-blue-50 text-blue-700'
        }`}>
          {typeLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-bold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
          {isIncrease ? '+' : '−'}{a.qty_adjusted}
        </span>
      </td>
      <td className="px-4 py-3 text-center text-xs text-slate-500">
        {a.qty_before} → <span className="font-semibold text-slate-700">{a.qty_after}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">{a.reason}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{a.adjusted_by_name}</td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {new Date(a.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
      </td>
      <td className="px-4 py-3">
        {a.requires_compliance && !a.compliance_noted && (
          <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-semibold">
            Compliance pending
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function StockAdjustmentPage() {
  const [batches, setBatches]         = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [selectedMed, setSelectedMed]     = useState<any>(null);
  const [typeFilter, setTypeFilter]   = useState('all');
  const [tab, setTab]                 = useState<'adjust' | 'history'>('adjust');

  const loadBatches = useCallback(async () => {
    try {
      const r = await api.get('/stock?include_zero=true&limit=200');
      setBatches(r.data?.data || r.data || []);
    } catch { toast.error('Failed to load stock'); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get(`/stock-adjustments${typeFilter !== 'all' ? `?type=${typeFilter}` : ''}`);
      setAdjustments(r.data || []);
    } catch { toast.error('Failed to load history'); }
  }, [typeFilter]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  const filtered = batches.filter(b =>
    !search || b.brand_name?.toLowerCase().includes(search.toLowerCase())
      || b.batch_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Return, write-off, patient returns and corrections</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['adjust','history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}>
              {t === 'adjust' ? 'Make adjustment' : 'History'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'adjust' ? (
        <div className="flex-1 overflow-auto p-6">
          {/* Search */}
          <div className="relative max-w-md mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search medicine or batch number..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Medicine','Batch','Expiry','Qty','MRP','Sale Rate','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b: any) => {
                    const days = daysToExpiry(b.expiry_date);
                    const isZero = Number(b.quantity) === 0;
                    return (
                      <tr key={b.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${isZero ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">{b.brand_name}</p>
                          <p className="text-xs text-slate-400">{b.molecule} · {b.schedule_class}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{b.batch_number}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${
                            days < 0 ? 'text-red-600' : days < 30 ? 'text-red-500'
                            : days < 90 ? 'text-amber-600' : 'text-green-600'
                          }`}>
                            {days < 0 ? 'EXPIRED' : `${days}d`}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {new Date(b.expiry_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${
                            isZero ? 'text-red-600' : Number(b.quantity) <= 10 ? 'text-amber-600' : 'text-slate-900'
                          }`}>
                            {b.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">₹{Number(b.mrp).toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-700">₹{Number(b.sale_rate).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setSelectedBatch(b); setSelectedMed(b); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-semibold rounded-lg hover:bg-[#003d4d] transition-colors">
                            <Package className="w-3 h-3" /> Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No batches found
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          {/* Type filter */}
          <div className="flex gap-2 mb-4">
            {['all', ...ADJ_TYPES.map(t => t.key)].map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === f
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                {f === 'all' ? 'All' : ADJ_TYPES.find(t => t.key === f)?.label ?? f}
              </button>
            ))}
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Medicine','Type','Qty change','Stock','Reason','By','Date','Compliance'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a: any) => <AdjRow key={a.id} a={a} />)}
                </tbody>
              </table>
              {adjustments.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No adjustments yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjustment modal */}
      {selectedBatch && (
        <AdjustmentModal
          batch={selectedBatch}
          medicine={selectedMed}
          onClose={() => { setSelectedBatch(null); setSelectedMed(null); }}
          onSuccess={() => { loadBatches(); if (tab === 'history') loadHistory(); }}
        />
      )}
    </div>
  );
}
