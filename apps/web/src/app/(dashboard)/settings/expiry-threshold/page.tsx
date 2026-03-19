'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, AlertTriangle } from 'lucide-react';

export default function ExpiryThresholdPage() {
  const router = useRouter();
  const [days, setDays]       = useState<number>(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get('/settings/expiry-threshold')
      .then(r => setDays(r.data?.expiry_warning_days ?? r.data?.days ?? 60))
      .catch(() => setDays(60))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (days < 1 || days > 365) { toast.error('Enter a value between 1 and 365 days'); return; }
    setSaving(true);
    try {
      await api.patch('/settings/expiry-threshold', { expiry_warning_days: days });
      toast.success('Expiry threshold saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-lg">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expiry warning threshold</h1>
          <p className="text-sm text-slate-500">How many days before expiry to show warnings</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-xl p-6">
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Warn when stock expires within
          </label>
          <div className="flex items-center gap-3 mb-6">
            <input
              type="number" min="1" max="365"
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="w-28 px-4 py-3 border border-slate-200 rounded-xl text-2xl font-bold text-center focus:outline-none focus:border-[#00475a]"
            />
            <span className="text-lg text-slate-500 font-medium">days</span>
          </div>

          {/* Visual guide */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <strong>Red alert</strong> — expires within 14 days (fixed)
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                <strong>Amber warning</strong> — expires within <strong>{days} days</strong> (your setting)
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
              <p className="text-sm text-green-700">
                <strong>No warning</strong> — expires after {days} days
              </p>
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#00475a] text-white text-sm font-medium rounded-xl hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save threshold
          </button>
        </div>
      )}
    </div>
  );
}
