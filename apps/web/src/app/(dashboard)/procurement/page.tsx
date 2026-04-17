'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  RefreshCw, Plus, Check, X, Loader2, Download,
  AlertTriangle, Package, Truck, ShoppingBag,
  ChevronRight, Eye, Send, ReceiptText, Search,
  Building2, Phone, Mail, Trash2, TrendingUp, Flame,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface ReorderFlag {
  id: string; medicine_id: string; brand_name: string;
  molecule: string; strength: string; dosage_form: string;
  current_stock: number; reorder_qty: number; suggested_qty: number;
  last_order_qty: number | null; last_order_date: string | null;
  last_unit_price: number | null; manufacturer: string | null;
  rack_location: string | null; gst_percent: number; hsn_code: string | null;
  supplier_name: string | null; preferred_supplier_id: string | null;
  status: string; flagged_at: string;
}

interface POItem {
  medicine_id: string; medicine_name: string; molecule: string;
  strength: string; hsn_code: string | null; gst_percent: number;
  ordered_qty: number; unit_price: number | null; total_price: number | null;
  reorder_flag_id: string | null; is_manual: boolean;
}

interface PO {
  id: string; po_number: string; status: string;
  supplier_name: string | null; order_date: string;
  total_amount: number; item_count: number; total_units: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:              { label: 'Draft',              color: 'bg-slate-100 text-slate-600' },
  sent:               { label: 'Sent',               color: 'bg-blue-50 text-blue-700' },
  partially_received: { label: 'Part. received',     color: 'bg-amber-50 text-amber-700' },
  received:           { label: 'Received',           color: 'bg-green-50 text-green-700' },
  cancelled:          { label: 'Cancelled',          color: 'bg-red-50 text-red-500' },
};

