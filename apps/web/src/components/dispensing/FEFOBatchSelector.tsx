'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { AlertTriangle, ChevronDown, Package, Check } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface Batch {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  sale_rate: number;
  purchase_rate: number;
}

interface Props {
  medicineId: string;
  medicineName: string;
  selectedBatchId?: string;
  onSelect: (batch: Batch) => void;
}

function expiryStatus(expiryDate: string) {
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0)  return { label: 'Expired',   color: 'text-red-600 bg-red-50',    badge: 'bg-red-100 text-red-700',    warn: true };
  if (days <= 14) return { label: `${days}d`,  color: 'text-red-500 bg-red-50',    badge: 'bg-red-100 text-red-600',    warn: true };
  if (days <= 60) return { label: `${days}d`,  color: 'text-amber-600 bg-amber-50',badge: 'bg-amber-100 text-amber-700',warn: false };
  return          { label: `${days}d`,          color: 'text-green-600 bg-green-50',badge: 'bg-green-100 text-green-700',warn: false };
}

export default function FEFOBatchSelector({ medicineId, medicineName, selectedBatchId, onSelect }: Props) {
  const [batches, setBatches]   = useState<Batch[]>([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get(`/stock/${medicineId}/batches`)
      .then(r => {
        // Sort FEFO: soonest expiry first, exclude expired
        const sorted = (r.data || [])
          .filter((b: Batch) => b.quantity > 0)
          .sort((a: Batch, b: Batch) =>
            new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
          );
        setBatches(sorted);
      })
      .catch(() => setBatches([]))
      .finally(() => setLoading(false));
  }, [open, medicineId]);

  const selected = batches.find(b => b.id === selectedBatchId);
  const fefo     = batches[0]; // first expiry = FEFO recommendation

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:border-slate-300 transition-colors"
      >
        <span className="text-slate-600 truncate">
          {selected
            ? `${selected.batch_number} · ${format(new Date(selected.expiry_date), 'MMM yy')}`
            : <span className="text-slate-400">Select batch (FEFO)</span>}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-100 shadow-lg z-20 overflow-hidden min-w-[280px]">
            <div className="px-3 pt-2 pb-1 border-b border-slate-50">
              <p className="text-xs font-semibold text-slate-500">Select Batch — FEFO order</p>
              <p className="text-xs text-slate-400">Soonest expiry shown first</p>
            </div>

            {loading && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">Loading batches...</div>
            )}

            {!loading && batches.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-red-500">No stock available</div>
            )}

            <div className="max-h-52 overflow-y-auto">
              {batches.map((batch, idx) => {
                const status     = expiryStatus(batch.expiry_date);
                const isFEFO     = batch.id === fefo?.id;
                const isSelected = batch.id === selectedBatchId;
                const isExpired  = differenceInDays(new Date(batch.expiry_date), new Date()) < 0;

                return (
                  <button
                    key={batch.id}
                    type="button"
                    disabled={isExpired}
                    onClick={() => { onSelect(batch); setOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                      ${isExpired ? 'opacity-40 cursor-not-allowed bg-red-50/50' : 'hover:bg-slate-50'}
                      ${isSelected ? 'bg-teal-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">{batch.batch_number}</span>
                        {isFEFO && !isExpired && (
                          <span className="text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">FEFO</span>
                        )}
                        {isExpired && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />Expired
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Exp: {format(new Date(batch.expiry_date), 'dd MMM yyyy')} · Qty: {batch.quantity} · ₹{Number(batch.sale_rate).toFixed(2)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${status.badge}`}>
                      {status.label}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
