'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, Loader2 } from 'lucide-react';

const TIERS = [
  { key: 'individual',      label: 'Individual',       icon: '●', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { key: 'family',          label: 'Family',            icon: '◆', color: 'bg-teal-50 border-teal-200 text-teal-800' },
  { key: 'extended_family', label: 'Extended Family',   icon: '★', color: 'bg-amber-50 border-amber-200 text-amber-800' },
];

interface TierConfig {
  tier: string;
  label: string;
  annual_fee: number;
  doctor_discount: number;
  pharmacy_discount: number;
  lab_discount: number;
  is_active: boolean;
}

export default function VipTierConfigPage() {
  const [configs, setConfigs] = useState<Record<string, TierConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get('/vip-tiers')
      .then(r => {
        const map: Record<string, TierConfig> = {};
        (r.data || []).forEach((t: TierConfig) => { map[t.tier] = t; });
        setConfigs(map);
      })
      .catch(() => toast.error('Failed to load VIP tiers'))
      .finally(() => setLoading(false));
  }, []);

  const update = (tier: string, field: keyof TierConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [tier]: { ...prev[tier], [field]: value },
    }));
  };

  const save = async (tier: string) => {
    setSaving(tier);
    try {
      await api.put(`/vip-tiers/${tier}`, configs[tier]);
      toast.success('Tier saved');
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
        <h1 className="text-xl font-bold text-slate-900">VIP Pass configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure discount percentages per tier. Discounts apply separately to Doctor, Pharmacy and Lab charges.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <strong>How it works:</strong> When a patient has a VIP tier set on their profile,
        discounts are applied automatically at billing time. Doctor discount only applies
        if the doctor's rate card has "VIP discount applicable" enabled.
      </div>

      <div className="space-y-4">
        {TIERS.map(t => {
          const cfg = configs[t.key];
          if (!cfg) return null;
          const isSaving = saving === t.key;
          return (
            <div key={t.key} className={`rounded-xl border-2 ${t.color} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{t.icon}</span>
                  <div>
                    <div className="font-semibold text-base">{t.label}</div>
                    <div className="text-xs opacity-70">VIP pass tier</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.is_active}
                      onChange={e => update(t.key, 'is_active', e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#00475a]"
                    />
                    Active
                  </label>
                  <button
                    onClick={() => save(t.key)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-medium rounded-lg hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Annual fee */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="col-span-1">
                  <label className="text-xs font-medium opacity-70 block mb-1">Annual fee (₹)</label>
                  <input
                    type="number" min="0"
                    value={cfg.annual_fee}
                    onChange={e => update(t.key, 'annual_fee', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-current border-opacity-30 rounded-lg text-sm font-semibold bg-white bg-opacity-60 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20"
                  />
                </div>
              </div>

              {/* Discounts */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { field: 'doctor_discount',   label: 'Doctor discount',   hint: 'On consultation fee (if doctor allows)' },
                  { field: 'pharmacy_discount', label: 'Pharmacy discount', hint: 'On all medicine charges' },
                  { field: 'lab_discount',      label: 'Lab discount',      hint: 'On lab tests and diagnostics' },
                ].map(disc => (
                  <div key={disc.field} className="bg-white bg-opacity-60 rounded-lg p-3 border border-current border-opacity-20">
                    <label className="text-xs font-medium opacity-70 block mb-1">{disc.label}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={(cfg as any)[disc.field]}
                        onChange={e => update(t.key, disc.field as keyof TierConfig, Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-current border-opacity-30 rounded-lg text-lg font-bold text-center bg-transparent focus:outline-none focus:ring-2 focus:ring-[#00475a]/20"
                      />
                      <span className="text-sm font-semibold">%</span>
                    </div>
                    <p className="text-xs opacity-60 mt-1 leading-tight">{disc.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
