'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, Plus, Minus, Trash2, CheckCircle2, Loader2,
  Stethoscope, FlaskConical, Pill, Wrench, Star, ChevronDown,
  Receipt, X,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────
const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => n(v).toFixed(2);

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  consultation: { label: 'Consultation',     icon: Stethoscope, color: 'text-blue-600 bg-blue-50' },
  lab:          { label: 'Lab & diagnostics', icon: FlaskConical, color: 'text-purple-600 bg-purple-50' },
  pharmacy:     { label: 'Pharmacy',          icon: Pill,         color: 'text-green-600 bg-green-50' },
  procedure:    { label: 'Procedures',        icon: Wrench,       color: 'text-amber-600 bg-amber-50' },
  other:        { label: 'Other',             icon: Receipt,      color: 'text-slate-600 bg-slate-50' },
};

interface LineItem {
  category: string;
  name: string;
  qty: number;
  unit_rate: number;
  gst_percent: number;
  source?: string;
  source_id?: string;
}

// ── Add service modal ─────────────────────────────────────────
function AddServiceModal({
  onAdd, onClose,
}: { onAdd: (item: LineItem) => void; onClose: () => void }) {
  const [category, setCategory] = useState('lab');
  const [catalog, setCatalog]   = useState<any[]>([]);
  const [search, setSearch]     = useState('');
  const [custom, setCustom]     = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [customGst, setCustomGst]   = useState('0');

  useEffect(() => {
    api.get(`/service-rates?category=${category}`)
      .then(r => setCatalog(r.data || []))
      .catch(() => setCatalog([]));
  }, [category]);

  const filtered = catalog.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const addFromCatalog = (svc: any) => {
    onAdd({
      category,
      name: svc.name,
      qty: 1,
      unit_rate: n(svc.rate),
      gst_percent: n(svc.gst_percent),
    });
    onClose();
  };

  const addCustom = () => {
    if (!customName.trim() || !customRate) {
      toast.error('Name and rate are required');
      return;
    }
    onAdd({
      category,
      name: customName.trim(),
      qty: 1,
      unit_rate: n(customRate),
      gst_percent: n(customGst),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Add service</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          {/* Category selector */}
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(CATEGORY_META).filter(([k]) => k !== 'pharmacy').map(([k, v]) => (
              <button key={k}
                onClick={() => { setCategory(k); setSearch(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  category === k
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!custom ? (
            <>
              {filtered.map(svc => (
                <button key={svc.id}
                  onClick={() => addFromCatalog(svc)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{svc.name}</p>
                    <p className="text-xs text-slate-400">{svc.unit} · GST {svc.gst_percent}%</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">₹{fmt(svc.rate)}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No services found</p>
              )}
              <button
                onClick={() => setCustom(true)}
                className="w-full mt-2 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-[#00475a] hover:text-[#00475a] transition-colors"
              >
                + Enter custom service
              </button>
            </>
          ) : (
            <div className="space-y-3 p-1">
              <button onClick={() => setCustom(false)} className="text-xs text-[#00475a] flex items-center gap-1">
                ← Back to catalog
              </button>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Service name *</label>
                <input type="text" value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]"
                  placeholder="e.g. Special dressing"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Rate (₹) *</label>
                  <input type="number" min="0" value={customRate}
                    onChange={e => setCustomRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">GST %</label>
                  <input type="number" min="0" max="28" value={customGst}
                    onChange={e => setCustomGst(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]"
                  />
                </div>
              </div>
              <button onClick={addCustom}
                className="w-full py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-medium hover:bg-[#003d4d]">
                Add to bill
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main billing page ──────────────────────────────────────────
export default function ReceptionistBillingPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'today' | 'manual'>('today');
  const [selectedEncounter, setSelectedEncounter] = useState<any>(null);
  const [encounterDetail, setEncounterDetail] = useState<any>(null);
  const [loadingEncounter, setLoadingEncounter] = useState(false);

  // Today's encounters
  const { data: todayEncounters = [], refetch: refetchEncounters } = useQuery({
    queryKey: ['today-encounters'],
    queryFn: () => api.get('/encounters/today').then(r => r.data),
    refetchInterval: 30000,
  });

  const loadEncounterDetail = async (queueId: string) => {
    setLoadingEncounter(true);
    try {
      const r = await api.get(`/encounters/${queueId}/summary`);
      setEncounterDetail(r.data);
      setSelectedEncounter(queueId);
      // Pre-populate items from encounter services
      const svcItems: LineItem[] = (r.data.services || [])
        .filter((s: any) => s.status !== 'cancelled')
        .map((s: any) => ({
          category: s.category || 'procedure',
          name: s.name,
          qty: 1,
          unit_rate: Number(s.price),
          gst_percent: Number(s.gst_percent || 0),
          source: 'encounter_service',
          source_id: s.id,
        }));
      // Add consultation fee
      if (r.data.summary?.consultation_fee > 0) {
        svcItems.unshift({
          category: 'consultation',
          name: `Consultation — ${r.data.queue?.visit_type || 'new visit'}`,
          qty: 1,
          unit_rate: Number(r.data.summary.consultation_fee),
          gst_percent: 0,
          source: 'consultation',
        });
      }
      setItems(svcItems);
      // Set patient
      if (r.data.queue?.patient_id) {
        setSelectedPatient({ id: r.data.queue.patient_id, first_name: r.data.queue.patient_name });
      }
    } catch (e: any) {
      toast.error('Failed to load encounter');
    } finally {
      setLoadingEncounter(false);
    }
  };

  const [patientSearch, setPatientSearch]   = useState('');
  const [patients, setPatients]             = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [vipInfo, setVipInfo]               = useState<any>(null);
  const [items, setItems]                   = useState<LineItem[]>([]);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [paymentMode, setPaymentMode]       = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [extraDiscountPct, setExtraDiscountPct] = useState('');
  const [extraDiscountNote, setExtraDiscountNote] = useState('');
  const [notes, setNotes]                   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [doneBill, setDoneBill]             = useState<any>(null);

  // Patient search
  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setPatients([]); return; }
    setSearchingPatients(true);
    try {
      const r = await api.get(`/patients?search=${encodeURIComponent(q)}&limit=8`);
      setPatients(r.data?.data || r.data || []);
    } catch { setPatients([]); }
    finally { setSearchingPatients(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 350);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  const selectPatient = async (p: any) => {
    setSelectedPatient(p);
    setPatients([]);
    setPatientSearch('');
    // Load VIP info
    try {
      const r = await api.get(`/patients/${p.id}/vip`);
      setVipInfo(r.data);
    } catch { setVipInfo(null); }
  };

  const addItem = (item: LineItem) => {
    setItems(prev => [...prev, item]);
  };

  const updateItem = (idx: number, field: 'qty' | 'unit_rate', value: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Live totals ──────────────────────────────────────────────
  const subtotal = items.reduce((s, it) => s + n(it.unit_rate) * it.qty, 0);
  const gstAmt   = items.reduce((s, it) => s + (n(it.unit_rate) * it.qty * n(it.gst_percent) / 100), 0);

  // Per-category VIP discount
  const vipDiscAmt = vipInfo?.tier
    ? items.reduce((s, it) => {
        let pct = 0;
        if (it.category === 'consultation') pct = n(vipInfo.doctor_discount);
        else if (it.category === 'pharmacy')     pct = n(vipInfo.pharmacy_discount);
        else if (it.category === 'lab')          pct = n(vipInfo.lab_discount);
        return s + (n(it.unit_rate) * it.qty * pct / 100);
      }, 0)
    : 0;

  const extraPct  = n(extraDiscountPct);
  const extraAmt  = extraPct > 0 ? ((subtotal + gstAmt - vipDiscAmt) * extraPct / 100) : 0;
  const total     = Math.max(0, subtotal + gstAmt - vipDiscAmt - extraAmt);

  // ── Submit bill ──────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return; }
    if (items.length === 0) { toast.error('Add at least one service'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/clinic-bills', {
        patient_id:          selectedPatient.id,
        items,
        payment_mode:        paymentMode,
        extra_discount_pct:  extraPct,
        extra_discount_note: extraDiscountNote || undefined,
        notes:               notes || undefined,
      });
      setDoneBill(res.data);
      toast.success(`Bill ${res.data.bill_number} created`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setDoneBill(null);
    setSelectedPatient(null);
    setVipInfo(null);
    setItems([]);
    setPatientSearch('');
    setExtraDiscountPct('');
    setExtraDiscountNote('');
    setNotes('');
    setPaymentMode('cash');
  };

  // ── Done screen ──────────────────────────────────────────────
  const doneBillScreen = doneBill ? (
    <div className="p-6 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Bill confirmed</h2>
        <p className="text-slate-500 text-sm mb-5">
          Receipt: <span className="font-semibold text-slate-700">{doneBill.bill_number}</span>
        </p>
        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">₹{fmt(doneBill.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">GST</span><span className="font-medium">₹{fmt(doneBill.gst_amount)}</span></div>
          {n(doneBill.vip_discount_amount) > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>VIP discount</span>
              <span>−₹{fmt(doneBill.vip_discount_amount)}</span>
            </div>
          )}
          {n(doneBill.extra_discount_amt) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Extra discount</span>
              <span>−₹{fmt(doneBill.extra_discount_amt)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 mt-1">
            <span>Total paid</span>
            <span className="text-[#00475a]">₹{fmt(doneBill.total_amount)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={reset}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            New bill
          </button>
          <button onClick={() => router.push('/receptionist')}
            className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-medium hover:bg-[#003d4d]">
            Back to queue
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="p-6 max-w-3xl">
      {doneBillScreen}
      {!doneBill && <>
      <h1 className="text-xl font-bold text-slate-900 mb-1">Billing</h1>
      <p className="text-sm text-slate-400 mb-4">Collect consultation fees and service charges</p>

      {/* Tab selector */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-4">
        <button onClick={() => setActiveTab('today')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'today' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
          Today&apos;s Patients
          {todayEncounters.filter((e: any) => ['consultation_done','completed'].includes(e.status)).length > 0 && (
            <span className="ml-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {todayEncounters.filter((e: any) => ['consultation_done','completed'].includes(e.status)).length}
            </span>
          )}
        </button>
        <button onClick={() => { setActiveTab('manual'); setSelectedEncounter(null); setEncounterDetail(null); setItems([]); setSelectedPatient(null); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
          Manual Bill
        </button>
      </div>

      {/* ── Today's patients tab ── */}
      {activeTab === 'today' && !selectedEncounter && (
        <div className="space-y-2">
          {todayEncounters.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm">No patients today yet</p>
            </div>
          ) : todayEncounters.map((enc: any) => {
            const pendingSvcs = Number(enc.pending_services || 0);
            const clinicTotal = Number(enc.consultation_fee || 0) + Number(enc.services_total || 0);
            const statusColors: Record<string,string> = {
              waiting: 'bg-slate-100 text-slate-500',
              in_consultation: 'bg-blue-100 text-blue-700',
              consultation_done: 'bg-amber-100 text-amber-700',
              completed: 'bg-green-100 text-green-700',
            };
            return (
              <button key={enc.queue_id}
                onClick={() => loadEncounterDetail(enc.queue_id)}
                className="w-full bg-white border border-slate-100 rounded-xl p-4 text-left hover:border-[#00475a] hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center text-[#00475a] font-bold text-sm">
                      #{enc.token_number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{enc.patient_name}</p>
                      <p className="text-xs text-slate-400">{enc.doctor_name ? `Dr. ${enc.doctor_name}` : 'Walk-in'}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[enc.status] || 'bg-slate-100 text-slate-600'}`}>
                    {enc.status?.replace(/_/g,' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex gap-3">
                    <span>Clinic: <strong className="text-slate-700">₹{clinicTotal.toFixed(0)}</strong></span>
                    {Number(enc.pharmacy_total) > 0 && <span>Pharmacy: <strong className="text-slate-700">₹{Number(enc.pharmacy_total).toFixed(0)}</strong></span>}
                    {pendingSvcs > 0 && <span className="text-amber-600 font-medium">⏳ {pendingSvcs} pending</span>}
                  </div>
                  <span className="text-[#00475a] font-medium">Open & collect →</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Back button when encounter selected */}
      {activeTab === 'today' && selectedEncounter && !loadingEncounter && (
        <button onClick={() => { setSelectedEncounter(null); setEncounterDetail(null); setItems([]); setSelectedPatient(null); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          ← Back to today&apos;s patients
        </button>
      )}

      {loadingEncounter && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
        </div>
      )}

      {/* Pharmacy bill info */}
      {activeTab === 'today' && selectedEncounter && encounterDetail?.pharmacy_bills?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-800">Pharmacy bill already generated separately</p>
            {encounterDetail.pharmacy_bills.map((b: any) => (
              <p key={b.id} className="text-xs text-green-600">{b.bill_number} — ₹{Number(b.total_amount).toFixed(2)}</p>
            ))}
          </div>
        </div>
      )}

      {/* Patient search - show for manual tab OR when encounter selected */}
      {(activeTab === 'manual' || (activeTab === 'today' && selectedEncounter && !loadingEncounter)) && (
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#00475a]" /> Patient
        </h2>

      {/* Patient search */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#00475a]" /> Patient
        </h2>
        {selectedPatient ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#00475a] text-white flex items-center justify-center text-sm font-bold">
              {(selectedPatient.first_name?.[0] ?? selectedPatient.full_name?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-slate-900 text-sm">
                {selectedPatient.first_name
                  ? `${selectedPatient.first_name} ${selectedPatient.last_name ?? ''}`.trim()
                  : selectedPatient.full_name}
              </p>
              <p className="text-xs text-slate-500">{selectedPatient.mobile}</p>
            </div>
            {/* VIP badge */}
            {vipInfo?.tier && (
              <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">
                <Star className="w-3 h-3" />
                {vipInfo.tier === 'individual' ? 'Individual' : vipInfo.tier === 'family' ? 'Family' : 'Extended Family'}
              </span>
            )}
            <button onClick={() => { setSelectedPatient(null); setVipInfo(null); }}
              className="text-slate-300 hover:text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={patientSearch}
              onChange={e => setPatientSearch(e.target.value)}
              placeholder="Search patient by name or mobile..."
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
            {searchingPatients && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
            )}
            {patients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 overflow-hidden">
                {patients.map(p => (
                  <button key={p.id} onClick={() => selectPatient(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                      {(p.first_name?.[0] ?? p.full_name?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {p.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : p.full_name}
                      </p>
                      <p className="text-xs text-slate-400">{p.mobile}</p>
                    </div>
                    {p.vip_tier && (
                      <Star className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      )}

      {/* VIP discount preview */}
      {(activeTab === 'manual' || (activeTab === 'today' && selectedEncounter && !loadingEncounter)) && vipInfo?.tier && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Doctor',   pct: vipInfo.doctor_discount },
              { label: 'Pharmacy', pct: vipInfo.pharmacy_discount },
              { label: 'Lab',      pct: vipInfo.lab_discount },
            ].map(d => (
              <div key={d.label} className="text-center bg-amber-50 border border-amber-100 rounded-lg py-1.5 px-2">
                <p className="text-xs text-amber-600 font-medium">{d.label}</p>
                <p className="text-sm font-bold text-amber-800">{d.pct}% off</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Line items by category */}
      {Object.entries(CATEGORY_META).map(([cat, meta]) => {
        const catItems = items.filter(it => it.category === cat);
        if (catItems.length === 0) return null;
        const Icon = meta.icon;
        return (
          <div key={cat} className="bg-white rounded-xl border border-slate-100 p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-1.5 rounded-lg ${meta.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-semibold text-slate-700">{meta.label}</span>
              <span className="text-xs text-slate-400 ml-auto">{catItems.length} item{catItems.length > 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {catItems.map((it, i) => {
                const realIdx = items.findIndex(x => x === it);
                const lineTotal = n(it.unit_rate) * it.qty * (1 + n(it.gst_percent) / 100);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 flex-1 truncate">{it.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateItem(realIdx, 'qty', Math.max(1, it.qty - 1))}
                        className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{it.qty}</span>
                      <button onClick={() => updateItem(realIdx, 'qty', it.qty + 1)}
                        className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 w-16 text-right">₹{fmt(it.unit_rate)}/u</span>
                    <span className="text-sm font-semibold text-slate-800 w-16 text-right">₹{fmt(lineTotal)}</span>
                    <button onClick={() => removeItem(realIdx)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add service button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 font-medium hover:border-[#00475a] hover:text-[#00475a] transition-colors mb-4 flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add service
      </button>

      {/* Summary */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">₹{fmt(subtotal)}</span>
            </div>
            {gstAmt > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">GST</span>
                <span className="font-medium">₹{fmt(gstAmt)}</span>
              </div>
            )}
            {vipDiscAmt > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>VIP discount</span>
                <span className="font-medium">−₹{fmt(vipDiscAmt)}</span>
              </div>
            )}

            {/* Extra discount */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-slate-500 flex-shrink-0">Extra discount</span>
              <input
                type="number" min="0" max="100" step="1"
                value={extraDiscountPct}
                onChange={e => setExtraDiscountPct(e.target.value)}
                placeholder="0"
                className="w-16 text-sm border border-slate-200 rounded-lg px-2 py-1 text-right focus:outline-none focus:border-[#00475a]"
              />
              <span className="text-sm text-slate-400">%</span>
              <input
                type="text" value={extraDiscountNote}
                onChange={e => setExtraDiscountNote(e.target.value)}
                placeholder="Reason (e.g. senior citizen)"
                className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#00475a]"
              />
            </div>
            {extraAmt > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Extra discount ({extraDiscountPct}%)</span>
                <span className="font-medium">−₹{fmt(extraAmt)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2">
              <span>Total</span>
              <span className="text-[#00475a]">₹{fmt(total)}</span>
            </div>
          </div>

          {/* Payment mode */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(['cash', 'upi', 'card', 'credit'] as const).map(m => (
              <button key={m}
                onClick={() => setPaymentMode(m)}
                className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                  paymentMode === m
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Notes */}
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Bill notes (optional)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4 focus:outline-none focus:border-[#00475a]"
          />

          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPatient}
            className="w-full py-3.5 bg-[#00475a] text-white rounded-xl text-sm font-bold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
              : <><CheckCircle2 className="w-4 h-4" />Confirm bill — ₹{fmt(total)}</>
            }
          </button>
        </div>
      )}

      {showAddModal && (
        <AddServiceModal onAdd={addItem} onClose={() => setShowAddModal(false)} />
      )}
      </>}
    </div>
  );
}

