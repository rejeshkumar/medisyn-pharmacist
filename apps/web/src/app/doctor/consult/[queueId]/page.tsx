'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import {
  ArrowLeft, Heart, Thermometer, Wind, Activity, User,
  Save, FileText, CheckCircle2, Plus, Trash2, Scan,
  ChevronDown, ChevronUp, Mic, MicOff, AlertTriangle,
  Clock, RefreshCw, Package, History, Sparkles, Loader2,
  LayoutTemplate, X, Check,
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

// ── Clinical Templates ────────────────────────────────────────────────────────
const CLINICAL_TEMPLATES = [
  {
    id: 'viral_fever', label: 'Viral Fever', emoji: '🤒',
    color: 'bg-orange-50 border-orange-200 text-orange-700',
    diagnosis: 'Viral fever (ICD: B34.9)',
    advice: 'Rest, adequate fluids, tepid sponging. Avoid cold drinks. Return if fever > 3 days or worsening.',
    medicines: [
      { medicine_name: 'Tab Paracetamol 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: '15', instructions: 'After food' },
      { medicine_name: 'Tab Cetirizine 10mg', dosage: '10mg', frequency: 'OD', duration: '3 days', quantity: '3', instructions: 'At night' },
      { medicine_name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '5 days', quantity: '5', instructions: 'Before breakfast' },
      { medicine_name: 'Tab Vitamin C 500mg', dosage: '500mg', frequency: 'BD', duration: '5 days', quantity: '10', instructions: 'After food' },
    ],
  },
  {
    id: 'urti', label: 'URTI / Cold', emoji: '🤧',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    diagnosis: 'Acute upper respiratory tract infection (ICD: J06.9)',
    advice: 'Steam inhalation, warm fluids, rest. Avoid cold and dusty areas.',
    medicines: [
      { medicine_name: 'Tab Amoxicillin 500mg', dosage: '500mg', frequency: 'TDS', duration: '5 days', quantity: '15', instructions: 'After food' },
      { medicine_name: 'Tab Cetirizine 10mg', dosage: '10mg', frequency: 'OD', duration: '5 days', quantity: '5', instructions: 'At night' },
      { medicine_name: 'Syp Bromhexine', dosage: '10ml', frequency: 'TDS', duration: '5 days', quantity: '1 bottle', instructions: 'After food' },
      { medicine_name: 'Tab Paracetamol 500mg', dosage: '500mg', frequency: 'SOS', duration: '3 days', quantity: '9', instructions: 'For fever/pain' },
    ],
  },
  {
    id: 'hypertension', label: 'Hypertension', emoji: '💓',
    color: 'bg-red-50 border-red-200 text-red-700',
    diagnosis: 'Essential hypertension (ICD: I10)',
    advice: 'Low salt diet, regular exercise. Monitor BP daily. Avoid smoking and alcohol.',
    medicines: [
      { medicine_name: 'Tab Amlodipine 5mg', dosage: '5mg', frequency: 'OD', duration: '30 days', quantity: '30', instructions: 'Morning after food' },
      { medicine_name: 'Tab Telmisartan 40mg', dosage: '40mg', frequency: 'OD', duration: '30 days', quantity: '30', instructions: 'Morning' },
      { medicine_name: 'Tab Aspirin 75mg', dosage: '75mg', frequency: 'OD', duration: '30 days', quantity: '30', instructions: 'After food' },
    ],
  },
  {
    id: 'diabetes', label: 'Diabetes T2', emoji: '🩸',
    color: 'bg-purple-50 border-purple-200 text-purple-700',
    diagnosis: 'Type 2 diabetes mellitus (ICD: E11)',
    advice: 'Diet control, regular exercise. Monitor blood sugar daily. Avoid sweets and fried food.',
    medicines: [
      { medicine_name: 'Tab Metformin 500mg', dosage: '500mg', frequency: 'BD', duration: '30 days', quantity: '60', instructions: 'After food' },
      { medicine_name: 'Tab Glimepiride 1mg', dosage: '1mg', frequency: 'OD', duration: '30 days', quantity: '30', instructions: 'Before breakfast' },
      { medicine_name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '30 days', quantity: '30', instructions: 'Before breakfast' },
    ],
  },
  {
    id: 'gastritis', label: 'Gastritis / GERD', emoji: '🫃',
    color: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    diagnosis: 'Gastritis / GERD (ICD: K29)',
    advice: 'Avoid spicy food, alcohol, NSAIDs. Eat small frequent meals. Elevate head end of bed.',
    medicines: [
      { medicine_name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: 'BD', duration: '7 days', quantity: '14', instructions: '30 min before food' },
      { medicine_name: 'Tab Domperidone 10mg', dosage: '10mg', frequency: 'TDS', duration: '5 days', quantity: '15', instructions: '30 min before food' },
      { medicine_name: 'Syp Sucralfate', dosage: '10ml', frequency: 'TDS', duration: '7 days', quantity: '1 bottle', instructions: '1 hr after food' },
    ],
  },
  {
    id: 'back_pain', label: 'Back Pain', emoji: '🦴',
    color: 'bg-slate-50 border-slate-200 text-slate-700',
    diagnosis: 'Low back pain (ICD: M54.5)',
    advice: 'Rest for 2 days, hot fomentation. Avoid heavy lifting. Physiotherapy if no improvement.',
    medicines: [
      { medicine_name: 'Tab Diclofenac 50mg', dosage: '50mg', frequency: 'BD', duration: '5 days', quantity: '10', instructions: 'After food' },
      { medicine_name: 'Tab Thiocolchicoside 4mg', dosage: '4mg', frequency: 'BD', duration: '5 days', quantity: '10', instructions: 'After food' },
      { medicine_name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '5 days', quantity: '5', instructions: 'Before breakfast' },
    ],
  },
  {
    id: 'uti', label: 'UTI', emoji: '💧',
    color: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    diagnosis: 'Urinary tract infection (ICD: N39.0)',
    advice: 'Increase fluid intake. Complete full course of antibiotics. Maintain hygiene.',
    medicines: [
      { medicine_name: 'Tab Nitrofurantoin 100mg', dosage: '100mg', frequency: 'BD', duration: '7 days', quantity: '14', instructions: 'After food' },
      { medicine_name: 'Tab Phenazopyridine 200mg', dosage: '200mg', frequency: 'TDS', duration: '2 days', quantity: '6', instructions: 'After food' },
      { medicine_name: 'Tab Pantoprazole 40mg', dosage: '40mg', frequency: 'OD', duration: '7 days', quantity: '7', instructions: 'Before breakfast' },
    ],
  },
  {
    id: 'skin_infection', label: 'Skin Infection', emoji: '🩹',
    color: 'bg-green-50 border-green-200 text-green-700',
    diagnosis: 'Bacterial skin infection (ICD: L08.9)',
    advice: 'Keep area clean and dry. Apply ointment as directed. Avoid scratching.',
    medicines: [
      { medicine_name: 'Tab Amoxiclav 625mg', dosage: '625mg', frequency: 'BD', duration: '7 days', quantity: '14', instructions: 'After food' },
      { medicine_name: 'Tab Cetirizine 10mg', dosage: '10mg', frequency: 'OD', duration: '5 days', quantity: '5', instructions: 'At night' },
      { medicine_name: 'Mupirocin 2% Ointment', dosage: 'Apply locally', frequency: 'BD', duration: '7 days', quantity: '1 tube', instructions: 'Apply thin layer on affected area' },
    ],
  },
];

// ── AI Template Suggester ─────────────────────────────────────────────────────
function AITemplateSuggester({ symptoms, vitals, patientAge, onApply }: {
  symptoms: string; vitals: any; patientAge: string;
  onApply: (template: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  const getSuggestion = async () => {
    if (!symptoms.trim()) { toast.error('Enter symptoms first'); return; }
    setLoading(true); setSuggestion(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a clinical assistant for an Indian specialty clinic. Given patient details, suggest a prescription.

Patient: ${patientAge ? `${patientAge} years old` : 'Adult'}
Symptoms/Chief complaint: ${symptoms}
${vitals?.temperature ? `Temperature: ${vitals.temperature}°F` : ''}
${vitals?.bp_systolic ? `BP: ${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` : ''}
${vitals?.pulse_rate ? `Pulse: ${vitals.pulse_rate} bpm` : ''}

Respond ONLY with valid JSON, no other text:
{
  "diagnosis": "string",
  "icd_code": "string",
  "advice": "string",
  "medicines": [
    {"medicine_name": "string", "dosage": "string", "frequency": "string", "duration": "string", "quantity": "string", "instructions": "string"}
  ]
}`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      setSuggestion(parsed);
    } catch (e) {
      toast.error('AI suggestion failed — check connection');
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-900">AI Prescription Assistant</span>
        </div>
        <button onClick={getSuggestion} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-50">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analysing...</> : <><Sparkles className="w-3.5 h-3.5" />Suggest Prescription</>}
        </button>
      </div>
      <p className="text-xs text-purple-600 mb-3">Based on symptoms and vitals, AI will suggest diagnosis and medicines</p>

      {suggestion && (
        <div className="bg-white rounded-xl border border-purple-200 p-4 mt-3 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Suggested Diagnosis</p>
            <p className="text-sm font-bold text-gray-900">{suggestion.diagnosis} <span className="text-xs text-gray-400 font-normal">({suggestion.icd_code})</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Suggested Medicines ({suggestion.medicines?.length})</p>
            <div className="space-y-1">
              {suggestion.medicines?.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-800 flex-1">{m.medicine_name}</span>
                  <span className="text-gray-500">{m.dosage} · {m.frequency} · {m.duration}</span>
                </div>
              ))}
            </div>
          </div>
          {suggestion.advice && (
            <div>
              <p className="text-xs text-gray-500">Advice</p>
              <p className="text-xs text-gray-700">{suggestion.advice}</p>
            </div>
          )}
          <button onClick={() => onApply(suggestion)}
            className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Apply to Prescription
          </button>
        </div>
      )}
    </div>
  );
}

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
  if (history.length === 0) return <div className="py-4 text-center text-xs text-slate-400">No previous consultations</div>;

  return (
    <div className="space-y-2">
      {history.map((c: any) => (
        <div key={c.id} className="bg-slate-50 rounded-lg border border-slate-100">
          <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left">
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
              {c.diagnosis && <div><span className="text-xs font-medium text-slate-600">Diagnosis: </span><span className="text-xs text-slate-700">{c.diagnosis}</span></div>}
              {c.advice && <div><span className="text-xs text-slate-400">Advice: </span><span className="text-xs text-slate-700">{c.advice}</span></div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StockBadge({ status }: { status: PrescriptionItem['stock_status'] }) {
  if (!status || status === 'checking') return status === 'checking' ? (
    <span className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Checking...</span>
  ) : null;
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

const fieldLabels: Record<string, string> = {
  symptoms: 'Symptoms', examination: 'Examination', diagnosis: 'Diagnosis', advice: 'Advice',
};

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
  const [showTemplates, setShowTemplates] = useState(false);

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

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = 'en-IN';
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setForm(f => ({ ...f, [activeVoiceField]: (f as any)[activeVoiceField] ? (f as any)[activeVoiceField] + ' ' + text : text }));
      toast.success(`Added to ${activeVoiceField}`);
    };
    r.onerror = () => setVoiceListening(false);
    r.onend = () => setVoiceListening(false);
    recognitionRef.current = r;
  }, [activeVoiceField]);

  const toggleVoice = () => {
    if (!recognitionRef.current) { toast.error('Voice not supported. Use Chrome or Edge.'); return; }
    if (voiceListening) { recognitionRef.current.stop(); setVoiceListening(false); }
    else { recognitionRef.current.start(); setVoiceListening(true); }
  };

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

  // ── Medicine autocomplete ──────────────────────────────────────────────────
  const [medSuggestions, setMedSuggestions] = useState<Record<number, any[]>>({});
  const [showSuggestions, setShowSuggestions] = useState<Record<number, boolean>>({});
  const medSearchTimer = useRef<Record<number, any>>({});

  const searchMedicines = useCallback(async (idx: number, q: string) => {
    if (q.length < 2) { setMedSuggestions(p => ({ ...p, [idx]: [] })); return; }
    try {
      const res = await api.get(`/medicines/search-enriched?search=${encodeURIComponent(q)}&limit=8`);
      setMedSuggestions(p => ({ ...p, [idx]: res.data || [] }));
      setShowSuggestions(p => ({ ...p, [idx]: true }));
    } catch {}
  }, []);

  const selectMedicine = (idx: number, med: any) => {
    const name = med.brand_name + (med.strength ? ' ' + med.strength : '');
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, medicine_name: name } : it));
    setShowSuggestions(p => ({ ...p, [idx]: false }));
    checkStock(idx, name);
  };

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
    if (field === 'medicine_name') {
      clearTimeout(stockCheckTimer.current[idx]);
      clearTimeout(medSearchTimer.current[idx]);
      stockCheckTimer.current[idx] = setTimeout(() => checkStock(idx, value), 600);
      medSearchTimer.current[idx] = setTimeout(() => searchMedicines(idx, value), 300);
    }
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  // ── Apply template ──────────────────────────────────────────────────────────
  const applyTemplate = (template: typeof CLINICAL_TEMPLATES[0]) => {
    setForm(f => ({
      ...f,
      diagnosis: template.diagnosis,
      advice: template.advice,
    }));
    setItems(template.medicines.map(m => ({ ...m, stock_status: null, alternatives: [] })));
    setShowTemplates(false);
    setTab('rx');
    toast.success(`${template.label} template applied — review and edit as needed`);
    // Trigger stock checks
    template.medicines.forEach((m, idx) => {
      setTimeout(() => checkStock(idx, m.medicine_name), idx * 200 + 500);
    });
  };

  // ── Apply AI suggestion ─────────────────────────────────────────────────────
  const applyAiSuggestion = (suggestion: any) => {
    setForm(f => ({
      ...f,
      diagnosis: suggestion.diagnosis || f.diagnosis,
      diagnosis_code: suggestion.icd_code || f.diagnosis_code,
      advice: suggestion.advice || f.advice,
    }));
    if (suggestion.medicines?.length > 0) {
      setItems(suggestion.medicines.map((m: any) => ({ ...m, stock_status: null, alternatives: [] })));
      suggestion.medicines.forEach((m: any, idx: number) => {
        setTimeout(() => checkStock(idx, m.medicine_name), idx * 200 + 500);
      });
    }
    toast.success('AI suggestion applied — review and edit as needed');
  };

  // ── Save consultation ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.diagnosis.trim()) { toast.error('Diagnosis is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, queue_id: queueId, patient_id: queueEntry?.patient_id };
      if (consultId) {
        await api.patch(`/consultations/${consultId}`, payload);
      } else {
        const { data } = await api.post('/consultations', payload);
        setConsultId(data.id);
      }
      setConsultSaved(true);
      toast.success('Consultation saved');
      setTab('rx');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleOcrImport = (meds: PrescriptionItem[]) => {
    setItems(meds.map(m => ({ ...m, stock_status: null, alternatives: [] })));
    setShowScanner(false);
    toast.success(`${meds.length} medicines imported from scan`);
  };

  const handleFinish = async () => {
    const filledItems = items.filter(i => i.medicine_name.trim());
    if (!filledItems.length) { toast.error('Add at least one medicine'); return; }
    setFinishing(true);
    try {
      await api.post(`/prescriptions`, {
        consultation_id: consultId,
        patient_id: queueEntry?.patient_id,
        items: filledItems.map((i: any) => ({ medicine_name: i.medicine_name, dosage: i.dosage, frequency: i.frequency, duration: i.duration, quantity: Number(i.quantity) || 1, instructions: i.instructions })),
        notes: rxNotes,
      });
      await api.patch(`/queue/${queueId}/status`, { status: 'consultation_done' });
      toast.success('Prescription issued & sent to pharmacy');
      router.back();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to issue prescription');
    } finally { setFinishing(false); }
  };

  const patient = queueEntry?.patient;
  const patientName = patient ? `${patient.salutation || ''} ${patient.first_name} ${patient.last_name || ''}`.trim() : queueEntry?.patient_name || 'Patient';
  const patientAge = patient?.age || (patient?.date_of_birth ? String(new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()) : '');
  const medicineNames = items.map(i => i.medicine_name).filter(Boolean);

  const patientContext = {
    age: patientAge,
    gender: patient?.gender,
    vitals: preCheck ? {
      temperature: preCheck.temperature, bp_systolic: preCheck.bp_systolic,
      bp_diastolic: preCheck.bp_diastolic, pulse_rate: preCheck.pulse_rate,
    } : undefined,
    chief_complaint: queueEntry?.chief_complaint,
    existing_conditions: patient?.existing_conditions,
    current_medicines: patient?.current_medicines,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" />Back to queue
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-[#00475a]" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">{patientName}</h2>
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5 flex-wrap">
                {patientAge && <span>{patientAge}y</span>}
                {patient?.gender && <span className="capitalize">{patient.gender}</span>}
                {patient?.uhid && <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{patient.uhid}</span>}
                {queueEntry?.chief_complaint && (
                  <span className="text-[#00475a] font-medium">Chief complaint: {queueEntry.chief_complaint}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">
              {queueEntry?.scheduled_time ? new Date(queueEntry.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Walk-in'}
            </span>
          </div>
        </div>
      </div>

      {/* Vitals */}
      {preCheck && (
        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Vitals</p>
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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {(['history', 'consult', 'rx'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} disabled={t === 'rx' && !consultSaved}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              t === 'rx' && !consultSaved ? 'opacity-40 cursor-not-allowed' : '',
            )}>
            {t === 'history' ? <><History className="w-3.5 h-3.5 inline mr-1.5" />History</> :
             t === 'consult' ? <>🩺 Consultation{consultSaved && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1.5 text-green-500" />}</> :
             <>💊 Prescription</>}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && queueEntry?.patient_id && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-[#00475a]" />Past Consultations
          </h3>
          <PatientHistory patientId={queueEntry.patient_id} />
        </div>
      )}

      {/* Consult tab */}
      {tab === 'consult' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
            {/* Voice dictation */}
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
              { field: 'symptoms', label: 'Symptoms / Chief Complaint', placeholder: 'Chief complaint and history...', rows: 2 },
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
                placeholder="Diet, activity, precautions..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : consultSaved ? 'Update & Continue' : 'Save & Continue to Prescription'}
              </button>
            </div>
          </div>
          <DiagnosisSuggestions patientContext={{ ...patientContext, symptoms: form.symptoms || queueEntry?.chief_complaint }} />
        </div>
      )}

      {/* Prescription tab */}
      {tab === 'rx' && (
        <div className="space-y-4">

          {/* ── Template Selector ── */}
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-[#00475a]" />Quick Templates
              </h3>
              <button onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs text-[#00475a] hover:underline">
                {showTemplates ? 'Hide' : 'Show all'}
              </button>
            </div>
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${showTemplates ? '' : 'max-h-24 overflow-hidden'}`}>
              {CLINICAL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all hover:shadow-sm ${t.color}`}>
                  <span className="text-lg leading-none">{t.emoji}</span>
                  <span className="text-xs font-semibold">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── AI Prescription Suggester ── */}
          <AITemplateSuggester
            symptoms={form.symptoms || queueEntry?.chief_complaint || ''}
            vitals={preCheck}
            patientAge={patientAge}
            onApply={applyAiSuggestion}
          />

          {/* ── Prescription Items ── */}
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
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {items.map((item, idx) => (
                <div key={idx} className="rounded-xl p-4 border bg-slate-50 border-slate-100">
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
                    <div className="col-span-2 relative">
                      <input type="text" value={item.medicine_name}
                        onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                        onFocus={() => { if (medSuggestions[idx]?.length) setShowSuggestions(p => ({ ...p, [idx]: true })); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(p => ({ ...p, [idx]: false })), 200)}
                        placeholder="Medicine name (type to search pharmacy stock or enter any name)"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                      {showSuggestions[idx] && medSuggestions[idx]?.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                          {medSuggestions[idx].map((med: any) => {
                            const stock = Number(med.total_stock || 0);
                            return (
                              <button key={med.id} type="button"
                                onMouseDown={() => selectMedicine(idx, med)}
                                className="w-full px-3 py-2 text-left hover:bg-teal-50 border-b border-slate-50 last:border-0 flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{med.brand_name}</p>
                                  <p className="text-[10px] text-slate-400">{med.molecule} · {med.strength} · {med.dosage_form}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                  stock <= 0 ? 'bg-red-100 text-red-600' : stock < 10 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {stock <= 0 ? 'OOS' : stock + ' left'}
                                </span>
                              </button>
                            );
                          })}
                          <div className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50">
                            Not found? Type the full name — doctor can prescribe any medicine
                          </div>
                        </div>
                      )}
                    </div>
                    <input type="text" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} placeholder="Dosage (e.g. 500mg)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="text" value={item.frequency} onChange={e => updateItem(idx, 'frequency', e.target.value)} placeholder="Frequency (TDS/BD/OD)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="text" value={item.duration} onChange={e => updateItem(idx, 'duration', e.target.value)} placeholder="Duration (e.g. 5 days)" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                    <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="Qty" className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />
                  </div>
                  <input type="text" value={item.instructions} onChange={e => updateItem(idx, 'instructions', e.target.value)} placeholder="Instructions (e.g. after food, at night)" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white" />

                  {item.stock_status === 'out_of_stock' && item.alternatives && item.alternatives.length > 0 && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />Out of stock — alternatives:
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
