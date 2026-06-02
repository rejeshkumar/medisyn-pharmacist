'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Loader2, Crown } from 'lucide-react';
import { ConsentCheckbox } from '@/components/patients/ConsentCheckbox';

// ── Constants ────────────────────────────────────────────────────────────────
const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Other'];
const GENDERS     = ['male', 'female', 'other'];
const CATEGORIES  = ['general', 'insurance', 'corporate', 'senior'];

const VIP_TIERS = [
  { value: 'individual',      label: 'Individual',      desc: 'Single person' },
  { value: 'family',          label: 'Family',          desc: 'Immediate family' },
  { value: 'extended_family', label: 'Extended Family', desc: 'Highest benefits' },
] as const;

const today          = () => new Date().toISOString().split('T')[0];
const oneYearFrom    = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 1); return dt.toISOString().split('T')[0]; };

const EMPTY_FORM = {
  salutation:       'Mr',
  first_name:       '',
  last_name:        '',
  gender:           'male',
  dob:              '',
  age:              '',
  mobile:           '',
  email:            '',
  area:             '',
  address:          '',
  category:         'general',
  ref_by:           '',
  residence_number: '',
  is_first_visit:   true,
  notes:            '',
  is_vip:           false,
  vip_tier:         '' as string,
  vip_start_date:   '',
  vip_end_date:     '',
  consent_given:    false,
  consent_version:  '1.0',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful registration with the new patient object */
  onSuccess?: (patient: any) => void;
  /** Extra query keys to invalidate on success, e.g. ['queue'] */
  invalidateKeys?: string[][];
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PatientRegistrationModal({ open, onClose, onSuccess, invalidateKeys = [] }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const set = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const reset = () => setForm({ ...EMPTY_FORM });

  const handleClose = () => { reset(); onClose(); };

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/patients', data).then(r => r.data),
    onSuccess: (patient) => {
      toast.success('Patient registered successfully');
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient-stats'] });
      invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: k }));
      onSuccess?.(patient);
      handleClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const handleSubmit = () => {
    if (!form.first_name.trim()) { toast.error('First name is required'); return; }
    if (!form.mobile.trim())     { toast.error('Mobile number is required'); return; }
    if (!form.consent_given)     { toast.error('Data privacy consent is required'); return; }
    if (form.is_vip && !form.vip_tier) { toast.error('Please select a VIP category'); return; }

    mutation.mutate({
      ...form,
      age:            form.age ? Number(form.age) : undefined,
      dob:            form.dob || undefined,
      vip_start_date: form.is_vip ? (form.vip_start_date || today()) : undefined,
      vip_end_date:   form.is_vip ? (form.vip_end_date || oneYearFrom(today())) : undefined,
      vip_tier:       form.is_vip ? form.vip_tier : undefined,
    });
  };

  if (!open) return null;

  const canSubmit = !mutation.isPending && form.consent_given && !(form.is_vip && !form.vip_tier);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">

        {/* ── Header ── */}
        <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900">Register New Patient</h3>
          <button onClick={handleClose} aria-label="Close">
            <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">

          {/* Personal Information */}
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Name row */}
              <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-2">
                <div className="sm:w-28">
                  <label className="label">Salutation</label>
                  <select className="input" value={form.salutation} onChange={e => set('salutation', e.target.value)}>
                    {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">First Name <span className="text-red-500">*</span></label>
                  <input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
                </div>
                <div className="flex-1">
                  <label className="label">Last Name</label>
                  <input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="label">Gender</label>
                <div className="flex gap-4 mt-2">
                  {GENDERS.map(g => (
                    <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                      <input type="radio" name="reg-gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>

              {/* DOB + Age */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label">Date of Birth</label>
                  <input type="date" className="input" value={form.dob} onChange={e => set('dob', e.target.value)} />
                </div>
                <div className="w-20">
                  <label className="label">Age</label>
                  <input type="number" className="input" value={form.age} onChange={e => set('age', e.target.value)} placeholder="yrs" min={0} />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="label">Mobile <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <span className="input w-14 text-center text-gray-500 bg-gray-50 flex-shrink-0">+91</span>
                  <input className="input flex-1" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="Mobile number" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
              </div>

              {/* Residence No */}
              <div>
                <label className="label">Residence No.</label>
                <input className="input" value={form.residence_number} onChange={e => set('residence_number', e.target.value)} placeholder="Landline / residence no." />
              </div>

              {/* Area */}
              <div>
                <label className="label">Area</label>
                <input className="input" value={form.area} onChange={e => set('area', e.target.value)} placeholder="Area / locality" />
              </div>

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Referred By */}
              <div>
                <label className="label">Referred By</label>
                <input className="input" value={form.ref_by} onChange={e => set('ref_by', e.target.value)} placeholder="Doctor / person name" />
              </div>

              {/* Address */}
              <div className="col-span-1 sm:col-span-2">
                <label className="label">Address</label>
                <textarea className="input resize-none" rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
              </div>
            </div>
          </section>

          {/* VIP Pass */}
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" /> SimpliRx VIP Pass
            </p>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_vip}
                onChange={e => {
                  const c = e.target.checked;
                  setForm(p => ({
                    ...p,
                    is_vip:         c,
                    vip_tier:       c ? p.vip_tier : '',
                    vip_start_date: c ? today() : '',
                    vip_end_date:   c ? oneYearFrom(today()) : '',
                  }));
                }}
                className="w-4 h-4 accent-amber-600"
              />
              <span className="text-sm font-medium text-amber-800">Enroll as VIP Member</span>
            </label>

            {form.is_vip && (
              <div className="space-y-3">
                {/* Tier selector — mandatory */}
                <div>
                  <label className="label text-amber-700 text-xs font-semibold">
                    VIP Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {VIP_TIERS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set('vip_tier', t.value)}
                        className={`rounded-xl border-2 p-2.5 text-left transition-all ${
                          form.vip_tier === t.value
                            ? 'border-amber-500 bg-amber-100'
                            : 'border-amber-200 bg-white hover:border-amber-300'
                        }`}
                      >
                        <p className={`text-xs font-semibold ${form.vip_tier === t.value ? 'text-amber-800' : 'text-gray-700'}`}>{t.label}</p>
                        <p className={`text-[10px] mt-0.5 ${form.vip_tier === t.value ? 'text-amber-600' : 'text-gray-400'}`}>{t.desc}</p>
                      </button>
                    ))}
                  </div>
                  {!form.vip_tier && (
                    <p className="text-xs text-amber-600 mt-1.5">⚠️ Select a VIP category to continue</p>
                  )}
                </div>

                {/* VIP dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-amber-700 text-xs">VIP Start</label>
                    <input
                      type="date"
                      className="input border-amber-200"
                      value={form.vip_start_date}
                      onChange={e => {
                        const s = e.target.value;
                        setForm(p => ({ ...p, vip_start_date: s, vip_end_date: s ? oneYearFrom(s) : '' }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="label text-amber-700 text-xs">VIP End (1 year)</label>
                    <input
                      type="date"
                      className="input border-amber-300 bg-amber-100/60 text-amber-900 font-semibold"
                      value={form.vip_end_date}
                      onChange={e => set('vip_end_date', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* First Visit */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_first_visit}
              onChange={e => set('is_first_visit', e.target.checked)}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm text-gray-700">Is First Visit</span>
          </label>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes..." />
          </div>

          {/* DPDPA Consent — shared component */}
          <ConsentCheckbox
            checked={form.consent_given}
            onChange={v => set('consent_given', v)}
            required
          />
        </div>

        {/* ── Footer ── */}
        <div className="p-5 border-t flex gap-3 flex-shrink-0">
          <button onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Register Patient
          </button>
        </div>
      </div>
    </div>
  );
}

export default PatientRegistrationModal;
