// ============================================================
// apps/web/src/app/(dashboard)/reports/inventory-classification/page.tsx
// Inventory Classification — ALL thresholds configurable on screen
// ============================================================

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────
interface ClassifiedItem {
  medicine_id: string;
  brand_name: string;
  molecule: string;
  strength: string;
  manufacturer: string;
  rack_location: string;
  schedule_class: string;
  category: 'fast' | 'slow' | 'dead';
  total_stock: number;
  total_batches: number;
  purchase_value: number;
  mrp_value: number;
  total_qty_sold: number;
  avg_daily_sales: number;
  days_of_stock: number;
  last_sale_date: string | null;
  days_since_last_sale: number;
  recommended_stock: number;
  excess_stock: number;
  reorder_point: number;
  next_order_qty: number;
  earliest_expiry: string | null;
  supplier_name: string | null;
  // Enriched
  is_urgent?: boolean;
  days_until_reorder?: number;
  capital_locked?: string;
  recoverable_value?: string;
  is_expired?: boolean;
  expiring_soon?: boolean;
  return_status?: string | null;
  purchase_cycle_days?: number;
  target_stock_days?: number;
}

interface Filters {
  analysisDays: number;
  deadThresholdDays: number;
  fastThreshold: number;
  fastStockDays: number;
  slowStockDays: number;
  fastCycleDays: number;
  slowCycleDays: number;
}

interface CategorySummary {
  category: string;
  item_count: number;
  total_stock: number;
  purchase_value: number;
  mrp_value: number;
  total_qty_sold: number;
  excess_value: number;
}

// ── Defaults ─────────────────────────────────────────────────
const DEFAULT_FILTERS: Filters = {
  analysisDays: 90,
  deadThresholdDays: 90,
  fastThreshold: 0.5,
  fastStockDays: 14,
  slowStockDays: 7,
  fastCycleDays: 10,
  slowCycleDays: 30,
};

// ── API ──────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || '';