// ── Reorder List Tab ───────────────────────────────────────────────────────
function ReorderTab() {
  const [flags, setFlags]         = useState<ReorderFlag[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [showPOForm, setShowPOForm] = useState(false);
  const [manualItem, setManualItem] = useState({ medicine_id:'', medicine_name:'', ordered_qty:1, unit_price:'' });
  const [medSearch, setMedSearch]   = useState('');
  const [medResults, setMedResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [flagsRes, suppRes] = await Promise.all([
        api.get('/reorder-flags?status=pending'),
        api.get('/suppliers'),
      ]);
      setFlags(flagsRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefresh(true);
    try {
      const r = await api.post('/reorder-flags/refresh', {});
      toast.success(`Checked ${r.data.checked} medicines — ${r.data.pending_flags} need reorder`);
      await load();
    } catch { toast.error('Refresh failed'); }
    finally { setRefresh(false); }
  };

  const dismiss = async (id: string) => {
    try {
      await api.patch(`/reorder-flags/${id}/dismiss`, {});
      setFlags(f => f.filter(x => x.id !== id));
      setSelected(s => { const n = new Set(s); n.delete(id); return n; });
      toast.success('Flag dismissed');
    } catch { toast.error('Failed'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === flags.length) setSelected(new Set());
    else setSelected(new Set(flags.map(f => f.id)));
  };

  // Med search for manual add
  useEffect(() => {
    if (medSearch.length < 2) { setMedResults([]); return; }
    api.get(`/medicines?search=${medSearch}&limit=8`)
      .then(r => setMedResults(r.data?.data || r.data || []))
      .catch(() => {});
  }, [medSearch]);

  const selectedFlags = flags.filter(f => selected.has(f.id));

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#00475a]" /></div>;

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50">
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh stock check
        </button>
        {selected.size > 0 && (
          <button onClick={() => setShowPOForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d]">
            <ReceiptText className="w-4 h-4" />
            Create PO for {selected.size} item{selected.size > 1 ? 's' : ''}
          </button>
        )}
        <span className="text-sm text-slate-400 ml-auto">
          {flags.length} medicine{flags.length !== 1 ? 's' : ''} need reorder
        </span>
      </div>

      {flags.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-semibold text-slate-500">All stock levels are healthy</p>
          <p className="text-xs text-slate-400 mt-1">Click "Refresh stock check" to re-run</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={selected.size === flags.length && flags.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 accent-[#00475a] rounded" />
                </th>
                {['Medicine','Current stock','Reorder at','Last ordered','Suggested order','Supplier',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {flags.map(f => {
                const isSelected = selected.has(f.id);
                const stockPct   = f.reorder_qty > 0 ? (f.current_stock / f.reorder_qty) * 100 : 0;
                return (
                  <tr key={f.id} className={`border-b border-slate-50 transition-colors ${isSelected ? 'bg-teal-50/30' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(f.id)}
                        className="w-4 h-4 accent-[#00475a] rounded" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-slate-800">{f.brand_name}</p>
                      <p className="text-xs text-slate-400">{f.molecule} · {f.strength} · {f.dosage_form}</p>
                      {f.manufacturer && <p className="text-[10px] text-slate-400 italic">{f.manufacturer}</p>}
                      {f.rack_location && <p className="text-[10px] text-blue-600">📍 {f.rack_location}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-black ${
                          f.current_stock === 0 ? 'text-red-600'
                          : f.current_stock <= f.reorder_qty ? 'text-amber-600'
                          : 'text-slate-700'
                        }`}>{f.current_stock}</span>
                        <span className="text-xs text-slate-400">units</span>
                      </div>
                      {/* Stock bar */}
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1">
                        <div className={`h-1.5 rounded-full ${
                          stockPct === 0 ? 'bg-red-500'
                          : stockPct < 50 ? 'bg-amber-500' : 'bg-green-500'
                        }`} style={{ width: `${Math.min(100, stockPct)}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-600 text-center">{f.reorder_qty}</td>
                    <td className="px-3 py-3">
                      {f.last_order_qty ? (
                        <div>
                          <p className="text-sm font-medium text-slate-700">{f.last_order_qty} units</p>
                          {f.last_order_date && (
                            <p className="text-[10px] text-slate-400">
                              {new Date(f.last_order_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'2-digit'})}
                            </p>
                          )}
                          {f.last_unit_price && (
                            <p className="text-[10px] text-slate-400">@ ₹{Number(f.last_unit_price).toFixed(2)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No history</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm font-bold text-[#00475a]">{f.suggested_qty} units</span>
                      <p className="text-[10px] text-slate-400">(reorder × 2)</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {f.supplier_name || <span className="text-slate-300">Not set</span>}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => dismiss(f.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors" title="Dismiss">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PO Creation Modal */}
      {showPOForm && (
        <POCreateModal
          flags={selectedFlags}
          suppliers={suppliers}
          onClose={() => setShowPOForm(false)}
          onCreated={() => { setShowPOForm(false); setSelected(new Set()); load(); }}
        />
      )}
    </div>
  );
}

// ── PO Creation Modal ──────────────────────────────────────────────────────
function POCreateModal({ flags, suppliers, onClose, onCreated }: {
  flags: ReorderFlag[]; suppliers: any[];
  onClose: () => void; onCreated: () => void;
}) {
  const [supplierId, setSupplierId]   = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);

  // Line items — pre-filled from flags
  const [items, setItems] = useState<Array<{
    flag_id: string | null; medicine_id: string; medicine_name: string;
    molecule: string; strength: string; hsn_code: string | null;
    gst_percent: number; ordered_qty: number; unit_price: string; is_manual: boolean;
  }>>(flags.map(f => ({
    flag_id: f.id, medicine_id: f.medicine_id,
    medicine_name: f.brand_name, molecule: f.molecule,
    strength: f.strength, hsn_code: f.hsn_code,
    gst_percent: Number(f.gst_percent),
    ordered_qty: f.suggested_qty || f.reorder_qty * 2 || 1,
    unit_price: f.last_unit_price ? String(f.last_unit_price) : '',
    is_manual: false,
  })));

  // Manual add
  const [manualSearch, setManualSearch] = useState('');
  const [manualResults, setManualResults] = useState<any[]>([]);

  useEffect(() => {
    if (manualSearch.length < 2) { setManualResults([]); return; }
    api.get(`/medicines?search=${manualSearch}&limit=8`)
      .then(r => setManualResults(r.data?.data || r.data || []))
      .catch(() => {});
  }, [manualSearch]);

  const addManualItem = (med: any) => {
    setItems(prev => [...prev, {
      flag_id: null, medicine_id: med.id, medicine_name: med.brand_name,
      molecule: med.molecule || '', strength: med.strength || '',
      hsn_code: med.hsn_code || null, gst_percent: Number(med.gst_percent || 0),
      ordered_qty: 1, unit_price: '', is_manual: true,
    }]);
    setManualSearch(''); setManualResults([]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const onSupplierChange = (id: string) => {
    setSupplierId(id);
    const sup = suppliers.find(s => s.id === id);
    if (sup) { setSupplierName(sup.name); setSupplierPhone(sup.phone||''); setSupplierEmail(sup.email||''); }
  };

  const totalAmount = items.reduce((s, i) => s + i.ordered_qty * (Number(i.unit_price) || 0), 0);

  const submit = async () => {
    if (items.length === 0) { toast.error('No items'); return; }
    setSaving(true);
    try {
      const r = await api.post('/purchase-orders', {
        supplier_id: supplierId || null,
        supplier_name: supplierName || null,
        supplier_phone: supplierPhone || null,
        supplier_email: supplierEmail || null,
        expected_date: expectedDate || null,
        notes: notes || null,
        items: items.map(i => ({
          medicine_id: i.medicine_id, ordered_qty: i.ordered_qty,
          unit_price: i.unit_price ? Number(i.unit_price) : null,
          reorder_flag_id: i.flag_id, is_manual: i.is_manual,
        })),
      });
      toast.success(`${r.data.po_number} created`);
      onCreated();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Create Purchase Order</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Supplier</label>
              <select value={supplierId} onChange={e => onSupplierChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#00475a]">
                <option value="">-- Select or type below --</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Supplier name (if not listed)</label>
              <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="Distributor name"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Phone</label>
              <input type="text" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)}
                placeholder="WhatsApp number"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Email</label>
              <input type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)}
                placeholder="supplier@example.com"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Expected delivery date</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Any special instructions"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Order items</label>
              <span className="text-xs text-slate-400">{items.length} items</span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {['Medicine','HSN','GST%','Qty','Unit price (₹)','Total',''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-slate-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className={`border-t border-slate-100 ${item.is_manual ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-3 py-2">
                        <p className="text-sm font-medium text-slate-800">{item.medicine_name}</p>
                        <p className="text-[10px] text-slate-400">{item.molecule} · {item.strength}</p>
                        {item.is_manual && <span className="text-[9px] bg-blue-100 text-blue-600 px-1 rounded">Manual</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{item.hsn_code || '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{item.gst_percent}%</td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} value={item.ordered_qty}
                          onChange={e => updateItem(idx, 'ordered_qty', Math.max(1, Number(e.target.value)))}
                          className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:border-[#00475a]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={0} step="0.01" value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:border-[#00475a]" />
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-700">
                        {item.unit_price ? `₹${(item.ordered_qty * Number(item.unit_price)).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => setItems(prev => prev.filter((_,i) => i !== idx))}
                          className="text-slate-300 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Manual medicine add */}
              <div className="border-t border-slate-100 px-3 py-2 bg-slate-50/50 relative">
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <input type="text" value={manualSearch} onChange={e => setManualSearch(e.target.value)}
                    placeholder="Add another medicine manually..."
                    className="flex-1 text-sm bg-transparent border-none outline-none text-slate-600 placeholder-slate-400" />
                </div>
                {manualResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto mt-1">
                    {manualResults.map((m: any) => (
                      <button key={m.id} onClick={() => addManualItem(m)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50 border-b border-slate-50 last:border-0">
                        <span className="font-medium text-slate-800">{m.brand_name}</span>
                        <span className="text-slate-400 text-xs ml-2">{m.molecule} · {m.strength}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Total */}
          {totalAmount > 0 && (
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-xs text-slate-400">Estimated total</p>
                <p className="text-2xl font-black text-[#00475a]">₹{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              className="flex-1 py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
              Create Purchase Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Purchase Orders Tab ────────────────────────────────────────────────────
function POTab() {
  const [pos, setPOs]             = useState<PO[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatus] = useState('all');
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  const [poDetail, setPODetail]   = useState<any>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/purchase-orders${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`);
      setPOs(r.data || []);
    } catch { toast.error('Failed to load POs'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openPO = async (id: string) => {
    setSelectedPO(id);
    try {
      const r = await api.get(`/purchase-orders/${id}`);
      setPODetail(r.data);
      setReceiveItems(r.data.items.map((item: any) => ({
        ...item,
        recv_qty: item.ordered_qty - item.received_qty,
        batch_number: '',
        expiry_date: '',
        sale_rate: '',
        mrp: '',
        manufacturer: item.medicine?.manufacturer || '',
      })));
    } catch { toast.error('Failed to load PO'); }
  };

  const updateStatus = async (id: string, status: string, sent_via?: string) => {
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status, sent_via });
      toast.success(`PO ${status}`);
      await load();
      if (selectedPO === id) openPO(id);
    } catch { toast.error('Failed'); }
  };

  const receiveStock = async () => {
    if (!poDetail) return;
    setReceiving(true);
    try {
      await api.post(`/purchase-orders/${poDetail.id}/receive`, {
        items: receiveItems.filter(i => i.recv_qty > 0).map(i => ({
          id: i.id, medicine_id: i.medicine_id,
          received_qty: i.recv_qty,
          batch_number: i.batch_number,
          expiry_date: i.expiry_date,
          unit_price: Number(poDetail.items.find((x: any) => x.id === i.id)?.unit_price || 0),
          sale_rate: i.sale_rate ? Number(i.sale_rate) : null,
          mrp: i.mrp ? Number(i.mrp) : null,
          manufacturer: i.manufacturer || '',
        })),
        invoice_number: poDetail.invoice_number,
        supplier_id: poDetail.supplier_id,
      });
      toast.success('Stock received and added to inventory');
      setSelectedPO(null); setPODetail(null);
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Receive failed');
    } finally { setReceiving(false); }
  };

  return (
    <div className="flex gap-4 h-full">
      {/* PO List */}
      <div className={`${selectedPO ? 'w-1/2' : 'w-full'} flex flex-col`}>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {['all','draft','sent','partially_received','received'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap flex-shrink-0 transition-all ${
                statusFilter === s ? 'bg-[#00475a] text-white border-[#00475a]' : 'border-slate-200 text-slate-500'
              }`}>
              {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#00475a]" /></div>
        ) : pos.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-slate-400">No purchase orders yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pos.map(po => (
              <button key={po.id} onClick={() => openPO(po.id)}
                className={`w-full flex items-center gap-4 p-4 bg-white border rounded-xl text-left hover:border-[#00475a]/30 transition-all ${
                  selectedPO === po.id ? 'border-[#00475a] bg-teal-50/20' : 'border-slate-100'
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-900">{po.po_number}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[po.status]?.color ?? ''}`}>
                      {STATUS_CONFIG[po.status]?.label ?? po.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {po.supplier_name || 'No supplier'} · {po.item_count} items · {po.total_units} units
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(po.order_date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {po.total_amount > 0 && (
                    <p className="text-sm font-bold text-slate-800">₹{Number(po.total_amount).toFixed(0)}</p>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PO Detail */}
      {selectedPO && poDetail && (
        <div className="w-1/2 bg-white rounded-2xl border border-slate-100 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">{poDetail.po_number}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {poDetail.supplier_name || poDetail.supplier_name_resolved || 'No supplier'}
                {poDetail.phone && ` · ${poDetail.phone}`}
              </p>
            </div>
            <button onClick={() => { setSelectedPO(null); setPODetail(null); }}
              className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {poDetail.status === 'draft' && (
                <>
                  <button onClick={() => updateStatus(poDetail.id, 'sent', 'print')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-semibold rounded-lg hover:bg-[#003d4d]">
                    <Send className="w-3.5 h-3.5" /> Mark as sent
                  </button>
                  <a href={`/api/purchase-orders/${poDetail.id}/export`} target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </a>
                </>
              )}
              {['sent','partially_received'].includes(poDetail.status) && (
                <button onClick={() => updateStatus(poDetail.id, 'partially_received')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700">
                  <Truck className="w-3.5 h-3.5" /> Receive stock
                </button>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              {poDetail.items?.map((item: any, idx: number) => {
                const ri = receiveItems[idx];
                const isFullyReceived = item.received_qty >= item.ordered_qty;
                return (
                  <div key={item.id} className={`border rounded-xl p-3 ${isFullyReceived ? 'border-green-200 bg-green-50/30' : 'border-slate-100'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.medicine_name}</p>
                        <p className="text-xs text-slate-400">{item.molecule} · {item.strength}</p>
                        {item.hsn_code && <p className="text-[10px] text-slate-400">HSN: {item.hsn_code} · GST: {item.gst_percent}%</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-700">
                          {item.received_qty}/{item.ordered_qty} units
                        </p>
                        {isFullyReceived && <span className="text-[10px] text-green-600 font-semibold">✓ Received</span>}
                      </div>
                    </div>

                    {/* Receive form */}
                    {['sent','partially_received'].includes(poDetail.status) && !isFullyReceived && ri && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Recv qty</label>
                          <input type="number" min={0} value={ri.recv_qty}
                            onChange={e => setReceiveItems(prev => prev.map((x,i) =>
                              i === idx ? { ...x, recv_qty: Number(e.target.value) } : x))}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Batch no.</label>
                          <input type="text" value={ri.batch_number}
                            onChange={e => setReceiveItems(prev => prev.map((x,i) =>
                              i === idx ? { ...x, batch_number: e.target.value } : x))}
                            placeholder="e.g. B240101"
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Expiry date</label>
                          <input type="date" value={ri.expiry_date}
                            onChange={e => setReceiveItems(prev => prev.map((x,i) =>
                              i === idx ? { ...x, expiry_date: e.target.value } : x))}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Sale rate ₹</label>
                          <input type="number" value={ri.sale_rate}
                            onChange={e => setReceiveItems(prev => prev.map((x,i) =>
                              i === idx ? { ...x, sale_rate: e.target.value } : x))}
                            placeholder="0.00"
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#00475a]" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-400 block mb-1">Manufacturer <span className="text-amber-500 font-semibold">*</span></label>
                          <input type="text" value={ri.manufacturer || ''}
                            onChange={e => setReceiveItems(prev => prev.map((x,i) =>
                              i === idx ? { ...x, manufacturer: e.target.value } : x))}
                            placeholder="e.g. Sun Pharma, Cipla, Abbott"
                            className={`w-full px-2 py-1 border rounded-lg text-sm focus:outline-none focus:border-[#00475a] ${
                              !ri.manufacturer ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                            }`} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {['sent','partially_received'].includes(poDetail.status) && (
              <button onClick={receiveStock} disabled={receiving}
                className="w-full py-3 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50">
                {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Confirm receipt & add to stock
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suppliers Tab ──────────────────────────────────────────────────────────
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', gst_number:'', address:'' });
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.get('/suppliers'); setSuppliers(r.data || []); }
    catch { toast.error('Failed'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Supplier name required'); return; }
    setSaving(true);
    try {
      await api.post('/suppliers', form);
      toast.success('Supplier added');
      setShowForm(false);
      setForm({ name:'', phone:'', email:'', gst_number:'', address:'' });
      await load();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{suppliers.length} suppliers</span>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white text-sm font-semibold rounded-xl hover:bg-[#003d4d]">
          <Plus className="w-4 h-4" /> Add supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[#00475a]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{s.name}</p>
                {s.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{s.phone}</p>}
                {s.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>}
                {s.gst_number && <p className="text-[10px] text-slate-400 mt-1">GST: {s.gst_number}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add supplier</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              {[
                { key:'name', label:'Supplier / Distributor name', req:true, placeholder:'Apollo Pharmacy Distributors' },
                { key:'phone', label:'Phone / WhatsApp', req:false, placeholder:'9876543210' },
                { key:'email', label:'Email', req:false, placeholder:'orders@distributor.com' },
                { key:'gst_number', label:'GST number', req:false, placeholder:'22AAAAA0000A1Z5' },
                { key:'address', label:'Address', req:false, placeholder:'City, State' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">
                    {f.label} {f.req && <span className="text-red-500">*</span>}
                  </label>
                  <input type="text" value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]" />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm">Cancel</button>
                <button onClick={save} disabled={saving}
                  className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── In Demand Tab ─────────────────────────────────────────────────────────
function DemandTab() {
  const [items, setItems]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [threshold, setThreshold] = useState(3);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/demand?threshold=${threshold}&days=30`);
      setItems(r.data?.all || []);
    } catch { toast.error('Failed to load demand data'); }
    finally { setLoading(false); }
  }, [threshold]);

  useEffect(() => { load(); }, [load]);

  const markOrdered = async (name: string) => {
    try {
      await api.post('/demand/fulfil', { medicine_name: name, status: 'ordered' });
      toast.success('Marked as ordered');
      load();
    } catch { toast.error('Failed to update'); }
  };

  const highDemand = items.filter(i => i.is_high_demand);
  const others     = items.filter(i => !i.is_high_demand);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#00475a]" /></div>;

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Medicines requested by walk-in patients that were unavailable.
            Threshold: <span className="font-semibold text-[#00475a]">{threshold}+ requests</span> = high demand.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Threshold:</span>
          {[2,3,5].map(t => (
            <button key={t} onClick={() => setThreshold(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${threshold === t ? 'bg-[#00475a] text-white' : 'bg-slate-100 text-slate-600'}`}>
              {t}+
            </button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No demand requests yet</p>
          <p className="text-xs mt-1">When pharmacists note unavailable medicines, they appear here</p>
        </div>
      ) : (
        <>
          {/* High demand section */}
          {highDemand.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-red-700 uppercase tracking-wide">
                  High Demand — Procure Now ({highDemand.length})
                </h2>
              </div>
              <div className="space-y-2">
                {highDemand.map((item: any) => (
                  <div key={item.medicine_name}
                    className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Flame className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-red-900">{item.medicine_name}</p>
                        <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">
                          {item.request_count} requests
                        </span>
                        {item.requests_recent > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {item.requests_recent} this week
                          </span>
                        )}
                        {item.already_in_reorder && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            Already in reorder list
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-red-600">
                        {item.molecule && <span>{item.molecule}</span>}
                        {item.dosage_form && <><span>·</span><span>{item.dosage_form}</span></>}
                        <span>· Last requested {new Date(item.last_requested).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        {item.current_stock > 0 && <span className="text-amber-600">· {item.current_stock} in stock now</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex gap-2">
                      <button onClick={() => {
                        const tab = document.querySelector('[data-tab="orders"]') as HTMLButtonElement;
                        tab?.click();
                        toast.success(`Add "${item.medicine_name}" to a new PO`);
                      }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600">
                        <ReceiptText className="w-3.5 h-3.5" /> Raise PO
                      </button>
                      <button onClick={() => markOrdered(item.medicine_name)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-[#00475a] text-white rounded-lg text-xs font-semibold hover:bg-[#003d4d]">
                        <Check className="w-3.5 h-3.5" /> Mark ordered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Normal demand section */}
          {others.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  Watching ({others.length})
                </h2>
              </div>
              <div className="space-y-2">
                {others.map((item: any) => (
                  <div key={item.medicine_name}
                    className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-xl hover:border-slate-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{item.medicine_name}</p>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {item.request_count} request{item.request_count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Last: {new Date(item.last_requested).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {item.requests_recent > 0 && ` · ${item.requests_recent} this week`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex gap-2">
                      <button onClick={() => toast.success(`Go to Purchase Orders tab to add "${item.medicine_name}"`)}
                        className="text-xs text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg hover:bg-amber-50 border border-amber-200">
                        Raise PO
                      </button>
                      <button onClick={() => markOrdered(item.medicine_name)}
                        className="text-xs text-slate-400 hover:text-[#00475a] px-2 py-1 rounded-lg hover:bg-slate-100">
                        Mark ordered
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ProcurementPage() {
  const [tab, setTab] = useState<'reorder' | 'orders' | 'suppliers' | 'demand'>('reorder');

  const TABS = [
    { key: 'reorder',   label: 'Reorder list',     icon: AlertTriangle },
    { key: 'orders',    label: 'Purchase orders',   icon: ReceiptText   },
    { key: 'suppliers', label: 'Suppliers',         icon: Building2     },
    { key: 'demand',    label: 'In Demand',         icon: Flame         },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Procurement</h1>
          <p className="text-sm text-slate-400 mt-0.5">Reorder alerts, purchase orders, supplier management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-white flex-shrink-0 px-6">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-[#00475a] text-[#00475a]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'reorder'   && <ReorderTab />}
        {tab === 'orders'    && <POTab />}
        {tab === 'suppliers' && <SuppliersTab />}
        {tab === 'demand'    && <DemandTab />}
      </div>
    </div>
  );
}
