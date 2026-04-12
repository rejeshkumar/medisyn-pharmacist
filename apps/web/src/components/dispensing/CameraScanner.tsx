'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Camera, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title?: string;
}

export default function CameraScanner({ onScan, onClose, title = 'Scan Barcode' }: Props) {
  const scannerRef   = useRef<any>(null);
  const [status, setStatus]       = useState<'loading'|'scanning'|'error'>('loading');
  const [error, setError]         = useState('');
  const [cameras, setCameras]     = useState<any[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [lastScan, setLastScan]   = useState('');

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
  };

  const startScanner = async (camIdx = 0) => {
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      await stopScanner();
      const devices = await Html5Qrcode.getCameras();
      if (!devices?.length) { setError('No camera found'); setStatus('error'); return; }
      setCameras(devices);
      const cam = devices[Math.min(camIdx, devices.length - 1)];
      scannerRef.current = scanner;
      await scanner.start(cam.id,
        { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5,
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
          ],
        },
        (code) => {
          if (code === lastScan) return;
          setLastScan(code);
          if (navigator.vibrate) navigator.vibrate(100);
          stopScanner();
          onScan(code);
          onClose();
        },
        () => {}
      );
      setStatus('scanning');
    } catch (err: any) {
      setError(err?.message?.includes('Permission')
        ? 'Camera permission denied. Allow camera access in browser settings.'
        : err?.message || 'Could not start camera');
      setStatus('error');
    }
  };

  const switchCamera = async () => {
    const next = (cameraIdx + 1) % Math.max(cameras.length, 1);
    setCameraIdx(next); setStatus('loading');
    await stopScanner(); await startScanner(next);
  };

  useEffect(() => { startScanner(0); return () => { stopScanner(); }; }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {cameras.length > 1 && (
            <button onClick={switchCamera} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-white" />
            </button>
          )}
          <button onClick={() => { stopScanner(); onClose(); }} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white text-sm">Starting camera...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-8 text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-white font-semibold mb-2">Camera unavailable</p>
            <p className="text-white/60 text-sm mb-6">{error}</p>
            <button onClick={() => { setStatus('loading'); startScanner(cameraIdx); }}
              className="px-6 py-2 bg-white text-black rounded-xl text-sm font-semibold">Try again</button>
          </div>
        )}
        <div id="medisyn-qr-scanner" className="w-full h-full" style={{ maxHeight: '70vh' }} />
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-64 h-40">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00e5a0] rounded-tl" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00e5a0] rounded-tr" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00e5a0] rounded-bl" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00e5a0] rounded-br" />
            </div>
          </div>
        )}
      </div>
      <div className="bg-black/80 px-4 py-4 text-center">
        {status === 'scanning' && (
          <>
            <p className="text-white/80 text-sm">Point camera at the barcode on the medicine strip</p>
            <p className="text-white/40 text-xs mt-1">Scanning automatically — no button press needed</p>
          </>
        )}
      </div>
      <style>{`
        #medisyn-qr-scanner video { width:100%!important; height:100%!important; object-fit:cover!important; }
        #medisyn-qr-scanner img { display:none!important; }
        #reader__dashboard { display:none!important; }
      `}</style>
    </div>
  );
}
