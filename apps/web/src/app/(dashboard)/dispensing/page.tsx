'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2,
  Loader2, AlertTriangle, RefreshCw, ChevronDown, Package,
  X, ArrowLeftRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Safe number helper — handles Postgres returning numerics as strings
const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => n(v).toFixed(2);

interface CartItem {
  medicine_id: string;
  batch_id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  qty: number;
  rate: number;
  gst_percent: number;
  is_substituted: boolean;
  schedule_class: string;
  molecule?: string;
}

interface Substitute {
  id: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  molecule: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  qty_in_stock: number;
  sale_rate: number;
}

// ── Substitutes modal ──────────────────────────────────────────────────────────
function SubstitutesModal({
  item,
  onSelect,
  onClose,
}: {
  item: CartItem;
  onSelect: (sub: Substitute) => void;
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<Substitute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!item.molecule && !item.medicine_name) { setLoading(false); return; }
    api.get(`/medicines/substitutes?medicine_id=${item.medicine_id}`)
      .then(r => setSubs(r.data || []))
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [item]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Molecule Substitutes</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Same active ingredient as {item.medicine_name}
              {item.molecule ? ` (${item.molecule})` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading substitutes...</span>
            </div>
          )}

          {!loading && subs.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No in-stock substitutes found with the same molecule
            </div>
          )}

          {subs.map(sub => {
            const daysToExpiry = Math.floor(
              (new Date(sub.expiry_date).getTime() - Date.now()) / 86400000
            );
            return (
              <div key={sub.batch_id}
                className="flex items-start justify-between p-3 rounded-xl border border-slate-100 mb-2 hover:border-teal-200 hover:bg-teal-50/30 transition-all">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{sub.brand_name}</p>
                  <p className="text-xs text-slate-500">{sub.strength} · {sub.dosage_form}</p>
                  <p className="text-xs text-slate-400">
                    Batch: {sub.batch_number} · Exp: {new Date(sub.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    {daysToExpiry <= 60 && (
                      <span className={`ml-1 font-medium ${daysToExpiry <= 14 ? 'text-red-500' : 'text-amber-600'}`}>
                        ({daysToExpiry}d)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">{sub.qty_in_stock} in stock · ₹{fmt(sub.sale_rate)}</p>
                </div>
                <button
                  onClick={() => { onSelect(sub); onClose(); }}
                  className="ml-3 flex-shrink-0 px-3 py-1.5 bg-[#00475a] text-white text-xs font-medium rounded-lg hover:bg-[#003d4d] transition-colors"
                >
                  Use This
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 text-center">
            Substitutes have the same active molecule — consult doctor before switching
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Dispensing Page ───────────────────────────────────────────────────────
export default function DispensingPage() {
  const router = useRouter();
  const user = getUser();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [substituteFor, setSubstituteFor] = useState<CartItem | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search medicines ─────────────────────────────────────────────────────────
  const searchMedicines = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/medicines?search=${encodeURIComponent(q)}&limit=12`);
      const meds = res.data?.data || res.data || [];
      // Enrich with stock info
      const enriched = await Promise.all(meds.map(async (m: any) => {
        try {
          const stock = await api.get(`/medicines/stock-check?name=${encodeURIComponent(m.brand_name)}`);
          return { ...m, _qty: n(stock.data?.quantity ?? -1) };
        } catch {
          return { ...m, _qty: -1 };
        }
      }));
      setResults(enriched);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchMedicines(search), 400);
  }, [search, searchMedicines]);

  // ── Add to cart ──────────────────────────────────────────────────────────────
  const addToCart = async (medicine: any) => {
    try {
      // Get best FEFO batch
      const batchRes = await api.get(`/stock/${medicine.id}/batches`);
      const batches = (batchRes.data || [])
        .filter((b: any) => n(b.quantity) > 0)
        .sort((a: any, b: any) =>
          new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
        );

      if (batches.length === 0) {
        toast.error(`${medicine.brand_name} is out of stock`);
        return;
      }

      const batch = batches[0];
      const existing = cart.find(i => i.medicine_id === medicine.id && i.batch_id === batch.id);
      if (existing) {
        setCart(prev => prev.map(i =>
          i.medicine_id === medicine.id && i.batch_id === batch.id
            ? { ...i, qty: i.qty + 1 } : i
        ));
      } else {
        setCart(prev => [...prev, {
          medicine_id: medicine.id,
          batch_id: batch.id,
          medicine_name: medicine.brand_name,
          batch_number: batch.batch_number,
          expiry_date: batch.expiry_date,
          qty: 1,
          rate: n(batch.sale_rate),
          gst_percent: n(medicine.gst_percent),
          is_substituted: false,
          schedule_class: medicine.schedule_class || 'OTC',
          molecule: medicine.molecule,
        }]);
      }
      setSearch('');
      setResults([]);
    } catch {
      toast.error('Failed to get stock info');
    }
  };

  // ── Apply substitute ──────────────────────────────────────────────────────────
  const applySubstitute = (originalItem: CartItem, sub: Substitute) => {
    setCart(prev => prev.map(i =>
      i.medicine_id === originalItem.medicine_id && i.batch_id === originalItem.batch_id
        ? {
            ...i,
            medicine_id: sub.id,
            batch_id: sub.batch_id,
            medicine_name: sub.brand_name,
            batch_number: sub.batch_number,
            expiry_date: sub.expiry_date,
            rate: n(sub.sale_rate),
            is_substituted: true,
            molecule: sub.molecule,
          }
        : i
    ));
    toast.success(`Substituted with ${sub.brand_name}`);
  };

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map((item, i) => i === idx ? { ...item, qty: item.qty + delta } : item);
      return updated.filter(item => item.qty > 0);
    });
  };

  // ── Totals ────────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, i) => sum + n(i.rate) * i.qty, 0);
  const tax = cart.reduce((sum, i) => sum + (n(i.rate) * i.qty * n(i.gst_percent) / 100), 0);
  const total = subtotal + tax;

  // ── Submit sale ───────────────────────────────────────────────────────────────
  const handleDispense = async () => {
    if (cart.length === 0) { toast.error('Add at least one medicine'); return; }
    setSubmitting(true);
    try {
      await api.post('/sales', {
        items: cart.map(i => ({
          medicine_id: i.medicine_id,
          batch_id: i.batch_id,
          qty: i.qty,
          rate: i.rate,
          gst_percent: i.gst_percent,
          is_substituted: i.is_substituted,
        })),
      });
      toast.success('Sale recorded successfully');
      setCart([]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const stockBadge = (qty: number) => {
    if (qty < 0) return null;
    if (qty === 0) return <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-medium">Out of stock</span>;
    if (qty < 10) return <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">{qty} left</span>;
    return <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded font-medium">{qty} in stock</span>;
  };

  return (
    <div className="flex h-full">
      {/* Left: Search + Results */}
      <div className="flex-1 flex flex-col min-w-0 p-5">
        <h1 className="text-lg font-bold text-slate-900 mb-4">Dispensing</h1>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search medicine by name or molecule..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mb-4">
            {results.map(med => (
              <div key={med.id}
                className={`flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 ${med._qty === 0 ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{med.brand_name}</p>
                  <p className="text-xs text-slate-400">{med.molecule && `${med.molecule} · `}{med.strength} · {med.dosage_form}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {stockBadge(med._qty)}
                  <button
                    onClick={() => addToCart(med)}
                    disabled={med._qty === 0}
                    className="flex items-center gap-1 text-xs bg-[#00475a] text-white px-2.5 py-1.5 rounded-lg hover:bg-[#003d4d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!search && cart.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Search and add medicines to start dispensing</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Cart */}
      <div className="w-80 flex-shrink-0 border-l border-slate-100 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#00475a]" />
            Cart
          </h2>
          {cart.length > 0 && (
            <span className="text-xs bg-[#00475a] text-white rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cart.length}
            </span>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-xs text-slate-400 text-center mt-8">Cart is empty</p>
          ) : (
            cart.map((item, idx) => {
              const itemTotal = n(item.rate) * item.qty;
              const daysToExpiry = Math.floor(
                (new Date(item.expiry_date).getTime() - Date.now()) / 86400000
              );
              const nearExpiry = daysToExpiry <= 60;

              return (
                <div key={idx} className={`rounded-xl p-3 border ${nearExpiry && daysToExpiry <= 14 ? 'border-red-200 bg-red-50/30' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.medicine_name}</p>
                      {item.is_substituted && (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">Substituted</span>
                      )}
                      <p className="text-xs text-slate-400 mt-0.5">
                        Batch: {item.batch_number} · ₹{fmt(item.rate)}/unit
                      </p>
                      {nearExpiry && (
                        <p className={`text-xs font-medium flex items-center gap-1 mt-0.5 ${daysToExpiry <= 14 ? 'text-red-600' : 'text-amber-600'}`}>
                          <AlertTriangle className="w-3 h-3" />
                          Expires in {daysToExpiry} days
                        </p>
                      )}
                    </div>
                    <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold text-slate-800 w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Substitute button */}
                      {item.molecule && (
                        <button
                          onClick={() => setSubstituteFor(item)}
                          className="flex items-center gap-1 text-xs text-teal-700 border border-teal-200 bg-teal-50 px-2 py-1 rounded-lg hover:bg-teal-100 transition-colors"
                          title="Find molecule substitutes"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Sub
                        </button>
                      )}
                      <span className="text-sm font-semibold text-[#00475a]">₹{fmt(itemTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Totals + Generate Bill */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span>₹{fmt(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>GST</span>
                <span>₹{fmt(tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2">
              <span>Total</span>
              <span className="text-[#00475a]">₹{fmt(total)}</span>
            </div>

            <button
              onClick={handleDispense}
              disabled={submitting}
              className="w-full py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
                : <><CheckCircle2 className="w-4 h-4" />Generate Bill — ₹{fmt(total)}</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Substitutes modal */}
      {substituteFor && (
        <SubstitutesModal
          item={substituteFor}
          onSelect={sub => applySubstitute(substituteFor, sub)}
          onClose={() => setSubstituteFor(null)}
        />
      )}
    </div>
  );
}
