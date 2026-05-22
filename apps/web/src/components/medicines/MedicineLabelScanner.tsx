'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, X, Loader2, CheckCircle2, AlertCircle, ScanLine, RefreshCw } from 'lucide-react';

export interface ScannedLabelData {
  medicine_name?: string;
  batch_number?: string;
  expiry_date?: string;
  mrp?: number;
  manufacturer?: string;
  composition?: string;
  strength?: string;
}

interface MedicineLabelScannerProps {
  mode: 'dispensing' | 'procurement';
  onScanComplete: (data: ScannedLabelData) => void;
  onClose: () => void;
}

export default function MedicineLabelScanner({ mode, onScanComplete, onClose }: MedicineLabelScannerProps) {
  const [step, setStep] = useState<'camera' | 'preview' | 'scanning' | 'result' | 'error'>('camera');
  const [imageData, setImageData] = useState<string | null>(null);
  const [result, setResult] = useState<ScannedLabelData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permission or upload an image.');
      setStep('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setImageData(canvas.toDataURL('image/jpeg', 0.85));
    stopCamera();
    setStep('preview');
  }, [stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImageData(ev.target?.result as string); stopCamera(); setStep('preview'); };
    reader.readAsDataURL(file);
  };

  const scanLabel = async () => {
    if (!imageData) return;
    setStep('scanning');
    const base64 = imageData.split(',')[1];
    const prompt = mode === 'dispensing'
      ? 'Extract medicine brand name and composition from this label. Return JSON only: {"medicine_name":"<brand>","composition":"<generic>","strength":"<dosage>"}'
      : 'Extract all medicine details from this label. Return JSON only: {"medicine_name":"<brand>","composition":"<generic>","strength":"<dosage>","batch_number":"<batch>","expiry_date":"<MM/YYYY>","mrp":<number>,"manufacturer":"<company>"}. Omit missing fields.';
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'https://successful-playfulness-production-873f.up.railway.app'}/scan-label`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ image: base64, mode }),
        }
      );
      if (!response.ok) throw new Error('Scan failed');
      const data = await response.json();
      setResult(data);
      setStep('result');
    } catch {
      setErrorMsg('Could not read the label. Try better lighting or a clearer photo.');
      setStep('error');
    }
  };

  const reset = () => { setImageData(null); setResult(null); setErrorMsg(''); setStep('camera'); startCamera(); };

  const videoMounted = useCallback((node: HTMLVideoElement | null) => {
    if (node) { (videoRef as any).current = node; startCamera(); }
  }, [startCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 bg-[#00b8a0]">
          <div className="flex items-center gap-2.5">
            <ScanLine className="w-5 h-5 text-white" />
            <div>
              <p className="text-white font-semibold text-sm">Medicine Label Scanner</p>
              <p className="text-white/70 text-xs">{mode === 'dispensing' ? 'Scan to identify medicine' : 'Scan to extract batch details'}</p>
            </div>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {step === 'camera' && (
          <div className="relative">
            <video ref={videoMounted} autoPlay playsInline muted className="w-full aspect-video object-cover bg-slate-900" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-36 border-2 border-[#00b8a0] rounded-xl relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#00b8a0] rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00b8a0] rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00b8a0] rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-[#00b8a0] rounded-br" />
                <div className="absolute inset-x-2 top-1/2 h-px bg-[#00b8a0]/50 animate-pulse" />
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <p className="text-white text-xs text-center mb-3 opacity-80">Position label within the frame</p>
              <div className="flex gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 bg-white/20 text-white text-sm font-medium rounded-xl hover:bg-white/30">Upload Photo</button>
                <button onClick={capturePhoto} className="flex-1 py-2.5 bg-[#00b8a0] text-white text-sm font-bold rounded-xl hover:bg-[#009688] flex items-center justify-center gap-2"><Camera className="w-4 h-4" /> Capture</button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
          </div>
        )}

        {step === 'preview' && imageData && (
          <div>
            <img src={imageData} alt="Captured" className="w-full aspect-video object-cover" />
            <div className="p-4 flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Retake</button>
              <button onClick={scanLabel} className="flex-1 py-2.5 bg-[#00b8a0] text-white text-sm font-bold rounded-xl hover:bg-[#009688] flex items-center justify-center gap-2"><ScanLine className="w-4 h-4" /> Scan Label</button>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="p-8 text-center">
            {imageData && <img src={imageData} alt="Scanning" className="w-full aspect-video object-cover rounded-xl mb-6 opacity-40" />}
            <Loader2 className="w-8 h-8 animate-spin text-[#00b8a0] mx-auto mb-3" />
            <p className="text-slate-700 font-semibold">Reading label...</p>
            <p className="text-slate-400 text-sm mt-1">AI is extracting medicine details</p>
          </div>
        )}

        {step === 'result' && result && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="w-5 h-5 text-green-500" /><p className="font-semibold text-slate-800">Label scanned successfully</p></div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 mb-4">
              {result.medicine_name && <div className="flex justify-between"><span className="text-xs text-slate-500">Medicine</span><span className="text-sm font-semibold text-slate-800">{result.medicine_name}</span></div>}
              {result.composition && <div className="flex justify-between"><span className="text-xs text-slate-500">Composition</span><span className="text-sm text-slate-600">{result.composition}</span></div>}
              {result.strength && <div className="flex justify-between"><span className="text-xs text-slate-500">Strength</span><span className="text-sm text-slate-600">{result.strength}</span></div>}
              {mode === 'procurement' && <>
                {result.batch_number && <div className="flex justify-between"><span className="text-xs text-slate-500">Batch No.</span><span className="text-sm font-mono text-slate-700">{result.batch_number}</span></div>}
                {result.expiry_date && <div className="flex justify-between"><span className="text-xs text-slate-500">Expiry</span><span className="text-sm text-slate-700">{result.expiry_date}</span></div>}
                {result.mrp && <div className="flex justify-between"><span className="text-xs text-slate-500">MRP</span><span className="text-sm font-bold text-[#00b8a0]">₹{result.mrp}</span></div>}
                {result.manufacturer && <div className="flex justify-between"><span className="text-xs text-slate-500">Manufacturer</span><span className="text-sm text-slate-600">{result.manufacturer}</span></div>}
              </>}
            </div>
            <div className="flex gap-3">
              <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Scan Again</button>
              <button onClick={() => { onScanComplete(result); onClose(); }} className="flex-1 py-2.5 bg-[#00b8a0] text-white text-sm font-bold rounded-xl hover:bg-[#009688] flex items-center justify-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Use This</button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-800 mb-1">Scan failed</p>
            <p className="text-slate-500 text-sm mb-5">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50">Upload Image</button>
              <button onClick={reset} className="flex-1 py-2.5 bg-[#00b8a0] text-white text-sm font-bold rounded-xl hover:bg-[#009688]">Try Again</button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
