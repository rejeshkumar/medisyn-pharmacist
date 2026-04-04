'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Scan, ArrowLeft, CheckCircle2, X, Search,
  Loader2, Link2, AlertTriangle, Save, RotateCcw, Camera,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const CameraScanner = dynamic(() => import('@/components/dispensing/CameraScanner'), { ssr: false });

interface QueueItem {
  id: number;
  barcode: string;
  medicine: any;
  status: 'pending' | 'saved' | 'error';
}

type Mode = 'scan' | 'review' | 'done';

export default function BulkBarcodeMappingPage() {
  const router = useRouter();
  const barcodeRef  = useRef<HTMLInputElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  const [mode, setMode]               = useState<Mode>('scan');
  const [barcode, setBarcode]         = useState('');
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [matchedMed, setMatchedMed]   = useState<any>(null);
  const [showSearch, setShowSearch]   = useState(false);
  const [search, setSearch]           = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching]     = useState(false);
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [queue, setQueue]             = useState<QueueItem[]>([]);
  const [saving, setSaving]           = useState(false);
  const [savedCount, setSavedCount]   = useState(0);
  const [lastMapped, setLastMapped]   = useState<QueueItem | null>(null);
  const [showCamera, setShowCamera]   = useState(false);

  // Auto-focus barcode input in scan mode
  useEffect(() => {
    if (mode === 'scan') barcodeRef.current?.focus();
  }, [mode]);

  // Medicine search debounce
  useEffect(() => {
    if (!search.trim() || search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.get(`/medicines?search=${encodeURIComponent(search)}&limit=8`)
        .then(r => setSearchResults(r.data?.data || r.data || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Process any barcode — from USB scanner or camera
  const processBarcode = useCallback((code: string) => {
    setCurrentBarcode(code);
    setMatchedMed(null);
    setShowSearch(false);
    setSelectedMed(null);
    setSearch('');

    api.get(`/medicines/barcode/${encodeURIComponent(code)}`)
      .then(r => {
        if (r.data?.medicine) {
          setMatchedMed(r.data.medicine);
        } else {
          setShowSearch(true);
          setTimeout(() => searchRef.current?.focus(), 100);
        }
      })
      .catch(() => {
        setShowSearch(true);
        setTimeout(() => searchRef.current?.focus(), 100);
      });
  }, []);

  // Handle camera scan
  const handleCameraScan = useCallback((code: string) => {
    setShowCamera(false);
    setBarcode('');
    processBarcode(code);
  }, [processBarcode]);

  // Handle barcode Enter (USB scanners send Enter after scan)
  const handleBarcodeKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !barcode.trim()) return;
    const code = barcode.trim();
    setBarcode('');
    processBarcode(code);
  }, [barcode, processBarcode]);

  const confirmMatch = () => {
    if (!matchedMed || !currentBarcode) return;
    const item: QueueItem = { id: Date.now(), barcode: currentBarcode, medicine: matchedMed, status: 'pending' };
    setQueue(q => [item, ...q]);
    setLastMapped(item);
    setMatchedMed(null);
    setCurrentBarcode('');
    barcodeRef.current?.focus();
  };

  const rejectMatch = () => {
    setMatchedMed(null);
    setShowSearch(true);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const confirmManual = () => {
    if (!selectedMed || !currentBarcode) return;
    const item: QueueItem = { id: Date.now(), barcode: currentBarcode, medicine: selectedMed, status: 'pending' };
    setQueue(q => [item, ...q]);
    setLastMapped(item);
    setShowSearch(false);
    setSelectedMed(null);
    setSearch('');
    setCurrentBarcode('');
    barcodeRef.current?.focus();
  };

  const removeFromQueue = (id: number) => setQueue(q => q.filter(x => x.id !== id));

  const saveAll = async () => {
    const pending = queue.filter(x => x.status === 'pending');
    if (!pending.length) return;
    setSaving(true);
    let success = 0;
    const updated = [...queue];

    for (const item of pending) {
      try {
        await api.post('/medicines/barcode-mappings', {
          barcode: item.barcode,
          medicine_id: item.medicine.id,
        });
        const idx = updated.findIndex(x => x.id === item.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], status: 'saved' };
        success++;
      } catch {
        const idx = updated.findIndex(x => x.id === item.id);
        if (idx >= 0) updated[idx] = { ...updated[idx], status: 'error' };
      }
    }

    setQueue(updated);
    setSavedCount(c => c + success);
    setSaving(false);
    toast.success(`${success} barcode(s) saved successfully`);
    if (success === pending.length) {
      setTimeout(() => setMode('done'), 800);
    }
  };

  const pendingCount = queue.filter(x => x.status === 'pending').length;

  return (
    <>
      {showCamera && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => setShowCamera(false)}
          title="Scan Medicine Barcode"
        />
      )}
      <div className="p-4 md:p-6 max-w-2xl">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Scan className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Bulk Barcode Mapping</h1>
          <p className="text-xs text-slate-400">Scan medicines rapidly — one after another</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Saved', value: savedCount, color: 'text-green-700 bg-green-50' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-700 bg-amber-50' },
          { label: 'Errors', value: queue.filter(x => x.status === 'error').length, color: 'text-red-700 bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs opacity-75 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-5">
        {(['scan', 'review', 'done'] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all capitalize
              ${mode === m ? 'bg-[#00475a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {m} {m === 'review' && pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* ── SCAN PANEL ────────────────────────────────────────────────── */}
      {mode === 'scan' && (
        <div className="space-y-4">
          {/* Scanner input */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-slate-700">Scanner ready</span>
            </div>
            <label className="label">Barcode</label>
            <div className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKey}
                placeholder="Scan or type barcode, press Enter..."
                className="input font-mono tracking-widest flex-1"
                autoComplete="off"
              />
              <button
                onClick={() => setShowCamera(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00475a] text-white text-sm font-medium hover:bg-[#003d4d] transition-colors"
                title="Use phone camera to scan"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Camera</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              USB scanner: just plug in and scan · Phone: tap Camera button
            </p>
          </div>

          {/* Auto-match card */}
          {matchedMed && currentBarcode && (
            <div className="card border-2 border-[#00475a]/30 bg-[#00475a]/5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-[#00475a]" />
                <span className="text-sm font-semibold text-[#00475a]">Medicine found</span>
                <span className="ml-auto font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{currentBarcode}</span>
              </div>
              <p className="text-base font-semibold text-slate-900">{matchedMed.brand_name}</p>
              <p className="text-xs text-slate-500 mb-4">{matchedMed.molecule} · {matchedMed.strength} · {matchedMed.dosage_form}</p>
              <div className="flex gap-2">
                <button onClick={confirmMatch} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                  <Link2 className="w-4 h-4" /> Confirm mapping
                </button>
                <button onClick={rejectMatch} className="btn-secondary text-sm px-4">
                  Wrong medicine
                </button>
              </div>
            </div>
          )}

          {/* Manual search card */}
          {showSearch && currentBarcode && (
            <div className="card border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">Not auto-matched — search manually</span>
                <span className="ml-auto font-mono text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">{currentBarcode}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedMed(null); }}
                  placeholder="Type medicine name..."
                  className="input pl-9"
                  autoComplete="off"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
              </div>

              {searchResults.length > 0 && !selectedMed && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {searchResults.map(m => (
                    <button key={m.id} onClick={() => { setSelectedMed(m); setSearch(m.brand_name); setSearchResults([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                      <p className="text-sm font-medium text-slate-800">{m.brand_name}</p>
                      <p className="text-xs text-slate-400">{m.molecule} · {m.strength}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedMed && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200">
                  <p className="text-sm font-semibold text-slate-800">{selectedMed.brand_name}</p>
                  <p className="text-xs text-slate-400">{selectedMed.molecule} · {selectedMed.strength}</p>
                </div>
              )}

              <button onClick={confirmManual} disabled={!selectedMed}
                className="btn-primary w-full mt-3 flex items-center justify-center gap-2 text-sm disabled:opacity-40">
                <Link2 className="w-4 h-4" /> Map this barcode
              </button>
            </div>
          )}

          {/* Last mapped */}
          {lastMapped && !matchedMed && !showSearch && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 truncate">{lastMapped.medicine.brand_name}</p>
                <p className="text-xs text-green-600 font-mono">{lastMapped.barcode}</p>
              </div>
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-lg">Added</span>
            </div>
          )}

          {/* Quick tip */}
          <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Tips for fast bulk mapping:</p>
            <p>• Scan the barcode on the medicine strip or box</p>
            <p>• If auto-matched, just press Confirm and scan the next one</p>
            <p>• All scans queue up — save to MediSyn all at once when done</p>
            <p>• USB scanner: just plug in and start scanning — no setup needed</p>
          </div>
        </div>
      )}

      {/* ── REVIEW PANEL ──────────────────────────────────────────────── */}
      {mode === 'review' && (
        <div>
          {queue.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Scan className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No barcodes scanned yet</p>
              <button onClick={() => setMode('scan')} className="btn-primary mt-4 text-sm">
                Start scanning
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {queue.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.medicine.brand_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{item.barcode}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      item.status === 'saved' ? 'bg-green-100 text-green-700' :
                      item.status === 'error' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {item.status}
                    </span>
                    {item.status === 'pending' && (
                      <button onClick={() => removeFromQueue(item.id)}
                        className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pendingCount > 0 && (
                <button onClick={saveAll} disabled={saving}
                  className="btn-primary w-full flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : `Save ${pendingCount} mapping(s) to MediSyn`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── DONE PANEL ────────────────────────────────────────────────── */}
      {mode === 'done' && (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            {savedCount} barcode{savedCount !== 1 ? 's' : ''} mapped
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            All mappings saved. Scanning these medicines at the dispensing counter will now auto-fill them instantly.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setMode('scan'); setSavedCount(0); setQueue([]); setLastMapped(null); }}
              className="btn-secondary flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" /> Map more barcodes
            </button>
            <button onClick={() => router.push('/dispensing')} className="btn-primary text-sm">
              Go to Dispensing →
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
