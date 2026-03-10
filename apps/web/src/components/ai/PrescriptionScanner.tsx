'use client';

import { useState, useRef } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Camera, Upload, Loader2, CheckCircle, AlertTriangle, X, RefreshCw, Scan } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ExtractedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface OcrResult {
  medicines: ExtractedMedicine[];
  doctor_notes?: string;
  confidence: 'high' | 'medium' | 'low';
  raw_text?: string;
}

interface Props {
  onExtracted: (medicines: ExtractedMedicine[]) => void;
  onClose: () => void;
}

const CONFIDENCE_COLOR = {
  high:   'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-red-100 text-red-700 border-red-200',
};

export default function PrescriptionScanner({ onExtracted, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image/jpeg');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [edited, setEdited] = useState<ExtractedMedicine[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return; }
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setResult(null);
      setEdited([]);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const scan = async () => {
    if (!preview) return;
    setScanning(true);
    try {
      const base64Image = preview.split(',')[1];
      const r = await axios.post(`${API}/ai/ocr`, { base64Image, mediaType },
        { headers: { Authorization: `Bearer ${getToken()}` } });
      setResult(r.data);
      setEdited(r.data.medicines || []);
      if ((r.data.medicines || []).length === 0) toast.error('No medicines detected — try a clearer photo');
      else toast.success(`${r.data.medicines.length} medicine(s) extracted`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Scan failed — check your API key');
    } finally {
      setScanning(false);
    }
  };

  const updateMed = (i: number, field: keyof ExtractedMedicine, value: string) => {
    setEdited(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const removeMed = (i: number) => setEdited(prev => prev.filter((_, idx) => idx !== i));

  const addMed = () => setEdited(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '' }]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00475a] flex items-center justify-center">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Prescription Scanner</h2>
              <p className="text-xs text-slate-400">Upload a photo of a handwritten prescription</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Upload zone */}
          {!preview ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-[#00475a] hover:bg-teal-50/30 transition-all"
            >
              <Camera className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Drop prescription photo here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse · JPG, PNG supported</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-100">
                <img src={preview} alt="Prescription" className="w-full max-h-64 object-contain bg-slate-50" />
                <button onClick={() => { setPreview(null); setResult(null); setEdited([]); }}
                  className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-slate-500 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!result ? (
                <button onClick={scan} disabled={scanning}
                  className="w-full py-3 bg-[#00475a] text-white font-semibold rounded-xl hover:bg-[#00475a]/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {scanning ? <><Loader2 className="w-5 h-5 animate-spin" />Scanning with AI...</> : <><Scan className="w-5 h-5" />Scan Prescription</>}
                </button>
              ) : (
                <button onClick={scan} disabled={scanning}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#00475a] transition-colors">
                  <RefreshCw className="w-4 h-4" />Re-scan
                </button>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Confidence + raw text */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${CONFIDENCE_COLOR[result.confidence]}`}>
                  {result.confidence === 'high' ? '✓' : result.confidence === 'medium' ? '~' : '!'} Confidence: {result.confidence}
                </span>
                {result.doctor_notes && (
                  <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    Notes: {result.doctor_notes}
                  </span>
                )}
              </div>

              {/* Editable medicines list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700">Extracted Medicines</h3>
                  <span className="text-xs text-slate-400">Review and edit before importing</span>
                </div>

                {edited.length === 0 ? (
                  <div className="bg-red-50 rounded-lg p-4 text-sm text-red-600 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    No medicines detected. Try a clearer photo or add medicines manually.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {edited.map((med, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-4 relative">
                        <button onClick={() => removeMed(i)} className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-slate-500 mb-1 block">Medicine Name</label>
                            <input value={med.name} onChange={e => updateMed(i, 'name', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Dosage</label>
                            <input value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)}
                              placeholder="e.g. 500mg"
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Frequency</label>
                            <input value={med.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)}
                              placeholder="e.g. twice daily"
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Duration</label>
                            <input value={med.duration} onChange={e => updateMed(i, 'duration', e.target.value)}
                              placeholder="e.g. 5 days"
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Notes</label>
                            <input value={med.notes || ''} onChange={e => updateMed(i, 'notes', e.target.value)}
                              placeholder="e.g. after food"
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={addMed} className="mt-2 text-xs text-[#00475a] hover:underline">+ Add medicine manually</button>
              </div>

              {/* Import button */}
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  onClick={() => { onExtracted(edited.filter(m => m.name.trim())); onClose(); }}
                  disabled={edited.filter(m => m.name.trim()).length === 0}
                  className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold hover:bg-[#00475a]/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  <CheckCircle className="w-4 h-4" />Import {edited.filter(m => m.name.trim()).length} Medicine(s)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