async function apiFetch(path: string, token: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function buildQueryString(filters: Filters): string {
  return [
    `analysis_days=${filters.analysisDays}`,
    `dead_threshold_days=${filters.deadThresholdDays}`,
    `fast_threshold=${filters.fastThreshold}`,
    `fast_stock_days=${filters.fastStockDays}`,
    `slow_stock_days=${filters.slowStockDays}`,
    `fast_cycle_days=${filters.fastCycleDays}`,
    `slow_cycle_days=${filters.slowCycleDays}`,
  ].join('&');
}

// ── Format helpers ───────────────────────────────────────────
const fmt = (n: number | string) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v)) return '—';
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const fmtNum = (n: number | string) => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(v) || v >= 9999) return '—';
  return v.toLocaleString('en-IN', { maximumFractionDigits: 1 });
};
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function InventoryClassificationPage() {
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'fast' | 'slow' | 'dead'>('overview');
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [overviewData, setOverviewData] = useState<CategorySummary[]>([]);
  const [reportData, setReportData] = useState<{ summary: any; data: ClassifiedItem[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showReturnModal, setShowReturnModal] = useState<ClassifiedItem | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token') || '');
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = buildQueryString(filters);
      if (activeTab === 'overview') {
        const res = await apiFetch(`/inventory-classification/summary?${qs}`, token);
        setOverviewData(res.data || res);
      } else {
        const endpoint = activeTab === 'fast' ? 'fast-moving'
          : activeTab === 'slow' ? 'slow-moving' : 'dead-stock';
        const res = await apiFetch(`/inventory-classification/${endpoint}?${qs}`, token);
        setReportData(res);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, filters]);

  useEffect(() => { if (token) fetchData(); }, [fetchData]);

  const displayData = useMemo(() => {
    if (!reportData?.data) return [];
    if (!search) return reportData.data;
    const s = search.toLowerCase();
    return reportData.data.filter(
      (r) =>
        (r.brand_name || '').toLowerCase().includes(s) ||
        (r.molecule || '').toLowerCase().includes(s) ||
        (r.manufacturer || '').toLowerCase().includes(s),
    );
  }, [reportData, search]);

  const handleExport = async () => {
    if (!token) return;
    try {
      const cat = activeTab === 'overview' ? '' : activeTab;
      const qs = buildQueryString(filters);
      const data = await apiFetch(`/inventory-classification/export?category=${cat}&${qs}`, token);
      const blob = new Blob([data.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('Export failed:', err); }
  };

  const handleResetFilters = () => setFilters({ ...DEFAULT_FILTERS });

  // ── Filter bar component ───────────────────────────────────
  const renderFilterBar = () => (
    <div style={{
      background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
      marginBottom: '16px', overflow: 'hidden',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          width: '100%', padding: '12px 20px', border: 'none', background: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#00475a',
        }}
      >
        <span>⚙️ Classification Filters</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Show current values as chips when collapsed */}
          {!showFilters && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Chip label={`${filters.analysisDays}d analysis`} />
              <Chip label={`Fast ≥ ${filters.fastThreshold}/day`} />
              <Chip label={`Dead: ${filters.deadThresholdDays}d no sale`} />
              <Chip label={`Fast stock: ${filters.fastStockDays}d`} />
              <Chip label={`Slow stock: ${filters.slowStockDays}d`} />
            </div>
          )}
          <span style={{ fontSize: '12px', color: '#999' }}>{showFilters ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded filter controls */}
      {showFilters && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
          {/* Row 1: Analysis period + classification thresholds */}
          <div style={{ marginTop: '16px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Classification Thresholds
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <FilterInput
              label="Analysis Period"
              suffix="days"
              value={filters.analysisDays}
              onChange={(v) => setFilters({ ...filters, analysisDays: v })}
              min={7} max={365}
              help="Sales lookback period for classification"
            />
            <FilterInput
              label="Fast Moving Threshold"
              suffix="units/day"
              value={filters.fastThreshold}
              onChange={(v) => setFilters({ ...filters, fastThreshold: v })}
              min={0.1} max={100} step={0.1}
              help="Avg daily sales ≥ this = Fast Moving"
            />
            <FilterInput
              label="Dead Stock Threshold"
              suffix="days"
              value={filters.deadThresholdDays}
              onChange={(v) => setFilters({ ...filters, deadThresholdDays: v })}
              min={7} max={365}
              help="No sale in X days = Dead Stock"
            />
          </div>

          {/* Row 2: Stock levels */}
          <div style={{ marginTop: '20px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Target Stock Levels
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <FilterInput
              label="🚀 Fast Moving — Keep Stock"
              suffix="days"
              value={filters.fastStockDays}
              onChange={(v) => setFilters({ ...filters, fastStockDays: v })}
              min={1} max={90}
              help="Keep this many days of avg sales in stock"
              accent="#16a34a"
            />
            <FilterInput
              label="🐢 Slow Moving — Keep Stock"
              suffix="days"
              value={filters.slowStockDays}
              onChange={(v) => setFilters({ ...filters, slowStockDays: v })}
              min={1} max={60}
              help="Keep this many days of avg sales in stock"
              accent="#d97706"
            />
          </div>

          {/* Row 3: Purchase cycles */}
          <div style={{ marginTop: '20px', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Purchase Cycle
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <FilterInput
              label="🚀 Fast Moving — Buy Every"
              suffix="days"
              value={filters.fastCycleDays}
              onChange={(v) => setFilters({ ...filters, fastCycleDays: v })}
              min={1} max={60}
              help="Purchase frequency for fast movers"
              accent="#16a34a"
            />
            <FilterInput
              label="🐢 Slow Moving — Buy Every"
              suffix="days"
              value={filters.slowCycleDays}
              onChange={(v) => setFilters({ ...filters, slowCycleDays: v })}
              min={1} max={120}
              help="Purchase frequency for slow movers"
              accent="#d97706"
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button
              onClick={handleResetFilters}
              style={{
                padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px',
                background: 'white', fontSize: '13px', cursor: 'pointer', color: '#666',
              }}
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => { fetchData(); setShowFilters(false); }}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: '8px',
                background: '#00475a', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Overview Tab ───────────────────────────────────────────
  const renderOverview = () => {
    if (loading) return <Loader text="Loading classification data..." />;
    if (!overviewData.length) return <Loader text="No data available. Sales history is needed for classification." />;

    const total = overviewData.reduce((s, r) => ({
      items: s.items + Number(r.item_count),
      pv: s.pv + Number(r.purchase_value),
      mv: s.mv + Number(r.mrp_value),
      sold: s.sold + Number(r.total_qty_sold),
      excess: s.excess + Number(r.excess_value),
    }), { items: 0, pv: 0, mv: 0, sold: 0, excess: 0 });

    return (
      <>
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
            <Metric label="Total Items" value={total.items} />
            <Metric label="Stock Value (Cost)" value={fmt(total.pv)} />
            <Metric label="Stock Value (MRP)" value={fmt(total.mv)} />
            <Metric label={`Qty Sold (${filters.analysisDays}d)`} value={total.sold.toLocaleString('en-IN')} />
            <Metric label="Excess Value" value={fmt(total.excess)} color="#dc2626" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {overviewData.map((cat) => {
            const colors: Record<string, { bg: string; border: string }> = {
              fast: { bg: '#f0fdf4', border: '#86efac' },
              slow: { bg: '#fffbeb', border: '#fcd34d' },
              dead: { bg: '#fef2f2', border: '#fca5a5' },
            };
            const c = colors[cat.category] || colors.slow;
            const icon = cat.category === 'fast' ? '🚀' : cat.category === 'slow' ? '🐢' : '💀';
            const label = cat.category === 'fast' ? 'Fast Moving' : cat.category === 'slow' ? 'Slow Moving' : 'Dead Stock';
            const rule = cat.category === 'fast'
              ? `Buy every ${filters.fastCycleDays}d • Keep ${filters.fastStockDays}d stock`
              : cat.category === 'slow'
              ? `Buy every ${filters.slowCycleDays}d • Keep ${filters.slowStockDays}d stock`
              : `No sale in ${filters.deadThresholdDays}d+ • Return to supplier`;

            return (
              <div
                key={cat.category}
                style={{
                  background: c.bg, borderRadius: '12px', border: `1px solid ${c.border}`,
                  padding: '20px', cursor: 'pointer', transition: 'transform 0.15s',
                }}
                onClick={() => setActiveTab(cat.category as any)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{icon} {label}</span>
                  <Badge cat={cat.category}>{Number(cat.item_count)} items</Badge>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Metric label="Stock Value" value={fmt(cat.purchase_value)} size="sm" />
                  <Metric label="Qty Sold" value={Number(cat.total_qty_sold).toLocaleString('en-IN')} size="sm" />
                  <Metric label="Total Stock" value={Number(cat.total_stock).toLocaleString('en-IN')} size="sm" />
                  <Metric label="Excess Value" value={fmt(cat.excess_value)} size="sm"
                    color={Number(cat.excess_value) > 0 ? '#dc2626' : '#16a34a'} />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
                  background: 'rgba(255,255,255,0.6)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)',
                  fontSize: '13px', color: '#475569', marginTop: '12px',
                }}>
                  📋 {rule}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  // ── Category Report Tabs ───────────────────────────────────
  const renderCategoryReport = () => {
    if (loading) return <Loader text={`Analyzing ${activeTab} movers...`} />;
    if (!reportData) return <Loader text="No data" />;

    const icon = activeTab === 'fast' ? '🚀' : activeTab === 'slow' ? '🐢' : '💀';
    const title = activeTab === 'fast' ? 'Fast Moving Items'
      : activeTab === 'slow' ? 'Slow Moving / High Value Items'
      : 'Dead Stock — Return to Supplier';

    const rule = activeTab === 'fast'
      ? `Purchase every ${filters.fastCycleDays} days • Keep stock worth ${filters.fastStockDays} days average sales`
      : activeTab === 'slow'
      ? `Purchase every ${filters.slowCycleDays} days • Keep stock worth ${filters.slowStockDays} days average sales`
      : `No sale in ${filters.deadThresholdDays}+ days • Return to supplier for credit note`;

    return (
      <>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '16px' }}>{icon} {title}</strong>
            <Badge cat={activeTab}>{reportData.summary.total_items} items</Badge>
          </div>
          <RuleBox>{`📦 ${rule}`}</RuleBox>

          {/* Category-specific alerts */}
          {activeTab === 'fast' && reportData.summary.urgent_items > 0 && (
            <RuleBox bg="#fef2f2" border="#fca5a5" color="#dc2626">
              ⚠️ <strong>{reportData.summary.urgent_items}</strong> items below reorder point — order urgently!
            </RuleBox>
          )}
          {activeTab === 'slow' && Number(reportData.summary.total_capital_locked) > 0 && (
            <RuleBox bg="#fffbeb" border="#fcd34d" color="#92400e">
              💰 Capital locked in excess slow-moving stock: <strong>{fmt(reportData.summary.total_capital_locked)}</strong>
            </RuleBox>
          )}
          {activeTab === 'dead' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <MetricBox label="Recoverable Value" value={fmt(reportData.summary.total_dead_value)} color="#dc2626" />
              <MetricBox label="Already Expired" value={reportData.summary.expired_items} color="#dc2626" />
              <MetricBox label="Expiring in 90d" value={reportData.summary.expiring_soon_items} color="#d97706" />
            </div>
          )}
        </div>

        {/* Data table */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text" placeholder="Search medicine name, molecule..."
              style={searchStyle} value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: '#999' }}>{displayData.length} items</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <TH>#</TH><TH>Medicine</TH><TH>Stock</TH><TH>Avg/Day</TH><TH>Days of Stock</TH><TH>Value</TH>
                  {activeTab === 'fast' && <><TH>Order Qty</TH><TH>Status</TH></>}
                  {activeTab === 'slow' && <><TH>Capital Locked</TH><TH>Recommended</TH></>}
                  {activeTab === 'dead' && <><TH>Last Sale</TH><TH>Expiry</TH><TH>Action</TH></>}
                  <TH>Supplier</TH>
                </tr>
              </thead>
              <tbody>
                {displayData.map((item, i) => (
                  <tr key={item.medicine_id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <TD style={{ color: '#999', fontSize: '12px' }}>{i + 1}</TD>
                    <TD>
                      <div style={{ fontWeight: 600 }}>{item.brand_name}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>
                        {item.molecule}{item.strength ? ` • ${item.strength}` : ''}
                      </div>
                      {item.rack_location && <div style={{ fontSize: '10px', color: '#aaa' }}>📍 {item.rack_location}</div>}
                    </TD>
                    <TD style={{ fontWeight: 600 }}>{item.total_stock}</TD>
                    <TD>{fmtNum(item.avg_daily_sales)}</TD>
                    <TD style={{
                      fontWeight: 600,
                      color: Number(item.days_of_stock) <= 3 ? '#dc2626'
                        : Number(item.days_of_stock) <= 7 ? '#d97706' : '#16a34a',
                    }}>
                      {fmtNum(item.days_of_stock)}{Number(item.days_of_stock) < 9999 ? 'd' : ''}
                    </TD>
                    <TD>{fmt(item.purchase_value)}</TD>

                    {activeTab === 'fast' && (
                      <>
                        <TD style={{ fontWeight: 600, color: '#00475a' }}>{item.next_order_qty || 0}</TD>
                        <TD>
                          {item.is_urgent ? (
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, color: 'white', background: '#dc2626' }}>
                              ⚠️ URGENT
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#16a34a' }}>{item.days_until_reorder}d to reorder</span>
                          )}
                        </TD>
                      </>
                    )}

                    {activeTab === 'slow' && (
                      <>
                        <TD style={{ color: Number(item.capital_locked) > 0 ? '#dc2626' : '#666' }}>{fmt(item.capital_locked || 0)}</TD>
                        <TD>
                          <span style={{ fontWeight: 600 }}>{item.recommended_stock}</span>
                          {item.excess_stock > 0 && (
                            <span style={{ fontSize: '11px', color: '#dc2626', marginLeft: '4px' }}>(+{item.excess_stock} excess)</span>
                          )}
                        </TD>
                      </>
                    )}

                    {activeTab === 'dead' && (
                      <>
                        <TD>
                          {item.last_sale_date ? (
                            <><div>{fmtDate(item.last_sale_date)}</div><div style={{ fontSize: '11px', color: '#dc2626' }}>{item.days_since_last_sale}d ago</div></>
                          ) : <span style={{ color: '#dc2626', fontSize: '12px' }}>Never sold</span>}
                        </TD>
                        <TD>
                          {item.earliest_expiry ? (
                            <span style={{
                              color: item.is_expired ? '#dc2626' : item.expiring_soon ? '#d97706' : '#666',
                              fontWeight: (item.is_expired || item.expiring_soon) ? 700 : 400,
                            }}>
                              {item.is_expired ? '❌ ' : item.expiring_soon ? '⚠️ ' : ''}{fmtDate(item.earliest_expiry)}
                            </span>
                          ) : '—'}
                        </TD>
                        <TD>
                          {item.return_status ? (
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                              background: item.return_status === 'credit_received' ? '#dcfce7' : item.return_status === 'returned' ? '#fef9c3' : '#f3f4f6',
                              color: item.return_status === 'credit_received' ? '#16a34a' : item.return_status === 'returned' ? '#a16207' : '#666',
                            }}>
                              {item.return_status === 'credit_received' ? '✅ Credit' : item.return_status === 'returned' ? '📦 Returned' : '⏳ Pending'}
                            </span>
                          ) : (
                            <button onClick={() => setShowReturnModal(item)}
                              style={{ padding: '4px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                              Return ↩
                            </button>
                          )}
                        </TD>
                      </>
                    )}

                    <TD style={{ fontSize: '12px', color: '#666' }}>{item.supplier_name || '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayData.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No items in this category</div>}
          </div>
        </div>
      </>
    );
  };

  // ── Return modal ───────────────────────────────────────────
  const renderReturnModal = () => {
    if (!showReturnModal) return null;
    const item = showReturnModal;
    const handleSubmit = async () => {
      try {
        await fetch(`${API}/inventory-classification/dead-stock-return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            medicine_id: item.medicine_id, quantity: item.total_stock,
            purchase_price: item.total_stock > 0 ? (Number(item.purchase_value) / item.total_stock).toFixed(2) : 0,
            notes: `Dead stock return — no sales in ${item.days_since_last_sale} days`,
          }),
        });
        setShowReturnModal(null);
        fetchData();
      } catch (err) { console.error('Return request failed:', err); }
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '14px', padding: '28px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#00475a' }}>Create Return Request</h3>
          <div style={{ fontWeight: 600 }}>{item.brand_name}</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{item.molecule} {item.strength}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <Metric label="Qty to Return" value={item.total_stock} size="sm" />
            <Metric label="Value" value={fmt(item.purchase_value)} size="sm" />
          </div>
          <RuleBox>🔄 Creates a pending return request. Update status after sending to supplier and receiving credit note.</RuleBox>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button onClick={() => setShowReturnModal(null)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSubmit}
              style={{ padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Create Return Request
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Main layout ────────────────────────────────────────────
  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#00475a', margin: 0 }}>📊 Inventory Classification</h1>
          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
            ABC analysis • Fast / Slow / Dead stock • All thresholds adjustable
          </div>
        </div>
        <button onClick={handleExport}
          style={{ padding: '8px 16px', background: '#00475a', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          📥 Export CSV
        </button>
      </div>

      {/* Filter bar */}
      {renderFilterBar()}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', background: '#f1f3f5', borderRadius: '10px', padding: '3px', overflowX: 'auto' }}>
        {([
          { key: 'overview', label: '📋 Overview' },
          { key: 'fast', label: '🚀 Fast Moving' },
          { key: 'slow', label: '🐢 Slow Moving' },
          { key: 'dead', label: '💀 Dead Stock' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => { setActiveTab(key); setSearch(''); }}
            style={{
              padding: '10px 18px', border: 'none', borderRadius: '8px', fontSize: '13px',
              fontWeight: activeTab === key ? 700 : 500, cursor: 'pointer',
              background: activeTab === key ? 'white' : 'transparent',
              color: activeTab === key ? '#00475a' : '#666',
              boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              whiteSpace: 'nowrap', transition: 'all 0.2s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' ? renderOverview() : renderCategoryReport()}
      {renderReturnModal()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════════

const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
  padding: '20px', marginBottom: '16px',
};
const searchStyle: React.CSSProperties = {
  padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '13px', width: '220px', outline: 'none',
};

function FilterInput({ label, suffix, value, onChange, min, max, step, help, accent }: {
  label: string; suffix: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; help?: string; accent?: string;
}) {
  return (
    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: `1px solid ${accent ? accent + '30' : '#e2e8f0'}` }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: accent || '#334155', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="number" value={value} min={min} max={max} step={step || 1}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
            fontSize: '14px', fontWeight: 700, width: '80px', outline: 'none',
            color: accent || '#00475a',
          }}
        />
        <span style={{ fontSize: '12px', color: '#888' }}>{suffix}</span>
      </div>
      {help && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{help}</div>}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px',
      fontSize: '11px', background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function Badge({ cat, children }: { cat: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { fast: '#16a34a', slow: '#d97706', dead: '#dc2626' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
      fontSize: '11px', fontWeight: 700, color: 'white', background: colors[cat] || '#888',
      textTransform: 'uppercase', letterSpacing: '0.5px',
    }}>
      {children}
    </span>
  );
}

function Metric({ label, value, size, color }: { label: string; value: any; size?: 'sm'; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: size === 'sm' ? '16px' : '22px', fontWeight: 700, color: color || '#1a1a1a' }}>{value}</div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
      padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0',
    }}>
      <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
      <strong style={{ fontSize: '18px', color: color || '#1a1a1a' }}>{value}</strong>
    </div>
  );
}

function RuleBox({ children, bg, border, color }: { children: React.ReactNode; bg?: string; border?: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px',
      background: bg || '#f8fafc', borderRadius: '8px', border: `1px solid ${border || '#e2e8f0'}`,
      fontSize: '13px', color: color || '#475569', marginTop: '8px',
    }}>
      {children}
    </div>
  );
}

function Loader({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999', fontSize: '14px' }}>{text}</div>;
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb',
      color: '#666', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase',
      letterSpacing: '0.3px', whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );
}

function TD({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  );
}
