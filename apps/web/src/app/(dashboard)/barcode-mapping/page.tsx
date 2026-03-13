'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Scan, Search, Link2, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function BarcodeMappingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefill = searchParams.get('barcode') || '';

  const [barcode, setBarcode]     = useState(prefill);
  const [search, setSearch]       = useState('');
  const [medicines, setMedicines] = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [mappings, setMappings]   = useState<any[]>([]);

  // Load existing mappings
  useEffect(() => {
    api.get('/medicines/barcode-mappings').then(r => setMappings(r.data || [])).catch(() => {});
  }, []);

  // Search medicines with debounce
  useEffect(() => {
    if (!search.trim() || search.length < 2) { setMedicines([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.get(`/medicines?search=${encodeURIComponent(search)}&limit=10`)
        .then(r => setMedicines(r.data?.data || r.data || []))
        .catch(() => setMedicines([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleSave = async () => {
    if (!barcode.trim() || !selected) { toast.error('Enter barcode and select a medicine'); return; }
    setSaving(true);
    try {
      await api.post('/medicines/barcode-mappings', {
        barcode: barcode.trim(),
        medicine_id: selected.id,
      });
      toast.success(`Barcode mapped to ${selected.brand_name}`);
      setMappings(m => [{ barcode: barcode.trim(), medicine: selected, created_at: new Date() }, ...m]);
      setBarcode('');
      setSearch('');
      setSelected(null);
      setMedicines([]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Scan className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Barcode Mapping</h1>
          <p className="text-xs text-slate-400">Link barcodes to medicines for fast scanning</p>
        </div>
      </div>

      {/* Map new barcode */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Map a Barcode</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Barcode</label>
            <input
              type="text"
              value={barcode}
              onChange={e => setBarcode(e.target.value)}
              placeholder="Scan or type barcode..."
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] font-mono tracking-wider"
              autoFocus={!!prefill}
            />
          </div>

          <div className="relative">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Search Medicine</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={selected ? selected.brand_name : search}
                onChange={e => { setSearch(e.target.value); setSelected(null); }}
                placeholder="Type medicine name..."
                className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
              {selected && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />}
            </div>

            {medicines.length > 0 && !selected && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-lg z-10 mt-1 overflow-hidden">
                {medicines.map(m => (
                  <button key={m.id} onClick={() => { setSelected(m); setSearch(''); setMedicines([]); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <p className="text-sm font-medium text-slate-800">{m.brand_name}</p>
                    <p className="text-xs text-slate-400">{m.molecule} · {m.strength} · {m.dosage_form}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSave} disabled={saving || !barcode.trim() || !selected}
            className="w-full py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Save Mapping
          </button>
        </div>
      </div>

      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Existing Mappings ({mappings.length})</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{m.barcode}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{m.medicine?.brand_name || m.medicine_name}</p>
                  <p className="text-xs text-slate-400">{m.medicine?.molecule} · {m.medicine?.strength}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarcodeMappingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading...</div>}>
      <BarcodeMappingContent />
    </Suspense>
  );
}
