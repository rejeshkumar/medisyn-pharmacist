'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Scan, X, Loader2, AlertTriangle, Hash, Camera, RefreshCw } from 'lucide-react';

interface Props {
  onFound: (medicine: any, batch: any) => void;
  onClose: () => void;
}

// ── Camera Scanner ────────────────────────────────────────────────────────────
function CameraView({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number>(0);
  const [status, setStatus]   = useState<'starting'|'scanning'|'error'>('starting');
  const [errMsg, setErrMsg]   = useState('');

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startLoop = (detector: any) => {
    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop); return;
      }
      try {
        const results = await detector.detect(videoRef.current);
        if (results?.length) { stop(); onDetected(results[0].rawValue); return; }
      } catch {}
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const start = useCallback(async () => {
    setStatus('starting'); setErrMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStatus('scanning');
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code'],
        });
        startLoop(detector);
      }
      // else: manual capture only
    } catch (e: any) {
      setErrMsg(
        e.name === 'NotAllowedError' ? 'Camera permission denied. Tap the lock icon in address bar and allow camera.' :
        e.name === 'NotFoundError'   ? 'No camera found on this device.' :
        'Camera error: ' + (e.message || e.name)
      );
      setStatus('error');
    }
  }, []);

  const capture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13','ean_8','code_128','code_39','upc_a','upc_e','qr_code'],
        });
        const results = await detector.detect(canvas);
        if (results?.length) { stop(); onDetected(results[0].rawValue); }
        else toast.error('No barcode detected — hold steady and try again');
      } catch { toast.error('Could not read — try manual entry'); }
    } else {
      toast.error('Camera scanning not supported on this browser. Use manual entry.');
    }
  };

  useEffect(() => { start(); return () => { cancelAnimationFrame(rafRef.current); stop(); }; }, []);

  if (status === 'starting') return (
    <div className="flex flex-col items-center py-10 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[#00475a]" />
      <p className="text-sm text-slate-500">Starting camera...</p>
    </div>
  );

  if (status === 'error') return (
    <div className="space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Camera Error</p>
          <p className="text-xs text-red-600 mt-1">{errMsg}</p>
        </div>
      </div>
      <button onClick={start} className="w-full py-2.5 border border-[#00475a] text-[#00475a] rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4" /> Try Again
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <style>{`@keyframes scanline{0%{top:10%}50%{top:85%}100%{top:10%}}`}</style>
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-52 h-28">
            <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-[#00d4aa] rounded-tl-sm" />
            <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#00d4aa] rounded-tr-sm" />
            <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-[#00d4aa] rounded-bl-sm" />
            <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-[#00d4aa] rounded-br-sm" />
            <span className="absolute left-2 right-2 h-0.5 bg-[#00d4aa]/80" style={{animation:'scanline 2s ease-in-out infinite'}} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={capture} className="py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <Camera className="w-4 h-4" /> Capture
        </button>
        <button onClick={() => { stop(); start(); }} className="py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" /> Restart
        </button>
      </div>
      <p className="text-xs text-slate-400 text-center">
        {'BarcodeDetector' in window ? 'Auto-scanning active — point at barcode' : 'Point camera at barcode then tap Capture'}
      </p>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function BarcodeScanner({ onFound, onClose }: Props) {
  const [mode, setMode]         = useState<'camera'|'manual'>('camera');
  const [barcode, setBarcode]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [unknown, setUnknown]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (mode === 'manual') setTimeout(() => inputRef.current?.focus(), 100); }, [mode]);

  const lookup = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true); setNotFound(false);
    try {
      const res = await api.get(`/medicines/barcode/${encodeURIComponent(code.trim())}`);
      if (res.data?.medicine) {
        toast.success(`Found: ${res.data.medicine.brand_name}`);
        onFound(res.data.medicine, res.data.batch);
        onClose();
      } else { setNotFound(true); setUnknown(code.trim()); }
    } catch { setNotFound(true); setUnknown(code.trim()); }
    finally { setLoading(false); }
  }, [onFound, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#00475a]" />
            <h2 className="font-semibold text-slate-900">Scan Barcode</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4">
            {[{key:'camera',label:'Camera',Icon:Camera},{key:'manual',label:'Manual / USB',Icon:Hash}].map(({key,label,Icon}) => (
              <button key={key} onClick={() => setMode(key as any)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${mode===key?'bg-white text-slate-900 shadow-sm':'text-slate-500'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>

          {mode === 'camera' && <CameraView onDetected={code => lookup(code)} />}

          {mode === 'manual' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Type a barcode or use a USB scanner — presses Enter automatically.</p>
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={barcode}
                  onChange={e => { setBarcode(e.target.value); setNotFound(false); }}
                  onKeyDown={e => e.key === 'Enter' && lookup(barcode)}
                  placeholder="Scan or type barcode..."
                  className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] font-mono"
                  autoComplete="off" />
                <button onClick={() => lookup(barcode)} disabled={loading || !barcode.trim()}
                  className="px-4 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
                </button>
              </div>
            </div>
          )}

          {notFound && unknown && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Barcode not found</p>
                  <p className="text-xs text-amber-600 mt-0.5 font-mono">{unknown}</p>
                  <p className="text-xs text-amber-700 mt-1">This barcode is not mapped to any medicine yet.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
