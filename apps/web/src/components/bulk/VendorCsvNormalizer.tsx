'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface NormalizedRecord {
  brand_name: string;
  batch_no: string;
  expiry: string;
  quantity: number;
  purchase_price: number;
  sale_rate: number;
  supplier: string;
}

interface NormalizerResult {
  success: boolean;
  format: string;
  recordCount: number;
  errors: string[];
  records: NormalizedRecord[];
  message: string;
}

export function VendorCsvNormalizer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<NormalizerResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleNormalize = async () => {
    if (!file) { setError('Please select a CSV file'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/bulk/vendor-csv/normalize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      if (!data.success && data.errors?.length) {
        setError(data.message);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportToStock = async () => {
    if (!result?.records?.length) return;
    setImporting(true);
    setImportResult(null);

    try {
      const { data } = await api.post('/bulk/vendor-csv/import', {
        records: result.records,
      });
      setImportResult(data);
    } catch (err: any) {
      setImportResult({ success: false, message: err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleCopy = () => {
    if (!result?.records) return;
    const headers = ['Brand Name', 'Batch No', 'Expiry', 'Qty', 'Purchase Price', 'Sale Rate', 'Supplier'];
    const rows = result.records.map(r => [r.brand_name, r.batch_no, r.expiry, r.quantity, r.purchase_price, r.sale_rate, r.supplier]);
    const tsv = [headers, ...rows].map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDownloadCsv = () => {
    if (!result?.records) return;
    const headers = ['Brand Name', 'Batch No', 'Expiry (MM/YYYY)', 'Quantity', 'Purchase Price', 'Sale Rate', 'Supplier'];
    const rows = result.records.map(r => [r.brand_name, r.batch_no, r.expiry, r.quantity, r.purchase_price, r.sale_rate, r.supplier]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `normalized_stock_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setImportResult(null);
    setCopied(false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-[#00475a]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Vendor CSV Import
        </h2>
        <p className="text-sm text-white/70 mt-1">
          Upload distributor invoices — auto-detects Inter Link &amp; MediWMS formats
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium text-sm">{error}</p>
            {result?.errors && result.errors.length > 0 && (
              <ul className="text-red-700 text-xs mt-2 space-y-1">
                {result.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                {result.errors.length > 5 && <li>...and {result.errors.length - 5} more</li>}
              </ul>
            )}
          </div>
        )}

        {/* Import Result */}
        {importResult && (
          <div className={`p-4 rounded-lg border ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className={`font-medium text-sm ${importResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {importResult.success
                ? `✓ Imported ${importResult.success_rows} of ${importResult.total_rows} records into stock`
                : `Import failed: ${importResult.message || 'Unknown error'}`
              }
            </p>
            {importResult.errors?.length > 0 && (
              <ul className="text-red-700 text-xs mt-2 space-y-1">
                {importResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>• {e}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Success — Normalized Records */}
        {result?.success && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-green-800">
                ✓ {result.format} — {result.recordCount} records normalized
              </p>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium">
                  {copied ? '✓ Copied!' : 'Copy'}
                </button>
                <button onClick={handleDownloadCsv} className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded font-medium">
                  Download CSV
                </button>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Brand Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Batch</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Expiry</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border-b">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border-b">Purchase ₹</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 border-b">MRP ₹</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {result.records.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-blue-50/50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.brand_name}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{r.batch_no}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs">{r.expiry}</td>
                      <td className="px-3 py-2 text-right">{r.quantity}</td>
                      <td className="px-3 py-2 text-right">{r.purchase_price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{r.sale_rate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-600 text-xs truncate max-w-[140px]">{r.supplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleImportToStock}
                disabled={importing}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Importing...
                  </>
                ) : (
                  <>✓ Import {result.recordCount} Records to Stock</>
                )}
              </button>
              <button onClick={reset} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm">
                Reset
              </button>
            </div>
          </div>
        )}

        {/* File Upload — only show when no result */}
        {!result?.success && (
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#00475a] transition-colors">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); setResult(null); setImportResult(null); }}
                disabled={loading}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#00475a] file:text-white file:font-medium hover:file:bg-[#003d4d] file:cursor-pointer disabled:opacity-50"
              />
              {file && <p className="text-sm text-gray-600 mt-2">Selected: <strong>{file.name}</strong></p>}
            </div>

            <button
              onClick={handleNormalize}
              disabled={!file || loading}
              className="w-full py-3 bg-[#00475a] hover:bg-[#003d4d] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Normalizing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Normalize &amp; Preview
                </>
              )}
            </button>
          </>
        )}

        {/* Supported Formats */}
        <div className="px-4 py-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">
            <strong>Supported:</strong> Inter Link (IL-26), MediWMS (Maas Pharma, PeeKay Drugs) •
            Auto-detects format • Converts to standard stock import schema
          </p>
        </div>
      </div>
    </div>
  );
}
