'use client';
import { useState, useRef, useEffect, useCallback, useId } from 'react';
import ReturnMedicinesDialog from '@/components/bills/ReturnMedicinesDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import dynamic from 'next/dynamic';
const BarcodeScanner = dynamic(() => import('@/components/dispensing/BarcodeScanner'), { ssr: false });
const PrescriptionBridge = dynamic(() => import('@/components/dispensing/PrescriptionBridge'), { ssr: false });
import { formatCurrency, getScheduleClassColor, getConfidenceColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Check,
  AlertTriangle, X, FileText, Loader2, Camera,
  ChevronUp, ClipboardList, MapPin, Tag, Info,
  RefreshCw, UserPlus, Stethoscope, Merge, Heart, Scan,
} from 'lucide-react';
import BillDocument, { type BillData } from '@/components/billing/BillDocument';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
interface CartItem {
  medicine_id: string;
  batch_id: string;
  medicine_name: string;
  molecule: string;
  batch_number: string;
  expiry_date: string;
  qty: number;
  rate: number;
  line_discount_pct: number;
  gst_percent: number;
  avl_qty: number;
  rack_location: string;
  is_substituted: boolean;
  original_medicine_id?: string;
  substitution_reason?: string;
  schedule_class: string;
  is_chronic: boolean;
  chronic_category?: string;
  create_care_plan: boolean;
  all_batches?: any[];
  discount_reason?: string;
  tabs_per_strip?: number;
  max_discount_pct?: number | null;
  manufacturer?: string;
  purchase_price?: number | null;
}

interface DraftBill {
  id: string; label: string;
  cart_data: CartItem[];
  compliance: ComplianceData;
  payment_mode: string; discount: number; updated_at: string;
}

interface ComplianceData {
  patient_name: string; patient_id?: string;
  patient_age?: string; patient_gender?: string;
  doctor_name: string; doctor_reg_no: string;
  referring_doctor: string;   // NEW
}

