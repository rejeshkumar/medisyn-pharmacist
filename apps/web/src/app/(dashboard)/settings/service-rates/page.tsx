'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Save, Trash2, Loader2 } from 'lucide-react';

type Category = 'consultation' | 'lab' | 'procedure' | 'other';

interface ServiceRate {
  id?: string;
  category: Category;
  name: string;
  rate: number;
  unit: string;
  gst_percent: number;
  is_active: boolean;
  _dirty?: boolean;
  _new?: boolean;
}

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'consultation', label: 'Consultation',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'lab',          label: 'Lab & diagnostics', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'procedure',    label: 'Procedures',        color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'other',        label: 'Other',             color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const DEFAULT_UNITS: Record<Category, string> = {
  consultation: 'per visit',
  lab:          'per test',
  procedure:    'per session',
  other:        'per item',
};

export default function ServiceRatesPage() {
  const [rates, setRates]     = useState<ServiceRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('lab');

  useEffect(() => {
    api.get('/service-rates')
      .then(r => setRates(r.data || []))
      .catch(() => toast.error('Failed to load rates'))
      .finally(() => setLoading(false));
  }, []);

  const addNew = (category: Category) => {
    const newRate: ServiceRate = {
      category,
      name: '',
      rate: 0,
      unit: DEFAULT_UNITS[category],
      gst_percent: category === 'procedure' ? 18 : 0,
      is_active: true,
      _new: true,
      _dirty: true,
    };
    setRates(prev => [...prev, newRate]);
  };

  const update = (idx: number, field: keyof ServiceRate, value: any) => {
    setRates(prev => prev.map((r, i) =>
      i === idx ? { ...r, [field]: value, _dirty: true } : r
    ));
  };

  const remove = async (idx: number, rate: ServiceRate) => {
    if (rate._new) {
      setRates(prev => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!rate.id) return;
    try {
      await api.delete(`/service-rates/${rate.id}`);
      setRates(prev => prev.filter((_, i) => i !== idx));
      toast.success('Service removed');
    } catch {
      toast.error('Failed to remove');
    }
  };

  const saveAll = async () => {
    const dirty = rates.filter(r => r._dirty);
    if (dirty.length === 0) { toast.success('No changes to save'); return; }
    setSaving(true);
    try {
      await Promise.all(dirty.map(r => {
        const payload = {
          category:    r.category,
          name:        r.name,
          rate:        r.rate,
          unit:        r.unit,
          gst_percent: r.gst_percent,
          is_active:   r.is_active,
        };
        return r._new
          ? api.post('/service-rates', payload)
          : api.put(`/service-rates/${r.id}`, payload);
      }));
      // Reload
      const res = await api.get('/service-rates');
      setRates(res.data || []);
      toast.success('All rates saved');
    } catch {
      toast.error('Failed to save some rates');
    } finally {
      setSaving(false);
    }
  };

  const visible = rates.filter(r => r.category === activeTab && r.is_active !== false);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service rate catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage rates for lab tests, procedures and other services.
          </p>
        </div>
        <button
          onClick={saveAll}
          disabled={saving || !rates.some(r => r._dirty)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-medium rounded-xl hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save all changes
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === cat.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {cat.label}
            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === cat.key ? 'bg-[#00475a]/10 text-[#00475a]' : 'bg-slate-200 text-slate-500'
            }`}>
              {rates.filter(r => r.category === cat.key && r.is_active !== false).length}
            </span>
          </button>
        ))}
      </div>

      {/* Rate table */}
      <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <div className="col-span-5">Service name</div>
          <div className="col-span-2">Unit</div>
          <div className="col-span-2 text-right">Rate (₹)</div>
          <div className="col-span-2 text-right">GST %</div>
          <div className="col-span-1"></div>
        </div>

        {/* Rows */}
        {visible.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No services yet — click "+ Add" below
          </div>
        ) : (
          visible.map((rate, visIdx) => {
            const realIdx = rates.findIndex(r => r === rate);
            return (
              <div
                key={rate.id ?? `new-${visIdx}`}
                className={`grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${
                  rate._dirty ? 'bg-teal-50/30' : ''
                } hover:bg-slate-50 transition-colors`}
              >
                <div className="col-span-5">
                  <input
                    type="text"
                    value={rate.name}
                    onChange={e => update(realIdx, 'name', e.target.value)}
                    placeholder="Service name..."
                    className="w-full text-sm text-slate-900 bg-transparent border-none outline-none placeholder-slate-300 focus:ring-0"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={rate.unit}
                    onChange={e => update(realIdx, 'unit', e.target.value)}
                    className="w-full text-sm text-slate-500 bg-transparent border-none outline-none focus:ring-0"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number" min="0" step="10"
                    value={rate.rate}
                    onChange={e => update(realIdx, 'rate', Number(e.target.value))}
                    className="w-full text-sm font-semibold text-slate-900 bg-transparent border-none outline-none text-right focus:ring-0"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number" min="0" max="28" step="0.5"
                    value={rate.gst_percent}
                    onChange={e => update(realIdx, 'gst_percent', Number(e.target.value))}
                    className="w-full text-sm text-slate-500 bg-transparent border-none outline-none text-right focus:ring-0"
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => remove(realIdx, rate)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={() => addNew(activeTab)}
        className="mt-3 flex items-center gap-2 text-sm text-[#00475a] font-medium hover:text-[#003d4d] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add {CATEGORIES.find(c => c.key === activeTab)?.label.toLowerCase()} service
      </button>
    </div>
  );
}
