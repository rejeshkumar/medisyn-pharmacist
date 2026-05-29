'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('medisyn_token') : null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const DEFAULT_CONFIG = { fast_sales_count: 10, fast_days: 100, dead_days: 60 };

function loadConfig() {
  try {
    const stored = localStorage.getItem('inv_intelligence_config');
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_CONFIG;
}

function configToParams(cfg: typeof DEFAULT_CONFIG) {
  const fastThreshold = cfg.fast_sales_count / Math.max(cfg.fast_days, 1);
  return new URLSearchParams({
    analysis_days: String(cfg.fast_days),
    dead_threshold_days: String(cfg.dead_days),
    fast_threshold: fastThreshold.toFixed(4),
  }).toString();
}

export default function InventoryIntelligencePage() {
  const [config] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    return loadConfig();
  });
  const [summary, setSummary] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'stockout' | 'fast' | 'slow' | 'dead'>('stockout');
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const params = configToParams(config);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiFetch(`/inventory-classification/summary?${params}`);
      const rows: any[] = data.data || [];
      const bycat: Record<string, any> = {};
      for (const r of rows) bycat[r.category] = r;
      setSummary({
        fast_moving: { count: Number(bycat.fast?.item_count || 0), total_stock: Number(bycat.fast?.total_stock || 0) },
        slow_moving: { count: Number(bycat.slow?.item_count || 0), total_value: Number(bycat.slow?.purchase_value || 0) },
        dead_stock: { count: Number(bycat.dead?.item_count || 0), cost_locked: Number(bycat.dead?.purchase_value || 0) },
      });
    } catch (e) {
      console.error('Summary fetch failed', e);
      toast.error('Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [params]);

  const fetchTab = useCallback(async (tab: string, q = '') => {
    setTabLoading(true);
    try {
      const searchParam = q ? `&search=${encodeURIComponent(q)}` : '';
      let data: any;
      if (tab === 'stockout') {
        data = await apiFetch(`/inventory-classification/fast-moving?${params}${searchParam}`);
        const items = (data.data || [])
          .filter((r: any) => r.is_urgent)
          .map((r: any) => ({
            id: r.medicine_id, name: r.brand_name, generic_name: r.molecule,
            current_stock: r.total_stock, avg_sales_per_day: Number(r.avg_daily_sales),
            days_of_stock_remaining: Number(r.days_of_stock),
            risk_level: Number(r.days_of_stock) <= 3 ? 'CRITICAL' : Number(r.days_of_stock) <= 7 ? 'HIGH' : 'MEDIUM',
          }));
        setMedicines(items);
      } else if (tab === 'fast') {
        data = await apiFetch(`/inventory-classification/fast-moving?${params}${searchParam}`);
        setMedicines((data.data || []).map((r: any) => ({
          id: r.medicine_id, name: r.brand_name, generic_name: r.molecule,
          current_stock: r.total_stock, avg_sales_per_day: Number(r.avg_daily_sales),
          days_of_stock_remaining: Number(r.days_of_stock), purchase_value: Number(r.purchase_value),
        })));
      } else if (tab === 'slow') {
        data = await apiFetch(`/inventory-classification/slow-moving?${params}${searchParam}`);
        setMedicines((data.data || []).map((r: any) => ({
          id: r.medicine_id, name: r.brand_name, generic_name: r.molecule,
          current_stock: r.total_stock, avg_sales_per_day: Number(r.avg_daily_sales),
          stock_value: Number(r.purchase_value), capital_locked: Number(r.capital_locked),
          days_since_last_sale: r.days_since_last_sale,
        })));
      } else if (tab === 'dead') {
        data = await apiFetch(`/inventory-classification/dead-stock?${params}${searchParam}`);
        setMedicines((data.data || []).map((r: any) => ({
          id: r.medicine_id, name: r.brand_name, generic_name: r.molecule,
          current_stock: r.total_stock, days_since_last_sale: r.days_since_last_sale,
          cost_value_locked: Number(r.purchase_value), expiring_soon: r.expiring_soon,
          is_expired: r.is_expired, return_status: r.return_status,
        })));
      }
    } catch (e) {
      console.error('Tab fetch failed', e);
      toast.error('Failed to load medicines');
      setMedicines([]);
    } finally {
      setTabLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchTab(activeTab, search); }, [activeTab, fetchTab]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await fetchSummary();
      await fetchTab(activeTab, search);
      toast.success('Data refreshed successfully');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchTab(activeTab, e.target.value);
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00475a]"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered stock movement analysis and predictions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/intelligence/config"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            ⚙️ Configure
          </Link>
          <button onClick={handleRefreshAll} disabled={refreshing}
            className="px-4 py-2 bg-[#00b8a0] text-white rounded-lg text-sm hover:bg-[#009d89] disabled:opacity-50">
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-700 font-medium">Fast Moving</p>
              <p className="text-2xl font-bold text-green-900">{summary?.fast_moving.count || 0}</p>
              <p className="text-xs text-green-600 mt-0.5">{summary?.fast_moving.total_stock || 0} units</p>
            </div>
            <div className="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center text-xl">🚀</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-700 font-medium">Slow Moving</p>
              <p className="text-2xl font-bold text-yellow-900">{summary?.slow_moving.count || 0}</p>
              <p className="text-xs text-yellow-600 mt-0.5">{fmt(summary?.slow_moving.total_value || 0)}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center text-xl">🐌</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-700 font-medium">Dead Stock</p>
              <p className="text-2xl font-bold text-red-900">{summary?.dead_stock.count || 0}</p>
              <p className="text-xs text-red-600 mt-0.5">{fmt(summary?.dead_stock.cost_locked || 0)} locked</p>
            </div>
            <div className="w-10 h-10 bg-red-200 rounded-full flex items-center justify-center text-xl">💀</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-700 font-medium">Stockout Risk</p>
              <p className="text-2xl font-bold text-orange-900">
                {activeTab === 'stockout' ? medicines.length : '—'}
              </p>
              <p className="text-xs text-orange-600 mt-0.5">
                {activeTab === 'stockout'
                  ? `${medicines.filter((m: any) => m.risk_level === 'CRITICAL').length} critical`
                  : 'Click tab to load'}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center text-xl">⚠️</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex min-w-max px-4">
            {[
              { key: 'stockout', label: '⚠️ Stockout Risk', count: activeTab === 'stockout' ? medicines.length : null },
              { key: 'fast', label: '🚀 Fast Moving', count: summary?.fast_moving.count || 0 },
              { key: 'slow', label: '🐌 Slow Moving', count: summary?.slow_moving.count || 0 },
              { key: 'dead', label: '💀 Dead Stock', count: summary?.dead_stock.count || 0 },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 px-3 border-b-2 font-medium text-sm whitespace-nowrap mr-2 ${
                  activeTab === tab.key
                    ? 'border-[#00475a] text-[#00475a]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label} ({tab.count ?? '…'})
              </button>
            ))}
          </nav>
        </div>
        <div className="px-4 py-3 border-b border-gray-100">
          <input type="text" placeholder="Search medicine name or molecule..."
            value={search} onChange={handleSearch}
            className="w-full sm:w-72 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
        </div>
        <div className="p-4">
          {tabLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00475a]"></div>
            </div>
          ) : medicines.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📦</div>
              <p>No medicines in this category</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-medium">Medicine</th>
                    <th className="text-right py-2 px-3 font-medium">Stock</th>
                    {activeTab === 'stockout' && <>
                      <th className="text-right py-2 px-3 font-medium">Sales/Day</th>
                      <th className="text-right py-2 px-3 font-medium">Days Left</th>
                      <th className="text-center py-2 px-3 font-medium">Risk</th>
                    </>}
                    {activeTab === 'fast' && <>
                      <th className="text-right py-2 px-3 font-medium">Sales/Day</th>
                      <th className="text-right py-2 px-3 font-medium">Days Left</th>
                      <th className="text-right py-2 px-3 font-medium">Value</th>
                    </>}
                    {activeTab === 'slow' && <>
                      <th className="text-right py-2 px-3 font-medium">Sales/Day</th>
                      <th className="text-right py-2 px-3 font-medium">Days Since Sale</th>
                      <th className="text-right py-2 px-3 font-medium">Capital Locked</th>
                    </>}
                    {activeTab === 'dead' && <>
                      <th className="text-right py-2 px-3 font-medium">Days Since Sale</th>
                      <th className="text-right py-2 px-3 font-medium">Value Locked</th>
                      <th className="text-center py-2 px-3 font-medium">Status</th>
                    </>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-900 leading-tight">{med.name}</div>
                        {med.generic_name && <div className="text-xs text-gray-400 mt-0.5">{med.generic_name}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium">{med.current_stock}</td>
                      {activeTab === 'stockout' && <>
                        <td className="py-2.5 px-3 text-right">{med.avg_sales_per_day?.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={med.days_of_stock_remaining <= 3 ? 'text-red-600 font-bold' : ''}>
                            {med.days_of_stock_remaining >= 9999 ? '∞' : Math.round(med.days_of_stock_remaining)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            med.risk_level === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                            med.risk_level === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'}`}>{med.risk_level}</span>
                        </td>
                      </>}
                      {activeTab === 'fast' && <>
                        <td className="py-2.5 px-3 text-right">{med.avg_sales_per_day?.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right">{med.days_of_stock_remaining >= 9999 ? '∞' : Math.round(med.days_of_stock_remaining || 0)}</td>
                        <td className="py-2.5 px-3 text-right">{fmt(med.purchase_value || 0)}</td>
                      </>}
                      {activeTab === 'slow' && <>
                        <td className="py-2.5 px-3 text-right">{med.avg_sales_per_day?.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right">{med.days_since_last_sale >= 9999 ? 'Never' : med.days_since_last_sale}</td>
                        <td className="py-2.5 px-3 text-right">{fmt(med.capital_locked || 0)}</td>
                      </>}
                      {activeTab === 'dead' && <>
                        <td className="py-2.5 px-3 text-right">{med.days_since_last_sale >= 9999 ? 'Never sold' : `${med.days_since_last_sale}d ago`}</td>
                        <td className="py-2.5 px-3 text-right text-red-600 font-medium">{fmt(med.cost_value_locked || 0)}</td>
                        <td className="py-2.5 px-3 text-center">
                          {med.is_expired ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expired</span>
                          ) : med.expiring_soon ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Expiring Soon</span>
                          ) : med.return_status ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 capitalize">{med.return_status}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
