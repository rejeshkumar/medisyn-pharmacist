'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, Loader2, Info } from 'lucide-react';

interface DoctorRate {
  id?: string;
  doctor_id: string;
  new_visit_rate: number;
  follow_up_rate: number;
  emergency_rate: number;
  vip_discount_applicable: boolean;
  doctor?: { full_name: string; specialization?: string };
}

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const AVATAR_COLORS = [
  { bg: '#e1f5ee', tc: '#0f6e56' }, { bg: '#e6f1fb', tc: '#185fa5' },
  { bg: '#fbeaf0', tc: '#993556' }, { bg: '#eeedfe', tc: '#534ab7' },
  { bg: '#faeeda', tc: '#854f0b' }, { bg: '#eaf3de', tc: '#3b6d11' },
];

export default function DoctorRatesPage() {
  const [rates, setRates]   = useState<DoctorRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/doctor-rates'),
      api.get('/users?role=doctor&limit=50'),
    ]).then(([ratesRes, doctorsRes]) => {
      const existingRates: DoctorRate[] = ratesRes.data || [];
      const doctors = doctorsRes.data?.data || doctorsRes.data || [];
      const rateMap = Object.fromEntries(existingRates.map(r => [r.doctor_id, r]));

      // Merge: every doctor gets a rate card (defaults if not set)
      const merged: DoctorRate[] = doctors.map((doc: any) => ({
        doctor_id:               doc.id,
        new_visit_rate:          rateMap[doc.id]?.new_visit_rate          ?? 300,
        follow_up_rate:          rateMap[doc.id]?.follow_up_rate          ?? 150,
        emergency_rate:          rateMap[doc.id]?.emergency_rate          ?? 500,
        vip_discount_applicable: rateMap[doc.id]?.vip_discount_applicable ?? true,
        doctor:                  { full_name: doc.full_name, specialization: doc.specialization },
      }));
      setRates(merged);
    })
    .catch(() => toast.error('Failed to load doctor rates'))
    .finally(() => setLoading(false));
  }, []);

  const update = (doctorId: string, field: keyof DoctorRate, value: any) => {
    setRates(prev => prev.map(r =>
      r.doctor_id === doctorId ? { ...r, [field]: value } : r
    ));
  };

  const save = async (doctorId: string) => {
    const rate = rates.find(r => r.doctor_id === doctorId);
    if (!rate) return;
    setSaving(doctorId);
    try {
      await api.put(`/doctor-rates/${doctorId}`, {
        new_visit_rate:          rate.new_visit_rate,
        follow_up_rate:          rate.follow_up_rate,
        emergency_rate:          rate.emergency_rate,
        vip_discount_applicable: rate.vip_discount_applicable,
      });
      toast.success(`${rate.doctor?.full_name} rates saved`);
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Doctor consultation rates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set rates for each visit type. Control whether VIP pass discount applies per doctor.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3">
        <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          VIP discount toggle controls whether a patient's VIP pass discount applies
          to that doctor's fee. Specialists may choose to opt out while GPs opt in.
        </p>
      </div>

      <div className="space-y-3">
        {rates.map((rate, idx) => {
          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const isSaving = saving === rate.doctor_id;
          const docName = rate.doctor?.full_name ?? 'Unknown';
          const spec = rate.doctor?.specialization ?? '';
          return (
            <div key={rate.doctor_id} className="bg-white border border-slate-100 rounded-xl p-4">
              {/* Doctor info row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    style={{ background: color.bg, color: color.tc }}
                  >
                    {initials(docName)}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{docName}</div>
                    {spec && <div className="text-xs text-slate-500">{spec}</div>}
                  </div>
                </div>
                <button
                  onClick={() => save(rate.doctor_id)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-medium rounded-lg hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>

              {/* Rate inputs */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { field: 'new_visit_rate',  label: 'New visit (₹)' },
                  { field: 'follow_up_rate',  label: 'Follow-up (₹)' },
                  { field: 'emergency_rate',  label: 'Emergency (₹)' },
                ].map(f => (
                  <div key={f.field} className="bg-slate-50 rounded-lg p-2.5">
                    <label className="text-xs text-slate-500 block mb-1">{f.label}</label>
                    <input
                      type="number" min="0" step="10"
                      value={(rate as any)[f.field]}
                      onChange={e => update(rate.doctor_id, f.field as keyof DoctorRate, Number(e.target.value))}
                      className="w-full text-base font-bold text-slate-900 bg-transparent border-none outline-none text-right"
                    />
                  </div>
                ))}
              </div>

              {/* VIP toggle */}
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                rate.vip_discount_applicable
                  ? 'bg-teal-50 border-teal-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">
                    VIP pass discount applicable
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {rate.vip_discount_applicable
                      ? "Patient's VIP tier discount will apply to this doctor's fee"
                      : 'Doctor has opted out — VIP discount will not apply to this fee'}
                  </div>
                </div>
                <button
                  onClick={() => update(rate.doctor_id, 'vip_discount_applicable', !rate.vip_discount_applicable)}
                  className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                    rate.vip_discount_applicable ? 'bg-[#00475a]' : 'bg-slate-300'
                  }`}
                  style={{ width: 40, height: 22 }}
                >
                  <span
                    className="absolute top-0.5 rounded-full bg-white transition-all shadow-sm"
                    style={{
                      width: 18, height: 18,
                      left: rate.vip_discount_applicable ? 20 : 2,
                    }}
                  />
                </button>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  rate.vip_discount_applicable
                    ? 'bg-teal-100 text-teal-700'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {rate.vip_discount_applicable ? 'On' : 'Off'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
