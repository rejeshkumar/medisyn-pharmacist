'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Loader2, ChevronLeft, Save, CheckCircle, Heart, Thermometer, Scale, Activity, Droplets, Wind } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const patientName = (p: any) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';

export default function NursePrecheckPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const router = useRouter();
  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const [queue, setQueue] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [vitals, setVitals] = useState({
    bp_systolic:      '',
    bp_diastolic:     '',
    pulse_rate:       '',
    temperature:      '',
    weight:           '',
    height:           '',
    spo2:             '',
    blood_sugar:      '',
    chief_complaint:  '',
    allergies:        '',
    current_medicines:'',
    notes:            '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/queue/${queueId}`, { headers: headers() });
        setQueue(r.data);
        // Load existing pre-check if any
        try {
          const pr = await axios.get(`${API}/queue/${queueId}/precheck`, { headers: headers() });
          if (pr.data) {
            setExisting(pr.data);
            setVitals({
              bp_systolic:       pr.data.bp_systolic?.toString() || '',
              bp_diastolic:      pr.data.bp_diastolic?.toString() || '',
              pulse_rate:        pr.data.pulse_rate?.toString() || '',
              temperature:       pr.data.temperature?.toString() || '',
              weight:            pr.data.weight?.toString() || '',
              height:            pr.data.height?.toString() || '',
              spo2:              pr.data.spo2?.toString() || '',
              blood_sugar:       pr.data.blood_sugar?.toString() || '',
              chief_complaint:   pr.data.chief_complaint || r.data.chief_complaint || '',
              allergies:         pr.data.allergies || '',
              current_medicines: pr.data.current_medicines || '',
              notes:             pr.data.notes || '',
            });
          } else {
            setVitals(v => ({ ...v, chief_complaint: r.data.chief_complaint || '' }));
          }
        } catch {
          setVitals(v => ({ ...v, chief_complaint: r.data.chief_complaint || '' }));
        }
      } catch {
        toast.error('Failed to load patient');
        router.push('/nurse');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [queueId]);

  const v = (val: string) => val ? parseFloat(val) : undefined;
  const vi = (val: string) => val ? parseInt(val) : undefined;

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/queue/precheck`, {
        queue_id: queueId,
        bp_systolic:       vi(vitals.bp_systolic),
        bp_diastolic:      vi(vitals.bp_diastolic),
        pulse_rate:        vi(vitals.pulse_rate),
        temperature:       v(vitals.temperature),
        weight:            v(vitals.weight),
        height:            v(vitals.height),
        spo2:              vi(vitals.spo2),
        blood_sugar:       v(vitals.blood_sugar),
        chief_complaint:   vitals.chief_complaint || undefined,
        allergies:         vitals.allergies || undefined,
        current_medicines: vitals.current_medicines || undefined,
        notes:             vitals.notes || undefined,
      }, { headers: headers() });
      setSaved(true);
      toast.success('Pre-check saved — patient advanced to Pre-check Done');
      setTimeout(() => router.push('/nurse'), 1500);
    } catch (e: any) {
      const detail = e?.response?.data?.message;
      const msg = Array.isArray(detail) ? detail.join(', ') : (detail || `Error ${e?.response?.status || ''}: Failed to save pre-check`);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: string) => setVitals(v => ({ ...v, [field]: value }));

  // BMI calculation
  const bmi = vitals.weight && vitals.height
    ? (parseFloat(vitals.weight) / Math.pow(parseFloat(vitals.height) / 100, 2)).toFixed(1)
    : null;

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading...</span>
    </div>
  );

  if (saved) return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-lg font-bold text-slate-800">Pre-check Saved!</h2>
      <p className="text-sm text-slate-400 mt-1">Patient advanced to Pre-check Done</p>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.push('/nurse')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors">
        <ChevronLeft className="w-4 h-4" />Back to Queue
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-black text-pink-600">#{queue?.token_number}</span>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg">{patientName(queue?.patient)}</h2>
            <p className="text-sm text-slate-400">{queue?.patient?.mobile} · {queue?.chief_complaint || 'No complaint noted'}</p>
          </div>
          {existing && <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">Updating existing</span>}
        </div>
      </div>

      <div className="space-y-4">
        {/* Vitals */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-pink-600" />Vitals
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {/* BP */}
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />Blood Pressure (mmHg)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={vitals.bp_systolic} onChange={e => set('bp_systolic', e.target.value)}
                  placeholder="Systolic" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
                <span className="text-slate-400">/</span>
                <input type="number" value={vitals.bp_diastolic} onChange={e => set('bp_diastolic', e.target.value)}
                  placeholder="Diastolic" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
              </div>
            </div>

            {/* Pulse */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Activity className="w-3 h-3 text-pink-400" />Pulse Rate (bpm)</label>
              <input type="number" value={vitals.pulse_rate} onChange={e => set('pulse_rate', e.target.value)}
                placeholder="e.g. 72" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>

            {/* Temperature */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Thermometer className="w-3 h-3 text-orange-400" />Temperature (°F)</label>
              <input type="number" step="0.1" value={vitals.temperature} onChange={e => set('temperature', e.target.value)}
                placeholder="e.g. 98.6" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>

            {/* Weight */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Scale className="w-3 h-3 text-blue-400" />Weight (kg)</label>
              <input type="number" step="0.1" value={vitals.weight} onChange={e => set('weight', e.target.value)}
                placeholder="e.g. 70" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>

            {/* Height */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Scale className="w-3 h-3 text-blue-400" />Height (cm)</label>
              <input type="number" value={vitals.height} onChange={e => set('height', e.target.value)}
                placeholder="e.g. 170" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>

            {/* BMI auto-calculated */}
            {bmi && (
              <div className="col-span-2">
                <div className="bg-slate-50 rounded-lg px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">BMI:</span>
                  <span className={`text-sm font-bold ${parseFloat(bmi) < 18.5 ? 'text-blue-600' : parseFloat(bmi) < 25 ? 'text-green-600' : parseFloat(bmi) < 30 ? 'text-amber-600' : 'text-red-600'}`}>{bmi}</span>
                  <span className="text-xs text-slate-400">
                    {parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Normal' : parseFloat(bmi) < 30 ? 'Overweight' : 'Obese'}
                  </span>
                </div>
              </div>
            )}

            {/* SpO2 */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Wind className="w-3 h-3 text-teal-400" />SpO2 (%)</label>
              <input type="number" value={vitals.spo2} onChange={e => set('spo2', e.target.value)}
                placeholder="e.g. 98" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>

            {/* Blood Sugar */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block flex items-center gap-1"><Droplets className="w-3 h-3 text-red-400" />Blood Sugar (mg/dL)</label>
              <input type="number" value={vitals.blood_sugar} onChange={e => set('blood_sugar', e.target.value)}
                placeholder="e.g. 110" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>
          </div>
        </div>

        {/* Clinical info */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Clinical Information</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Chief Complaint</label>
              <input value={vitals.chief_complaint} onChange={e => set('chief_complaint', e.target.value)}
                placeholder="Primary reason for visit"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Known Allergies</label>
              <input value={vitals.allergies} onChange={e => set('allergies', e.target.value)}
                placeholder="Any drug or food allergies"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Current Medicines</label>
              <input value={vitals.current_medicines} onChange={e => set('current_medicines', e.target.value)}
                placeholder="Medicines patient is currently taking"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Notes</label>
              <textarea value={vitals.notes} onChange={e => set('notes', e.target.value)} rows={2}
                placeholder="Any additional observations"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-400 resize-none" />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-pink-600 text-white font-semibold rounded-xl hover:bg-pink-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Pre-check & Advance Queue'}
        </button>
      </div>
    </div>
  );
}
