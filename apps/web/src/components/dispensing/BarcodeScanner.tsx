'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Scan, X, Loader2, AlertTriangle, Hash, Camera } from 'lucide-react';

interface Props {
  onFound: (medicine: any, batch: any) => void;
  onClose: () => void;
}

// ── Camera Scanner using native browser APIs ─────────────────────────────────
function CameraScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        // Try ZXing if available, otherwise show manual fallback
        tryZxingLoad();
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Camera error: ' + err.message);
      }
    }
  };

  const tryZxingLoad = () => {
    // Dynamically load ZXing barcode library
    if ((window as any).ZXing) {
      startZxingScanning();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js';
    script.onload = () => startZxingScanning();
    script.onerror = () => {
      // Fallback: manual capture button
      setError('');
    };
    document.head.appendChild(script);
  };

  const startZxingScanning = () => {
    const ZXing = (window as any).ZXing;
    if (!ZXing || !videoRef.current) return;
    try {
      const codeReader = new ZXing.BrowserMultiFormatReader();
      codeReader.decodeFromVideoElement(videoRef.current, (result: any, err: any) => {
        if (result) {
          onDetected(result.getText());
          stopCamera();
        }
      });
    } catch {}
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    // With ZXing loaded, attempt decode
    const ZXing = (window as any).ZXing;
    if (ZXing) {
      try {
        const codeReader = new ZXing.BrowserMultiFormatReader();
        codeReader.decodeFromCanvas(canvas)
          .then((result: any) => { if (result) onDetected(result.getText()); })
          .catch(() => toast.error('No barcode detected — try again'));
      } catch { toast.error('Could not read barcode'); }
    }
  };

  if (error) return (
    <div className="text-center py-6 space-y-3">
      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
      <p className="text-sm text-slate-600">{error}</p>
      <button onClick={startCamera}
        className="px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium">
        Try Again
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {/* Scanning overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-32 border-2 border-white/70 rounded-lg relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00d4aa] rounded-tl" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00d4aa] rounded-tr" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00d4aa] rounded-bl" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00d4aa] rounded-br" />
          </div>
        </div>
        {scanning && (
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
              Point camera at barcode
            </span>
          </div>
        )}
      </div>
      <button onClick={captureFrame}
        className="w-full py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
        <Camera className="w-4 h-4" /> Capture Barcode
      </button>
      <p className="text-xs text-slate-400 text-center">
        Auto-scanning active • or tap Capture to scan manually
      </p>
    </div>
  );
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
            <CameraScanner onDetected={(code) => { setBarcode(code); lookup(code); }} />
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
