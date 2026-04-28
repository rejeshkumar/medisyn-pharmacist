'use client';
/**
 * MediSyn — BarcodeScanner Component (GS1-enabled)
 * ===================================================
 * Supports:
 *   - GS1 DataMatrix: extracts GTIN + Batch + Expiry → auto-selects correct batch
 *   - EAN-13: extracts GTIN → finds medicine, uses FEFO batch
 *   - Manual barcode entry (USB scanner or keyboard)
 *
 * Place at: apps/web/src/components/dispensing/BarcodeScanner.tsx
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { parseBarcode, hasBatchInfo, barcodeToString, GS1ParseResult } from '@/lib/gs1-parser';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { X, Scan, CheckCircle, AlertTriangle, Loader2, Package, Hash, Calendar } from 'lucide-react';

interface ScanResult {
  medicine: any;
  batch: any | null;
  parsed: GS1ParseResult;
  confidence: 'exact_batch' | 'fefo_batch' | 'not_found';
}

interface Props {
  onFound: (medicine: any, batch: any | null) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onFound, onClose }: Props) {
  const [input, setInput]           = useState('');
  const [scanning, setScanning]     = useState(false);
  const [result, setResult]         = useState<ScanResult | null>(null);
  const [error, setError]           = useState('');
  const [parsed, setParsed]         = useState<GS1ParseResult | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Real-time parse as user types/scans
  useEffect(() => {
    if (input.length >= 8) {
      setParsed(parseBarcode(input));
    } else {
      setParsed(null);
    }
  }, [input]);

  // Handle scan submission
  const handleScan = useCallback(async () => {
    if (!input.trim()) return;
    setScanning(true);
    setError('');
    setResult(null);

    try {
      const parsed = parseBarcode(input.trim());

      if (parsed.type === 'UNKNOWN') {
        setError('Unrecognised barcode format. Try scanning again or type the barcode manually.');
        setScanning(false);
        return;
      }

      // Call API with parsed barcode data
      const response = await api.post('/medicines/scan-barcode', {
        gtin:         parsed.gtin || parsed.gtin13,
        gtin13:       parsed.gtin13,
        batch_number: parsed.batch_number,
        expiry_date:  parsed.expiry_date,
        raw:          input.trim(),
        barcode_type: parsed.type,
      });

      const { medicine, batch, confidence } = response.data;

      if (!medicine) {
        setError(`Medicine not found for this barcode.\nGTIN: ${parsed.gtin13 || parsed.gtin || 'unknown'}\n${parsed.batch_number ? `Batch: ${parsed.batch_number}` : ''}`);
        setScanning(false);
        return;
      }

      // Check expiry
      if (parsed.is_expired) {
        toast.error(`⚠️ Expired medicine! Expiry: ${parsed.expiry_display}`);
      }

      setResult({ medicine, batch, parsed, confidence });

    } catch (err: any) {
      setError(err.response?.data?.message || 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [input]);

  // Auto-submit when barcode scanner fires (ends with Enter or after pause)
  useEffect(() => {
    if (input.length >= 8) {
      const timer = setTimeout(() => {
        // Auto-submit if input looks complete (typical scanner fires quickly)
        if (input.length >= 13) handleScan();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [input, handleScan]);

  const handleAdd = () => {
    if (!result) return;
    onFound(result.medicine, result.batch);
    // Reset for next scan
    setInput('');
    setResult(null);
    setParsed(null);
    setError('');
    inputRef.current?.focus();
    toast.success(`Added: ${result.medicine.brand_name}${result.batch ? ` (Batch: ${result.batch.batch_number})` : ''}`);
  };

  const confidenceColor = {
    exact_batch: 'bg-green-50 border-green-200',
    fefo_batch:  'bg-amber-50 border-amber-200',
    not_found:   'bg-red-50 border-red-200',
  };

  const confidenceLabel = {
    exact_batch: '✅ Exact batch matched from barcode',
    fefo_batch:  '⚡ FEFO batch assigned (barcode has no batch info)',
    not_found:   '❌ Medicine not found',
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00475a] flex items-center justify-center">
              <Scan className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Barcode Scanner</h3>
              <p className="text-xs text-slate-400">GS1 DataMatrix · EAN-13 · Manual entry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Scanner input */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">
              Scan barcode or type manually
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setError(''); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleScan()}
                placeholder="Point scanner at medicine box or type barcode..."
                className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] font-mono"
                autoComplete="off"
              />
              <button
                onClick={handleScan}
                disabled={scanning || input.length < 8}
                className="px-4 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-medium hover:bg-[#003d4d] disabled:opacity-40 flex items-center gap-2"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                {scanning ? 'Scanning...' : 'Find'}
              </button>
            </div>
          </div>

          {/* Live parse preview */}
          {parsed && !result && !error && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Barcode detected</p>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  parsed.type === 'GS1_DATAMATRIX' ? 'bg-green-100 text-green-700' :
                  parsed.type === 'EAN13' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {parsed.type === 'GS1_DATAMATRIX' ? '⬛ GS1 DataMatrix' :
                   parsed.type === 'EAN13' ? '▌▌ EAN-13' : parsed.type}
                </span>
                {parsed.gtin13 && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-mono">
                    GTIN: {parsed.gtin13}
                  </span>
                )}
                {parsed.batch_number && (
                  <span className="text-xs px-2 py-1 rounded-lg bg-teal-100 text-teal-700 font-mono flex items-center gap-1">
                    <Hash className="w-3 h-3" /> {parsed.batch_number}
                  </span>
                )}
                {parsed.expiry_display && (
                  <span className={`text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1 ${
                    parsed.is_expired ? 'bg-red-100 text-red-700' :
                    (parsed.days_to_expiry || 0) < 90 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    <Calendar className="w-3 h-3" />
                    Exp: {parsed.expiry_display}
                    {parsed.is_expired && ' ⚠️ EXPIRED'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Not found</p>
                <p className="text-xs text-red-500 mt-1 whitespace-pre-line">{error}</p>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`border rounded-xl p-4 ${confidenceColor[result.confidence]}`}>
              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-3">
                {confidenceLabel[result.confidence]}
              </p>

              {/* Medicine info */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#00475a] flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{result.medicine.brand_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {result.medicine.molecule} · {result.medicine.strength} · {result.medicine.manufacturer}
                  </p>

                  {/* Batch info */}
                  {result.batch && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 font-mono flex items-center gap-1">
                        <Hash className="w-3 h-3 text-slate-400" />
                        {result.batch.batch_number}
                      </span>
                      <span className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Exp: {new Date(result.batch.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {result.batch.quantity} in stock
                      </span>
                      <span className="text-xs bg-white px-2 py-1 rounded-lg border border-slate-200 font-medium">
                        ₹{Number(result.batch.sale_rate || result.medicine.sale_rate).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Batch mismatch warning */}
                  {result.parsed.batch_number && result.batch &&
                   result.batch.batch_number !== result.parsed.batch_number && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700 font-medium">
                        ⚠️ Batch mismatch — scanned {result.parsed.batch_number} but dispensing from {result.batch.batch_number} (FEFO)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={handleAdd}
                className="mt-4 w-full bg-[#00475a] text-white py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#003d4d]"
              >
                <CheckCircle className="w-4 h-4" />
                Add to Bill
              </button>
            </div>
          )}

          {/* Tips */}
          {!result && !error && !parsed && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Tips</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p>⬛ Point scanner at the <strong>square dotted pattern</strong> on the box (GS1 DataMatrix) — gives batch + expiry</p>
                <p>▌▌ Or scan the <strong>standard barcode stripes</strong> (EAN-13) — identifies medicine only</p>
                <p>⌨️ Or type the barcode number manually and press Enter</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
