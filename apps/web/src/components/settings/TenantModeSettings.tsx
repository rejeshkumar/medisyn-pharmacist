'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Store, Stethoscope, Building2, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clearTenantModeCache } from '@/lib/tenant-mode';

const MODES = [
  {
    value: 'full',
    label: 'Full Platform',
    description: 'Clinic + pharmacy features both active',
    icon: Building2,
    color: 'border-teal-200 bg-teal-50 text-teal-700',
  },
  {
    value: 'pharmacy_only',
    label: 'Pharmacy Only',
    description: 'Dispensing, stock, billing — no clinic queue',
    icon: Store,
    color: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    value: 'clinic_only',
    label: 'Clinic Only',
    description: 'Queue, consultations, prescriptions — no dispensing',
    icon: Stethoscope,
    color: 'border-purple-200 bg-purple-50 text-purple-700',
  },
];

export default function TenantModeSettings() {
  const [mode, setMode]     = useState('full');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/tenants/me')
      .then(r => { setMode(r.data?.mode ?? 'full'); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/tenants/me', { mode });
      clearTenantModeCache();
      toast.success('Platform mode updated — reload to see changes');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="text-sm text-slate-400 py-2">Loading...</div>;

  return (
    <div>
      <div className="grid gap-3 mb-4">
        {MODES.map(m => {
          const Icon = m.icon;
          const selected = mode === m.value;
          return (
            <button key={m.value} onClick={() => setMode(m.value)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all
                ${selected ? m.color + ' border-2' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                ${selected ? 'bg-white/60' : 'bg-slate-100'}`}>
                <Icon className={`w-4 h-4 ${selected ? '' : 'text-slate-500'}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{m.label}</p>
                <p className={`text-xs mt-0.5 ${selected ? 'opacity-80' : 'text-slate-400'}`}>{m.description}</p>
              </div>
              {selected && (
                <div className="w-4 h-4 rounded-full bg-current opacity-30 flex-shrink-0 border-2 border-current" />
              )}
            </button>
          );
        })}
      </div>
      <button onClick={save} disabled={saving}
        className="w-full py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Platform Mode
      </button>
    </div>
  );
}
