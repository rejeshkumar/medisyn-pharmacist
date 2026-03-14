'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import {
  ArrowLeft, Heart, Thermometer, Wind, Activity, User,
  Save, FileText, CheckCircle2, Plus, Trash2, Scan,
  ChevronDown, ChevronUp, Mic, MicOff, AlertTriangle,
  Clock, RefreshCw, Package, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import DiagnosisSuggestions from '@/components/ai/DiagnosisSuggestions';
import DrugInteractionChecker from '@/components/ai/DrugInteractionChecker';
import PrescriptionScanner from '@/components/ai/PrescriptionScanner';

// ── Types ────────────────────────────────────────────────────────────────────
interface PrescriptionItem {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'checking' | null;
  alternatives?: { id: string; brand_name: string; strength: string; quantity: number }[];
}

const emptyItem = (): PrescriptionItem => ({
  medicine_name: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '',
  stock_status: null, alternatives: [],
});

// ── Patient History Panel ─────────────────────────────────────────────────────
function PatientHistory({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/consultations/patient/${patientId}?limit=10`)
      .then(r => setHistory(r.data?.items || r.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="py-4 text-center text-xs text-slate-400">Loading history...</div>;
  if (history.length === 0) return (
    <div className="py-4 text-center text-xs text-slate-400">No previous consultations</div>
  );

  return (
    <div className="space-y-2">
      {history.map((c: any) => (
        <div key={c.id} className="bg-slate-50 rounded-lg border border-slate-100">
          <button
            onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <div>
              <span className="text-xs font-medium text-slate-700">
                {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="ml-2 text-xs text-slate-500 truncate max-w-xs">{c.diagnosis || 'No diagnosis'}</span>
            </div>
            {expanded === c.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          {expanded === c.id && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
              {c.symptoms && <div><span className="text-xs text-slate-400">Symptoms: </span><span className="text-xs text-slate-700">{c.symptoms}</span></div>}
              {c.examination && <div><span className="text-xs text-slate-400">Examination: </span><span className="text-xs text-slate-700">{c.examination}</span></div>}
              {c.diagnosis && <div><span className="text-xs font-medium text-slate-600">Diagnosis: </span><span className="text-xs text-slate-700">{c.diagnosis}</span></div>}
              {c.advice && <div><span className="text-xs text-slate-400">Advice: </span><span className="text-xs text-slate-700">{c.advice}</span></div>}
              {c.prescriptions?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">Prescribed:</p>
                  {c.prescriptions.map((rx: any, i: number) => (
                    <div key={i} className="text-xs text-slate-600">
                      • {rx.medicine_name} {rx.dosage && `(${rx.dosage})`} {rx.frequency && `× ${rx.frequency}`} {rx.duration && `for ${rx.duration}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stock Badge ───────────────────────────────────────────────────────────────
function StockBadge({ status }: { status: PrescriptionItem['stock_status'] }) {
  if (!status || status === 'checking') return status === 'checking'
    ? <span className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Checking...</span>
    : null;
  const map = {
    in_stock: 'text-green-700 bg-green-50 border-green-200',
    low_stock: 'text-amber-700 bg-amber-50 border-amber-200',
    out_of_stock: 'text-red-700 bg-red-50 border-red-200',
  };
  const labels = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${map[status]}`}>
      <Package className="w-3 h-3" />{labels[status]}
    </span>
  );
}

// ── Main Consultation Page ────────────────────────────────────────────────────
export default function ConsultPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const router = useRouter();
  const user = getUser();

  const [tab, setTab] = useState<'history' | 'consult' | 'rx'>('consult');
  const [consultSaved, setConsultSaved] = useState(false);
  const [consultId, setConsultId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<'symptoms' | 'examination' | 'diagnosis' | 'advice'>('symptoms');
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [form, setForm] = useState({
    symptoms: '', examination: '', diagnosis: '',
    diagnosis_code: '', advice: '', follow_up_date: '', referral: '',
    is_follow_up: false,
  });
  const [items, setItems] = useState<PrescriptionItem[]>([emptyItem()]);
  const [rxNotes, setRxNotes] = useState('');

  const [queueEntry, setQueueEntry] = useState<any>(null);
  const [preCheck, setPreCheck] = useState<any>(null);
  const stockCheckTimer = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!queueId) return;
    Promise.all([
      api.get(`/queue/${queueId}`).catch(() => ({ data: null })),
      api.get(`/queue/${queueId}/precheck`).catch(() => ({ data: null })),
      api.get(`/consultations/queue/${queueId}`).catch(() => ({ data: null })),
    ]).then(([qRes, pRes, cRes]) => {
      setQueueEntry(qRes.data);
      setPreCheck(pRes.data);
      if (cRes.data) {
        const c = cRes.data;
        setConsultSaved(true);
        setConsultId(c.id);
        setForm({
          symptoms: c.symptoms || '', examination: c.examination || '',
          diagnosis: c.diagnosis || '', diagnosis_code: c.diagnosis_code || '',
          advice: c.advice || '', follow_up_date: c.follow_up_date || '',
          referral: c.referral || '', is_follow_up: c.is_follow_up || false,
        });
      }
    });
  }, [queueId]);

  // ── Voice (free Web Speech API) ───────────────────────────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = 'en-IN';
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setForm(f => ({ ...f, [activeVoiceField]: (f as any)[activeVoiceField] ? (f as any)[activeVoiceField] + ' ' + text : text }));
      toast.success(`Added to ${activeVoiceField}`);
    };
    r.onerror = () => { setVoiceListening(false); };
    r.onend = () => setVoiceListening(false);
    recognitionRef.current = r;
  }, [activeVoiceField]);

  const toggleVoice = () => {
    if (!recognitionRef.current) { toast.error('Voice not supported. Use Chrome or Edge.'); return; }
    if (voiceListening) { recognitionRef.current.stop(); setVoiceListening(false); }
    else { recognitionRef.current.start(); setVoiceListening(true); }
  };

  // ── Stock check on medicine name change ───────────────────────────────────
  const checkStock = useCallback(async (idx: number, medicineName: string) => {
    if (!medicineName.trim() || medicineName.length < 3) {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, stock_status: null, alternatives: [] } : it));
      return;
    }
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, stock_status: 'checking' } : it));
    try {
      const res = await api.get(`/medicines/stock-check?name=${encodeURIComponent(medicineName)}`);
      const { quantity, alternatives } = res.data;
      const status: PrescriptionItem['stock_status'] = quantity === 0 ? 'out_of_stock' : quantity < 10 ? 'low_stock' : 'in_stock';
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, stock_status: status, alternatives: alternatives || [] } : it));
    } catch {
      setItems(prev => prev.map((it, i) => i === idx ? { ...it, stock_status: null } : it));
    }
  }, []);

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      clearTimeout(stockCheckTimer.current[idx]);
      stockCheckTimer.current[idx] = setTimeout(() => checkStock(idx, value), 600);
    }
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  // ── Save consultation ─────────────────────────────────────────────────────
  const handleSaveConsult = async () => {
    if (!form.diagnosis) { toast.error('Diagnosis is required'); return; }
    setSaving(true);
    try {
      const res = await api.post('/consultations', {
        queue_id: queueId,
        patient_id: queueEntry?.patient_id,
        ...form,
      });
      setConsultId(res.data?.id);
      setConsultSaved(true);
      toast.success('Consultation saved');
      setTab('rx');
    } catch { toast.error('Failed to save consultation'); }
    finally { setSaving(false); }
  };

  // ── Issue prescription + move queue to dispensing ─────────────────────────
  const handleFinish = async () => {
    if (!consultId) { toast.error('Save consultation first'); return; }
    const filled = items.filter(i => i.medicine_name.trim());
    if (filled.length === 0) { toast.error('Add at least one medicine'); return; }
    setFinishing(true);
    try {
      const rxRes = await api.post('/prescriptions', {
        consultation_id: consultId,
        patient_id: queueEntry?.patient_id,
        notes: rxNotes,
        items: filled.map(i => ({ ...i, quantity: i.quantity ? parseInt(i.quantity) : undefined })),
      });
      // Move queue status to dispensing so pharmacist sees it
      await api.patch(`/queue/${queueId}/status`, { status: 'dispensing' }).catch(() => {});
      // Complete consultation
      await api.patch(`/consultations/${consultId}/complete`, form).catch(() => {});
      toast.success(`Prescription ${rxRes.data?.prescription_no || ''} sent to pharmacy`);
      router.push('/doctor');
    } catch { toast.error('Failed to issue prescription'); }
    finally { setFinishing(false); }
  };

  // ── OCR import ────────────────────────────────────────────────────────────
  const handleOcrImport = (medicines: any[]) => {
    const newItems = medicines.map(m => ({
      ...emptyItem(),
      medicine_name: m.name || '',
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
      instructions: m.notes || '',
    }));
    setItems(prev => prev.some(p => p.medicine_name.trim()) ? [...prev, ...newItems] : newItems);
    toast.success(`${newItems.length} medicines imported`);
  };

  const patient = queueEntry?.patient;
  const patientName = patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || patient?.name || '—';
  const medicineNames = items.map(i => i.medicine_name.trim()).filter(Boolean);

  const patientContext = {
    age: patient?.age, gender: patient?.gender,
    chief_complaint: queueEntry?.chief_complaint,
    existing_conditions: patient?.chronic_conditions,
    vitals: preCheck ? {
      bp: preCheck.bp_systolic ? `${preCheck.bp_systolic}/${preCheck.bp_diastolic}` : undefined,
      pulse: preCheck.pulse_rate, temperature: preCheck.temperature, spo2: preCheck.spo2,
    } : undefined,
  };

  const fieldLabels = { symptoms: 'Symptoms', examination: 'Examination', diagnosis: 'Diagnosis', advice: 'Advice' };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => router.push('/doctor')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Queue
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-[#00475a] font-bold text-lg flex-shrink-0">
          {patientName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{patientName}</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500">
            {patient?.age && <span>Age: {patient.age}</span>}
            {patient?.gender && <span className="capitalize">{patient.gender}</span>}
            {(patient?.phone || patient?.mobile) && <span>{patient.phone || patient.mobile}</span>}
            {queueEntry?.chief_complaint && <span>Chief complaint: {queueEntry.chief_complaint}</span>}
          </div>
          {/* Allergy warning — prominently shown */}
          {(patient?.known_allergies || patient?.allergies) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 inline-flex">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <strong>Allergies:</strong> {patient.known_allergies || patient.allergies}
            </div>
          )}
          {/* Chronic conditions */}
          {patient?.chronic_conditions && (
            <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
              Chronic: {patient.chronic_conditions}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-[#00475a]">#{queueEntry?.token_number}</div>
          <div className="text-xs text-slate-400 capitalize">{queueEntry?.visit_type}</div>
        </div>
      </div>

      {/* Vitals */}
      {preCheck && (
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pre-check Vitals</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'BP', value: preCheck.bp_systolic ? `${preCheck.bp_systolic}/${preCheck.bp_diastolic}` : '—' },
              { label: 'Pulse', value: preCheck.pulse_rate ? `${preCheck.pulse_rate} bpm` : '—' },
              { label: 'Temp', value: preCheck.temperature ? `${preCheck.temperature}°F` : '—' },
              { label: 'SpO2', value: preCheck.spo2 ? `${preCheck.spo2}%` : '—' },
              { label: 'Weight', value: preCheck.weight ? `${preCheck.weight} kg` : '—' },
              { label: 'BMI', value: preCheck.bmi || '—' },
            ].map(v => (
              <div key={v.label} className="bg-white rounded-lg p-2.5 text-center border border-slate-100">
                <p className="text-xs text-slate-400 mb-0.5">{v.label}</p>
                <p className="text-sm font-semibold text-slate-800">{v.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs — now includes History */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {(['history', 'consult', 'rx'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={t === 'rx' && !consultSaved}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              t === 'rx' && !consultSaved ? 'opacity-40 cursor-not-allowed' : '',
            )}
          >
            {t === 'history' ? <><History className="w-3.5 h-3.5 inline mr-1.5" />History</> :
             t === 'consult' ? <>🩺 Consultation{consultSaved && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1.5 text-green-500" />}</> :
             <>💊 Prescription</>}
          </button>
        ))}
      </div>

      {/* ── History tab ────────────────────────────────────────────────────── */}
      {tab === 'history' && queueEntry?.patient_id && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-[#00475a]" />Past Consultations
          </h3>
          <PatientHistory patientId={queueEntry.patient_id} />
        </div>
      )}

      {/* ── Consultation tab ───────────────────────────────────────────────── */}
      {tab === 'consult' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">

            {/* Voice dictation toolbar */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Dictate into:</span>
              <div className="flex gap-1.5 flex-wrap">
                {(['symptoms', 'examination', 'diagnosis', 'advice'] as const).map(f => (
                  <button key={f} onClick={() => setActiveVoiceField(f)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize ${activeVoiceField === f ? 'bg-[#00475a] text-white border-[#00475a]' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <button onClick={toggleVoice}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto ${voiceListening ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-teal-50 border border-teal-200 text-[#00475a]'}`}>
                {voiceListening ? <><MicOff className="w-3.5 h-3.5" />Stop</> : <><Mic className="w-3.5 h-3.5" />Speak</>}
              </button>
              {voiceListening && <span className="flex items-center gap-1.5 text-xs text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Recording {fieldLabels[activeVoiceField]}...</span>}
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="follow_up" checked={form.is_follow_up}
                onChange={e => setForm({ ...form, is_follow_up: e.target.checked })} className="rounded" />
              <label htmlFor="follow_up" className="text-sm text-slate-600">Follow-up visit</label>
            </div>

            {[
              { field: 'symptoms', label: 'Symptoms', placeholder: 'Chief complaint and history...', rows: 2 },
              { field: 'examination', label: 'Examination Findings', placeholder: 'Clinical findings on examination...', rows: 2 },
              { field: 'diagnosis', label: 'Diagnosis *', placeholder: 'Primary diagnosis...', rows: 2 },
            ].map(({ field, label, placeholder, rows }) => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <textarea rows={rows} value={(form as any)[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  onFocus={() => setActiveVoiceField(field as any)}
                  placeholder={placeholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none" />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ICD Code</label>
                <input type="text" value={form.diagnosis_code} onChange={e => setForm({ ...form, diagnosis_code: e.target.value })}
                  placeholder="e.g. J06.9" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Date</label>
                <input type="date" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Advice to Patient</label>
              <textarea rows={2} value={form.advice} onChange={e => setForm({ ...form, advice: e.target.value })}
                onFocus={() => setActiveVoiceField('advice')}
                placeholder="Lifestyle, diet, rest instructions..." className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Referral</label>
              <input type="text" value={form.referral} onChange={e => setForm({ ...form, referral: e.target.value })}
                placeholder="Refer to specialist (if any)" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleSaveConsult} disabled={!form.diagnosis || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : consultSaved ? 'Update & Continue' : 'Save & Continue to Prescription'}
              </button>
            </div>
          </div>

          <DiagnosisSuggestions patientContext={{ ...patientContext, symptoms: form.symptoms || queueEntry?.chief_complaint }} />
        </div>
      )}

      {/* ── Prescription tab ──────────────────────────────────────────────── */}
      {tab === 'rx' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00475a]" />Prescription Items
              </h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowScanner(true)}
                  className="flex items-center gap-1.5 text-sm border border-[#00475a] text-[#00475a] px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors font-medium">
                  <Scan className="w-4 h-4" /> Scan Rx
                </button>
                <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-[#00475a] hover:text-[#003d4d] font-medium">
                  <Plus className="w-4 h-4" /> Add Medicine
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {items.map((item, idx) => (
                <div key={idx} className={cn('rounded-xl p-4 border', item.stock_status === 'out_of_stock' ? 'border-red-200 bg-red-50/30' : 'bg-slate-50 border-slate-100')}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">Medicine {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <StockBadge status={item.stock_status} />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div className="col-span-2">
                      <input type="text" value={item.medicine_name}
                        onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                        placeholder="Medicine name *"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    </div>
                    <input type="text" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} placeholder="Dosage (e.g. 500mg)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="text" value={item.frequency} onChange={e => updateItem(idx, 'frequency', e.target.value)} placeholder="Frequency (e.g. TID)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="text" value={item.duration} onChange={e => updateItem(idx, 'duration', e.target.value)} placeholder="Duration (e.g. 5 days)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                  </div>
                  <input type="text" value={item.instructions} onChange={e => updateItem(idx, 'instructions', e.target.value)} placeholder="Special instructions (e.g. after food)" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />

                  {/* Out-of-stock alternatives */}
                  {item.stock_status === 'out_of_stock' && item.alternatives && item.alternatives.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Out of stock — available alternatives with same molecule:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.alternatives.map(alt => (
                          <button key={alt.id} onClick={() => updateItem(idx, 'medicine_name', alt.brand_name)}
                            className="text-xs bg-white border border-amber-300 text-amber-800 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors font-medium">
                            {alt.brand_name} {alt.strength} ({alt.quantity} in stock)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes for Pharmacist</label>
              <textarea rows={2} value={rxNotes} onChange={e => setRxNotes(e.target.value)}
                placeholder="Additional instructions for the pharmacy..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none" />
            </div>

            <div className="flex justify-end">
              <button onClick={handleFinish} disabled={finishing}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                <CheckCircle2 className="w-4 h-4" />
                {finishing ? 'Processing...' : 'Issue Prescription & Send to Pharmacy'}
              </button>
            </div>
          </div>

          <DrugInteractionChecker medicines={medicineNames} />
        </div>
      )}

      {showScanner && (
        <PrescriptionScanner onExtracted={handleOcrImport} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
