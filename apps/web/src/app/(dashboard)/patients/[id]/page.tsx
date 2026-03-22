'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Loader2, Star, User,
  Phone, Calendar, MapPin, AlertTriangle,
} from 'lucide-react';

const VIP_TIERS = [
  { value: '',                label: 'No VIP',          desc: 'Standard patient',                       color: 'border-slate-200 text-slate-600' },
  { value: 'individual',     label: 'Individual',       desc: 'Single person VIP pass',                 color: 'border-blue-200 text-blue-700 bg-blue-50' },
  { value: 'family',         label: 'Family',           desc: 'Covers immediate family members',        color: 'border-teal-200 text-teal-700 bg-teal-50' },
  { value: 'extended_family',label: 'Extended Family',  desc: 'Extended family — highest benefits',     color: 'border-amber-200 text-amber-700 bg-amber-50' },
];

export default function PatientEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [vipSaving, setVipSaving] = useState(false);
  const [patient, setPatient]   = useState<any>(null);
  const [vipInfo, setVipInfo]   = useState<any>(null);
  const [tierDiscounts, setTierDiscounts] = useState<Record<string, any>>({});

  // Form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', mobile: '', gender: '',
    date_of_birth: '', address: '', allergies: '', chronic_conditions: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  });

  // VIP state
  const [vipForm, setVipForm] = useState({
    vip_tier: '' as string,
    vip_valid_until: '',
    vip_since: '',
  });

  useEffect(() => {
    Promise.all([
      api.get(`/patients/${id}`),
      api.get(`/patients/${id}/vip`).catch(() => ({ data: null })),
      api.get('/vip-tiers').catch(() => ({ data: [] })),
    ]).then(([patRes, vipRes, tiersRes]) => {
      const p = patRes.data;
      setPatient(p);
      setForm({
        first_name:              p.first_name              ?? '',
        last_name:               p.last_name               ?? '',
        mobile:                  p.mobile                  ?? '',
        gender:                  p.gender                  ?? '',
        date_of_birth:           p.date_of_birth           ?? '',
        address:                 p.address                 ?? '',
        allergies:               p.allergies               ?? '',
        chronic_conditions:      p.chronic_conditions      ?? '',
        emergency_contact_name:  p.emergency_contact_name  ?? '',
        emergency_contact_phone: p.emergency_contact_phone ?? '',
      });

      if (vipRes.data) {
        setVipInfo(vipRes.data);
        setVipForm({
          vip_tier:       p.vip_tier         ?? '',
          vip_valid_until: p.vip_valid_until  ?? '',
          vip_since:      p.vip_since         ?? '',
        });
      }

      // Build tier discount map
      const map: Record<string, any> = {};
      (tiersRes.data || []).forEach((t: any) => { map[t.tier] = t; });
      setTierDiscounts(map);
    }).catch(() => toast.error('Failed to load patient'))
    .finally(() => setLoading(false));
  }, [id]);

  const saveProfile = async () => {
    if (!form.first_name || !form.mobile) {
      toast.error('First name and mobile are required');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/patients/${id}`, form);
      toast.success('Patient profile saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveVip = async () => {
    setVipSaving(true);
    try {
      await api.patch(`/patients/${id}/vip`, {
        vip_tier:        vipForm.vip_tier || null,
        vip_valid_until: vipForm.vip_valid_until || null,
        vip_since:       vipForm.vip_since || null,
      });
      // Reload VIP info
      const r = await api.get(`/patients/${id}/vip`);
      setVipInfo(r.data);
      toast.success('VIP status updated');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update VIP');
    } finally {
      setVipSaving(false);
    }
  };

  const set = (field: string, value: string) =>
    setForm(p => ({ ...p, [field]: value }));

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  if (!patient) return (
    <div className="p-6 text-center text-slate-500">Patient not found</div>
  );

  const selectedTierConfig = tierDiscounts[vipForm.vip_tier];

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#00475a] text-white flex items-center justify-center text-lg font-bold">
          {(form.first_name?.[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {form.first_name} {form.last_name}
          </h1>
          <p className="text-sm text-slate-500">{form.mobile}</p>
        </div>
        {vipInfo?.tier && (
          <span className="ml-auto flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-sm font-medium text-amber-700">
            <Star className="w-3.5 h-3.5" />
            {VIP_TIERS.find(t => t.value === vipInfo.tier)?.label ?? vipInfo.tier}
          </span>
        )}
      </div>

      {/* ── Profile form ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-[#00475a]" /> Basic information
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">First name *</label>
            <input
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Last name</label>
            <input
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Mobile *</label>
            <input
              value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Gender</label>
            <select
              value={form.gender}
              onChange={e => set('gender', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a] bg-white"
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Date of birth</label>
            <input
              type="date"
              value={form.date_of_birth}
              onChange={e => set('date_of_birth', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Address</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Allergies</label>
            <input
              value={form.allergies}
              onChange={e => set('allergies', e.target.value)}
              placeholder="e.g. Penicillin, Sulfa"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Chronic conditions</label>
            <input
              value={form.chronic_conditions}
              onChange={e => set('chronic_conditions', e.target.value)}
              placeholder="e.g. Diabetes, Hypertension"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Emergency contact name</label>
            <input
              value={form.emergency_contact_name}
              onChange={e => set('emergency_contact_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Emergency contact phone</label>
            <input
              value={form.emergency_contact_phone}
              onChange={e => set('emergency_contact_phone', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white text-sm font-medium rounded-xl hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save profile
        </button>
      </div>

      {/* ── VIP section ──────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" /> VIP pass
        </h2>

        {/* Tier selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {VIP_TIERS.map(tier => (
            <button
              key={tier.value}
              onClick={() => setVipForm(p => ({ ...p, vip_tier: tier.value }))}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                vipForm.vip_tier === tier.value
                  ? tier.value
                    ? `border-[#00475a] ${tier.color}`
                    : 'border-[#00475a] bg-slate-50 text-slate-700'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                {tier.value && <Star className="w-3.5 h-3.5" />}
                <span className="text-sm font-semibold">{tier.label}</span>
              </div>
              <p className="text-xs opacity-70">{tier.desc}</p>
            </button>
          ))}
        </div>

        {/* Show discounts for selected tier */}
        {vipForm.vip_tier && selectedTierConfig && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Doctor',   pct: selectedTierConfig.doctor_discount },
              { label: 'Pharmacy', pct: selectedTierConfig.pharmacy_discount },
              { label: 'Lab',      pct: selectedTierConfig.lab_discount },
            ].map(d => (
              <div key={d.label} className="text-center bg-amber-50 border border-amber-100 rounded-lg py-2">
                <p className="text-xs text-amber-600 font-medium">{d.label}</p>
                <p className="text-base font-bold text-amber-800">{d.pct}% off</p>
              </div>
            ))}
          </div>
        )}

        {/* VIP dates */}
        {vipForm.vip_tier && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Member since</label>
              <input
                type="date"
                value={vipForm.vip_since}
                onChange={e => setVipForm(p => ({ ...p, vip_since: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Valid until</label>
              <input
                type="date"
                value={vipForm.vip_valid_until}
                onChange={e => setVipForm(p => ({ ...p, vip_valid_until: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
              />
            </div>
          </div>
        )}

        <button
          onClick={saveVip}
          disabled={vipSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {vipSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
          Save VIP status
        </button>
      </div>
    </div>
  );
}
