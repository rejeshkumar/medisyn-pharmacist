// apps/web/src/app/(dashboard)/returns/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Returns Console — manage stock returns to suppliers
// Mirrors the Procurement page UI pattern (split-panel: list left, detail right)
// Backend: /return-requests (already deployed)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Plus, Send, CheckCircle2, X, ChevronRight, Loader2,
  AlertTriangle, Calendar, Package, FileText, Search,
  ArrowLeft, Truck, IndianRupee, Trash2,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;
const BRAND = '#00b8a0';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-slate-100 text-slate-700' },
  sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  closed:    { label: 'Closed',    color: 'bg-slate-200 text-slate-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600' },
};

const REASON_LABELS: Record<string, string> = {
  expired:        'Expired',
  near_expiry:    'Near expiry',
  damaged:        'Damaged',
  quality_issue:  'Quality issue',
  overstocked:    'Overstocked',
  wrong_product:  'Wrong product',
  other:          'Other',
};

interface ReturnRequest {
  id: string;
  rr_number: string;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: string;
  notes: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  credit_note_no: string | null;
  credit_amount: number;
  created_at: string;
  created_by_name: string | null;
  item_count?: number;
  total_units?: number;
  total_value?: number;
}

interface ReturnRequestItem {
  id: string;
  batch_id: string;
  medicine_id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  return_qty: number;
  purchase_price: number;
  mrp: number;
  return_value: number;
  return_reason: string;
  notes: string | null;
}

interface NearExpiryBatch {
  batch_id: string;
  medicine_id: string;
  brand_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  mrp: number;
  supplier_id: string | null;
  supplier_name: string | null;
  days_to_expiry: number;
}