const SCHEDULE_CONFIG: Record<string, any> = {
  OTC: { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  H:   { color: '#92400e', bg: '#fffbeb', border: '#fde68a',
         banner: 'Schedule H — Prescription required', bannerColor: '#92400e' },
  H1:  { color: '#9a3412', bg: '#fff7ed', border: '#fed7aa',
         banner: 'Schedule H1 — Restricted prescription (Kerala D&C Act)', bannerColor: '#9a3412' },
  X:   { color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca',
         banner: 'Schedule X — Narcotic · Form 17 register mandatory', bannerColor: '#7f1d1d' },
};

// ── Medicine search dropdown ───────────────────────────────────────────────
function MedSearchDropdown({
  value, onChange, onSelect, autoFocus,
}: {
  value: string; onChange: (v: string) => void;
  onSelect: (med: any) => void; onDemand?: (query: string) => void; autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ['med-search', value],
    queryFn: () => value.length >= 2
      ? api.get(`/medicines/search-enriched?search=${value}&limit=12`)
          .then(r => r.data)
          .catch(() => api.get(`/medicines?search=${value}&limit=12`).then(r => r.data))
      : Promise.resolve([]),
    enabled: value.length >= 2,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (results?.length) setOpen(true); }, [results]);

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text" value={value}
        autoFocus={autoFocus}
        onChange={e => { onChange(e.target.value); }}
        onFocus={() => { if (results?.length) setOpen(true); }}
        placeholder="Type medicine name..."
        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#00475a] rounded"
      />
      {open && results?.length === 0 && (value?.length ?? 0) >= 3 && (
        <div className="absolute top-full left-0 z-50 w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">No medicines found for "{value}"</p>
          <p className="text-xs text-gray-400 mb-3">Not in your stock. You can log this as missed demand.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setOpen(false); onDemand?.(value); }}
              className="flex-1 text-xs px-3 py-2 rounded-lg bg-[#00475a] text-white font-medium hover:bg-[#003d4d] transition-colors"
            >
              Log demand
            </button>
          </div>
        </div>
      )}
      {open && results?.length > 0 && (
        <div className="absolute top-full left-0 z-50 w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
          {results.map((med: any) => {
            const stock  = Number(med.total_stock ?? med.available_stock ?? 0);
            const hasStockData = med.total_stock !== undefined && med.total_stock !== null;
            const isOOS  = hasStockData && stock <= 0;
            const isLow  = hasStockData && stock > 0 && stock <= 10;
            const isGood = hasStockData && stock > 10;
            const fefo   = med.fefo_batch;
            const cfg    = SCHEDULE_CONFIG[med.schedule_class] ?? SCHEDULE_CONFIG.OTC;
            return (
              <button key={med.id}
                onClick={() => { if (!isOOS) { onSelect(med); setOpen(false); onChange(''); } }}
                className={`w-full px-3 py-2.5 text-left border-b border-gray-50 last:border-0 transition-colors
                  ${isOOS  ? 'bg-red-50 cursor-not-allowed border-l-[3px] border-l-red-400'
                  : isLow  ? 'bg-amber-50 cursor-pointer border-l-[3px] border-l-amber-400 hover:bg-amber-100'
                  : 'hover:bg-teal-50/40 cursor-pointer'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-semibold truncate ${isOOS ? 'text-red-700' : isLow ? 'text-amber-800' : 'text-gray-900'}`}>
                      {med.brand_name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                      {med.schedule_class}
                    </span>
                  </div>
                  {hasStockData && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isOOS  ? 'bg-red-100 text-red-700'
                      : isLow  ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {isOOS ? 'OUT OF STOCK' : `${stock} left`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                  <span className="text-[#00475a] font-medium">{med.molecule}</span>
                  <span>·</span><span>{med.strength}</span>
                  <span>·</span><span>{med.dosage_form}</span>
                  {(med.tabs_per_strip || 1) > 1 && (
                    <><span>·</span><span className="font-bold text-[#00475a] bg-teal-50 px-1 rounded">{med.tabs_per_strip}'s</span></>
                  )}
                  {med.manufacturer && <><span>·</span><span className="italic">{med.manufacturer}</span></>}
                  {med.rack_location && <><span>·</span><span className="text-blue-600 font-medium">📍{med.rack_location}</span></>}
                  {fefo?.sale_rate && (
                    <span className="inline-flex items-center gap-1">
                      <span>·</span>
                      <span className="font-bold text-[#00475a]">Sale ₹{Number(fefo.sale_rate).toFixed(2)}</span>
                    </span>
                  )}
                  {fefo?.mrp && (
                    <span className="inline-flex items-center gap-1">
                      <span>·</span>
                      <span className="text-gray-500">MRP ₹{Number(fefo.mrp).toFixed(2)}</span>
                    </span>
                  )}
                  {fefo?.purchase_price && Number(fefo.purchase_price) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <span>·</span>
                      <span className="text-amber-700">Cost ₹{Number(fefo.purchase_price).toFixed(2)}</span>
                    </span>
                  )}
                  {fefo?.purchase_price && fefo.sale_rate && (() => {
                    const margin = ((Number(fefo.sale_rate) - Number(fefo.purchase_price)) / Number(fefo.sale_rate) * 100);
                    if (margin <= 0) return null;
                    return (
                      <span className="inline-flex items-center gap-1">
                        <span>·</span>
                        <span className={`font-bold text-[10px] ${margin >= 20 ? 'text-green-600' : margin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>{margin.toFixed(0)}% margin</span>
                      </span>
                    );
                  })()}
                </div>
                {isOOS && (
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] text-red-600 font-semibold">
                      Cannot dispense — no stock available
                      {med.substitute_count > 0 && ` · ${med.substitute_count} substitute(s) available`}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        api.post('/demand', { medicine_id: med.id, medicine_name: med.brand_name })
                          .then(r => {
                            if (r.data?.is_high_demand) {
                              toast.success(`🔥 High demand: ${med.brand_name} flagged for procurement`);
                            } else {
                              toast.success(`Demand noted (${r.data?.total_requests || 1} request${(r.data?.total_requests||1) > 1 ? 's' : ''})`);
                            }
                          })
                          .catch(() => toast.error('Failed to note demand'));
                      }}
                      className="flex-shrink-0 ml-2 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-2 py-0.5 rounded-full transition-colors">
                      + Note demand
                    </button>
                  </div>
                )}
                {isLow && (
                  <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                    Low stock — reorder soon
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Patient search ─────────────────────────────────────────────────────────
function PatientSearch({ value, onSelect, onChange }: {
  value: string; onSelect: (p: any) => void; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['patient-search-disp', value],
    queryFn: () => value.length >= 2
      ? api.get(`/patients?search=${value}&limit=8`).then(r => r.data?.data || r.data || [])
      : Promise.resolve([]),
    enabled: value.length >= 2,
  });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (data?.length) setOpen(true); }, [data]);

  return (
    <div ref={ref} className="relative">
      <input type="text" value={value}
        onChange={e => { onChange(e.target.value); }}
        onFocus={() => { if (data?.length) setOpen(true); }}
        placeholder="Search patient name / mobile..."
        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#00475a]" />
      {open && data?.length > 0 && (
        <div className="absolute top-full left-0 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-48 overflow-y-auto">
          {data.map((p: any) => (
            <button key={p.id} onClick={() => { onSelect(p); setOpen(false); }}
              className="w-full px-3 py-2 text-left border-b border-gray-50 last:border-0 hover:bg-teal-50 text-sm">
              <p className="font-semibold text-gray-800">
                {p.first_name} {p.last_name ?? ''}
              </p>
              <p className="text-xs text-gray-400">{p.mobile} · {p.gender} · {p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() + 'y' : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

// ── LogDemandDialog ────────────────────────────────────────────────────
function LogDemandDialog({ query, onClose }: { query: string; onClose: () => void }) {
  const [name, setName] = useState(query);
  const [qty, setQty] = useState('');
  const [hasRx, setHasRx] = useState(false);
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [done, setDone] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL;

  const validate = async (n: string) => {
    if (n.length < 3) return;
    setValidating(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/demand-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ medicine_name_raw: n, qty_requested: qty, has_prescription: hasRx, patient_mobile: mobile }),
      });
      const data = await res.json();
      setValidation(data.validation);
      if (res.ok) setDone(true);
    } catch { setValidation(null); }
    finally { setValidating(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    await validate(name);
    setLoading(false);
  };

  const statusColor = {
    validated:      'text-green-700 bg-green-50 border-green-200',
    misspelling:    'text-amber-700 bg-amber-50 border-amber-200',
    not_a_medicine: 'text-red-700 bg-red-50 border-red-200',
    pending:        'text-gray-600 bg-gray-50 border-gray-200',
  };

  const statusLabel = {
    validated:      'Validated medicine',
    misspelling:    'Possible misspelling — check suggested name',
    not_a_medicine: 'Not recognised as a medicine',
    pending:        'Pending review',
  };

  if (done && validation) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
          <div className="text-center">
            <div className="text-3xl mb-2">{validation.status === 'validated' ? '✓' : validation.status === 'not_a_medicine' ? '⚠' : '~'}</div>
            <p className="font-medium text-gray-900">Demand logged</p>
            <p className="text-sm text-gray-500 mt-1">"{name}" has been recorded</p>
          </div>
          {validation.status !== 'pending' && (
            <div className={`text-xs p-3 rounded-lg border ${statusColor[validation.status as keyof typeof statusColor]}`}>
              <p className="font-medium">{statusLabel[validation.status as keyof typeof statusLabel]}</p>
              {validation.inn_name && <p className="mt-1">INN: {validation.inn_name}</p>}
              {validation.suggested_name && <p className="mt-1">Did you mean: <strong>{validation.suggested_name}</strong>?</p>}
              {validation.schedule_class && <p className="mt-1">Schedule {validation.schedule_class}</p>}
              {validation.is_nti && <p className="mt-1 font-medium">⚠ Narrow Therapeutic Index</p>}
              {validation.notes && <p className="mt-1 text-gray-500">{validation.notes}</p>}
            </div>
          )}
          <button onClick={onClose} className="w-full py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Log missed demand</p>
            <p className="text-xs text-gray-400 mt-0.5">We will validate and track this</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Medicine name (as patient said/wrote) *</label>
            <input
              className="input w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Pantop 40, Shelcal 500..."
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quantity patient wanted</label>
            <input className="input w-full" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 1 strip, 2 boxes" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="hasRx" checked={hasRx} onChange={e => setHasRx(e.target.checked)} className="rounded" />
            <label htmlFor="hasRx" className="text-sm text-gray-600 cursor-pointer">Patient had a prescription</label>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Patient mobile (optional — for callback when stocked)</label>
            <input className="input w-full" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" />
          </div>
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name || loading || validating}
            className="flex-2 flex-1 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            {loading || validating ? 'Validating...' : 'Log demand'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DispensingPage() {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchValues, setSearchValues] = useState<string[]>(['']); // one per row

  // Patient / compliance
  const [compliance, setCompliance] = useState<ComplianceData>({
    patient_name: '', patient_id: '', patient_age: '',
    patient_gender: '', doctor_name: '', doctor_reg_no: '',
    referring_doctor: '',
  });
  const [patientSearch, setPatientSearch] = useState('');

  // Payment
  const [paymentMode, setPaymentMode] = useState('');
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [overallDiscountReason, setOverallDiscountReason] = useState('');
  const [amountPaid, setAmountPaid] = useState<number | ''>(''); // NEW: partial payment

  // UI state
  const [showBillPanel, setShowBillPanel] = useState(false);

  const [returnSale, setReturnSale] = useState<{id: string, bill_number: string} | null>(null);
  const [demandQuery, setDemandQuery] = useState<string | null>(null);
  // Auto-hide compliance when no scheduled drugs in cart
  useEffect(() => {
    if (!cart.some(i => ['H', 'H1', 'X'].includes(i.schedule_class))) {
      setShowCompliance(false);
    }
  }, [cart]);
  const [showCompliance, setShowCompliance] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [hybridCash, setHybridCash] = useState(0);
  const [hybridUpi, setHybridUpi] = useState(0);
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const [showSubstitutes, setShowSubstitutes] = useState<string | null>(null);
  const [substitutesForMed, setSubstitutesForMed] = useState<any>(null);
  const [ddiResult, setDdiResult] = useState<any>(null);
  const [ddiChecking, setDdiChecking] = useState(false);
  const [showDdiModal, setShowDdiModal] = useState(false);
  const [aiPrescriptionId, setAiPrescriptionId] = useState<string | null>(null);
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(null);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // Multi-bill tabs
  const [drafts, setDrafts] = useState<DraftBill[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string>('current');
  const [holdingBill, setHoldingBill] = useState(false);
  const [showRxPanel, setShowRxPanel] = useState(true);
  const [pendingRxCount, setPendingRxCount] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: rxQueue = [] } = useQuery({
    queryKey: ['rx-queue-dispensing'],
    queryFn: () => api.get('/queue/today').then(r =>
      r.data.filter((e: any) => ['consultation_done', 'dispensing'].includes(e.status))
    ).catch(() => []),
    refetchInterval: 15000,
  });

  const { data: substitutes } = useQuery({
    queryKey: ['substitutes', showSubstitutes],
    queryFn: () => api.get(`/substitutes?medicine_id=${showSubstitutes}`).then(r => r.data),
    enabled: !!showSubstitutes,
  });

  const loadDrafts = useCallback(async () => {
    try { const r = await api.get('/draft-bills'); setDrafts(r.data || []); } catch {}
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // ── Add medicine to cart from search ──────────────────────────────────
  const handleSelectMedicine = async (med: any, rowIdx: number) => {
    try {
      const { data: bestBatch } = await api.get(`/stock/${med.id}/best-batch`);
      if (!bestBatch) {
        setSubstitutesForMed(med);
        setShowSubstitutes(med.id);
        toast('No stock — showing substitutes', { icon: '⚠️' });
        return;
      }
      // ── 3-signal chronic detection ─────────────────────────────
      const isChronicByMolecule = med.is_chronic === true;
      const isChronicByQtySchedule = (
        Number(bestBatch.quantity) >= 20 &&
        ['H', 'H1'].includes(med.schedule_class)
      );
      const isChronicDetected = isChronicByMolecule || isChronicByQtySchedule;

      const newItem: CartItem = {
        medicine_id:       med.id,
        batch_id:          bestBatch.id,
        medicine_name:     med.brand_name,
        molecule:          med.molecule || '',
        batch_number:      bestBatch.batch_number,
        expiry_date:       bestBatch.expiry_date,
        qty:               0,
        rate:              Number(bestBatch.sale_rate),
        line_discount_pct: 0,
        gst_percent:       Number(med.gst_percent || 0),
        avl_qty:           Number(bestBatch.quantity || 0),
        rack_location:     med.rack_location || '',
        is_substituted:    false,
        schedule_class:    med.schedule_class,
        tabs_per_strip:    med.tabs_per_strip || 1,
        max_discount_pct:  med.max_discount_pct ?? null,
        is_chronic:        isChronicDetected,
        chronic_category:  med.chronic_category || '',
        create_care_plan:  isChronicDetected,
        all_batches:       med.all_batches || [],
        manufacturer:      med.manufacturer || '',
        purchase_price:    bestBatch.purchase_price ? Number(bestBatch.purchase_price) : null,
      };

      if (rowIdx < cart.length) {
        // Replace existing empty row
        const updated = [...cart];
        updated[rowIdx] = newItem;
        setCart(updated);
      } else {
        setCart(prev => [...prev, newItem]);
      }

      // Add a new empty search row
      const newSearchVals = [...searchValues];
      newSearchVals[rowIdx] = '';
      if (rowIdx >= searchValues.length - 1) newSearchVals.push('');
      setSearchValues(newSearchVals);

      // Focus next qty field
      setTimeout(() => {
        const qtyInput = document.getElementById(`qty-${rowIdx}`);
        qtyInput?.focus();
      }, 50);

      if (['H', 'H1', 'X'].includes(med.schedule_class)) {
        setShowCompliance(true);
        toast('Compliance details required', { icon: '🔐' });
      }
    } catch {
      toast.error('Failed to fetch stock');
    }
  };

  // ── Update cart item field — auto-splits across batches when qty exceeds avl_qty ──
  const updateItem = (idx: number, field: keyof CartItem, value: any) => {
    if (field !== 'qty') {
      setCart(prev => prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      ));
      return;
    }

    const requestedQty = Number(value);
    setCart(prev => {
      const item = prev[idx];
      if (!item) return prev;

      // If qty fits in current batch — simple update
      if (requestedQty <= item.avl_qty) {
        return prev.map((it, i) => i === idx ? { ...it, qty: requestedQty } : it);
      }

      // qty exceeds current batch — auto-split across all_batches (FEFO order)
      const allBatches: any[] = (item.all_batches || [])
        .filter((b: any) => Number(b.quantity) > 0)
        .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

      if (allBatches.length <= 1) {
        // No other batches — just update and let validation catch it
        return prev.map((it, i) => i === idx ? { ...it, qty: requestedQty } : it);
      }

      // Build split rows
      const splitRows: CartItem[] = [];
      let remaining = requestedQty;

      for (const batch of allBatches) {
        if (remaining <= 0) break;
        const available = Number(batch.quantity);
        const useQty = Math.min(remaining, available);
        splitRows.push({
          ...item,
          batch_id:     batch.id,
          batch_number: batch.batch_number,
          expiry_date:  batch.expiry_date,
          rate:         Number(batch.sale_rate),
          avl_qty:      available,
          qty:          useQty,
          all_batches:  item.all_batches,
        });
        remaining -= useQty;
      }

      if (splitRows.length === 0) return prev;

      // Replace current row with split rows
      const newCart = [...prev];
      newCart.splice(idx, 1, ...splitRows);

      // Show toast if split happened
      if (splitRows.length > 1) {
        setTimeout(() => {
          toast.success(
            `Split across ${splitRows.length} batches: ${splitRows.map(r => r.batch_number + ' (\u00d7' + r.qty + ')').join(', ')}`,
            { duration: 4000 }
          );
        }, 100);
      }

      return newCart;
    });
  };

  // ── Calculations ──────────────────────────────────────────────────────
  // MRP is GST-inclusive — back-calculate GST from rate
  const lineTotal = (item: CartItem) => {
    const base = item.qty * item.rate;
    const disc = base * (item.line_discount_pct / 100);
    return base - disc; // No GST added — already in rate
  };

  const subtotal     = cart.reduce((s, i) => s + i.qty * i.rate, 0);
  const lineDiscTotal= cart.reduce((s, i) => s + i.qty * i.rate * (i.line_discount_pct / 100), 0);
  const taxTotal     = cart.reduce((s, i) => {
    // GST back-calculated from GST-inclusive rate
    const base = i.qty * i.rate * (1 - i.line_discount_pct / 100);
    return s + base * (i.gst_percent / (100 + i.gst_percent));
  }, 0);
  const afterLineDisc = subtotal - lineDiscTotal + taxTotal;
  const overallDiscAmt= afterLineDisc * (overallDiscount / 100);
  const netBeforeRound= afterLineDisc - overallDiscAmt;
  const roundOff      = Math.round(netBeforeRound) - netBeforeRound;
  const netTotal      = Math.round(netBeforeRound);
  const dueAmount     = typeof amountPaid === 'number' ? Math.max(0, netTotal - amountPaid) : 0;

  const hasScheduledDrugs = cart.some(i => ['H', 'H1', 'X'].includes(i.schedule_class));

  // ── Hold & new bill ───────────────────────────────────────────────────
  const holdAndNew = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setHoldingBill(true);
    try {
      const label = compliance.patient_name
        ? `Patient: ${compliance.patient_name}`
        : `Bill ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      await api.post('/draft-bills', {
        label, cart_data: cart, compliance,
        payment_mode: paymentMode, discount: overallDiscount,
      });
      setCart([]); setSearchValues(['']);
      setCompliance({ patient_name:'', patient_id:'', patient_age:'', patient_gender:'', doctor_name:'', doctor_reg_no:'', referring_doctor:'' });
      setOverallDiscount(0); setOverallDiscountReason(''); setAmountPaid('');
      setActiveDraftId('current');
      toast.success('Bill held — start a new one');
      await loadDrafts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to hold bill');
    } finally { setHoldingBill(false); }
  };

  // ── Keyboard shortcut: Ctrl+N / Cmd+N = Hold & New ──────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (cart.length === 0) return;
        holdAndNew();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, holdAndNew]);

  const switchToDraft = async (id: string) => {
    if (id === 'current') { setActiveDraftId('current'); return; }
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    setCart(draft.cart_data || []);
    setSearchValues([...(draft.cart_data || []).map(() => ''), '']);
    setCompliance(draft.compliance || { patient_name:'', patient_id:'', patient_age:'', patient_gender:'', doctor_name:'', doctor_reg_no:'', referring_doctor:'' });
    setPaymentMode(draft.payment_mode || 'cash');
    setOverallDiscount(Number(draft.discount) || 0);
    setActiveDraftId(id);
  };

  const abandonDraft = async (id: string) => {
    try {
      await api.delete(`/draft-bills/${id}`);
      if (activeDraftId === id) { setActiveDraftId('current'); setCart([]); }
      await loadDrafts();
    } catch { toast.error('Failed'); }
  };

  // ── Billing ───────────────────────────────────────────────────────────
  const createSaleMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales', payload).then(r => r.data),
    onSuccess: async (data) => {
      setShowPreview(false);
      setCompletedSale(data);
      setCart([]); setSearchValues(['']);
      setCompliance({ patient_name:'', patient_id:'', patient_age:'', patient_gender:'', doctor_name:'', doctor_reg_no:'', referring_doctor:'' });
      setOverallDiscount(0); setOverallDiscountReason(''); setAmountPaid('');
      setAiResult(null); setAiPrescriptionId(null);
      if (activeDraftId !== 'current') {
        await api.patch(`/draft-bills/${activeDraftId}/confirm`, {}).catch(() => {});
        setActiveDraftId('current');
        await loadDrafts();
      }
      if (activePrescriptionId) {
        api.patch(`/prescriptions/${activePrescriptionId}/dispense`, { sale_id: data.id }).catch(() => {});
        setActivePrescriptionId(null);
      }
      if (activeQueueId) {
        api.patch(`/queue/${activeQueueId}/status`, { status: 'completed' }).catch(() => {});
        setActiveQueueId(null);
      }
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['rx-queue-dispensing'] });
      qc.invalidateQueries({ queryKey: ['dispensing-queue'] });
      toast.success(`Bill ${data.bill_number} created!`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Bill creation failed'),
  });

  // ── Drug Interaction Check via Claude API ────────────────────────────
  const checkDrugInteractions = async () => {
    const molecules = cart
      .map(i => i.molecule)
      .filter(m => m && m.length > 2 && !m.toLowerCase().includes('as per'));
    if (molecules.length < 2) return null; // need 2+ medicines to check
    setDdiChecking(true);
    try {
      const { data } = await api.post('/ai/drug-interactions', { molecules });
      return data;
    } catch {
      return null; // fail silently — don't block billing
    } finally {
      setDdiChecking(false);
    }
  };

  const handleBill = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    const overQty = cart.filter(i => i.avl_qty > 0 && i.qty > i.avl_qty);
    if (overQty.length > 0) {
      toast.error(`Quantity exceeds available stock for: ${overQty.map(i => i.medicine_name).join(', ')}}`);
      return;
    }
    if (hasScheduledDrugs && (!compliance.patient_name || !compliance.doctor_name)) {
      setShowCompliance(true); setShowBillPanel(true);
      toast.error('Compliance details required'); return;
    }
    if (!paymentMode) {
      setShowPaymentPrompt(true);
      return;
    }
    if (paymentMode === 'hybrid') {
      if (!hybridCash && !hybridUpi) {
        toast.error('Enter Cash and UPI amounts for split payment');
        setShowBillPanel(true);
        return;
      }
      const hybridTotal = hybridCash + hybridUpi;
      if (hybridTotal < netTotal * 0.99) {
        toast.error(`Split total ₹${hybridTotal.toFixed(0)} is less than net ₹${netTotal}. Please adjust.`);
        setShowBillPanel(true);
        return;
      }
    }
    // Run DDI check if 2+ medicines in cart
    if (cart.length >= 2) {
      const ddi = await checkDrugInteractions();
      if (ddi?.interactions?.length > 0) {
        setDdiResult(ddi);
        setShowDdiModal(true);
        return; // pause — pharmacist must acknowledge
      }
    }
    setShowPreview(true);
  };

  const buildPayload = () => ({
    customer_name:    compliance.patient_name,
    doctor_name:      compliance.doctor_name,
    doctor_reg_no:    compliance.doctor_reg_no,
    referring_doctor: compliance.referring_doctor,
    prescription_id:  activePrescriptionId,
    items: cart.map(i => ({
      medicine_id: i.medicine_id, batch_id: i.batch_id, qty: i.qty,
      rate: i.rate, gst_percent: i.gst_percent,
      discount_percent: i.line_discount_pct,
      is_substituted: i.is_substituted,
      original_medicine_id: i.original_medicine_id,
      create_care_plan: i.create_care_plan,
      is_chronic: i.is_chronic,
      chronic_category: i.chronic_category,
    })),
    discount_amount:   overallDiscAmt + lineDiscTotal,
    discount_reason:   overallDiscountReason || undefined,
    payment_mode:      paymentMode === 'hybrid' ? 'cash_upi' : paymentMode,
    hybrid_cash:       paymentMode === 'hybrid' ? hybridCash : undefined,
    hybrid_upi:        paymentMode === 'hybrid' ? hybridUpi : undefined,
    amount_paid:       typeof amountPaid === 'number' ? amountPaid : netTotal,
    ai_prescription_id: aiPrescriptionId,
    compliance_data:   hasScheduledDrugs ? compliance : undefined,
  });

  // ── File upload / AI ──────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setAiExtracting(true);
    const formData = new FormData(); formData.append('file', file);
    try {
      const { data } = await api.post('/ai/prescription/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAiPrescriptionId(data.id);
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        const { data: result } = await api.get(`/ai/prescription/${data.id}`);
        if (result.status === 'completed' || attempts > 20) {
          clearInterval(poll); setAiExtracting(false);
          if (result.extraction_json) {
            setAiResult(result); setShowAiReview(true);
            if (result.patient_name) setCompliance(p => ({ ...p, patient_name: result.patient_name }));
            if (result.doctor_name)  setCompliance(p => ({ ...p, doctor_name: result.doctor_name, referring_doctor: result.doctor_name }));
          }
        }
        if (result.status === 'failed') { clearInterval(poll); setAiExtracting(false); toast.error('Scan failed'); }
      }, 2000);
    } catch { setAiExtracting(false); toast.error('Upload failed'); }
  };

  const handleApproveAi = async () => {
    const medicines = aiResult?.extraction_json?.medicines || [];
    const notFound: string[] = [];
    const outOfStock: string[] = [];
    let added = 0;

    // Set doctor name from prescription if available
    const docName = aiResult?.extraction_json?.doctor_name || aiResult?.extraction_json?.doctor || '';
    if (docName) setCompliance((p: any) => ({ ...p, doctor_name: docName, referring_doctor: docName }));

    for (const med of medicines) {
      if (med.matched_medicine_id) {
        // Check if the matched medicine has stock via search-enriched
        try {
          const res = await api.get(`/medicines/search-enriched?search=${encodeURIComponent(med.matched_medicine_name || med.name)}&limit=1`);
          const found = res.data?.[0];
          if (found && Number(found.total_stock) > 0) {
            await handleSelectMedicine({
              id: med.matched_medicine_id,
              brand_name: med.matched_medicine_name || med.name,
              gst_percent: found.gst_percent || 0,
              schedule_class: found.schedule_class || 'OTC',
              fefo_batch: found.fefo_batch,
              total_stock: found.total_stock,
            }, cart.length);
            added++;
          } else {
            outOfStock.push(med.matched_medicine_name || med.name);
            // Note demand automatically
            api.post('/demand', {
              medicine_id: med.matched_medicine_id,
              medicine_name: med.matched_medicine_name || med.name,
              notes: 'From prescription scan',
            }).catch(() => {});
          }
        } catch {
          await handleSelectMedicine({
            id: med.matched_medicine_id,
            brand_name: med.matched_medicine_name || med.name,
            gst_percent: 0, schedule_class: 'OTC',
          }, cart.length);
          added++;
        }
      } else {
        // Medicine not in inventory at all
        notFound.push(med.name);
        // Note demand for procurement
        api.post('/demand', {
          medicine_name: med.name,
          notes: 'From prescription scan — not in inventory',
        }).catch(() => {});
      }
    }

    setShowAiReview(false);

    // Show summary toast
    if (added > 0 && notFound.length === 0 && outOfStock.length === 0) {
      toast.success(`✅ ${added} medicine${added > 1 ? 's' : ''} added to bill`);
    } else {
      if (added > 0) toast.success(`✅ ${added} medicine${added > 1 ? 's' : ''} added to bill`);
      if (outOfStock.length > 0) toast.error(`⚠️ Out of stock: ${outOfStock.join(', ')}`);
      if (notFound.length > 0) toast.error(`❌ Not in inventory: ${notFound.join(', ')}`);
      if (outOfStock.length > 0 || notFound.length > 0) {
        toast('Unavailable medicines noted for procurement', { icon: '📋' });
      }
    }
  };

  const handleLoadPrescription = async (data: { prescriptionId: string; queueId?: string; patientName: string; doctorName: string; items: Array<{ medicine_name: string; medicine_id?: string; dosage?: string; frequency?: string; quantity?: number; }> }) => {
    setActivePrescriptionId(data.prescriptionId);
    setActiveQueueId(data.queueId || null);
    setCompliance(p => ({ ...p, patient_name: data.patientName, doctor_name: data.doctorName, referring_doctor: data.doctorName }));
    setPatientSearch(data.patientName);
    setShowRxPanel(false);

    // Clear cart first, then add items sequentially so indices are correct
    setCart([]);
    setSearchValues(['']);

    const loadingToast = toast.loading(`Loading ${data.items.length} medicines...`);
    let added = 0;
    const newCart: CartItem[] = [];

    for (const item of data.items) {
      try {
        const res = await api.get(`/medicines/search-enriched?search=${encodeURIComponent(item.medicine_name)}&limit=1`);
        const med = res.data?.[0];
        if (med) {
          const { data: bestBatch } = await api.get(`/stock/${med.id}/best-batch`).catch(() => ({ data: null }));
          if (bestBatch) {
            const qty = item.quantity || 1;
            newCart.push({
              medicine_id:       med.id,
              batch_id:          bestBatch.id,
              medicine_name:     med.brand_name,
              molecule:          med.molecule || '',
              batch_number:      bestBatch.batch_number,
              expiry_date:       bestBatch.expiry_date,
              qty,
              rate:              Number(bestBatch.sale_rate),
              line_discount_pct: 0,
              gst_percent:       Number(med.gst_percent || 0),
              avl_qty:           Number(bestBatch.quantity || 0),
              rack_location:     med.rack_location || '',
              is_substituted:    false,
              schedule_class:    med.schedule_class || 'OTC',
              tabs_per_strip:    med.tabs_per_strip || 1,
              max_discount_pct:  med.max_discount_pct ?? null,
              is_chronic:        med.is_chronic || false,
              chronic_category:  med.chronic_category || '',
              create_care_plan:  med.is_chronic || false,
              all_batches:       med.all_batches || [],
            });
            added++;
          }
        }
      } catch {}
    }

    setCart(newCart);
    setSearchValues([...newCart.map(() => ''), '']);
    toast.dismiss(loadingToast);

    if (added > 0) {
      toast.success(`✅ ${added} medicine${added > 1 ? 's' : ''} loaded from prescription`);
      if (added < data.items.length) {
        toast(`⚠️ ${data.items.length - added} medicine${data.items.length - added > 1 ? 's' : ''} not in stock — check substitutes`, { duration: 5000 });
      }
    } else {
      toast.error('No medicines could be loaded — check stock');
    }
  };

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* ── Bill tabs ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-white overflow-x-auto flex-shrink-0">
        <button onClick={() => switchToDraft('current')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all ${
            activeDraftId === 'current' ? 'bg-[#00475a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>
          <ShoppingCart className="w-3.5 h-3.5" /> Current bill
        </button>
        {drafts.map(d => (
          <div key={d.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 border transition-all ${
            activeDraftId === d.id ? 'bg-[#00475a] text-white border-[#00475a]' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <button onClick={() => switchToDraft(d.id)} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="max-w-[100px] truncate">{d.label}</span>
            </button>
            <button onClick={() => abandonDraft(d.id)} className="opacity-60 hover:opacity-100 ml-1">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={holdAndNew} disabled={holdingBill || cart.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 border border-dashed border-slate-300 text-slate-500 hover:border-[#00475a] hover:text-[#00475a] disabled:opacity-40 transition-all">
          {holdingBill ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Hold & new bill
        </button>
      </div>

      {/* ── Rx Waiting Banner ── */}
      {rxQueue.length > 0 && (
        <div className="flex-shrink-0 bg-teal-600 px-3 py-2 flex items-center gap-2 overflow-x-auto">
          <ClipboardList className="w-4 h-4 text-white flex-shrink-0" />
          <span className="text-white text-xs font-bold flex-shrink-0">
            {rxQueue.length} prescription{rxQueue.length > 1 ? 's' : ''} waiting:
          </span>
          <div className="flex gap-1.5 flex-1 overflow-x-auto">
            {rxQueue.map((entry: any) => {
              const name = entry.patient
                ? `${entry.patient.first_name || ''} ${entry.patient.last_name || ''}`.trim()
                : entry.patient_name || 'Patient';
              return (
                <button
                  key={entry.id}
                  onClick={() => setShowRxPanel(true)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border border-white/30"
                >
                  <span className="w-5 h-5 bg-white text-teal-700 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {entry.token_number}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowRxPanel(v => !v)}
            className="flex-shrink-0 text-white/80 hover:text-white text-xs underline whitespace-nowrap"
          >
            {showRxPanel ? 'Hide panel' : 'Show panel'}
          </button>
        </div>
      )}

      {/* ── Patient / bill header ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Patient search */}
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
              Patient:
              {!hasScheduledDrugs && cart.length > 0 && (
                <span className="ml-1 text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded">OTC — optional</span>
              )}
            </span>
            <div className="flex-1 relative">
              <PatientSearch
                value={patientSearch}
                onChange={setPatientSearch}
                onSelect={p => {
                  const name = `${p.first_name} ${p.last_name ?? ''}`.trim();
                  setPatientSearch(name);
                  setCompliance(prev => ({
                    ...prev,
                    patient_name: name,
                    patient_id: p.id,
                    patient_age: p.date_of_birth
                      ? String(new Date().getFullYear() - new Date(p.date_of_birth).getFullYear())
                      : '',
                    patient_gender: p.gender || '',
                  }));
                }}
              />
            </div>
          </div>
          {/* Gender + Age + Patient ID */}
          <div className="flex items-center gap-2 flex-wrap">
            {compliance.patient_gender && (
              <span className="text-xs text-slate-500">
                {compliance.patient_gender} · {compliance.patient_age ? `${compliance.patient_age}y` : ''}
              </span>
            )}
            {compliance.patient_id && (
              <span className="text-xs bg-teal-50 text-[#00475a] px-2 py-0.5 rounded font-mono font-medium border border-teal-100">
                ID: {String(compliance.patient_id).slice(0, 8).toUpperCase()}
              </span>
            )}
          </div>
          {/* Referring doctor */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Ref. Dr:</span>
            <input type="text" value={compliance.referring_doctor}
              onChange={e => setCompliance(p => ({ ...p, referring_doctor: e.target.value }))}
              placeholder="Referring doctor"
              className="px-2 py-1 text-sm border border-slate-200 rounded-lg w-40 focus:outline-none focus:border-[#00475a]" />
          </div>
          {/* Date */}
          <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">Date: {today}</span>
          {/* Upload Rx */}
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
            {aiExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            Upload Rx
          </button>
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        </div>
      </div>

      {/* ── AI review ── */}
      {showAiReview && aiResult && (
        <div className="mx-4 mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-blue-900">AI Extracted Medicines</p>
            <button onClick={() => setShowAiReview(false)}><X className="w-4 h-4 text-blue-400" /></button>
          </div>
          <div className="space-y-1 mb-2">
            {aiResult.extraction_json?.medicines?.map((med: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getConfidenceColor(med.confidence)}`}>{med.confidence}</span>
                <span className="font-medium text-gray-800">{med.name}</span>
                <span className="text-gray-400">{med.strength} · {med.frequency}</span>
                {med.matched_medicine_name && <span className="text-green-600">→ {med.matched_medicine_name}</span>}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleApproveAi} className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
              <Check className="w-3.5 h-3.5 inline mr-1" />Approve & Add
            </button>
            <button onClick={() => setShowAiReview(false)} className="px-3 py-1.5 border border-slate-200 text-xs rounded-lg">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Prescription Bridge sidebar ── */}
        {showRxPanel && (
          <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
            <PrescriptionBridge
              onLoadPrescription={handleLoadPrescription}
              onPendingCountChange={setPendingRxCount}
            />
            <button
              onClick={() => setShowRxPanel(false)}
              className="flex-shrink-0 flex items-center justify-center py-2 border-t border-slate-100 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Hide panel
            </button>
          </div>
        )}

        {/* ── Cart table ── */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase w-8">No</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">Medicine / Batch</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-20">Avl.Qty</th>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-500 uppercase w-20">Qty</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase w-24">Rate</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-500 uppercase w-28">Amount</th>
                <th className="px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {/* Filled rows */}
              {cart.map((item, idx) => {
                const cfg = SCHEDULE_CONFIG[item.schedule_class] ?? SCHEDULE_CONFIG.OTC;
                const amt = lineTotal(item);
                const daysExp = Math.floor((new Date(item.expiry_date).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={`${item.medicine_id}-${item.batch_id}-${idx}`}
                    className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border flex-shrink-0"
                          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                          {item.schedule_class}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.medicine_name}</p>
                          {(item as any).manufacturer && (
                            <p className="text-[10px] text-slate-500 italic">{(item as any).manufacturer}</p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                            <span>Batch: {item.batch_number}</span>
                            <span className={daysExp < 30 ? 'text-red-500 font-semibold' : daysExp < 90 ? 'text-amber-600' : ''}>
                              Exp: {new Date(item.expiry_date).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}
                              {daysExp < 30 && ' ⚠️'}
                            </span>
                            {item.rack_location && (
                              <span className="text-blue-600 font-medium">📍 {item.rack_location}</span>
                            )}
                            {item.is_substituted && <span className="text-blue-500">Substituted</span>}
                            {item.is_chronic && (
                              <button
                                onClick={() => updateItem(idx, 'create_care_plan', !item.create_care_plan)}
                                title={item.create_care_plan ? 'AI Care plan will be created — click to disable' : 'Click to create AI Care refill plan'}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  item.create_care_plan
                                    ? 'bg-purple-100 text-purple-700 border-purple-300'
                                    : 'bg-gray-100 text-gray-400 border-gray-200'
                                }`}>
                                <Heart className="w-2.5 h-2.5" />
                                {item.create_care_plan ? `AI Care · ${item.chronic_category || 'Chronic'}` : 'Add to AI Care?'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-sm font-bold ${
                        item.avl_qty <= 0 ? 'text-red-500'
                        : item.avl_qty <= 10 ? 'text-amber-600'
                        : 'text-green-600'
                      }`}>
                        {item.avl_qty}
                        {(item.tabs_per_strip || 1) > 1 && item.avl_qty > 0 && (
                          <span className="block text-[9px] text-[#00475a] font-semibold">
                            {Math.floor(item.avl_qty / (item.tabs_per_strip||1))}×{item.tabs_per_strip}'s
                          </span>
                        )}
                        {item.qty > item.avl_qty && item.avl_qty > 0 && (
                          <span className="block text-[9px] text-red-500 font-bold">⚠ Exceeds stock</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input id={`qty-${idx}`} type="number" min={1} value={item.qty || ''}
                        onChange={e => updateItem(idx, 'qty', Number(e.target.value) || 0)}
                        onBlur={e => { if (!item.qty || item.qty < 1) updateItem(idx, 'qty', 1); }}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const nextSearch = document.getElementById(`search-${idx + 1}`);
                            if (nextSearch) nextSearch.focus();
                            else {
                              const newSearchVals = [...searchValues];
                              if (newSearchVals.length <= idx + 1) newSearchVals.push('');
                              setSearchValues(newSearchVals);
                              setTimeout(() => document.getElementById(`search-${idx + 1}`)?.focus(), 50);
                            }
                          }
                        }}
                        className="w-16 text-center text-sm font-bold border border-slate-200 rounded focus:outline-none focus:border-[#00475a] py-1" />
                      {(item.tabs_per_strip || 1) > 1 && item.qty > 0 && (() => {
                        const tps = item.tabs_per_strip || 1;
                        const strips = Math.floor(item.qty / tps);
                        const loose  = item.qty % tps;
                        return (
                          <div className="text-[9px] text-[#00475a] font-semibold mt-0.5 text-center">
                            {strips > 0 && loose > 0 ? `${strips}×${tps}+${loose}` : strips > 0 ? `${strips}×${tps}'s` : `${loose} tab`}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-slate-700">
                      ₹{Number(item.rate).toFixed(2)}
                    </td>

                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                      ₹{amt.toFixed(2)}
                      {/* Live profit indicator */}
                      {item.purchase_price && item.purchase_price > 0 && item.qty > 0 && (() => {
                        const sellPrice  = item.rate * (1 - item.line_discount_pct / 100);
                        const cost       = item.purchase_price;
                        const profitPer  = sellPrice - cost;
                        const profitPct  = (profitPer / item.rate) * 100;
                        const totalProfit= profitPer * item.qty;
                        const isLoss     = profitPer < 0;
                        const isThin     = profitPct >= 0 && profitPct < 10;
                        const color      = isLoss ? 'text-red-600' : isThin ? 'text-amber-600' : 'text-green-600';
                        const icon       = isLoss ? '⚠️' : isThin ? '↓' : '✓';
                        return (
                          <div className={`text-[9px] font-bold mt-0.5 ${color}`} title={`Cost ₹${cost.toFixed(2)} · Sell ₹${sellPrice.toFixed(2)} · Margin ${profitPct.toFixed(1)}%`}>
                            {icon} {isLoss ? `Loss ₹${Math.abs(totalProfit).toFixed(0)}` : `+₹${totalProfit.toFixed(0)} profit`}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => {
                        const newCart = cart.filter((_,i) => i !== idx);
                        setCart(newCart);
                        setSearchValues(v => v.filter((_,i) => i !== idx));
                        if (newCart.length === 0) {
                          setPaymentMode('');
                          setHybridCash(0);
                          setHybridUpi(0);
                          setAmountPaid('');
                        }
                      }} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Empty search rows */}
              {searchValues.map((sv, idx) => (
                idx >= cart.length && (
                  <tr key={`search-${idx}`} className="border-b border-slate-100 bg-white">
                    <td className="px-3 py-2 text-xs text-slate-300 text-center">{cart.length + 1}</td>
                    <td className="px-3 py-2" colSpan={6}>
                      <div id={`search-${idx}`} className="flex items-center gap-2">
                        <div className="flex-1">
                        <MedSearchDropdown
                          value={sv}
                          onChange={v => {
                            const updated = [...searchValues];
                            updated[idx] = v;
                            setSearchValues(updated);
                          }}
                          onSelect={med => handleSelectMedicine(med, idx)}
                          autoFocus={idx === 0 && cart.length === 0}
                        />
                        </div>
                        <button onClick={() => setShowScanner(true)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00475a]/10 hover:bg-[#00475a] hover:text-white text-[#00475a] text-xs font-medium transition-colors border border-[#00475a]/20">
                          <Scan className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Scan</span>
                        </button>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                )
              ))}

              {/* Schedule compliance row */}
              {hasScheduledDrugs && (
                <tr className="bg-orange-50/50 border-b border-orange-200">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-orange-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Compliance:
                      </span>
                      <input type="text" placeholder="Patient name *" value={compliance.patient_name}
                        onChange={e => setCompliance(p => ({ ...p, patient_name: e.target.value }))}
                        className="px-2 py-1 text-xs border border-orange-200 rounded-lg w-36 focus:outline-none bg-white" />
                      <input type="text" placeholder="Doctor name *" value={compliance.doctor_name}
                        onChange={e => setCompliance(p => ({ ...p, doctor_name: e.target.value }))}
                        className="px-2 py-1 text-xs border border-orange-200 rounded-lg w-36 focus:outline-none bg-white" />
                      {cart.some(i => i.schedule_class === 'X') && (
                        <input type="text" placeholder="Doctor reg. no. *" value={compliance.doctor_reg_no}
                          onChange={e => setCompliance(p => ({ ...p, doctor_reg_no: e.target.value }))}
                          className="px-2 py-1 text-xs border border-red-200 rounded-lg w-32 focus:outline-none bg-white" />
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Type a medicine name in the row above to start billing</p>
            </div>
          )}
        </div>

        {/* ── Bill summary panel — hidden on mobile, visible on desktop ── */}
        <div className="hidden lg:flex w-72 border-l border-slate-200 bg-white flex-col flex-shrink-0">
          {/* Totals */}
          <div className="flex-1 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span>GST</span><span>{formatCurrency(taxTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs">Discount ₹</span>
              <input type="number" min={0} value={overallDiscount > 0 ? overallDiscAmt.toFixed(0) : ''}
                onChange={e => {
                  const amt = Number(e.target.value) || 0;
                  const base = subtotal + taxTotal;
                  if (base > 0) setOverallDiscount(Math.min(100, parseFloat(((amt / base) * 100).toFixed(2))));
                  else setOverallDiscount(0);
                }}
                placeholder="0"
                className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#00475a]" />
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs">Discount %</span>
              <input type="number" min={0} max={100} value={overallDiscount || ''}
                onChange={e => setOverallDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                placeholder="0"
                className="w-20 text-right border border-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#00475a]" />
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-xs">Reason</span>
              <select
                value={overallDiscountReason || ''}
                onChange={e => setOverallDiscountReason(e.target.value)}
                className="w-32 text-xs border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-[#00475a]">
                <option value="">— select —</option>
                <option>Staff discount</option>
                <option>Owner discount</option>
                <option>Round off</option>
                <option>VIP Pass</option>
                <option>Special doctor discount</option>
                <option>Other</option>
              </select>
            </div>
            {roundOff !== 0 && (
              <div className="flex justify-between text-slate-400 text-xs">
                <span>Round off</span>
                <span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2 flex justify-between font-bold text-slate-900 text-base">
              <span>Net total</span><span>{formatCurrency(netTotal)}</span>
            </div>

            {/* Profit summary */}
            {(() => {
              const totalCost = cart.reduce((sum, i) => {
                if (!i.purchase_price || i.purchase_price <= 0) return sum;
                return sum + i.purchase_price * i.qty;
              }, 0);
              const totalSell = cart.reduce((sum, i) => {
                return sum + i.rate * (1 - i.line_discount_pct / 100) * i.qty;
              }, 0);
              const hasCostData = cart.some(i => i.purchase_price && i.purchase_price > 0);
              if (!hasCostData || cart.length === 0) return null;
              const profit = totalSell - totalCost;
              const profitPct = totalSell > 0 ? (profit / totalSell) * 100 : 0;
              const isLoss = profit < 0;
              const isThin = profit >= 0 && profitPct < 10;
              return (
                <div className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
                  isLoss ? 'bg-red-50 border-red-200 text-red-700'
                  : isThin ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-green-50 border-green-200 text-green-700'
                }`}>
                  <div className="flex justify-between">
                    <span>{isLoss ? '⚠️ Loss on this bill' : '✓ Bill profit'}</span>
                    <span>₹{Math.abs(profit).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] opacity-75 mt-0.5">
                    <span>Cost: ₹{totalCost.toFixed(2)}</span>
                    <span>Margin: {profitPct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })()}

            {/* Amount paid */}
            <div className="flex justify-between items-center text-slate-600">
              <span>Amount paid</span>
              <input type="number" min={0} placeholder={String(netTotal)}
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-24 text-right border border-slate-200 rounded px-2 py-0.5 text-sm font-bold focus:outline-none focus:border-[#00475a]" />
            </div>

            {/* Due amount */}
            <div className={`flex justify-between font-bold text-sm ${dueAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              <span>Due amount</span>
              <span>{formatCurrency(dueAmount)}</span>
            </div>

            {/* Payment mode */}
            <div className="pt-1">
              <p className="text-xs text-slate-400 mb-1.5">Payment mode</p>
              <div className="grid grid-cols-3 gap-1">
                {['cash','upi','card','online','hybrid'].map(m => (
                  <button key={m} onClick={() => setPaymentMode(m)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      paymentMode === m
                        ? 'bg-[#00475a] text-white border-[#00475a]'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}>
                    {m === 'hybrid' ? 'Cash+UPI' : m.toUpperCase()}
                  </button>
                ))}
              </div>
              {paymentMode === 'hybrid' && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-slate-500">Split must equal net total <span className="font-bold text-[#00475a]">₹{netTotal}</span></p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-8">💵 Cash</span>
                    <input type="number" min={0} placeholder="0"
                      value={hybridCash || ''}
                      onChange={e => {
                        const cash = Number(e.target.value) || 0;
                        setHybridCash(cash);
                        setHybridUpi(Math.max(0, netTotal - cash));
                      }}
                      className="flex-1 text-sm font-bold border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#00475a]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 w-8">📱 UPI</span>
                    <input type="number" min={0} placeholder="0"
                      value={hybridUpi || ''}
                      onChange={e => {
                        const upi = Number(e.target.value) || 0;
                        setHybridUpi(upi);
                        setHybridCash(Math.max(0, netTotal - upi));
                      }}
                      className="flex-1 text-sm font-bold border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#00475a]" />
                  </div>
                  {(() => {
                    const total = hybridCash + hybridUpi;
                    const diff = total - netTotal;
                    if (total === 0) return null;
                    if (Math.abs(diff) < 1) return (
                      <p className="text-[10px] text-green-600 font-semibold">✅ Split matches — ₹{hybridCash} cash + ₹{hybridUpi} UPI</p>
                    );
                    return (
                      <p className="text-[10px] text-red-500 font-semibold">
                        {diff > 0 ? `⚠ ₹${diff.toFixed(0)} excess` : `⚠ ₹${Math.abs(diff).toFixed(0)} short`} — must equal ₹{netTotal}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-slate-100 space-y-2">
            <button onClick={handleBill} disabled={cart.length === 0 || createSaleMutation.isPending}
              className="w-full py-3 bg-[#00475a] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#003d4d] disabled:opacity-40 transition-colors">
              {createSaleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generate Bill
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Bill Panel Bottom Sheet ── */}
      {showBillPanel && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowBillPanel(false)} />
          {/* Sheet */}
          <div className="relative bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <span className="font-bold text-slate-900">Bill Summary</span>
              <button onClick={() => setShowBillPanel(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {lineDiscTotal > 0 && <div className="flex justify-between text-amber-600"><span>Line discounts</span><span>−{formatCurrency(lineDiscTotal)}</span></div>}
              <div className="flex justify-between text-slate-600"><span>GST</span><span>{formatCurrency(taxTotal)}</span></div>
              {overallDiscAmt > 0 && <div className="flex justify-between text-green-600"><span>Overall discount</span><span>−{formatCurrency(overallDiscAmt)}</span></div>}
              {roundOff !== 0 && <div className="flex justify-between text-slate-400 text-xs"><span>Round off</span><span>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 mt-1">
                <span>Net total</span><span>{formatCurrency(netTotal)}</span>
              </div>
              {/* Amount paid */}
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1">Amount paid</p>
                <input type="number" placeholder={String(netTotal)}
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#00475a]" />
              </div>
              {dueAmount > 0 && (
                <div className="flex justify-between font-bold text-sm text-red-600">
                  <span>Due amount</span><span>{formatCurrency(dueAmount)}</span>
                </div>
              )}
              {/* Payment mode */}
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1.5">Payment mode</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {['cash','upi','card','online','hybrid'].map(m => (
                    <button key={m} onClick={() => setPaymentMode(m)}
                      className={`py-2 rounded-lg text-xs font-semibold border transition-all ${paymentMode===m ? 'bg-[#00475a] text-white border-[#00475a]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      {m === 'hybrid' ? 'Cash+UPI' : m.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              {paymentMode === 'hybrid' && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] text-slate-500">Split must equal net total <span className="font-bold text-[#00475a]">₹{netTotal}</span></p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-10">💵 Cash</span>
                    <input type="number" min={0} placeholder="0" value={hybridCash||''}
                      onChange={e => { const c=Number(e.target.value)||0; setHybridCash(c); setHybridUpi(Math.max(0,netTotal-c)); }}
                      className="flex-1 text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#00475a]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-10">📱 UPI</span>
                    <input type="number" min={0} placeholder="0" value={hybridUpi||''}
                      onChange={e => { const u=Number(e.target.value)||0; setHybridUpi(u); setHybridCash(Math.max(0,netTotal-u)); }}
                      className="flex-1 text-sm font-bold border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#00475a]" />
                  </div>
                  {(() => {
                    const total = hybridCash+hybridUpi;
                    if (total===0) return null;
                    if (Math.abs(total-netTotal)<1) return <p className="text-xs text-green-600 font-semibold">✅ Split matches</p>;
                    return <p className="text-xs text-red-500 font-semibold">⚠ {total>netTotal?`₹${(total-netTotal).toFixed(0)} excess`:`₹${(netTotal-total).toFixed(0)} short`}</p>;
                  })()}
                </div>
              )}
              {/* Overall discount */}
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1">Overall discount %</p>
                <input type="number" min={0} max={100} value={overallDiscount}
                  onChange={e => setOverallDiscount(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00475a]" />
              </div>
            </div>
            {/* Generate Bill button */}
            <div className="p-4 border-t border-slate-100" style={{paddingBottom: 'calc(1rem + env(safe-area-inset-bottom)'}}>
              <button onClick={() => { setShowBillPanel(false); handleBill(); }}
                disabled={cart.length === 0 || createSaleMutation.isPending}
                className="w-full py-3.5 bg-[#00475a] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#003d4d] disabled:opacity-40">
                {createSaleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white border-t border-slate-200 shadow-lg" style={{paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))"}}>
        <button onClick={() => setShowBillPanel(true)}
          className="w-full py-3 bg-[#00475a] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Bill Summary · {formatCurrency(netTotal)}
          {cart.length > 0 && (
            <span className="bg-white text-[#00475a] rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Modals ── */}
      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onFound={(medicine, batch) => {
            handleSelectMedicine({ ...medicine, fefo_batch: batch, total_stock: batch?.quantity || 0 }, searchValues.length - 1);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Payment Mode Prompt */}
      {showPaymentPrompt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-1">Select Payment Mode</h3>
            <p className="text-sm text-gray-500 mb-5">How is the patient paying?</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { mode: 'cash',   label: '💵 Cash',     color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100' },
                { mode: 'upi',    label: '📱 UPI',      color: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' },
                { mode: 'card',   label: '💳 Card',     color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100' },
                { mode: 'online', label: '🌐 Online',   color: 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100' },
                { mode: 'hybrid', label: '💵+📱 Split', color: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' },
                { mode: 'credit', label: '📋 Credit',   color: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' },
              ].map(({ mode, label, color }) => (
                <button key={mode}
                  onClick={() => {
                    setPaymentMode(mode);
                    setShowPaymentPrompt(false);
                    if (mode === 'hybrid') {
                      // Open bill panel so user can enter split amounts
                      setShowBillPanel(true);
                      toast('Enter Cash + UPI split amounts below', { icon: '💵' });
                    } else {
                      setTimeout(() => setShowPreview(true), 50);
                    }
                  }}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${color}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPaymentPrompt(false)} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      {showPreview && (
        <BillDocument
          data={{
            patientName: compliance.patient_name || undefined,
            doctorName: compliance.doctor_name || undefined,
            doctorRegNo: compliance.doctor_reg_no || undefined,
            paymentMode,
            items: cart.map(i => ({
              medicineName: i.medicine_name, batchNumber: i.batch_number,
              expiryDate: i.expiry_date, qty: i.qty, rate: i.rate,
              gstPercent: i.gst_percent, itemTotal: lineTotal(i),
              isSubstituted: i.is_substituted,
            })),
            subtotal, taxAmount: taxTotal,
            discountAmount: overallDiscAmt + lineDiscTotal,
            totalAmount: netTotal,
            amountPaid: typeof amountPaid === 'number' ? amountPaid : netTotal,
            hasScheduledDrugs,
          }}
          mode="preview"
          onClose={() => setShowPreview(false)}
          onConfirm={() => createSaleMutation.mutate(buildPayload())}
          isLoading={createSaleMutation.isPending}
        />
      )}

      {completedSale && (
        <BillDocument
          data={{
            billNumber: completedSale.bill_number, date: completedSale.created_at,
            clinic: completedSale.clinic,
            patientName: completedSale.customer_name, patientId: completedSale.patient_id, doctorName: completedSale.doctor_name,
            paymentMode: completedSale.payment_mode,
            items: completedSale.items?.map((item: any) => ({
              medicineName: item.medicine?.brand_name || item.medicine_name,
              manufacturer: item.medicine?.manufacturer || '',
              batchNumber: item.batch?.batch_number || item.batch_number,
              expiryDate: item.batch?.expiry_date, qty: item.qty,
              rate: Number(item.rate), gstPercent: Number(item.gst_percent),
              itemTotal: Number(item.item_total), isSubstituted: item.is_substituted,
            })) || [],
            subtotal: Number(completedSale.subtotal),
            taxAmount: Number(completedSale.tax_amount),
            discountAmount: Number(completedSale.discount_amount),
            totalAmount: Number(completedSale.total_amount),
            amountPaid: Number(completedSale.amount_paid || completedSale.total_amount),
            hasScheduledDrugs: completedSale.has_scheduled_drugs,
          }}
          mode="print" onClose={() => setCompletedSale(null)} />
      )}

      {/* ── Enhanced Substitutes Modal ── */}
      {showSubstitutes && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900 text-lg">Available Alternatives</h3>
                <button onClick={() => { setShowSubstitutes(null); setSubstitutesForMed(null); }}>
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              {substitutesForMed && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700">
                    <span className="font-semibold">{substitutesForMed.brand_name}</span>
                    {' '}({substitutesForMed.molecule} · {substitutesForMed.strength}) is out of stock.
                    Select an alternative below.
                  </p>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!substitutes?.length && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="text-gray-500 text-sm">No substitutes found for this medicine</p>
                  <p className="text-gray-400 text-xs mt-1">Molecule data may need to be updated</p>
                </div>
              )}
              {substitutes?.filter((s: any) => s.available_stock > 0).length > 0 && (
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">In Stock</p>
              )}
              {substitutes?.filter((s: any) => s.available_stock > 0).map((sub: any) => (
                <div key={sub.id} className="border-2 border-green-100 rounded-xl p-4 bg-green-50/30">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900">{sub.brand_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{sub.molecule} · {sub.strength} · {sub.dosage_form}</p>
                      <p className="text-xs text-gray-400">{sub.manufacturer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-[#00475a]">₹{Number(sub.sale_rate || sub.mrp).toFixed(2)}</p>
                      <p className="text-xs text-green-600 font-medium">{sub.available_stock} in stock</p>
                      {sub.rack_location && (
                        <p className="text-xs text-gray-400 flex items-center justify-end gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{sub.rack_location}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Brand not in stock', 'Patient preference', 'Better price', 'Doctor approved'].map(reason => (
                      <button key={reason}
                        onClick={async () => {
                          try {
                            const { data: batch } = await api.get(`/stock/${sub.id}/best-batch`);
                            if (!batch) { toast.error('No stock'); return; }
                            const idx = cart.findIndex(i => i.medicine_id === showSubstitutes);
                            if (idx >= 0) {
                              const updated = [...cart];
                              updated[idx] = {
                                ...updated[idx],
                                medicine_id: sub.id, batch_id: batch.id,
                                medicine_name: sub.brand_name, molecule: sub.molecule || '',
                                batch_number: batch.batch_number, expiry_date: batch.expiry_date,
                                rate: Number(batch.sale_rate), avl_qty: Number(batch.quantity),
                                is_substituted: true, original_medicine_id: showSubstitutes!,
                                substitution_reason: reason, schedule_class: sub.schedule_class,
                                rack_location: sub.rack_location || '',
                              };
                              setCart(updated);
                            } else {
                              // Add as new cart item
                              const newItem: CartItem = {
                                medicine_id: sub.id, batch_id: batch.id,
                                medicine_name: sub.brand_name, molecule: sub.molecule || '',
                                batch_number: batch.batch_number, expiry_date: batch.expiry_date,
                                qty: 0, rate: Number(batch.sale_rate),
                                line_discount_pct: 0, gst_percent: Number(sub.gst_percent || 0),
                                avl_qty: Number(batch.quantity), rack_location: sub.rack_location || '',
                                is_substituted: true, original_medicine_id: showSubstitutes!,
                                substitution_reason: reason, schedule_class: sub.schedule_class,
                                is_chronic: false, chronic_category: '', create_care_plan: false,
                              };
                              setCart(prev => [...prev, newItem]);
                            }
                            setShowSubstitutes(null);
                            setSubstitutesForMed(null);
                            toast.success(`✅ ${sub.brand_name} selected — ${reason}`);
                          } catch { toast.error('Failed to select substitute'); }
                        }}
                        className="text-xs text-[#00475a] border border-[#00475a]/30 bg-white px-3 py-1.5 rounded-lg hover:bg-teal-50 font-medium transition-colors">
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {substitutes?.filter((s: any) => s.available_stock === 0).length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Out of Stock Alternatives</p>
                  {substitutes?.filter((s: any) => s.available_stock === 0).map((sub: any) => (
                    <div key={sub.id} className="border border-gray-100 rounded-xl p-3 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-700 text-sm">{sub.brand_name}</p>
                          <p className="text-xs text-gray-400">{sub.molecule} · {sub.strength}</p>
                        </div>
                        <span className="text-xs text-red-400 font-medium">Out of stock</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { setShowSubstitutes(null); setSubstitutesForMed(null); }}
                className="w-full py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Dispense without substitute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Drug Interaction Check Modal ── */}
      {showDdiModal && ddiResult && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-red-100 bg-red-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-red-900">Drug Interaction Alert</h3>
                  <p className="text-xs text-red-600 mt-0.5">
                    {ddiResult.interactions.length} interaction{ddiResult.interactions.length > 1 ? 's' : ''} detected in this prescription
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {ddiResult.interactions.map((interaction: any, idx: number) => (
                <div key={idx} className={`rounded-xl p-4 border-2 ${
                  interaction.severity === 'HIGH' ? 'border-red-200 bg-red-50' :
                  interaction.severity === 'MODERATE' ? 'border-amber-200 bg-amber-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        interaction.severity === 'HIGH' ? 'bg-red-200 text-red-800' :
                        interaction.severity === 'MODERATE' ? 'bg-amber-200 text-amber-800' :
                        'bg-blue-200 text-blue-800'
                      }`}>
                        {interaction.severity}
                      </span>
                      <span className="text-xs text-gray-500">interaction</span>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm mb-1">
                    {interaction.drug1} + {interaction.drug2}
                  </p>
                  <p className="text-xs text-gray-700 mb-2">{interaction.effect}</p>
                  {interaction.recommendation && (
                    <div className="flex items-start gap-1.5 mt-2 p-2 bg-white/70 rounded-lg">
                      <Info className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-600">{interaction.recommendation}</p>
                    </div>
                  )}
                </div>
              ))}
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 text-center">
                  ⚕️ This is an advisory check. Clinical judgement of the pharmacist takes precedence.
                  All overrides are logged for audit.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setShowDdiModal(false); setDdiResult(null); setShowPreview(true); }}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600">
                Acknowledge & Proceed
              </button>
              <button
                onClick={() => { setShowDdiModal(false); setDdiResult(null); }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50">
                Review Prescription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DDI Checking overlay ── */}
      {ddiChecking && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex items-center gap-4 shadow-2xl">
            <Loader2 className="w-6 h-6 text-[#00475a] animate-spin" />
            <p className="text-sm font-medium text-gray-700">Checking drug interactions...</p>
          </div>
        </div>
      )}
      {demandQuery && (
        <LogDemandDialog
          query={demandQuery}
          onClose={() => setDemandQuery(null)}
        />
      )}
      {returnSale && (
        <ReturnMedicinesDialog
          saleId={returnSale.id}
          billNumber={returnSale.bill_number}
          onClose={() => setReturnSale(null)}
          onSuccess={() => { setReturnSale(null); refetch(); }}
        />
      )}
    </div>
  );
}
