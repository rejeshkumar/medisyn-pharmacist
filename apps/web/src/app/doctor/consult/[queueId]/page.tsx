'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft, User, Heart, Thermometer, Wind,
  Activity, Save, FileText, CheckCircle2, Plus, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PrescriptionItem {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  instructions: string;
}

const emptyItem = (): PrescriptionItem => ({
  medicine_name: '', dosage: '', frequency: '', duration: '', quantity: '', instructions: '',
});

export default function ConsultPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const router = useRouter();
  const user = getUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'consult' | 'rx'>('consult');
  const [consultSaved, setConsultSaved] = useState(false);
  const [consultId, setConsultId] = useState<string | null>(null);

  // Consult form state
  const [form, setForm] = useState({
    symptoms: '', examination: '', diagnosis: '',
    diagnosis_code: '', advice: '', follow_up_date: '', referral: '',
    is_follow_up: false,
  });

  // Prescription items
  const [items, setItems] = useState<PrescriptionItem[]>([emptyItem()]);
  const [rxNotes, setRxNotes] = useState('');

  // Load queue entry
  const { data: queueEntry } = useQuery({
    queryKey: ['queue-entry', queueId],
    queryFn: () => api.get(`/queue/${queueId}`).then(r => r.data),
  });

  // Load pre-check vitals
  const { data: preCheck } = useQuery({
    queryKey: ['precheck', queueId],
    queryFn: () => api.get(`/queue/${queueId}/precheck`).then(r => r.data),
    retry: false,
  });

  // Load existing consultation if any
  const { data: existingConsult } = useQuery({
    queryKey: ['consult-by-queue', queueId],
    queryFn: () => api.get(`/consultations/queue/${queueId}`).then(r => {
      const c = r.data;
      setConsultSaved(true);
      setConsultId(c.id);
      setForm({
        symptoms: c.symptoms || '',
        examination: c.examination || '',
        diagnosis: c.diagnosis || '',
        diagnosis_code: c.diagnosis_code || '',
        advice: c.advice || '',
        follow_up_date: c.follow_up_date || '',
        referral: c.referral || '',
        is_follow_up: c.is_follow_up || false,
      });
      return c;
    }),
    retry: false,
  });

  const saveConsultMutation = useMutation({
    mutationFn: () => api.post('/consultations', {
      queue_id: queueId,
      patient_id: queueEntry?.patient_id,
      ...form,
    }),
    onSuccess: (res) => {
      setConsultId(res.data.id);
      setConsultSaved(true);
      toast.success('Consultation saved');
      qc.invalidateQueries({ queryKey: ['doctor-queue'] });
      setTab('rx');
    },
    onError: () => toast.error('Failed to save consultation'),
  });

  const completeConsultMutation = useMutation({
    mutationFn: () => api.patch(`/consultations/${consultId}/complete`, form),
    onSuccess: () => {
      toast.success('Consultation completed');
      qc.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
    onError: () => toast.error('Failed to complete consultation'),
  });

  const createRxMutation = useMutation({
    mutationFn: () => api.post('/prescriptions', {
      consultation_id: consultId,
      patient_id: queueEntry?.patient_id,
      notes: rxNotes,
      items: items.filter(i => i.medicine_name.trim()).map(i => ({
        ...i,
        quantity: i.quantity ? parseInt(i.quantity) : undefined,
      })),
    }),
    onSuccess: (res) => {
      toast.success(`Prescription ${res.data.prescription_no} created`);
      completeConsultMutation.mutate();
      router.push('/doctor');
    },
    onError: () => toast.error('Failed to create prescription'),
  });

  const handleFinish = () => {
    if (!consultId) { toast.error('Save consultation first'); return; }
    const filledItems = items.filter(i => i.medicine_name.trim());
    if (filledItems.length === 0) { toast.error('Add at least one medicine'); return; }
    createRxMutation.mutate();
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof PrescriptionItem, value: string) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const patient = queueEntry?.patient;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/doctor')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Queue
      </button>

      {/* Patient header */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5 flex items-start gap-4">
        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-[#00475a] font-bold text-lg flex-shrink-0">
          {patient?.name?.[0]?.toUpperCase() || 'P'}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">{patient?.name || '—'}</h1>
          <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500">
            {patient?.age && <span>Age: {patient.age}</span>}
            {patient?.gender && <span className="capitalize">{patient.gender}</span>}
            {patient?.phone && <span>{patient.phone}</span>}
            {queueEntry?.chief_complaint && <span>Chief complaint: {queueEntry.chief_complaint}</span>}
          </div>
          {patient?.known_allergies && (
            <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 inline-block">
              ⚠️ Allergies: {patient.known_allergies}
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
              { label: 'BP', value: preCheck.bp_systolic ? `${preCheck.bp_systolic}/${preCheck.bp_diastolic}` : '—', icon: Activity },
              { label: 'Pulse', value: preCheck.pulse_rate ? `${preCheck.pulse_rate} bpm` : '—', icon: Heart },
              { label: 'Temp', value: preCheck.temperature ? `${preCheck.temperature}°F` : '—', icon: Thermometer },
              { label: 'SpO2', value: preCheck.spo2 ? `${preCheck.spo2}%` : '—', icon: Wind },
              { label: 'Weight', value: preCheck.weight ? `${preCheck.weight} kg` : '—', icon: User },
              { label: 'BMI', value: preCheck.bmi || '—', icon: Activity },
            ].map(v => {
              const Icon = v.icon;
              return (
                <div key={v.label} className="bg-white rounded-lg p-2.5 text-center border border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">{v.label}</p>
                  <p className="text-sm font-semibold text-slate-800">{v.value}</p>
                </div>
              );
            })}
          </div>
          {preCheck.allergies && (
            <p className="text-xs text-red-600 mt-2">Reported allergies: {preCheck.allergies}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {(['consult', 'rx'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={t === 'rx' && !consultSaved}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
              t === 'rx' && !consultSaved ? 'opacity-40 cursor-not-allowed' : '',
            )}
          >
            {t === 'consult' ? '🩺 Consultation' : '💊 Prescription'}
            {t === 'consult' && consultSaved && <CheckCircle2 className="w-3.5 h-3.5 inline ml-1.5 text-green-500" />}
          </button>
        ))}
      </div>

      {/* Consultation tab */}
      {tab === 'consult' && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              id="follow_up"
              checked={form.is_follow_up}
              onChange={e => setForm({ ...form, is_follow_up: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="follow_up" className="text-sm text-slate-600">Follow-up visit</label>
          </div>

          {[
            { field: 'symptoms', label: 'Symptoms', placeholder: 'Describe patient symptoms...', rows: 2 },
            { field: 'examination', label: 'Examination Findings', placeholder: 'Clinical examination notes...', rows: 2 },
            { field: 'diagnosis', label: 'Diagnosis *', placeholder: 'Primary diagnosis...', rows: 2 },
          ].map(({ field, label, placeholder, rows }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <textarea
                rows={rows}
                value={(form as any)[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
                placeholder={placeholder}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ICD / Diagnosis Code</label>
              <input
                type="text"
                value={form.diagnosis_code}
                onChange={e => setForm({ ...form, diagnosis_code: e.target.value })}
                placeholder="e.g. J06.9"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={form.follow_up_date}
                onChange={e => setForm({ ...form, follow_up_date: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Advice to Patient</label>
            <textarea
              rows={2}
              value={form.advice}
              onChange={e => setForm({ ...form, advice: e.target.value })}
              placeholder="Lifestyle advice, diet, rest..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Referral</label>
            <input
              type="text"
              value={form.referral}
              onChange={e => setForm({ ...form, referral: e.target.value })}
              placeholder="Refer to specialist (if any)"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => saveConsultMutation.mutate()}
              disabled={!form.diagnosis || saveConsultMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {consultSaved ? 'Update & Continue' : 'Save & Continue to Prescription'}
            </button>
          </div>
        </div>
      )}

      {/* Prescription tab */}
      {tab === 'rx' && (
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00475a]" /> Prescription Items
            </h3>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-sm text-[#00475a] hover:text-[#003d4d] font-medium"
            >
              <Plus className="w-4 h-4" /> Add Medicine
            </button>
          </div>

          <div className="space-y-3 mb-4">
            {items.map((item, i) => (
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500">Medicine {i + 1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={item.medicine_name}
                      onChange={e => updateItem(i, 'medicine_name', e.target.value)}
                      placeholder="Medicine name *"
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                    />
                  </div>
                  <input
                    type="text"
                    value={item.dosage}
                    onChange={e => updateItem(i, 'dosage', e.target.value)}
                    placeholder="Dosage (e.g. 500mg)"
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                  />
                  <input
                    type="text"
                    value={item.frequency}
                    onChange={e => updateItem(i, 'frequency', e.target.value)}
                    placeholder="Frequency (e.g. TID)"
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                  />
                  <input
                    type="text"
                    value={item.duration}
                    onChange={e => updateItem(i, 'duration', e.target.value)}
                    placeholder="Duration (e.g. 5 days)"
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                  />
                </div>
                <input
                  type="text"
                  value={item.instructions}
                  onChange={e => updateItem(i, 'instructions', e.target.value)}
                  placeholder="Special instructions (e.g. after food)"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white"
                />
              </div>
            ))}
          </div>

          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-1">Prescription Notes</label>
            <textarea
              rows={2}
              value={rxNotes}
              onChange={e => setRxNotes(e.target.value)}
              placeholder="Additional notes for pharmacist..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleFinish}
              disabled={createRxMutation.isPending || completeConsultMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Issue Prescription & Complete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
