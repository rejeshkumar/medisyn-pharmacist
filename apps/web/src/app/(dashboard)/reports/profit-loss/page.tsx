'use client';
import PageHeader from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/Skeleton';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Download, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const pct = (n: number) => (n || 0).toFixed(1) + '%';

export default function ProfitLossPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = 'Profit and Loss — SimpliRx'; }, []);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/profit-loss?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function exportExcel() {
    if (!data) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`P&L ${MONTHS[month-1]} ${year}`);
    ws.columns = [{ header: 'Line Item', key: 'item', width: 36 }, { header: 'Amount (₹)', key: 'amount', width: 20 }, { header: '%', key: 'pct', width: 10 }];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00475A' } };
    const addSection = (label: string) => { const r = ws.addRow({ item: label }); r.font = { bold: true }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5F8' } }; };
    const addLine = (item: string, amount: number, p?: number) => ws.addRow({ item, amount: amount.toFixed(2), pct: p != null ? p.toFixed(1)+'%' : '' });
    const addTotal = (item: string, amount: number, p?: number) => { const r = ws.addRow({ item, amount: amount.toFixed(2), pct: p != null ? p.toFixed(1)+'%' : '' }); r.font = { bold: true }; };

    const rev = data.revenue;
    addSection('REVENUE');
    addLine('Pharmacy Sales', rev.pharmacy); addLine('Consultation', rev.consultation); addLine('VIP Subscriptions', rev.vip); addLine('Lab (placeholder)', rev.lab);
    addTotal('Total Revenue', rev.total, 100);
    ws.addRow({});
    addSection('COST OF GOODS SOLD');
    addLine('Drug Cost (COGS)', data.cogs);
    addTotal('Gross Profit', data.gross_profit, data.gross_margin_pct);
    ws.addRow({});
    addSection('OPERATING EXPENSES');
    for (const e of data.operating_expenses) addLine(e.category, e.amount);
    addTotal('Total Operating Expenses', data.total_opex);
    ws.addRow({});
    addTotal('NET PROFIT / (LOSS)', data.net_profit, data.net_margin_pct);

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    Object.assign(document.createElement('a'), { href: url, download: `PL_${MONTHS[month-1]}_${year}.xlsx` }).click();
    URL.revokeObjectURL(url);
  }

  const rev = data?.revenue;
  const isProfit = (data?.net_profit || 0) >= 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Profit & Loss Statement</h1>
          <p className="text-sm text-gray-500 mt-1">Monthly P&L — Revenue, COGS, Expenses, Net Profit</p>
        </div>
        <button onClick={exportExcel} disabled={!data} className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#003d4d]">
          <Download size={16}/> Export Excel
        </button>
      </div>

      <div className="flex gap-3 mb-6">
        <select value={month} onChange={e => setMonth(+e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg mb-4 text-sm"><AlertCircle size={16}/>{error}</div>}

      {loading && <div className="bg-white rounded-xl border border-gray-200 p-4"><TableSkeleton rows={4} /></div>}

      {data && (
        <div className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
              <p className="text-xl font-semibold text-[#00475a]">{fmt(rev.total)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Gross Margin</p>
              <p className="text-xl font-semibold text-gray-900">{pct(data.gross_margin_pct)}</p>
            </div>
            <div className={`border rounded-xl p-4 ${isProfit ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-gray-500 mb-1">Net {isProfit ? 'Profit' : 'Loss'}</p>
              <div className="flex items-center gap-1">
                {isProfit ? <TrendingUp size={16} className="text-green-600"/> : <TrendingDown size={16} className="text-red-600"/>}
                <p className={`text-xl font-semibold ${isProfit ? 'text-green-700' : 'text-red-700'}`}>{fmt(Math.abs(data.net_profit))}</p>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{pct(data.net_margin_pct)} margin</p>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-gray-50">
              <span className="text-sm font-medium text-gray-700">P&L — {MONTHS[month-1]} {year}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Revenue */}
              <div className="px-5 py-3 bg-teal-50/40">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue</p>
                {[['Pharmacy Sales', rev.pharmacy],['Consultation', rev.consultation],['VIP Subscriptions', rev.vip],['Lab (placeholder)', rev.lab]].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-600 pl-3">{label}</span>
                    <span className="text-gray-900">{fmt(val as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 text-sm font-semibold border-t border-teal-200 mt-1">
                  <span>Total Revenue</span><span className="text-[#00475a]">{fmt(rev.total)}</span>
                </div>
              </div>

              {/* COGS */}
              <div className="px-5 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cost of Goods Sold</p>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-gray-600 pl-3">Drug procurement cost</span>
                  <span className="text-gray-900">({fmt(data.cogs)})</span>
                </div>
                <div className="flex justify-between py-1.5 text-sm font-semibold border-t border-gray-200 mt-1">
                  <span>Gross Profit</span><span className="text-gray-900">{fmt(data.gross_profit)} <span className="text-xs text-gray-400 font-normal">({pct(data.gross_margin_pct)})</span></span>
                </div>
              </div>

              {/* Opex */}
              <div className="px-5 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Operating Expenses</p>
                {data.operating_expenses.length === 0 && <p className="text-sm text-gray-400 pl-3">No expenses recorded</p>}
                {data.operating_expenses.map((e: any) => (
                  <div key={e.category} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-600 pl-3">{e.category}</span>
                    <span className="text-gray-900">({fmt(e.amount)})</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 text-sm font-semibold border-t border-gray-200 mt-1">
                  <span>Total Operating Expenses</span><span className="text-gray-900">({fmt(data.total_opex)})</span>
                </div>
              </div>

              {/* Net */}
              <div className={`px-5 py-4 ${isProfit ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex justify-between text-base font-bold">
                  <span>Net {isProfit ? 'Profit' : 'Loss'}</span>
                  <span className={isProfit ? 'text-green-700' : 'text-red-700'}>{fmt(data.net_profit)} <span className="text-sm font-normal">({pct(data.net_margin_pct)})</span></span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">COGS calculated from purchase cost price. If cost price unavailable, estimated at 70% of MRP. Review with your accountant for audit purposes.</p>
        </div>
      )}
    </div>
  );
}
