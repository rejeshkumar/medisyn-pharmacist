'use client';
import PrescriptionScanner from '@/components/ai/PrescriptionScanner';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate, getScheduleClassColor, getConfidenceColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  Check, AlertTriangle, X, FileText,
  Loader2, Camera, ChevronUp, ClipboardList,
  ChevronDown, MapPin, Package, Tag, Info,
  RefreshCw,
} from 'lucide-react';
import BarcodeScanner from '@/components/dispensing/BarcodeScanner';
import BillDocument, { type BillData } from '@/components/billing/BillDocument';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────
interface CartItem {
  medicine_id: string;
  batch_id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  qty: number;
  rate: number;
  gst_percent: number;
  is_substituted: boolean;
  original_medicine_id?: string;
  substitution_reason?: string;
  schedule_class: string;
}

interface DraftBill {
  id: string;
  label: string;
  cart_data: CartItem[];
  compliance: { patient_name: string; doctor_name: string; doctor_reg_no: string };
  payment_mode: string;
  discount: number;
  updated_at: string;
}

// ── Schedule class config ──────────────────────────────────────────────────
const SCHEDULE_CONFIG: Record<string, { color: string; bg: string; border: string; banner?: string; bannerColor?: string }> = {
  OTC:  { color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  H:    { color: '#92400e', bg: '#fffbeb', border: '#fde68a',
          banner: 'Schedule H — Valid prescription required',
          bannerColor: '#92400e' },
  H1:   { color: '#9a3412', bg: '#fff7ed', border: '#fed7aa',
          banner: 'Schedule H1 — Restricted prescription (Kerala D&C Act)',
          bannerColor: '#9a3412' },
  X:    { color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca',
          banner: 'Schedule X — Narcotic · Form 17 register mandatory',
          bannerColor: '#7f1d1d' },
};

// ── BillSummaryContent (unchanged from original) ───────────────────────────
interface BillSummaryProps {
  hasScheduledDrugs: boolean;
  showCompliance: boolean;
  complianceData: { patient_name: string; doctor_name: string; doctor_reg_no: string };
  setComplianceData: (fn: (p: any) => any) => void;
  cart: CartItem[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  setDiscount: (v: number) => void;
  total: number;
  paymentMode: string;
  setPaymentMode: (v: string) => void;
  handleBill: () => void;
  isPending: boolean;
}

function BillSummaryContent({
  hasScheduledDrugs, showCompliance, complianceData, setComplianceData,
  cart, subtotal, taxTotal, discount, setDiscount, total,
  paymentMode, setPaymentMode, handleBill, isPending,
}: BillSummaryProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {hasScheduledDrugs && (
        <div className="mx-4 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex-shrink-0">
          <p className="text-xs font-medium text-orange-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Scheduled drug — compliance required
          </p>
        </div>
      )}
      {(hasScheduledDrugs || showCompliance) && (
        <div className="mx-4 mt-3 p-3 bg-gray-50 rounded-lg space-y-2 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-700">Compliance Details</p>
          <input type="text" className="input text-xs" placeholder="Patient name *"
            value={complianceData.patient_name}
            onChange={(e) => setComplianceData((p) => ({ ...p, patient_name: e.target.value }))} />
          <input type="text" className="input text-xs" placeholder="Doctor name *"
            value={complianceData.doctor_name}
            onChange={(e) => setComplianceData((p) => ({ ...p, doctor_name: e.target.value }))} />
          {cart.some((i) => i.schedule_class === 'X') && (
            <input type="text" className="input text-xs" placeholder="Doctor registration no. *"
              value={complianceData.doctor_reg_no}
              onChange={(e) => setComplianceData((p) => ({ ...p, doctor_reg_no: e.target.value }))} />
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>GST</span><span>{formatCurrency(taxTotal)}</span>
          </div>
          <div className="flex justify-between items-center text-gray-600">
            <span>Discount</span>
            <div className="flex items-center gap-1">
              <span>₹</span>
              <input type="number"
                className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right"
                value={discount} min={0}
                onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900 text-base">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1.5">Payment Mode</p>
          <div className="grid grid-cols-3 gap-1.5">
            {['cash', 'card', 'upi'].map((mode) => (
              <button key={mode} onClick={() => setPaymentMode(mode)}
                className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  paymentMode === mode
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-200 text-gray-600 hover:border-primary-400'
                }`}>
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <button onClick={handleBill} disabled={cart.length === 0 || isPending}
          className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generate Bill
        </button>
      </div>
    </div>
  );
}

// ── Enhanced Medicine Search Card ──────────────────────────────────────────
function MedicineCard({ med, onAdd }: { med: any; onAdd: (med: any) => void }) {
  const [showBatches, setShowBatches] = useState(false);
  const stockRaw  = med.total_stock;
  const isUnknown = stockRaw === undefined || stockRaw === null;
  const stock     = isUnknown ? 0 : Number(stockRaw);
  const isOOS     = !isUnknown && stock <= 0;
  const isLow     = !isUnknown && stock > 0 && stock < 10;
  const isX      = med.schedule_class === 'X';
  const isH      = ['H', 'H1'].includes(med.schedule_class);
  const fefo     = med.fefo_batch;
  const allBatch = med.all_batches ?? [];
  const subCnt   = Number(med.substitute_count ?? 0);
  const cfg      = SCHEDULE_CONFIG[med.schedule_class] ?? SCHEDULE_CONFIG.OTC;
  const needsReorder = med.reorder_qty > 0 && stock <= med.reorder_qty;

  const daysExp = fefo?.expiry_date
    ? Math.floor((new Date(fefo.expiry_date).getTime() - Date.now()) / 86400000)
    : 999;

  return (
    <div className={`border-b border-gray-50 last:border-0 ${isOOS ? 'bg-gray-50/70' : ''}`}>
      {/* Schedule banners */}
      {(isX || isH) && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cfg.color }} />
          <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.banner}</span>
        </div>
      )}

      <button onClick={() => (!isOOS || isUnknown) && onAdd(med)} disabled={isOOS && !isUnknown}
        className={`w-full px-4 py-3 text-left transition-colors ${isOOS ? 'cursor-not-allowed' : 'hover:bg-teal-50/30'}`}>

        {/* Row 1: Name + schedule badge + stock */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <p className={`text-sm font-bold truncate ${isOOS ? 'text-gray-400' : 'text-gray-900'}`}>
              {med.brand_name}
            </p>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold border"
              style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
              {med.schedule_class}
            </span>
          </div>
          <span className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            isUnknown ? 'bg-slate-50 text-slate-500 border-slate-200'
            : isOOS ? 'bg-red-50 text-red-600 border-red-200'
            : isLow ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isUnknown ? 'bg-slate-400' : isOOS ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-green-500'}`} />
            {isUnknown ? 'Tap to add' : isOOS ? 'Out of stock' : isLow ? `Only ${stock} left` : `${stock} in stock`}
          </span>
        </div>

        {/* Row 2: Molecule · strength · form */}
        <div className="flex items-center gap-1 flex-wrap text-xs mb-1">
          {med.molecule && <span className="text-[#00475a] font-medium">{med.molecule}</span>}
          {med.molecule && (med.strength || med.dosage_form) && <span className="text-gray-300">·</span>}
          {med.strength && <span className="text-gray-500">{med.strength}</span>}
          {med.dosage_form && <span className="text-gray-400">{med.dosage_form}</span>}
        </div>

        {/* Row 3: Manufacturer + rack + treatment */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] mb-1.5">
          {med.manufacturer && (
            <span className="flex items-center gap-1 text-gray-500">
              <Tag className="w-2.5 h-2.5" />{med.manufacturer}
            </span>
          )}
          {med.rack_location && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              <MapPin className="w-2.5 h-2.5" />Rack: {med.rack_location}
            </span>
          )}
          {med.treatment_for && (
            <span className="text-purple-600 font-medium">{med.treatment_for}</span>
          )}
        </div>

        {/* Row 4: Pricing + expiry */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            {med.mrp && (
              <span className="text-[10px] text-gray-400">
                MRP <span className="line-through">₹{Number(med.mrp).toFixed(2)}</span>
              </span>
            )}
            {fefo?.sale_rate && (
              <span className="text-sm font-black text-gray-900">
                ₹{Number(fefo.sale_rate).toFixed(2)}
              </span>
            )}
            {!fefo?.sale_rate && med.sale_rate && (
              <span className="text-sm font-black text-gray-900">
                ₹{Number(med.sale_rate).toFixed(2)}
              </span>
            )}
            {Number(med.gst_percent) > 0 && (
              <span className="text-[10px] text-gray-400">+{med.gst_percent}% GST</span>
            )}
          </div>
          {fefo?.expiry_date && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${
              daysExp < 30 ? 'bg-red-50 text-red-600'
              : daysExp < 90 ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-50 text-gray-500'
            }`}>
              Exp {new Date(fefo.expiry_date).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}
              · {fefo.batch_number}
              {daysExp < 30 && ' ⚠️'}
            </span>
          )}
        </div>

        {/* Row 5: Reorder warning + substitute count + batches toggle */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {needsReorder && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded font-semibold flex items-center gap-1">
              <Package className="w-2.5 h-2.5" />Reorder needed (min: {med.reorder_qty})
            </span>
          )}
          {subCnt > 0 && (
            <span className="text-[10px] text-[#00475a] font-medium">
              ↔ {subCnt} substitute{subCnt > 1 ? 's' : ''} available
            </span>
          )}
          {allBatch.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowBatches(v => !v); }}
              className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5 hover:underline"
            >
              <Info className="w-2.5 h-2.5" />
              {allBatch.length} batches {showBatches ? '▲' : '▼'}
            </button>
          )}
        </div>
      </button>

      {/* All batches expandable panel */}
      {showBatches && allBatch.length > 0 && (
        <div className="mx-3 mb-2 border border-blue-100 rounded-xl overflow-hidden bg-blue-50/30">
          <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100">
            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">All batches in stock</p>
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-blue-600 font-semibold">
                <td className="px-3 py-1">Batch</td>
                <td className="px-3 py-1">Expiry</td>
                <td className="px-3 py-1 text-right">Qty</td>
                <td className="px-3 py-1 text-right">Rate</td>
              </tr>
            </thead>
            <tbody>
              {allBatch.map((b: any, i: number) => (
                <tr key={b.id} className={`${i === 0 ? 'font-semibold text-green-700' : 'text-gray-600'} border-t border-blue-100`}>
                  <td className="px-3 py-1">{b.batch_number} {i === 0 && <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">FEFO</span>}</td>
                  <td className={`px-3 py-1 ${b.days_to_expiry < 30 ? 'text-red-600 font-semibold' : b.days_to_expiry < 90 ? 'text-amber-600' : ''}`}>
                    {new Date(b.expiry_date).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}
                    {b.days_to_expiry < 30 && ' ⚠️'}
                  </td>
                  <td className="px-3 py-1 text-right">{b.quantity}</td>
                  <td className="px-3 py-1 text-right">₹{Number(b.sale_rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Multi-Bill Tab Bar ─────────────────────────────────────────────────────
function BillTabs({
  drafts, activeDraftId, onSelect, onNew, onClose, loading,
}: {
  drafts: DraftBill[];
  activeDraftId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50 overflow-x-auto flex-shrink-0">
      {/* Current unsaved bill tab */}
      <button
        onClick={() => onSelect('current')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
          activeDraftId === 'current'
            ? 'bg-[#00475a] text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        Current bill
      </button>

      {/* Saved draft tabs */}
      {drafts.map(d => (
        <div key={d.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 border transition-all ${
            activeDraftId === d.id
              ? 'bg-[#00475a] text-white border-[#00475a]'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <button onClick={() => onSelect(d.id)} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="max-w-[120px] truncate">{d.label || 'Held bill'}</span>
            {d.cart_data?.length > 0 && (
              <span className={`text-[10px] px-1.5 rounded-full ${
                activeDraftId === d.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {d.cart_data.length}
              </span>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(d.id); }}
            className="ml-1 opacity-60 hover:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}

      {/* Hold current + new bill button */}
      <button onClick={onNew} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 border border-dashed border-gray-300 text-gray-500 hover:border-[#00475a] hover:text-[#00475a] transition-all"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Hold & new bill
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DispensingPage() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showSubstitutes, setShowSubstitutes] = useState<string | null>(null);
  const [complianceData, setComplianceData] = useState({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
  const [showCompliance, setShowCompliance] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [rxImage, setRxImage] = useState<File | null>(null);
  const [aiPrescriptionId, setAiPrescriptionId] = useState<string | null>(null);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  const [showBillPanel, setShowBillPanel] = useState(false);
  const [pendingRxCount, setPendingRxCount] = useState(0);
  const [showRxPanel, setShowRxPanel] = useState(false);
  const [activePrescriptionId, setActivePrescriptionId] = useState<string | null>(null);

  // Multi-bill state
  const [drafts, setDrafts]               = useState<DraftBill[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string>('current');
  const [holdingBill, setHoldingBill]     = useState(false);
  const [billLabel, setBillLabel]         = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Load drafts on mount
  const loadDrafts = useCallback(async () => {
    try {
      const r = await api.get('/draft-bills');
      setDrafts(r.data || []);
    } catch { /* drafts optional */ }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  // ── Hold current bill + start new ─────────────────────────────────────
  const holdAndNew = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    setHoldingBill(true);
    try {
      const label = complianceData.patient_name
        ? `Patient: ${complianceData.patient_name}`
        : `Bill ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      if (activeDraftId !== 'current') {
        // Update existing draft
        await api.patch(`/draft-bills/${activeDraftId}`, {
          label, cart_data: cart, compliance: complianceData,
          payment_mode: paymentMode, discount,
        });
      } else {
        // Save as new draft
        const r = await api.post('/draft-bills', {
          label, cart_data: cart, compliance: complianceData,
          payment_mode: paymentMode, discount,
        });
        // Switch to the saved draft id so it can be updated later
        await loadDrafts();
      }
      // Reset current bill
      setCart([]);
      setComplianceData({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
      setDiscount(0);
      setPaymentMode('cash');
      setActiveDraftId('current');
      setSearch('');
      toast.success(`Bill held — start a new one`);
      await loadDrafts();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to hold bill');
    } finally {
      setHoldingBill(false);
    }
  };

  // ── Switch to a draft ──────────────────────────────────────────────────
  const switchToDraft = async (draftId: string) => {
    if (draftId === 'current') {
      setActiveDraftId('current');
      return;
    }
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    // Save current cart to current draft first if there's anything
    setCart(draft.cart_data || []);
    setComplianceData(draft.compliance || { patient_name: '', doctor_name: '', doctor_reg_no: '' });
    setPaymentMode(draft.payment_mode || 'cash');
    setDiscount(Number(draft.discount) || 0);
    setActiveDraftId(draftId);
    setSearch('');
  };

  // ── Abandon a draft ────────────────────────────────────────────────────
  const abandonDraft = async (draftId: string) => {
    try {
      await api.delete(`/draft-bills/${draftId}`);
      if (activeDraftId === draftId) {
        setActiveDraftId('current');
        setCart([]);
        setComplianceData({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
      }
      await loadDrafts();
      toast.success('Bill removed');
    } catch { toast.error('Failed to remove bill'); }
  };

  const { data: medicines } = useQuery({
    queryKey: ['medicines-search', search],
    queryFn: () =>
      search.length >= 2
        ? api.get(`/medicines/search-enriched?search=${search}&limit=15`)
            .then((r) => r.data)
            .catch(() => api.get(`/medicines?search=${search}&limit=15`).then((r) => r.data))
        : Promise.resolve([]),
    enabled: search.length >= 2,
  });

  const { data: substitutes } = useQuery({
    queryKey: ['substitutes', showSubstitutes],
    queryFn: () => api.get(`/substitutes?medicine_id=${showSubstitutes}`).then((r) => r.data),
    enabled: !!showSubstitutes,
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: any) => api.post('/sales', payload).then((r) => r.data),
    onSuccess: async (data) => {
      setShowPreview(false);
      setCompletedSale(data);
      setCart([]);
      setComplianceData({ patient_name: '', doctor_name: '', doctor_reg_no: '' });
      setDiscount(0);
      setAiResult(null);
      setAiPrescriptionId(null);
      setShowBillPanel(false);
      // Mark draft as confirmed if billing from a draft
      if (activeDraftId !== 'current') {
        await api.patch(`/draft-bills/${activeDraftId}/confirm`, {}).catch(() => {});
        setActiveDraftId('current');
        await loadDrafts();
      }
      if (activePrescriptionId) {
        api.patch(`/prescriptions/${activePrescriptionId}/dispense`, { sale_id: data.id }).catch(() => {});
        setActivePrescriptionId(null);
      }
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['dispensing-queue'] });
      toast.success(`Bill ${data.bill_number} created!`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Bill creation failed'),
  });

  const handleAddMedicine = async (medicine: any) => {
    try {
      const { data: bestBatch } = await api.get(`/stock/${medicine.id}/best-batch`);
      if (!bestBatch) {
        if (medicine.id) {
          setShowSubstitutes(medicine.id);
          toast('No stock available. Showing substitutes.', { icon: '⚠️' });
        }
        return;
      }
      const existing = cart.findIndex(
        (i) => i.medicine_id === medicine.id && i.batch_id === bestBatch.id,
      );
      if (existing !== -1) {
        const updated = [...cart];
        updated[existing].qty += 1;
        setCart(updated);
      } else {
        setCart((prev) => [...prev, {
          medicine_id:   medicine.id,
          batch_id:      bestBatch.id,
          medicine_name: medicine.brand_name,
          batch_number:  bestBatch.batch_number,
          expiry_date:   bestBatch.expiry_date,
          qty:           1,
          rate:          Number(bestBatch.sale_rate),
          gst_percent:   Number(medicine.gst_percent || 0),
          is_substituted: false,
          schedule_class: medicine.schedule_class,
        }]);
      }
      setSearch('');
      if (['H', 'H1', 'X'].includes(medicine.schedule_class)) {
        setShowCompliance(true);
        toast('Compliance details required for scheduled drug', { icon: '🔐' });
      }
    } catch {
      toast.error('Failed to fetch stock');
    }
  };

  const handleLoadPrescription = async ({ prescriptionId, patientName, doctorName, items }: any) => {
    setActivePrescriptionId(prescriptionId);
    setComplianceData(p => ({
      ...p,
      patient_name: patientName || p.patient_name,
      doctor_name:  doctorName  || p.doctor_name,
    }));
    let loaded = 0;
    for (const item of items) {
      if (item.medicine_id) {
        await handleAddMedicine({
          id: item.medicine_id, brand_name: item.medicine_name,
          gst_percent: 0, schedule_class: 'OTC',
        });
        loaded++;
      }
    }
    setShowRxPanel(false);
    if (loaded > 0) toast.success(`${loaded} medicine(s) loaded from prescription`);
    else toast('Prescription loaded — add medicines manually', { icon: '⚠️' });
  };

  const handleSubstitute = async (original: CartItem, substitute: any, reason: string) => {
    const { data: bestBatch } = await api.get(`/stock/${substitute.id}/best-batch`);
    if (!bestBatch) { toast.error('No stock for this substitute'); return; }
    setCart((prev) => prev.map((item) =>
      item.medicine_id === original.medicine_id
        ? { ...item, medicine_id: substitute.id, batch_id: bestBatch.id,
            medicine_name: substitute.brand_name, batch_number: bestBatch.batch_number,
            expiry_date: bestBatch.expiry_date, rate: Number(bestBatch.sale_rate),
            is_substituted: true, original_medicine_id: original.medicine_id,
            substitution_reason: reason, schedule_class: substitute.schedule_class }
        : item,
    ));
    setShowSubstitutes(null);
    toast.success('Substitute selected');
  };

  const subtotal = cart.reduce((sum, i) => sum + i.qty * Number(i.rate), 0);
  const taxTotal = cart.reduce((sum, i) => sum + (i.qty * Number(i.rate) * i.gst_percent) / 100, 0);
  const total    = subtotal + taxTotal - discount;
  const hasScheduledDrugs = cart.some((i) => ['H', 'H1', 'X'].includes(i.schedule_class));

  const buildPayload = () => ({
    customer_name:    complianceData.patient_name,
    doctor_name:      complianceData.doctor_name,
    doctor_reg_no:    complianceData.doctor_reg_no,
    prescription_id:  activePrescriptionId,
    items: cart.map((i) => ({
      medicine_id: i.medicine_id, batch_id: i.batch_id, qty: i.qty,
      rate: i.rate, gst_percent: i.gst_percent, is_substituted: i.is_substituted,
      original_medicine_id: i.original_medicine_id, substitution_reason: i.substitution_reason,
    })),
    discount_amount:    discount,
    payment_mode:       paymentMode,
    ai_prescription_id: aiPrescriptionId,
    compliance_data:    hasScheduledDrugs ? complianceData : undefined,
  });

  const handleBill = () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (hasScheduledDrugs && (!complianceData.patient_name || !complianceData.doctor_name)) {
      setShowCompliance(true); setShowBillPanel(true);
      toast.error('Compliance details required for scheduled drugs');
      return;
    }
    setShowPreview(true);
  };

  const handleFileUpload = async (file: File) => {
    setRxImage(file); setAiExtracting(true);
    const formData = new FormData();
    formData.append('file', file);
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
            if (result.patient_name) setComplianceData((p) => ({ ...p, patient_name: result.patient_name }));
            if (result.doctor_name)  setComplianceData((p) => ({ ...p, doctor_name:  result.doctor_name }));
          }
        }
        if (result.status === 'failed') {
          clearInterval(poll); setAiExtracting(false);
          toast.error('Prescription scan failed', { duration: 8000 });
        }
      }, 2000);
    } catch { setAiExtracting(false); toast.error('Upload failed'); }
  };

  const handleApproveAi = async () => {
    for (const med of aiResult?.extraction_json?.medicines || []) {
      if (med.matched_medicine_id) {
        await handleAddMedicine({ id: med.matched_medicine_id, brand_name: med.matched_medicine_name || med.name,
          gst_percent: 0, schedule_class: 'OTC' });
      }
    }
    setShowAiReview(false);
    toast.success('Medicines added from prescription');
  };

  const billSummaryProps: BillSummaryProps = {
    hasScheduledDrugs, showCompliance, complianceData, setComplianceData,
    cart, subtotal, taxTotal, discount, setDiscount, total,
    paymentMode, setPaymentMode, handleBill,
    isPending: createSaleMutation.isPending,
  };

  const previewBillData: BillData = {
    patientName:  complianceData.patient_name || undefined,
    doctorName:   complianceData.doctor_name  || undefined,
    doctorRegNo:  complianceData.doctor_reg_no|| undefined,
    paymentMode,
    items: cart.map((i) => ({
      medicineName: i.medicine_name, batchNumber: i.batch_number,
      expiryDate: i.expiry_date, qty: i.qty, rate: i.rate, gstPercent: i.gst_percent,
      itemTotal: i.qty * i.rate + (i.qty * Number(i.rate) * i.gst_percent) / 100,
      isSubstituted: i.is_substituted,
    })),
    subtotal, taxAmount: taxTotal, discountAmount: discount, totalAmount: total,
    hasScheduledDrugs,
  };

  return (
    <div className="flex h-full overflow-hidden flex-col">

      {/* ── Multi-bill tab bar ── */}
      <BillTabs
        drafts={drafts}
        activeDraftId={activeDraftId}
        onSelect={switchToDraft}
        onNew={holdAndNew}
        onClose={abandonDraft}
        loading={holdingBill}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Prescription Bridge sidebar ── */}
        <div className={cn('flex-shrink-0 border-r border-gray-100 bg-white transition-all duration-200 overflow-hidden',
          showRxPanel ? 'w-72' : 'w-0')}>
        </div>

        {/* ── Main cart area ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" className="input pl-9 w-full"
                  placeholder="Search medicine by brand, molecule or condition..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus />
                {search.length >= 2 && medicines?.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 max-h-[520px] overflow-y-auto">
                    {medicines.map((med: any) => (
                      <MedicineCard key={med.id} med={med} onAdd={handleAddMedicine} />
                    ))}
                  </div>
                )}
                {search.length >= 2 && medicines?.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-4 text-center text-sm text-gray-400">
                    No medicines found for "{search}"
                  </div>
                )}
              </div>
              <button onClick={() => setShowRxPanel(v => !v)}
                className={cn('btn-secondary flex items-center gap-2 flex-shrink-0 relative',
                  showRxPanel && 'bg-teal-50 border-teal-300 text-teal-700',
                  pendingRxCount > 0 && !showRxPanel && 'border-amber-400 text-amber-700 bg-amber-50')}>
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Prescriptions</span>
                {pendingRxCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                    {pendingRxCount}
                  </span>
                )}
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="btn-secondary flex items-center gap-2 flex-shrink-0">
                {aiExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span className="hidden sm:inline">{aiExtracting ? 'Extracting...' : 'Upload Rx'}</span>
              </button>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
            </div>
            {activePrescriptionId && (
              <div className="mt-2 flex items-center gap-2 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Prescription loaded — will be marked as dispensed after billing</span>
                <button onClick={() => setActivePrescriptionId(null)} className="ml-auto text-teal-500 hover:text-teal-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* AI Review panel */}
          {showAiReview && aiResult && (
            <div className="m-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900">AI Extracted Medicines</h3>
                <button onClick={() => setShowAiReview(false)} className="text-blue-400 hover:text-blue-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-blue-600 mb-3">
                {aiResult.confidence_summary} · Patient: {aiResult.patient_name || '-'} · Dr: {aiResult.doctor_name || '-'}
              </p>
              <div className="space-y-2">
                {aiResult.extraction_json?.medicines?.map((med: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-blue-100">
                    <span className={`badge text-xs ${getConfidenceColor(med.confidence)}`}>{med.confidence}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{med.name}</p>
                      <p className="text-xs text-gray-500">
                        {med.strength} · {med.frequency} · {med.duration}
                        {med.matched_medicine_name && <span className="text-green-600"> → {med.matched_medicine_name}</span>}
                      </p>
                    </div>
                    {!med.matched_medicine_id && <span className="text-xs text-red-500">No match</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleApproveAi} className="btn-primary flex-1">
                  <Check className="w-4 h-4 inline mr-1" />Approve & Add to Cart
                </button>
                <button onClick={() => setShowAiReview(false)} className="btn-secondary">Dismiss</button>
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-20 lg:pb-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-1">Search medicines above or upload a prescription</p>
                {drafts.length > 0 && (
                  <p className="text-xs mt-3 text-amber-600">
                    {drafts.length} held bill{drafts.length > 1 ? 's' : ''} — click a tab above to resume
                  </p>
                )}
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.medicine_id}-${item.batch_id}`}
                  className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{item.medicine_name}</p>
                        {item.is_substituted && (
                          <span className="badge bg-blue-50 text-blue-600 border-blue-200 text-xs">Substituted</span>
                        )}
                        <span className={`badge text-xs ${getScheduleClassColor(item.schedule_class)}`}>
                          {item.schedule_class}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Batch {item.batch_number} · Exp {formatDate(item.expiry_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => {
                        const updated = [...cart];
                        if (updated[idx].qty > 1) updated[idx].qty -= 1;
                        else updated.splice(idx, 1);
                        setCart(updated);
                      }} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                      <button onClick={() => {
                        const updated = [...cart];
                        updated[idx].qty += 1;
                        setCart(updated);
                      }} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold text-gray-900 w-16 text-right">
                        {formatCurrency(item.qty * item.rate)}
                      </span>
                      <button onClick={() => setShowSubstitutes(item.medicine_id)}
                        className="text-xs text-primary-600 hover:underline px-1 hidden sm:block">Sub</button>
                      <button onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                        className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Mobile: sticky bottom bar ── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-white border-t border-gray-100 shadow-lg">
          <button onClick={() => setShowBillPanel(true)}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span>Bill Summary</span>
            <span className="font-bold">· {formatCurrency(total)}</span>
            {cart.length > 0 && (
              <span className="bg-white text-primary-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center ml-1">
                {cart.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Mobile: slide-up bill sheet ── */}
        {showBillPanel && (
          <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowBillPanel(false)} />
            <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <h2 className="font-semibold text-gray-900">Bill Summary</h2>
                <button onClick={() => setShowBillPanel(false)} className="text-gray-400 hover:text-gray-600">
                  <ChevronUp className="w-5 h-5" />
                </button>
              </div>
              <BillSummaryContent {...billSummaryProps} />
            </div>
          </div>
        )}

        {/* ── Desktop: fixed right panel ── */}
        <div className="hidden lg:flex w-80 border-l border-gray-100 bg-white flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h2 className="font-semibold text-gray-900">
              Bill Summary
              {activeDraftId !== 'current' && (
                <span className="ml-2 text-xs text-amber-600 font-normal">
                  (held bill)
                </span>
              )}
            </h2>
          </div>
          <BillSummaryContent {...billSummaryProps} />
        </div>
      </div>

      {/* ── Modals ── */}
      {showPreview && (
        <BillDocument data={previewBillData} mode="preview"
          onClose={() => setShowPreview(false)}
          onConfirm={() => createSaleMutation.mutate(buildPayload())}
          isLoading={createSaleMutation.isPending} />
      )}
      {completedSale && (
        <BillDocument
          data={{
            billNumber: completedSale.bill_number, date: completedSale.created_at,
            pharmacist: completedSale.pharmacist?.name,
            patientName: completedSale.customer_name, doctorName: completedSale.doctor_name,
            doctorRegNo: completedSale.doctor_reg_no, paymentMode: completedSale.payment_mode,
            items: completedSale.items?.map((item: any) => ({
              medicineName: item.medicine?.brand_name || item.medicine_name,
              batchNumber: item.batch?.batch_number || item.batch_number,
              expiryDate: item.batch?.expiry_date, qty: item.qty,
              rate: Number(item.rate), gstPercent: Number(item.gst_percent),
              itemTotal: Number(item.item_total), isSubstituted: item.is_substituted,
            })) || [],
            subtotal: Number(completedSale.subtotal),
            taxAmount: Number(completedSale.tax_amount),
            discountAmount: Number(completedSale.discount_amount),
            totalAmount: Number(completedSale.total_amount),
            hasScheduledDrugs: completedSale.has_scheduled_drugs,
          }}
          mode="print" onClose={() => setCompletedSale(null)} />
      )}
      {showSubstitutes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Available Alternatives</h3>
              <button onClick={() => setShowSubstitutes(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {substitutes?.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No substitutes found</p>
                </div>
              )}
              {substitutes?.map((sub: any) => (
                <div key={sub.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{sub.brand_name}</p>
                      <p className="text-xs text-gray-500">{sub.molecule} · {sub.strength} · {sub.dosage_form}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(sub.sale_rate || sub.mrp)}</p>
                      <p className={`text-xs font-medium ${sub.available_stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {sub.available_stock} in stock
                      </p>
                    </div>
                  </div>
                  {sub.available_stock > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['Brand not in stock', 'Patient preference', 'Better price', 'Doctor approved'].map((reason) => (
                        <button key={reason}
                          onClick={() => {
                            const original = cart.find((i) => i.medicine_id === showSubstitutes);
                            if (original) handleSubstitute(original, sub, reason);
                          }}
                          className="text-xs text-primary-600 border border-primary-200 px-2 py-1 rounded-lg hover:bg-primary-50">
                          {reason}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
