'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Download, RefreshCw, Settings, ChevronDown,
  BarChart3, Package, Users, Shield, Briefcase,
  FileText, Loader2, X, Eye, EyeOff, Filter,
  TrendingUp, AlertTriangle, Calendar,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
interface ReportConfig {
  report_id: string; name: string; description: string;
  category: string; sort_order: number;
  default_cols: string[]; all_cols: string[]; visible_cols?: string[];
  params: string[]; default_range: string; allowed_roles: string[];
  is_visible: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  sales:      { label: 'Sales',      icon: TrendingUp,     color: 'text-green-600'  },
  clinical:   { label: 'Clinical',   icon: Users,          color: 'text-blue-600'   },
  stock:      { label: 'Stock',      icon: Package,        color: 'text-amber-600'  },
  compliance: { label: 'Compliance', icon: Shield,         color: 'text-red-600'    },
  hr:         { label: 'HR',         icon: Briefcase,      color: 'text-purple-600' },
};

const RANGE_OPTIONS = [
  { value: '7d',  label: 'Last 7 days'   },
  { value: '30d', label: 'Last 30 days'  },
  { value: '90d', label: 'Last 90 days'  },
  { value: 'mtd', label: 'Month to date' },
  { value: 'ytd', label: 'Year to date'  },
  { value: 'custom', label: 'Custom'     },
];

const ENDPOINT_MAP: Record<string, string> = {
  sales_summary:      'sales-summary',
  medicine_sales:     'medicine-sales',
  doctor_revenue:     'doctor-revenue',
  patient_visits:     'patient-visits',
  stock_valuation:    'stock-valuation',
  expiry_report:      'expiry-report',
  purchase_history:   'purchase-history',
  gst_report:         'gst-report',
  attendance_payroll: 'attendance-payroll',
  schedule_log:       'schedule-log',
};

const COL_LABELS: Record<string, string> = {
  date: 'Date', bill_count: 'Bills', gross_amount: 'Gross',
  discount: 'Discount', net_amount: 'Net amount', cash: 'Cash',
  card: 'Card', upi: 'UPI', avg_bill: 'Avg bill', patient_count: 'Patients',
  brand_name: 'Medicine', molecule: 'Molecule', strength: 'Strength',
  schedule_class: 'Schedule', qty_sold: 'Qty sold', revenue: 'Revenue',
  bill_count2: 'Bills', avg_rate: 'Avg rate', last_sold: 'Last sold',
  doctor_name: 'Doctor', patient_name: 'Patient', mobile: 'Mobile',
  gender: 'Gender', age: 'Age', visit_count: 'Visits', last_visit: 'Last visit',
  total_spent: 'Total spent', total_qty: 'Total qty', purchase_value: 'Purchase value',
  mrp_value: 'MRP value', sale_value: 'Sale value', batches: 'Batches',
  rack_location: 'Rack', batch_number: 'Batch', expiry_date: 'Expiry',
  days_left: 'Days left', quantity: 'Qty', supplier: 'Supplier',
  po_number: 'PO number', order_date: 'Date', status: 'Status',
  item_count: 'Items', total_amount: 'Amount', sent_via: 'Sent via',
  hsn_code: 'HSN', gst_percent: 'GST%', taxable_amount: 'Taxable',
  cgst: 'CGST', sgst: 'SGST', igst: 'IGST', total_tax: 'Total tax',
  staff_name: 'Staff', role: 'Role', present: 'Present', absent: 'Absent',
  half_day: 'Half day', leave: 'Leave', lop: 'LOP', total_hours: 'Hours',
  late_count: 'Late', bill_number: 'Bill #', doctor_reg_no: 'Dr. Reg #',
  qty: 'Qty', pharmacist: 'Pharmacist', manufacturer: 'Manufacturer',
  supplier_name: 'Supplier', total_units: 'Units',
};