export default function ReturnsPage() {
  const [tab, setTab] = useState<'requests' | 'expiry' | 'patient'>('requests');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [detail, setDetail] = useState<{ rr: ReturnRequest; items: ReturnRequestItem[] } | null>(null);
  const [settlementModal, setSettlementModal] = useState<string | null>(null); // return request id
  const [settlementType, setSettlementType] = useState<'credit_note'|'cash'|'upi'>('credit_note');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().slice(0,10));
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('medisyn_token') : '';

  // ── Load requests ──────────────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const url = `${API}/return-requests${statusFilter ? `?status=${statusFilter}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load return requests');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || 'Error loading');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, token]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // ── Load detail when row selected ──────────────────────────────────────────
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    (async () => {
      try {
        const res = await fetch(`${API}/return-requests/${selected.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load detail');
        const data = await res.json();
        // API returns return-request fields flat with `items` appended.
        // Normalise to the { rr, items } shape the render expects.
        setDetail(data?.rr ? data : { rr: data, items: data?.items || [] });
      } catch {
        setDetail(null);
      }
    })();
  }, [selected, token]);

  // ── Update status ──────────────────────────────────────────────────────────
  async function updateStatus(id: string, newStatus: string, extra: any = {}) {
    if (!confirm(`Change status to "${STATUS_CONFIG[newStatus]?.label || newStatus}"?`)) return;
    try {
      const res = await fetch(`${API}/return-requests/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update');
      }
      await loadRequests();
      // Reload selected detail
      if (selected?.id === id) {
        const det = await fetch(`${API}/return-requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.json());
        const norm = det?.rr ? det : { rr: det, items: det?.items || [] };
        setDetail(norm);
        setSelected(norm.rr);
      }
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  // ── Confirm with credit note ───────────────────────────────────────────────
  async function confirmWithCredit(id: string) {
    const cnNo = prompt('Credit note number from supplier:');
    if (!cnNo) return;
    const amt = prompt('Credit amount (₹):');
    if (!amt) return;
    await updateStatus(id, 'confirmed', {
      credit_note_no: cnNo,
      credit_amount: Number(amt),
    });
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 min-h-screen">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-6 h-6" style={{ color: BRAND }} />
              Returns
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Return expired or damaged stock to suppliers and track credit notes
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            <Plus className="w-4 h-4" /> New return
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-slate-200 -mb-4 overflow-x-auto">
          <button
            onClick={() => setTab('requests')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === 'requests'
                ? 'border-current'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={tab === 'requests' ? { color: BRAND } : {}}
          >
            Return requests
          </button>
          <button
            onClick={() => setTab('expiry')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === 'expiry'
                ? 'border-current'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={tab === 'expiry' ? { color: BRAND } : {}}
          >
            Expiry list
          </button>
          <button
            onClick={() => setTab('patient')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 whitespace-nowrap ${
              tab === 'patient'
                ? 'border-current'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            style={tab === 'patient' ? { color: BRAND } : {}}
          >
            Patient returns
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {tab === 'requests' ? (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
          {/* List panel */}
          <div className={`bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden ${
            selected ? 'hidden lg:flex lg:w-1/2' : 'flex w-full lg:w-1/2'
          }`}>
            {/* Filter */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">Filter:</span>
              {['', 'draft', 'sent', 'confirmed', 'closed'].map(s => (
                <button
                  key={s || 'all'}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    statusFilter === s
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s ? STATUS_CONFIG[s]?.label || s : 'All'}
                </button>
              ))}
              <button
                onClick={loadRequests}
                className="ml-auto text-slate-400 hover:text-slate-600"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
              ) : error ? (
                <div className="p-8 text-center text-sm text-red-500">{error}</div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600">No return requests</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Go to "Expiry list" to start a return.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {requests.map(rr => (
                    <button
                      key={rr.id}
                      onClick={() => setSelected(rr)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                        selected?.id === rr.id ? 'bg-teal-50/40 border-l-4' : 'border-l-4 border-transparent'
                      }`}
                      style={selected?.id === rr.id ? { borderLeftColor: BRAND } : {}}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{rr.rr_number}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            STATUS_CONFIG[rr.status]?.color || ''
                          }`}>
                            {STATUS_CONFIG[rr.status]?.label || rr.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {rr.supplier_name || 'No supplier'} · {rr.item_count || 0} items · {rr.total_units || 0} units
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(rr.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {Number(rr.total_value) > 0 && (
                          <p className="text-sm font-bold text-slate-800">
                            ₹{Number(rr.total_value).toFixed(0)}
                          </p>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail panel */}
          {selected && detail?.rr && (
            <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden flex-1 lg:w-1/2">
              {/* Detail header */}
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => { setSelected(null); setDetail(null); }}
                  className="lg:hidden text-slate-500 hover:text-slate-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{detail.rr.rr_number}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {detail.rr.supplier_name || 'No supplier'}
                    {detail.rr.supplier_phone && ` · ${detail.rr.supplier_phone}`}
                  </p>
                </div>
                <button
                  onClick={() => { setSelected(null); setDetail(null); }}
                  className="hidden lg:block text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {detail.rr.status === 'draft' && (
                    <>
                      <button
                        onClick={() => updateStatus(detail.rr.id, 'sent')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg hover:opacity-90"
                        style={{ backgroundColor: BRAND }}
                      >
                        <Send className="w-3.5 h-3.5" /> Mark as sent
                      </button>
                      <button
                        onClick={() => updateStatus(detail.rr.id, 'cancelled')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </>
                  )}
                  {detail.rr.status === 'sent' && (
                    <button
                      onClick={() => {
                        setSettlementAmount(String(detail.rr.total_value || ''));
                        setSettlementModal(detail.rr.id);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Record Settlement
                    </button>
                  )}
                  {detail.rr.status === 'confirmed' && (
                    <button
                      onClick={() => updateStatus(detail.rr.id, 'closed')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 text-white text-xs font-semibold rounded-lg hover:bg-slate-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Close
                    </button>
                  )}
                </div>

                {/* Meta */}
                <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Created</span>
                    <p className="font-semibold text-slate-700 mt-0.5">
                      {new Date(detail.rr.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">By</span>
                    <p className="font-semibold text-slate-700 mt-0.5">
                      {detail.rr.created_by_name || '—'}
                    </p>
                  </div>
                  {detail.rr.sent_at && (
                    <div>
                      <span className="text-slate-500">Sent</span>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {new Date(detail.rr.sent_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  )}
                  {detail.rr.confirmed_at && (
                    <div>
                      <span className="text-slate-500">Confirmed</span>
                      <p className="font-semibold text-slate-700 mt-0.5">
                        {new Date(detail.rr.confirmed_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  )}
                  {detail.rr.settlement_type && (
                    <div className="col-span-2 pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Settlement</span>
                      <p className="font-semibold text-green-700 mt-0.5">
                        {detail.rr.settlement_type === 'credit_note' ? '📄 Credit Note' :
                         detail.rr.settlement_type === 'upi' ? '📱 UPI' : '💵 Cash'}
                        {' '}· ₹{Number(detail.rr.settlement_amount || detail.rr.credit_amount || 0).toFixed(2)}
                        {detail.rr.settlement_ref && ` · ${detail.rr.settlement_ref}`}
                      </p>
                    </div>
                  )}
                </div>

                {detail.rr.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                    <p className="text-sm text-slate-700 bg-amber-50 rounded-lg p-3 border border-amber-100">
                      {detail.rr.notes}
                    </p>
                  </div>
                )}

                {/* Items table */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Items ({detail.items.length})
                  </p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">Medicine</th>
                            <th className="px-3 py-2 text-left font-semibold">Batch</th>
                            <th className="px-3 py-2 text-right font-semibold">Qty</th>
                            <th className="px-3 py-2 text-right font-semibold">Value</th>
                            <th className="px-3 py-2 text-left font-semibold">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detail.items.map(it => (
                            <tr key={it.id}>
                              <td className="px-3 py-2">
                                <p className="font-semibold text-slate-800">{it.medicine_name}</p>
                                <p className="text-slate-500">
                                  Exp: {new Date(it.expiry_date).toLocaleDateString('en-IN', {
                                    month: 'short', year: 'numeric',
                                  })}
                                </p>
                              </td>
                              <td className="px-3 py-2 text-slate-600">{it.batch_number}</td>
                              <td className="px-3 py-2 text-right font-semibold">{it.return_qty}</td>
                              <td className="px-3 py-2 text-right">₹{Number(it.return_value).toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-600">
                                {REASON_LABELS[it.return_reason] || it.return_reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-2 text-right">Total</td>
                            <td className="px-3 py-2 text-right">
                              {detail.items.reduce((s, i) => s + Number(i.return_qty), 0)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₹{detail.items.reduce((s, i) => s + Number(i.return_value), 0).toFixed(2)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no selection */}
          {/* Settlement Modal */}
      {settlementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Record Settlement</h2>
              <button onClick={() => setSettlementModal(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Settlement type */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">How did the distributor settle?</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'credit_note', label: '📄 Credit Note', desc: 'Adjust in next PO' },
                    { key: 'cash', label: '💵 Cash', desc: 'Cash payment received' },
                    { key: 'upi', label: '📱 UPI', desc: 'UPI transfer received' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setSettlementType(t.key)}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                        settlementType === t.key
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Amount Received (₹)</label>
                <input type="number" value={settlementAmount}
                  onChange={e => setSettlementAmount(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  placeholder="0.00" />
              </div>

              {/* Reference */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  {settlementType === 'credit_note' ? 'Credit Note Number' :
                   settlementType === 'upi' ? 'UPI Transaction ID' : 'Receipt Number (optional)'}
                </label>
                <input type="text" value={settlementRef}
                  onChange={e => setSettlementRef(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                  placeholder={settlementType === 'credit_note' ? 'e.g. CN/2026/1234' :
                               settlementType === 'upi' ? 'e.g. 4056789012345' : 'Optional'} />
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Settlement Date</label>
                <input type="date" value={settlementDate}
                  onChange={e => setSettlementDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Notes (optional)</label>
                <textarea value={settlementNotes} onChange={e => setSettlementNotes(e.target.value)}
                  rows={2} placeholder="Any additional notes..."
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500" />
              </div>

              {settlementType === 'credit_note' && (
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  💡 Credit note will be saved against this supplier. You can apply it when raising the next Purchase Order.
                </div>
              )}
              {(settlementType === 'cash' || settlementType === 'upi') && (
                <div className="bg-green-50 rounded-lg p-3 text-xs text-green-700">
                  💡 This amount will be recorded as income in the Finance module automatically.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setSettlementModal(null)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                disabled={!settlementAmount || settlementSaving}
                onClick={async () => {
                  setSettlementSaving(true);
                  try {
                    const res = await fetch(`${API}/return-requests/${settlementModal}/settle`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        settlement_type: settlementType,
                        settlement_amount: Number(settlementAmount),
                        settlement_ref: settlementRef || null,
                        settlement_date: settlementDate,
                        settlement_notes: settlementNotes || null,
                      }),
                    });
                    if (!res.ok) throw new Error('Failed to record settlement');
                    setSettlementModal(null);
                    setSettlementAmount('');
                    setSettlementRef('');
                    setSettlementNotes('');
                    await loadList();
                    if (selected) {
                      const det = await fetch(`${API}/return-requests/${selected.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      }).then(r => r.json());
                      const norm = det?.rr ? det : { rr: det, items: det?.items || [] };
                      setDetail(norm);
                      setSelected(norm.rr);
                    }
                  } catch (e: any) {
                    const msg = e.message || 'Error recording settlement';
                    if (msg.includes('already') || msg.includes('Cannot transition') || msg.includes('sent')) {
                      // Already settled — just close and refresh
                      setSettlementModal(null);
                      await loadList();
                    } else {
                      alert(msg);
                    }
                  } finally {
                    setSettlementSaving(false);
                  }
                }}
                className="px-4 py-2 text-sm text-white rounded-lg font-semibold disabled:opacity-50"
                style={{ backgroundColor: BRAND }}>
                {settlementSaving ? 'Saving...' : 'Record Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!selected && (
            <div className="hidden lg:flex flex-1 bg-white rounded-2xl border border-slate-200 items-center justify-center">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Select a return request</p>
                <p className="text-xs text-slate-400 mt-1">
                  Click any row from the list to view details
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ExpiryListTab onCreateReturn={() => setShowCreate(true)} token={token} />
      ) : tab === 'patient' ? (
        <PatientReturnTab token={token} />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateReturnModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry List Tab — shows near-expiry batches; user selects to create return
// ─────────────────────────────────────────────────────────────────────────────
function ExpiryListTab({ onCreateReturn, token }: { onCreateReturn: () => void; token: string | null }) {
  const [batches, setBatches] = useState<NearExpiryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(90);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/stock/alerts/near-expiry?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : []);
      } catch {
        setBatches([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [days, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      b =>
        b.brand_name?.toLowerCase().includes(q) ||
        b.batch_number?.toLowerCase().includes(q) ||
        b.supplier_name?.toLowerCase().includes(q),
    );
  }, [batches, search]);

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden">
      <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden flex-1">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search medicine or batch…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
            />
          </div>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
          >
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={180}>Next 180 days</option>
            <option value={365}>Next year</option>
          </select>
          <button
            onClick={onCreateReturn}
            className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            <Plus className="w-4 h-4" /> New return
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading expiry data…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">No near-expiry stock</p>
              <p className="text-xs text-slate-400 mt-1">
                Nothing in the next {days} days. Stock is healthy.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Medicine</th>
                    <th className="px-4 py-2 text-left font-semibold">Batch</th>
                    <th className="px-4 py-2 text-left font-semibold">Expiry</th>
                    <th className="px-4 py-2 text-right font-semibold">Qty</th>
                    <th className="px-4 py-2 text-right font-semibold">Value</th>
                    <th className="px-4 py-2 text-left font-semibold">Supplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(b => {
                    const expired = b.days_to_expiry < 0;
                    const critical = b.days_to_expiry >= 0 && b.days_to_expiry <= 30;
                    return (
                      <tr key={b.batch_id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-semibold text-slate-800">{b.brand_name}</td>
                        <td className="px-4 py-2 text-slate-600">{b.batch_number}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            expired ? 'bg-red-100 text-red-700' :
                            critical ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {new Date(b.expiry_date).toLocaleDateString('en-IN', {
                              month: 'short', year: 'numeric',
                            })}
                            {expired ? ' · expired' : ` · ${b.days_to_expiry}d`}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{b.quantity}</td>
                        <td className="px-4 py-2 text-right">
                          ₹{(b.quantity * Number(b.purchase_price || 0)).toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-slate-600 text-xs">
                          {b.supplier_name || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Return Modal — pick supplier, add items, save as draft
// ─────────────────────────────────────────────────────────────────────────────
function CreateReturnModal({
  token, onClose, onCreated,
}: {
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const [batches, setBatches] = useState<NearExpiryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, { qty: number; reason: string }>>({});
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [suppliers, setSuppliers] = useState<{id:string;name:string;phone?:string}[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/stock/suppliers`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, [token]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/stock/alerts/near-expiry?days=180`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setBatches(Array.isArray(data) ? data : []);
      } catch {
        setBatches([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      b =>
        b.brand_name?.toLowerCase().includes(q) ||
        b.batch_number?.toLowerCase().includes(q),
    );
  }, [batches, search]);

  const selectedItems = useMemo(
    () => batches.filter(b => selected[b.batch_id]?.qty > 0),
    [batches, selected],
  );

  const totalValue = useMemo(
    () => selectedItems.reduce(
      (s, b) => s + (selected[b.batch_id]?.qty || 0) * Number(b.purchase_price || 0),
      0,
    ),
    [selectedItems, selected],
  );

  // Auto-fill supplier from first selected if supplier is empty
  useEffect(() => {
    if (!supplierName && selectedItems.length > 0 && selectedItems[0].supplier_name) {
      setSupplierName(selectedItems[0].supplier_name);
    }
  }, [selectedItems, supplierName]);

  function toggleItem(b: NearExpiryBatch) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[b.batch_id]) {
        delete next[b.batch_id];
      } else {
        // Default reason based on expiry
        const reason = b.days_to_expiry < 0 ? 'expired'
          : b.days_to_expiry <= 30 ? 'near_expiry'
          : 'near_expiry';
        next[b.batch_id] = { qty: b.quantity, reason };
      }
      return next;
    });
  }

  function updateQty(batchId: string, qty: number, max: number) {
    setSelected(prev => ({
      ...prev,
      [batchId]: { ...prev[batchId], qty: Math.max(1, Math.min(max, qty)) },
    }));
  }

  function updateReason(batchId: string, reason: string) {
    setSelected(prev => ({
      ...prev,
      [batchId]: { ...prev[batchId], reason },
    }));
  }

  async function submit() {
    if (selectedItems.length === 0) {
      setError('Select at least one batch to return');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const items = selectedItems.map(b => ({
        batch_id: b.batch_id,
        medicine_id: b.medicine_id,
        medicine_name: b.brand_name,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        return_qty: selected[b.batch_id].qty,
        purchase_price: Number(b.purchase_price || 0),
        mrp: Number(b.mrp || 0),
        return_value: selected[b.batch_id].qty * Number(b.purchase_price || 0),
        return_reason: selected[b.batch_id].reason,
      }));
      const res = await fetch(`${API}/return-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          supplier_name: supplierName || null,
          supplier_phone: supplierPhone || null,
          notes: notes || null,
          items,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create return');
      }
      onCreated();
    } catch (e: any) {
      setError(e.message || 'Error creating return');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-4xl sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {step === 'pick' ? 'Select batches to return' : 'Review return request'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 'pick'
                ? 'Pick expired or near-expiry batches'
                : `${selectedItems.length} items · ₹${totalValue.toFixed(2)}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step 1: Pick items */}
        {step === 'pick' && (
          <>
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search medicine or batch…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  No near-expiry batches found
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map(b => {
                    const isSelected = !!selected[b.batch_id];
                    const expired = b.days_to_expiry < 0;
                    return (
                      <div
                        key={b.batch_id}
                        className={`p-3 ${isSelected ? 'bg-teal-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(b)}
                            className="mt-1 w-4 h-4"
                            style={{ accentColor: BRAND }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {b.brand_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-slate-500">Batch {b.batch_number}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                expired ? 'bg-red-100 text-red-700' :
                                b.days_to_expiry <= 30 ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                Exp {new Date(b.expiry_date).toLocaleDateString('en-IN', {
                                  month: 'short', year: 'numeric',
                                })}
                              </span>
                              <span className="text-xs text-slate-500">
                                Stock: {b.quantity}
                              </span>
                              <span className="text-xs text-slate-500">
                                ₹{Number(b.purchase_price).toFixed(2)}/unit
                              </span>
                            </div>
                            {b.supplier_name && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                <Truck className="w-3 h-3 inline mr-1" />
                                {b.supplier_name}
                              </p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 ml-7 flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-slate-500">Qty:</label>
                              <input
                                type="number"
                                min={1}
                                max={b.quantity}
                                value={selected[b.batch_id].qty}
                                onChange={e =>
                                  updateQty(b.batch_id, Number(e.target.value), b.quantity)
                                }
                                className="w-20 px-2 py-1 text-sm border border-slate-200 rounded"
                              />
                              <span className="text-xs text-slate-400">/ {b.quantity}</span>
                            </div>
                            <select
                              value={selected[b.batch_id].reason}
                              onChange={e => updateReason(b.batch_id, e.target.value)}
                              className="text-xs border border-slate-200 rounded px-2 py-1"
                            >
                              {Object.entries(REASON_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">{selectedItems.length}</span> selected ·
                <span className="font-semibold ml-1">₹{totalValue.toFixed(2)}</span>
              </p>
              <button
                onClick={() => setStep('review')}
                disabled={selectedItems.length === 0}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
                style={selectedItems.length > 0 ? { backgroundColor: BRAND } : {}}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Review and submit */}
        {step === 'review' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Supplier info */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Supplier</p>
                <div className="relative">
                  <input
                    value={supplierSearch || supplierName}
                    onChange={e => {
                      setSupplierSearch(e.target.value);
                      setSupplierName(e.target.value);
                      setShowSupplierDrop(true);
                    }}
                    onFocus={() => setShowSupplierDrop(true)}
                    onBlur={() => setTimeout(() => setShowSupplierDrop(false), 200)}
                    placeholder="Search supplier..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                  />
                  {showSupplierDrop && (supplierSearch || supplierName) && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {suppliers
                        .filter(s => s.name.toLowerCase().includes((supplierSearch || supplierName).toLowerCase()))
                        .slice(0, 20)
                        .map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSupplierName(s.name);
                              setSupplierPhone(s.phone || '');
                              setSupplierSearch('');
                              setShowSupplierDrop(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-slate-50 last:border-0"
                          >
                            <span className="font-medium text-slate-800">{s.name}</span>
                            {s.phone && <span className="text-slate-400 text-xs ml-2">{s.phone}</span>}
                          </button>
                        ))}
                      {suppliers.filter(s => s.name.toLowerCase().includes((supplierSearch || supplierName).toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-400">No suppliers found</div>
                      )}
                    </div>
                  )}
                </div>
                <input
                  value={supplierPhone}
                  onChange={e => setSupplierPhone(e.target.value)}
                  placeholder="Supplier phone (optional)"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              {/* Items summary */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
                  Items ({selectedItems.length})
                </p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Medicine</th>
                        <th className="px-3 py-2 text-right font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Value</th>
                        <th className="px-3 py-2 text-left font-semibold">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedItems.map(b => (
                        <tr key={b.batch_id}>
                          <td className="px-3 py-2">
                            <p className="font-semibold">{b.brand_name}</p>
                            <p className="text-slate-500">{b.batch_number}</p>
                          </td>
                          <td className="px-3 py-2 text-right">{selected[b.batch_id].qty}</td>
                          <td className="px-3 py-2 text-right">
                            ₹{(selected[b.batch_id].qty * Number(b.purchase_price)).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {REASON_LABELS[selected[b.batch_id].reason]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      <tr>
                        <td className="px-3 py-2 text-right" colSpan={2}>Total</td>
                        <td className="px-3 py-2 text-right">₹{totalValue.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </p>
              )}
            </div>
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                onClick={() => setStep('pick')}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                ← Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: BRAND }}
              >
                {submitting ? 'Creating…' : 'Create return request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Patient Return Tab
function PatientReturnTab({ token }: { token: string | null }) {
  const [billSearch, setBillSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [billError, setBillError] = useState('');
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  async function lookupBill() {
    if (!billSearch.trim()) return;
    setSearching(true); setBillError(''); setBill(null);
    setReturnQtys({}); setSelectedItems({}); setSuccess(''); setError('');
    try {
      const res = await fetch(`${API}/sales/bill/${encodeURIComponent(billSearch.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Bill not found'); }
      const data = await res.json();
      setBill(data);
      const qtys: Record<string, number> = {};
      const reasons: Record<string, string> = {};
      const sel: Record<string, boolean> = {};
      (data.items || []).forEach((it: any) => { qtys[it.id] = 0; reasons[it.id] = 'patient_return'; sel[it.id] = false; });
      setReturnQtys(qtys); setReturnReasons(reasons); setSelectedItems(sel);
    } catch (e: any) { setBillError(e.message || 'Error looking up bill'); }
    finally { setSearching(false); }
  }

  const checkedItems = bill?.items?.filter((it: any) => selectedItems[it.id] && returnQtys[it.id] > 0) || [];
  const totalRefund = checkedItems.reduce((s: number, it: any) => s + returnQtys[it.id] * Number(it.unit_price || 0), 0);

  async function submitReturn() {
    if (checkedItems.length === 0) { setError('Select at least one item with qty > 0'); return; }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API}/return-requests/patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sale_id: bill.id,
          bill_no: bill.bill_number,
          patient_name: bill.patient_name,
          items: checkedItems.map((it: any) => ({
            sale_item_id: it.id,
            medicine_id: it.medicine_id,
            medicine_name: it.medicine?.brand_name || it.medicine_name || '',
            batch_id: it.batch_id,
            batch_number: it.batch?.batch_number || it.batch_number,
            return_qty: returnQtys[it.id],
            unit_price: Number(it.unit_price || 0),
            return_value: returnQtys[it.id] * Number(it.unit_price || 0),
            reason: returnReasons[it.id],
          })),
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Failed to create return'); }
      setSuccess(`Return processed. Refund: Rs.${totalRefund.toFixed(2)}`);
      setBill(null); setBillSearch('');
    } catch (e: any) { setError(e.message || 'Error processing return'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="flex-1 p-4 max-w-3xl mx-auto w-full">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: BRAND }} />
            Look up bill to process patient return
          </h2>
          <div className="flex gap-2">
            <input type="text" value={billSearch}
              onChange={e => setBillSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupBill()}
              placeholder="Enter bill number e.g. BL-20260611-0001"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00b8a0]" />
            <button onClick={lookupBill} disabled={searching}
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg flex items-center gap-2"
              style={{ backgroundColor: BRAND }}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
          {billError && <p className="text-xs text-red-500 mt-2">{billError}</p>}
        </div>

        {bill && (
          <>
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4 text-xs text-slate-600">
              <span><span className="font-semibold">Bill:</span> {bill.bill_number}</span>
              <span><span className="font-semibold">Patient:</span> {bill.patient_name || '—'}</span>
              <span><span className="font-semibold">Date:</span> {new Date(bill.created_at).toLocaleDateString('en-IN')}</span>
              <span><span className="font-semibold">Total:</span> Rs.{Number(bill.total_amount || bill.grand_total || 0).toFixed(2)}</span>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Select items to return</p>
              <div className="space-y-3">
                {(bill.items || []).map((it: any) => {
                  const maxQty = Number(it.qty || 0);
                  const isSelected = selectedItems[it.id];
                  return (
                    <div key={it.id} className={`border rounded-xl p-3 transition-colors ${isSelected ? 'border-[#00b8a0] bg-[#00b8a0]/5' : 'border-slate-200'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={!!isSelected}
                          onChange={e => {
                            setSelectedItems(prev => ({ ...prev, [it.id]: e.target.checked }));
                            if (e.target.checked && returnQtys[it.id] === 0)
                              setReturnQtys(prev => ({ ...prev, [it.id]: maxQty }));
                          }}
                          className="mt-1 w-4 h-4 accent-[#00b8a0]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{it.medicine?.brand_name || it.medicine_name || ''}</p>
                          <p className="text-xs text-slate-500">
                            Batch: <span className="font-mono font-semibold">{it.batch?.batch_number || it.batch_number || '—'}</span>
                            {' · '}Sold: <span className="font-semibold">{maxQty}</span>
                            {' · '}Rs.{Number(it.unit_price || 0).toFixed(2)}/unit
                          </p>
                          {isSelected && (
                            <div className="mt-2 flex flex-wrap gap-3 items-center">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500">Return qty:</label>
                                <input type="number" min={1} max={maxQty}
                                  value={returnQtys[it.id] || ''}
                                  onChange={e => setReturnQtys(prev => ({ ...prev, [it.id]: Math.max(1, Math.min(maxQty, Number(e.target.value))) }))}
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-[#00b8a0]" />
                                <span className="text-xs text-slate-400">of {maxQty}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-500">Reason:</label>
                                <select value={returnReasons[it.id] || 'patient_return'}
                                  onChange={e => setReturnReasons(prev => ({ ...prev, [it.id]: e.target.value }))}
                                  className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#00b8a0]">
                                  <option value="patient_return">Patient return</option>
                                  <option value="wrong_medicine">Wrong medicine dispensed</option>
                                  <option value="duplicate_bill">Duplicate bill</option>
                                  <option value="doctor_change">Doctor changed prescription</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>
                              <span className="text-xs font-semibold text-[#00b8a0]">
                                Refund: Rs.{(returnQtys[it.id] * Number(it.unit_price || 0)).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {checkedItems.length > 0 && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm">
                  <span className="text-slate-500">{checkedItems.length} item(s) · </span>
                  <span className="font-bold text-slate-800">Total refund: Rs.{totalRefund.toFixed(2)}</span>
                </div>
                <button onClick={submitReturn} disabled={submitting}
                  className="px-5 py-2 text-white text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {submitting ? 'Processing...' : 'Process return & refund'}
                </button>
              </div>
            )}
          </>
        )}
        {!bill && !billError && (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Enter a bill number above to look up the sale</p>
          </div>
        )}
        {success && <div className="mx-5 my-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {success}</div>}
        {error && <div className="mx-5 my-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
      </div>
    </div>
  );
}
