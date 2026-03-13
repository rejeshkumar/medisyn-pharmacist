'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Scan, X, Loader2, AlertTriangle, Hash, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  onFound: (medicine: any, batch: any) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onFound, onClose }: Props) {
  const [mode, setMode]           = useState<'camera' | 'manual'>('manual');
  const [barcode, setBarcode]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [notFound, setNotFound]   = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for USB barcode scanners (they act as keyboards)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lookup = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await api.get(`/medicines/barcode/${encodeURIComponent(code.trim())}`);
      if (res.data?.medicine) {
        const { medicine, batch } = res.data;
        toast.success(`Found: ${medicine.brand_name}`);
        onFound(medicine, batch);
        onClose();
      } else {
        setNotFound(true);
        setUnknownBarcode(code.trim());
      }
    } catch {
      setNotFound(true);
      setUnknownBarcode(code.trim());
    } finally {
      setLoading(false);
    }
  }, [onFound, onClose]);

  // Detect Enter key from USB scanner
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') lookup(barcode);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#00475a]" />
            <h2 className="font-semibold text-slate-900">Scan Barcode</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
            {[
              { key: 'manual', label: 'Manual / USB Scanner', icon: Hash },
              { key: 'camera', label: 'Camera',               icon: Camera },
            ].map(m => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => setMode(m.key as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all
                    ${mode === m.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  <Icon className="w-3.5 h-3.5" />{m.label}
                </button>
              );
            })}
          </div>

          {mode === 'manual' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Type a barcode or scan with a USB barcode scanner — it acts as a keyboard and presses Enter automatically.
              </p>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcode}
                  onChange={e => { setBarcode(e.target.value); setNotFound(false); }}
                  onKeyDown={handleKey}
                  placeholder="Scan or type barcode..."
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] font-mono tracking-wider"
                  autoComplete="off"
                />
                <button onClick={() => lookup(barcode)} disabled={loading || !barcode.trim()}
                  className="px-4 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
                </button>
              </div>
            </div>
          )}

          {mode === 'camera' && (
            <div className="text-center py-6 text-slate-400">
              <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Camera scanning requires a barcode library.</p>
              <p className="text-xs mt-1">Use USB scanner or manual entry for now.</p>
            </div>
          )}

          {/* Not found — offer to map */}
          {notFound && unknownBarcode && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Barcode not found</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-mono">{unknownBarcode}</p>
                </div>
              </div>
              <p className="text-xs text-amber-700 mb-3">
                This barcode isn't mapped to any medicine. You can map it now so future scans work automatically.
              </p>
              <button
                onClick={() => {
                  onClose();
                  // Navigate to barcode mapping page with the unknown barcode pre-filled
                  window.location.href = `/barcode-mapping?barcode=${encodeURIComponent(unknownBarcode)}`;
                }}
                className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
                Map this barcode to a medicine →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
