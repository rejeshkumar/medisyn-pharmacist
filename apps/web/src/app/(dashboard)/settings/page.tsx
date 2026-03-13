'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Settings, Stethoscope, AlertTriangle, Save, Loader2, Building2, Scan } from 'lucide-react';
import DoctorFeeSettings from '@/components/settings/DoctorFeeSettings';
import TenantModeSettings from '@/components/settings/TenantModeSettings';
import toast from 'react-hot-toast';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SettingsPage() {
  const [expiryDays, setExpiryDays] = useState(60);
  const [saving, setSaving] = useState(false);
  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    axios.get(`${API}/settings/expiry-threshold`, { headers: headers() })
      .then(r => setExpiryDays(r.data?.days ?? 60))
      .catch(() => {});
  }, []);

  const saveExpiryThreshold = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/settings/expiry-threshold`, { days: expiryDays }, { headers: headers() });
      toast.success('Expiry warning threshold saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-[#00475a]" />
          <h2 className="font-semibold text-slate-800">Platform Mode</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">Control which features are active for this tenant.</p>
        <TenantModeSettings />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Stethoscope className="w-4 h-4 text-[#00475a]" />
          <h2 className="font-semibold text-slate-800">Doctor Consultation Fees</h2>
        </div>
        <DoctorFeeSettings />
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Expiry Warning Threshold</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Warn about medicines expiring within this many days.</p>
        <div className="flex items-center gap-3">
          <input type="number" min="7" max="365" value={expiryDays}
            onChange={e => setExpiryDays(parseInt(e.target.value) || 60)}
            className="w-24 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
          <span className="text-sm text-slate-500">days before expiry</span>
          <button onClick={saveExpiryThreshold} disabled={saving}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-semibold hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-slate-500" />
            <div>
              <h2 className="font-semibold text-slate-800">Barcode Mappings</h2>
              <p className="text-xs text-slate-400 mt-0.5">Link product barcodes to medicines for fast scanning</p>
            </div>
          </div>
          <Link href="/barcode-mapping" className="text-sm text-[#00475a] font-semibold hover:underline">
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
