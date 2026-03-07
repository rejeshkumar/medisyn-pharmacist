'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Upload, Download, CheckCircle, XCircle, Loader2,
  FileSpreadsheet, FileText, Trash2, Edit2, Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface InvoiceItem {
  medicineName: string;
  batchNo: string;
  expiry: string;
  qty: number;
  purchasePrice: number;
  mrp: number;
  gstPercent: number;
}

export default function BulkPage() {
  const [tab, setTab] = useState<'medicines' | 'stock' | 'invoice'>('invoice');
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // PDF invoice state
  const [invoicePreview, setInvoicePreview] = useState<{
    supplier: string;
    invoiceNo: string;
    invoiceDate: string;
    items: InvoiceItem[];
  } | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<InvoiceItem | null>(null);

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['bulk-logs'],
    queryFn: () => api.get('/bulk/logs').then((r) => r.data),
  });

  const importMutation = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      return api
        .post(`/bulk/${type}/import`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Import complete: ${data.success_rows} rows imported`);
      qc.invalidateQueries({ queryKey: ['bulk-logs'] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Import failed'),
  });

  const parsePdfMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api
        .post('/bulk/invoice/parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      setInvoicePreview(data);
      if (data.items.length === 0) {
        toast.error('No medicines found in the PDF. Try a different invoice.');
      } else {
        toast.success(`Found ${data.items.length} medicine(s) — review before importing`);
      }
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Failed to read PDF'),
  });

  const confirmImportMutation = useMutation({
    mutationFn: () =>
      api
        .post('/bulk/invoice/import', {
          items: invoicePreview!.items,
          supplier: invoicePreview!.supplier,
          invoiceNo: invoicePreview!.invoiceNo,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`${data.success_rows} items imported into stock!`);
      setInvoicePreview(null);
      qc.invalidateQueries({ queryKey: ['bulk-logs'] });
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Import failed'),
  });

  const handleDownloadTemplate = async (type: string) => {
    const response = await api.get(`/bulk/template/${type}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-import-template.xlsx`;
    a.click();
    toast.success('Template downloaded');
  };

  const removeItem = (idx: number) => {
    if (!invoicePreview) return;
    setInvoicePreview({
      ...invoicePreview,
      items: invoicePreview.items.filter((_, i) => i !== idx),
    });
  };

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditRow({ ...invoicePreview!.items[idx] });
  };

  const saveEdit = () => {
    if (!invoicePreview || editingIdx === null || !editRow) return;
    const items = [...invoicePreview.items];
    items[editingIdx] = editRow;
    setInvoicePreview({ ...invoicePreview, items });
    setEditingIdx(null);
    setEditRow(null);
  };

  const TABS = [
    { id: 'invoice', label: '📄 PDF Invoice' },
    { id: 'medicines', label: 'Medicine Master' },
    { id: 'stock', label: 'Stock Batches' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Bulk Upload</h1>
        <p className="text-sm text-gray-500">
          Import stock directly from supplier PDF invoices, or use Excel templates
        </p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id as any);
              setResult(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PDF INVOICE TAB ─────────────────────────────────── */}
      {tab === 'invoice' && (
        <div className="space-y-5">
          {!invoicePreview ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card space-y-4">
                <h3 className="font-semibold text-gray-900">Import from Supplier Invoice PDF</h3>

                <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-800 space-y-1">
                  <p className="font-medium">✅ No API key needed — works with digital invoices</p>
                  <p className="text-blue-600">
                    Upload the PDF you get from your distributor (Central Pharmacy, etc.)
                    and we'll automatically read the medicine names, batch numbers, expiry,
                    quantity and rates.
                  </p>
                </div>

                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                  onClick={() => pdfRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f && f.type === 'application/pdf')
                      parsePdfMutation.mutate(f);
                    else toast.error('Please upload a PDF file');
                  }}
                >
                  {parsePdfMutation.isPending ? (
                    <div className="space-y-2">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary-600" />
                      <p className="text-sm text-gray-600">Reading PDF...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileText className="w-12 h-12 mx-auto text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">Drop your invoice PDF here</p>
                      <p className="text-xs text-gray-400">or click to browse</p>
                    </div>
                  )}
                </div>
                <input
                  ref={pdfRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) parsePdfMutation.mutate(f);
                    e.target.value = '';
                  }}
                />

                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
                  <p className="font-medium text-gray-600">Supported invoice formats:</p>
                  <p>• Reliable Software (used by most Kerala distributors)</p>
                  <p>• Any digital/searchable PDF (not scanned photos)</p>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Activity Log</h3>
                <ActivityLog logs={logs} logsLoading={logsLoading} />
              </div>
            </div>
          ) : (
            /* ── PREVIEW TABLE ─────────────────── */
            <div className="space-y-4">
              {/* Invoice header */}
              <div className="card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900">Review Extracted Data</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {invoicePreview.supplier && (
                        <span>
                          <span className="text-gray-400">Supplier: </span>
                          <span className="font-medium">{invoicePreview.supplier}</span>
                        </span>
                      )}
                      {invoicePreview.invoiceNo && (
                        <span>
                          <span className="text-gray-400">Invoice #: </span>
                          <span className="font-medium">{invoicePreview.invoiceNo}</span>
                        </span>
                      )}
                      {invoicePreview.invoiceDate && (
                        <span>
                          <span className="text-gray-400">Date: </span>
                          <span className="font-medium">{invoicePreview.invoiceDate}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Please verify the data below before confirming import. You can edit or remove rows.
                    </p>
                  </div>
                  <button
                    onClick={() => setInvoicePreview(null)}
                    className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </div>
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Medicine Name', 'Batch No', 'Expiry', 'Qty', 'Purchase Price (₹)', 'MRP (₹)', 'GST %', ''].map(
                        (h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePreview.items.map((item, idx) =>
                      editingIdx === idx ? (
                        <tr key={idx} className="bg-blue-50 border-b border-blue-100">
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-44"
                              value={editRow!.medicineName}
                              onChange={(e) =>
                                setEditRow({ ...editRow!, medicineName: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-24"
                              value={editRow!.batchNo}
                              onChange={(e) =>
                                setEditRow({ ...editRow!, batchNo: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-24"
                              value={editRow!.expiry}
                              placeholder="MM/YYYY"
                              onChange={(e) =>
                                setEditRow({ ...editRow!, expiry: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-16"
                              type="number"
                              value={editRow!.qty}
                              onChange={(e) =>
                                setEditRow({ ...editRow!, qty: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-20"
                              type="number"
                              step="0.01"
                              value={editRow!.purchasePrice}
                              onChange={(e) =>
                                setEditRow({
                                  ...editRow!,
                                  purchasePrice: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-20"
                              type="number"
                              step="0.01"
                              value={editRow!.mrp}
                              onChange={(e) =>
                                setEditRow({ ...editRow!, mrp: Number(e.target.value) })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input text-xs w-14"
                              type="number"
                              value={editRow!.gstPercent}
                              onChange={(e) =>
                                setEditRow({
                                  ...editRow!,
                                  gstPercent: Number(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={saveEdit} className="text-green-600 hover:text-green-700">
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingIdx(null);
                                  setEditRow(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{item.medicineName}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.batchNo}</td>
                          <td className="px-3 py-2 text-gray-600">{item.expiry}</td>
                          <td className="px-3 py-2 text-gray-900 font-semibold">{item.qty}</td>
                          <td className="px-3 py-2 text-gray-900">₹{item.purchasePrice.toFixed(2)}</td>
                          <td className="px-3 py-2 text-gray-900">₹{item.mrp.toFixed(2)}</td>
                          <td className="px-3 py-2 text-gray-600">{item.gstPercent}%</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => startEdit(idx)}
                                className="text-blue-500 hover:text-blue-700"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeItem(idx)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>

                {invoicePreview.items.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">All items removed. Upload the PDF again or go back.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {invoicePreview.items.length} item(s) ready to import
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setInvoicePreview(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmImportMutation.mutate()}
                    disabled={
                      invoicePreview.items.length === 0 || confirmImportMutation.isPending
                    }
                    className="btn-primary flex items-center gap-2"
                  >
                    {confirmImportMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Confirm Import to Stock
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXCEL TABS ────────────────────────────────────────── */}
      {(tab === 'medicines' || tab === 'stock') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">
              Import {tab === 'medicines' ? 'Medicine Master' : 'Stock Batches'}
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-xl">
                <p className="text-sm font-medium text-primary-800 mb-2">
                  Step 1: Download Template
                </p>
                <button
                  onClick={() =>
                    handleDownloadTemplate(tab === 'medicines' ? 'medicines' : 'stock')
                  }
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download {tab === 'medicines' ? 'Medicine' : 'Stock'} Template
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Step 2: Fill & Upload
                </p>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) importMutation.mutate({ file: f, type: tab });
                  }}
                >
                  {importMutation.isPending ? (
                    <div className="space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
                      <p className="text-sm text-gray-600">Processing...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-300" />
                      <p className="text-sm font-medium text-gray-700">Drop Excel file here</p>
                      <p className="text-xs text-gray-400">or click to browse (.xlsx, .xls)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importMutation.mutate({ file: f, type: tab });
                  }}
                />
              </div>

              {result && (
                <div
                  className={`p-4 rounded-xl border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <p className="font-medium text-gray-900 text-sm">
                      {result.message ||
                        (result.success ? 'Import successful' : 'Import failed')}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="text-gray-400">Total</p>
                      <p className="font-semibold">{result.total_rows}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Success</p>
                      <p className="font-semibold text-green-600">{result.success_rows}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Failed</p>
                      <p className="font-semibold text-red-500">{result.failed_rows}</p>
                    </div>
                  </div>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                      {result.errors.map((err: any, i: number) => (
                        <p key={i} className="text-xs text-red-600">
                          Row {err.row}: {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Activity Log</h3>
            <ActivityLog logs={logs} logsLoading={logsLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityLog({
  logs,
  logsLoading,
}: {
  logs: any[];
  logsLoading: boolean;
}) {
  if (logsLoading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300" />
      </div>
    );
  }
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Upload className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No uploads yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
      {logs.map((log: any) => (
        <div key={log.id} className="border border-gray-100 rounded-lg p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{log.file_name}</p>
              <p className="text-xs text-gray-400">
                {log.action_type.replace(/_/g, ' ')} · {formatDateTime(log.created_at)}
              </p>
            </div>
            <div className="text-right text-xs">
              <p className="text-green-600 font-medium">{log.success_rows} ok</p>
              {log.failed_rows > 0 && (
                <p className="text-red-500">{log.failed_rows} failed</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