function formatCell(key: string, val: any): string {
  if (val === null || val === undefined) return '—';
  if (key.includes('amount') || key.includes('value') || key === 'revenue'
      || key === 'total_spent' || key === 'avg_bill' || key === 'cash'
      || key === 'card' || key === 'upi' || key.includes('cgst')
      || key.includes('sgst') || key.includes('tax')) {
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (key === 'gst_percent') return `${val}%`;
  if (key === 'days_left') {
    const d = Number(val);
    return d < 0 ? 'EXPIRED' : `${d} days`;
  }
  if (key === 'expiry_date' || key === 'date' || key === 'last_visit' || key === 'last_sold' || key === 'order_date') {
    return val ? new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
  }
  return String(val);
}

function cellClass(key: string, val: any): string {
  if (key === 'days_left') {
    const d = Number(val);
    if (d < 0)  return 'text-red-600 font-bold';
    if (d < 30) return 'text-red-500 font-semibold';
    if (d < 90) return 'text-amber-600';
  }
  if (key === 'status') {
    if (val === 'received')   return 'text-green-600';
    if (val === 'cancelled')  return 'text-red-500';
    if (val === 'sent')       return 'text-blue-600';
  }
  if ((key.includes('amount') || key === 'revenue' || key === 'total_spent') && Number(val) > 0)
    return 'font-semibold text-slate-800';
  return 'text-slate-600';
}

// ── Column picker ──────────────────────────────────────────────────────────
function ColPicker({ allCols, activeCols, onChange, onClose }: {
  allCols: string[]; activeCols: string[];
  onChange: (cols: string[]) => void; onClose: () => void;
}) {
  const [cols, setCols] = useState<string[]>(activeCols);
  return (
    <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-xl w-64 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">Visible columns</span>
        <button onClick={onClose}><X className="w-3.5 h-3.5 text-slate-400" /></button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
        {allCols.map(col => (
          <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5">
            <input type="checkbox" checked={cols.includes(col)}
              onChange={e => setCols(prev =>
                e.target.checked ? [...prev, col] : prev.filter(c => c !== col)
              )}
              className="w-3.5 h-3.5 accent-[#00475a]" />
            <span className="text-xs text-slate-700">{COL_LABELS[col] ?? col}</span>
          </label>
        ))}
      </div>
      <button onClick={() => { onChange(cols); onClose(); }}
        className="w-full py-1.5 bg-[#00475a] text-white text-xs font-semibold rounded-lg">
        Apply
      </button>
    </div>
  );
}

// ── Summary cards ──────────────────────────────────────────────────────────
function SummaryCards({ data, reportId }: { data: any; reportId: string }) {
  if (!data) return null;

  if (reportId === 'sales_summary' && data.totals) {
    const t = data.totals;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ['Total revenue', `₹${Number(t.total_revenue||0).toLocaleString('en-IN')}`, 'text-green-600'],
          ['Total bills',   String(t.total_bills||0),                                  'text-[#00475a]'],
          ['Total discount',`₹${Number(t.total_discount||0).toLocaleString('en-IN')}`, 'text-amber-600'],
          ['Avg bill',      `₹${Number(t.avg_bill||0).toFixed(2)}`,                   'text-slate-700'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-white border border-slate-100 rounded-xl p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-xl font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>
    );
  }

  if (reportId === 'stock_valuation' && data.totals) {
    const t = data.totals;
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          ['Medicines',      String(t.medicine_count||0),                                    'text-[#00475a]'],
          ['Total units',    String(t.total_units||0),                                       'text-slate-700'],
          ['Purchase value', `₹${Number(t.total_purchase_value||0).toLocaleString('en-IN')}`, 'text-amber-600'],
          ['MRP value',      `₹${Number(t.total_mrp_value||0).toLocaleString('en-IN')}`,      'text-green-600'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-white border border-slate-100 rounded-xl p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className={`text-xl font-bold mt-1 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>
    );
  }

  if (reportId === 'gst_report' && data.totals) {
    const t = data.totals;
    return (
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Taxable amount', `₹${Number(t.total_taxable||0).toLocaleString('en-IN')}`],
          ['Total GST',      `₹${Number(t.total_tax||0).toLocaleString('en-IN')}`],
          ['Total with tax', `₹${Number(t.total_with_tax||0).toLocaleString('en-IN')}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-white border border-slate-100 rounded-xl p-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-xl font-bold mt-1 text-[#00475a]">{val}</p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ── Main reports page ──────────────────────────────────────────────────────
export default function ReportsPage() {
  const [registry, setRegistry]       = useState<ReportConfig[]>([]);
  const [activeReport, setActive]     = useState<string>('sales_summary');
  const [reportData, setData]         = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [range, setRange]             = useState('30d');
  const [fromDate, setFrom]           = useState('');
  const [toDate, setTo]               = useState('');
  const [activeCols, setActiveCols]   = useState<string[]>([]);
  const [showColPicker, setShowCols]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filters, setFilters]         = useState<Record<string, string>>({});
  const [exporting, setExporting]     = useState(false);

  // Load registry
  useEffect(() => {
    api.get('/reports/registry').then(r => {
      setRegistry(r.data || []);
      if (r.data?.length > 0) {
        const first = r.data[0];
        setActive(first.report_id);
        setActiveCols(first.visible_cols || first.default_cols);
        setRange(first.default_range || '30d');
      }
    }).catch(() => toast.error('Failed to load reports'));
  }, []);

  const currentReport = registry.find(r => r.report_id === activeReport);

  const loadReport = useCallback(async () => {
    if (!activeReport) return;
    setLoading(true); setData(null);
    const endpoint = ENDPOINT_MAP[activeReport];
    if (!endpoint) { setLoading(false); return; }
    try {
      const params: any = { range, ...filters };
      if (range === 'custom') { params.from = fromDate; params.to = toDate; }
      const r = await api.get(`/reports/${endpoint}`, { params });
      setData(r.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Report failed');
    } finally { setLoading(false); }
  }, [activeReport, range, fromDate, toDate, filters]);

  useEffect(() => { loadReport(); }, [activeReport, range]);

  const handleReportSwitch = (reportId: string) => {
    const rep = registry.find(r => r.report_id === reportId);
    if (!rep) return;
    setActive(reportId);
    setActiveCols(rep.visible_cols || rep.default_cols);
    setRange(rep.default_range || '30d');
    setFilters({});
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ range, ...filters });
      if (range === 'custom') { params.set('from', fromDate); params.set('to', toDate); }
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || ''}/reports/${activeReport}/export?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const saveColConfig = async (cols: string[]) => {
    setActiveCols(cols);
    try {
      await api.patch(`/reports/config/${activeReport}`, { visible_cols: cols });
    } catch {}
  };

  const toggleReportVisibility = async (reportId: string, visible: boolean) => {
    try {
      await api.patch(`/reports/config/${reportId}`, { is_visible: visible });
      setRegistry(prev => prev.map(r =>
        r.report_id === reportId ? { ...r, is_visible: visible } : r
      ));
      toast.success(visible ? 'Report enabled' : 'Report hidden');
    } catch { toast.error('Failed'); }
  };

  // Group by category
  const categories = ['sales','clinical','stock','compliance','hr'];
  const rows = Array.isArray(reportData) ? reportData : reportData?.rows || [];

  return (
    <div className="flex h-full overflow-hidden bg-slate-50">
      {/* ── Left: Report list ── */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">Reports</span>
          <button onClick={() => setShowSettings(true)}
            className="text-slate-400 hover:text-slate-600">
            <Settings className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {categories.map(cat => {
            const catReports = registry.filter(r => r.category === cat && r.is_visible);
            if (!catReports.length) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const Icon = cfg.icon;
            return (
              <div key={cat} className="mb-3">
                <div className="flex items-center gap-1.5 px-4 py-1">
                  <Icon className={`w-3 h-3 ${cfg.color}`} />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cfg.label}</span>
                </div>
                {catReports.map(r => (
                  <button key={r.report_id} onClick={() => handleReportSwitch(r.report_id)}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                      activeReport === r.report_id
                        ? 'bg-teal-50 text-[#00475a] font-semibold border-r-2 border-[#00475a]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}>
                    {r.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Report content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex-shrink-0 bg-white border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Report title */}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">{currentReport?.name}</h2>
              <p className="text-xs text-slate-400 hidden sm:block">{currentReport?.description}</p>
            </div>

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {/* Date range */}
              <select value={range} onChange={e => setRange(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#00475a]">
                {RANGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Custom date range */}
              {range === 'custom' && (
                <>
                  <input type="date" value={fromDate} onChange={e => setFrom(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00475a]" />
                  <span className="text-xs text-slate-400">to</span>
                  <input type="date" value={toDate} onChange={e => setTo(e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#00475a]" />
                </>
              )}

              {/* Filters */}
              <button onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-all ${
                  Object.keys(filters).length > 0
                    ? 'border-[#00475a] bg-teal-50 text-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                <Filter className="w-3.5 h-3.5" />
                Filters {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
              </button>

              {/* Refresh */}
              <button onClick={loadReport} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {loading ? 'Loading...' : 'Run'}
              </button>

              {/* Column picker */}
              <div className="relative">
                <button onClick={() => setShowCols(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50">
                  <Eye className="w-3.5 h-3.5" />
                  Columns
                </button>
                {showColPicker && currentReport && (
                  <ColPicker
                    allCols={currentReport.all_cols}
                    activeCols={activeCols}
                    onChange={saveColConfig}
                    onClose={() => setShowCols(false)}
                  />
                )}
              </div>

              {/* Export CSV */}
              <button onClick={exportCSV} disabled={exporting || !rows.length}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white rounded-lg text-xs font-semibold hover:bg-[#003d4d] disabled:opacity-40">
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export CSV
              </button>
            </div>
          </div>

          {/* Filter row */}
          {showFilters && currentReport && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 flex-wrap">
              {currentReport.params.includes('schedule_class') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Schedule</label>
                  <select value={filters.schedule_class || ''}
                    onChange={e => setFilters(p => ({ ...p, schedule_class: e.target.value || undefined! }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="">All</option>
                    {['OTC','H','H1','X'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              {currentReport.params.includes('sort_by') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Sort by</label>
                  <select value={filters.sort_by || ''}
                    onChange={e => setFilters(p => ({ ...p, sort_by: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="qty">Qty sold</option>
                    <option value="revenue">Revenue</option>
                  </select>
                </div>
              )}
              {currentReport.params.includes('doctor') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Doctor</label>
                  <input type="text" value={filters.doctor || ''}
                    onChange={e => setFilters(p => ({ ...p, doctor: e.target.value }))}
                    placeholder="Filter by doctor..."
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#00475a] w-36" />
                </div>
              )}
              {currentReport.params.includes('expiry_within_days') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Expiring within</label>
                  <select value={filters.within_days || '90'}
                    onChange={e => setFilters(p => ({ ...p, within_days: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                  </select>
                </div>
              )}
              {currentReport.params.includes('role') && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Role</label>
                  <select value={filters.role || ''}
                    onChange={e => setFilters(p => ({ ...p, role: e.target.value }))}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="">All roles</option>
                    {['doctor','pharmacist','receptionist','nurse','assistant'].map(r => (
                      <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                  </select>
                </div>
              )}
              {Object.keys(filters).length > 0 && (
                <button onClick={() => setFilters({})}
                  className="text-xs text-red-500 hover:underline">Clear filters</button>
              )}
              <button onClick={loadReport}
                className="ml-auto px-3 py-1 bg-[#00475a] text-white text-xs rounded-lg font-semibold">
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Summary cards */}
        {reportData && (
          <div className="px-5 pt-4">
            <SummaryCards data={reportData} reportId={activeReport} />
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">No data for this period</p>
              <button onClick={loadReport}
                className="mt-3 text-xs text-[#00475a] hover:underline">Run report</button>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {activeCols.map(col => (
                        <th key={col}
                          className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                          {COL_LABELS[col] ?? col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        {activeCols.map(col => (
                          <td key={col}
                            className={`px-4 py-2.5 text-xs whitespace-nowrap ${cellClass(col, row[col])}`}>
                            {formatCell(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-400">{rows.length} rows</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Report settings</h3>
              <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Toggle which reports are visible in the sidebar</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {registry.map(r => (
                <div key={r.report_id}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{r.category}</p>
                  </div>
                  <button onClick={() => toggleReportVisibility(r.report_id, !r.is_visible)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      r.is_visible ? 'bg-teal-50 text-[#00475a]' : 'bg-slate-100 text-slate-400'
                    }`}>
                    {r.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
