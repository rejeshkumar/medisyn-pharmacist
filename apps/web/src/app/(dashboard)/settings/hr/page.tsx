'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Save, Loader2, MapPin, Plus,
  Trash2, ChevronRight, Clock, Shield,
} from 'lucide-react';

interface SubOption  { key: string; label: string; }
interface RemoteReason { key: string; label: string; sub_options: SubOption[]; }

export default function HrSettingsPage() {
  const router = useRouter();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [locating, setLocating] = useState(false);

  const [settings, setSettings] = useState({
    office_lat:          null as number | null,
    office_lng:          null as number | null,
    office_name:         'Clinic',
    fence_radius_m:      200,
    checkin_early_min:   30,
    late_threshold_min:  15,
    geo_fence_enabled:   false,
    remote_reasons:      [] as RemoteReason[],
  });

  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  useEffect(() => {
    api.get('/hr/settings')
      .then(r => {
        if (r.data) setSettings({
          office_lat:         r.data.office_lat         ?? null,
          office_lng:         r.data.office_lng         ?? null,
          office_name:        r.data.office_name        ?? 'Clinic',
          fence_radius_m:     r.data.fence_radius_m     ?? 200,
          checkin_early_min:  r.data.checkin_early_min  ?? 30,
          late_threshold_min: r.data.late_threshold_min ?? 15,
          geo_fence_enabled:  r.data.geo_fence_enabled  ?? false,
          remote_reasons:     r.data.remote_reasons     ?? DEFAULT_REASONS,
        });
      })
      .catch(() => setSettings(s => ({ ...s, remote_reasons: DEFAULT_REASONS })))
      .finally(() => setLoading(false));
  }, []);

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setSettings(s => ({
          ...s,
          office_lat: pos.coords.latitude,
          office_lng: pos.coords.longitude,
        }));
        toast.success(`Location captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
      },
      err => {
        toast.error('Could not get location: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = async () => {
    if (settings.geo_fence_enabled && (!settings.office_lat || !settings.office_lng)) {
      toast.error('Capture office location before enabling geo-fence');
      return;
    }
    setSaving(true);
    try {
      await api.post('/hr/settings', settings);
      toast.success('HR settings saved');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addReason = () => {
    const key = `reason_${Date.now()}`;
    setSettings(s => ({
      ...s,
      remote_reasons: [...s.remote_reasons, { key, label: '', sub_options: [] }],
    }));
    setExpandedReason(key);
  };

  const updateReason = (idx: number, field: keyof RemoteReason, value: any) => {
    setSettings(s => ({
      ...s,
      remote_reasons: s.remote_reasons.map((r, i) =>
        i === idx ? { ...r, [field]: value } : r
      ),
    }));
  };

  const removeReason = (idx: number) => {
    setSettings(s => ({
      ...s,
      remote_reasons: s.remote_reasons.filter((_, i) => i !== idx),
    }));
  };

  const addSubOption = (reasonIdx: number) => {
    setSettings(s => ({
      ...s,
      remote_reasons: s.remote_reasons.map((r, i) =>
        i === reasonIdx
          ? { ...r, sub_options: [...r.sub_options, { key: `sub_${Date.now()}`, label: '' }] }
          : r
      ),
    }));
  };

  const updateSubOption = (reasonIdx: number, subIdx: number, label: string) => {
    setSettings(s => ({
      ...s,
      remote_reasons: s.remote_reasons.map((r, i) =>
        i === reasonIdx
          ? { ...r, sub_options: r.sub_options.map((so, si) =>
              si === subIdx ? { ...so, label } : so) }
          : r
      ),
    }));
  };

  const removeSubOption = (reasonIdx: number, subIdx: number) => {
    setSettings(s => ({
      ...s,
      remote_reasons: s.remote_reasons.map((r, i) =>
        i === reasonIdx
          ? { ...r, sub_options: r.sub_options.filter((_, si) => si !== subIdx) }
          : r
      ),
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">HR Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Geo-fence, check-in rules, remote work reasons</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d] disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save all
        </button>
      </div>

      {/* ── Check-in rules ──────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#00475a]" />
          <h2 className="font-semibold text-slate-900">Check-in rules</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">
              Allow check-in from (mins before shift)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="120"
                value={settings.checkin_early_min}
                onChange={e => setSettings(s=>({...s,checkin_early_min:Number(e.target.value)}))}
                className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:border-[#00475a]" />
              <span className="text-sm text-slate-500">minutes early</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              e.g. 30 = check-in opens at 8:30 for a 9:00 shift
            </p>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">
              Mark as late after (mins past shift start)
            </label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="60"
                value={settings.late_threshold_min}
                onChange={e => setSettings(s=>({...s,late_threshold_min:Number(e.target.value)}))}
                className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-center font-bold focus:outline-none focus:border-[#00475a]" />
              <span className="text-sm text-slate-500">minutes late</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              e.g. 15 = flagged late only after 9:15 for a 9:00 shift
            </p>
          </div>
        </div>
      </div>

      {/* ── Geo-fence ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#00475a]" />
            <h2 className="font-semibold text-slate-900">Geo-fence</h2>
          </div>
          <button
            onClick={() => setSettings(s=>({...s,geo_fence_enabled:!s.geo_fence_enabled}))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.geo_fence_enabled ? 'bg-[#00475a]' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 rounded-full bg-white shadow transition-all w-5 h-5 ${
              settings.geo_fence_enabled ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>

        {settings.geo_fence_enabled && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Office name</label>
              <input type="text" value={settings.office_name}
                onChange={e => setSettings(s=>({...s,office_name:e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>

            {/* Location capture */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Office location</label>
              <div className="flex items-center gap-3">
                <button onClick={captureLocation} disabled={locating}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-[#00475a] text-[#00475a] text-sm font-semibold rounded-xl hover:bg-teal-50 disabled:opacity-50 transition-colors">
                  {locating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <MapPin className="w-4 h-4" />}
                  {settings.office_lat ? 'Update location' : 'Capture from this device'}
                </button>
                {settings.office_lat && (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <p className="text-xs font-mono text-green-700">
                      {Number(settings.office_lat).toFixed(5)}, {Number(settings.office_lng).toFixed(5)}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Open this page from the clinic device to capture the correct location
              </p>
            </div>

            {/* Radius */}
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">
                Allowed radius — {settings.fence_radius_m}m
              </label>
              <input type="range" min="50" max="1000" step="50"
                value={settings.fence_radius_m}
                onChange={e => setSettings(s=>({...s,fence_radius_m:Number(e.target.value)}))}
                className="w-full accent-[#00475a]" />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>50m (strict)</span>
                <span>500m (building)</span>
                <span>1km (area)</span>
              </div>
            </div>
          </div>
        )}

        {!settings.geo_fence_enabled && (
          <p className="text-sm text-slate-400 text-center py-2">
            Geo-fence is off — staff can check in from anywhere
          </p>
        )}
      </div>

      {/* ── Remote work reasons ─────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00475a]" />
            <div>
              <h2 className="font-semibold text-slate-900">Remote work reasons</h2>
              <p className="text-xs text-slate-400">Shown when staff check in outside the geo-fence</p>
            </div>
          </div>
          <button onClick={addReason}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#00475a] bg-teal-50 rounded-lg hover:bg-teal-100">
            <Plus className="w-3.5 h-3.5" /> Add reason
          </button>
        </div>

        <div className="space-y-2">
          {settings.remote_reasons.map((reason, ri) => (
            <div key={reason.key} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Reason header */}
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => setExpandedReason(expandedReason === reason.key ? null : reason.key)}
                  className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedReason === reason.key ? 'rotate-90' : ''}`} />
                </button>
                <input type="text" value={reason.label}
                  onChange={e => updateReason(ri, 'label', e.target.value)}
                  placeholder="Reason label (e.g. Work from Home)"
                  className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-none outline-none" />
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {reason.sub_options.length} sub-options
                </span>
                <button onClick={() => removeReason(ri)}
                  className="text-slate-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sub-options */}
              {expandedReason === reason.key && (
                <div className="border-t border-slate-100 p-3 bg-slate-50 space-y-2">
                  {reason.sub_options.map((sub, si) => (
                    <div key={sub.key} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                      <input type="text" value={sub.label}
                        onChange={e => updateSubOption(ri, si, e.target.value)}
                        placeholder="Sub-option label"
                        className="flex-1 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00475a]" />
                      <button onClick={() => removeSubOption(ri, si)}
                        className="text-slate-300 hover:text-red-500 flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSubOption(ri)}
                    className="flex items-center gap-1.5 text-xs text-[#00475a] font-medium hover:underline">
                    <Plus className="w-3 h-3" /> Add sub-option
                  </button>
                </div>
              )}
            </div>
          ))}

          {settings.remote_reasons.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-3">
              No reasons configured — staff must enter free text when outside
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Default reasons (used if none configured yet)
const DEFAULT_REASONS: RemoteReason[] = [
  { key:'wfh',      label:'Work from Home',  sub_options:[] },
  { key:'on_duty',  label:'On Duty',         sub_options:[
    { key:'home_collection',   label:'Home Collection' },
    { key:'medicine_delivery', label:'Medicine Delivery' },
    { key:'hospital_visit',    label:'Hospital / Referral Visit' },
    { key:'bank_work',         label:'Bank / Govt. Work' },
  ]},
  { key:'other', label:'Other', sub_options:[] },
];
