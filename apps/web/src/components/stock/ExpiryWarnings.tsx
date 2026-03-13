'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { AlertTriangle, Package, ChevronRight, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ExpiryWarnings() {
  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/stock/expiring`, { headers: headers() }),
      axios.get(`${API}/settings/expiry-threshold`, { headers: headers() }).catch(() => ({ data: { days: 60 } })),
    ]).then(([stockRes, settingsRes]) => {
      setItems(stockRes.data || []);
      setThreshold(settingsRes.data?.days ?? 60);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const visible = items.filter(i => !dismissed.has(i.id));
  const critical = visible.filter(i => differenceInDays(new Date(i.expiry_date), new Date()) <= 14);
  const warning  = visible.filter(i => {
    const days = differenceInDays(new Date(i.expiry_date), new Date());
    return days > 14 && days <= (threshold ?? 60);
  });

  if (loading || visible.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          {visible.length} batch{visible.length > 1 ? 'es' : ''} expiring within {threshold} days
        </span>
        {critical.length > 0 && (
          <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
            {critical.length} critical (&lt;14 days)
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
        {[...critical, ...warning].map(item => {
          const daysLeft = differenceInDays(new Date(item.expiry_date), new Date());
          const isCritical = daysLeft <= 14;
          return (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <Package className={`w-4 h-4 flex-shrink-0 ${isCritical ? 'text-red-400' : 'text-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{item.medicine_name}</p>
                <p className="text-xs text-slate-400">
                  Batch {item.batch_number} · Qty {item.quantity} · Expires {format(new Date(item.expiry_date), 'dd MMM yyyy')}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
                ${isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {daysLeft}d
              </span>
              <button onClick={() => setDismissed(s => new Set([...s, item.id]))}
                className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
