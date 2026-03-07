'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate, getExpiryStatus, getScheduleClassColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Search, Plus, X, AlertTriangle, Clock, Loader2, Package } from 'lucide-react';

export default function StockPage() {
  const [tab, setTab] = useState<'stock' | 'purchase' | 'adjust'>('stock');
  const [search, setSearch] = useState('');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [expiryFilter, setExpiryFilter] = useState('');
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '', invoice_no: '',
    items: [{ medicine_id: '', batch_number: '', expiry_date: '', quantity: '', purchase_price: '', mrp: '', sale_rate: '' }],
  });
  const qc = useQueryClient();

  const { data: stock, isLoading } = useQuery({
    queryKey: ['stock', search, lowStockFilter, expiryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (lowStockFilter) params.set('low_stock', 'true');
      if (expiryFilter) params.set('expiry_days', expiryFilter);
      return api.get(`/stock?${params}`).then((r) => r.data);
    },
  });

  const { data: medicines } = useQuery({
    queryKey: ['medicines-list'],
    queryFn: () => api.get('/medicines').then((r) => r.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/stock/suppliers').then((r) => r.data),
  });

  const purchaseMutation = useMutation({
    mutationFn: (data: any) => api.post('/stock/purchase', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Purchase added successfully');
      setShowPurchaseForm(false);
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add purchase'),
  });

  const addPurchaseItem = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [...purchaseForm.items, { medicine_id: '', batch_number: '', expiry_date: '', quantity: '', purchase_price: '', mrp: '', sale_rate: '' }],
    });
  };

  const handlePurchaseSubmit = () => {
    const payload = {
      supplier_id: purchaseForm.supplier_id || undefined,
      invoice_no: purchaseForm.invoice_no || undefined,
      items: purchaseForm.items.map((i) => ({
        medicine_id: i.medicine_id,
        batch_number: i.batch_number,
        expiry_date: i.expiry_date,
        quantity: Number(i.quantity),
        purchase_price: Number(i.purchase_price),
        mrp: Number(i.mrp),
        sale_rate: Number(i.sale_rate) || Number(i.mrp),
      })).filter((i) => i.medicine_id && i.batch_number && i.quantity > 0),
    };
    if (payload.items.length === 0) { toast.error('Add at least one valid item'); return; }
    purchaseMutation.mutate(payload);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock & Inventory</h1>
          <p className="text-sm text-gray-500">{stock?.length || 0} batches</p>
        </div>
        <button onClick={() => setShowPurchaseForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Purchase
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${lowStockFilter ? 'bg-red-50 border-red-200 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Low Stock
        </button>
        <select
          className="input w-auto"
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
        >
          <option value="">All Expiry</option>
          <option value="30">Expiry ≤ 30 days</option>
          <option value="60">Expiry ≤ 60 days</option>
          <option value="90">Expiry ≤ 90 days</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Medicine</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">MRP</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sale Rate</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : stock?.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No stock found
              </td></tr>
            ) : (
              stock?.map((batch: any) => {
                const expiry = getExpiryStatus(batch.expiry_date);
                return (
                  <tr key={batch.id} className="table-row">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{batch.medicine?.brand_name}</p>
                      <p className="text-xs text-gray-400">{batch.medicine?.molecule} · {batch.medicine?.schedule_class}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">{batch.batch_number}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${expiry.color}`}>
                        {formatDate(batch.expiry_date)} ({expiry.label})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${batch.quantity <= 10 ? 'text-red-600' : batch.quantity <= 50 ? 'text-amber-600' : 'text-gray-900'}`}>
                        {batch.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">₹{batch.mrp}</td>
                    <td className="px-4 py-3 text-gray-700">₹{batch.sale_rate}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{batch.supplier?.name || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showPurchaseForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Purchase Invoice</h3>
              <button onClick={() => setShowPurchaseForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Supplier</label>
                  <select className="input" value={purchaseForm.supplier_id} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}>
                    <option value="">Select supplier</option>
                    {suppliers?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Invoice No.</label>
                  <input className="input" value={purchaseForm.invoice_no} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_no: e.target.value })} placeholder="INV-001" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">Line Items</p>
                  <button onClick={addPurchaseItem} className="text-primary-600 text-xs hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>
                {purchaseForm.items.map((item, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="label">Medicine *</label>
                        <select className="input" value={item.medicine_id}
                          onChange={(e) => {
                            const updated = [...purchaseForm.items];
                            updated[idx].medicine_id = e.target.value;
                            setPurchaseForm({ ...purchaseForm, items: updated });
                          }}
                        >
                          <option value="">Select medicine</option>
                          {medicines?.map((m: any) => <option key={m.id} value={m.id}>{m.brand_name} {m.strength}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Batch No *</label>
                        <input className="input" value={item.batch_number}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].batch_number = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                          placeholder="BATCH001"
                        />
                      </div>
                      <div>
                        <label className="label">Expiry Date *</label>
                        <input type="date" className="input" value={item.expiry_date}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].expiry_date = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                        />
                      </div>
                      <div>
                        <label className="label">Quantity *</label>
                        <input type="number" className="input" value={item.quantity}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].quantity = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <label className="label">Purchase Price *</label>
                        <input type="number" className="input" value={item.purchase_price}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].purchase_price = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                          placeholder="45.00"
                        />
                      </div>
                      <div>
                        <label className="label">MRP *</label>
                        <input type="number" className="input" value={item.mrp}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].mrp = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                          placeholder="95.00"
                        />
                      </div>
                      <div>
                        <label className="label">Sale Rate</label>
                        <input type="number" className="input" value={item.sale_rate}
                          onChange={(e) => { const u = [...purchaseForm.items]; u[idx].sale_rate = e.target.value; setPurchaseForm({ ...purchaseForm, items: u }); }}
                          placeholder="90.00"
                        />
                      </div>
                    </div>
                    {purchaseForm.items.length > 1 && (
                      <button
                        onClick={() => setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.filter((_, i) => i !== idx) })}
                        className="text-red-500 text-xs hover:underline"
                      >
                        Remove row
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowPurchaseForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handlePurchaseSubmit} disabled={purchaseMutation.isPending} className="btn-primary flex-1">
                {purchaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Save Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
