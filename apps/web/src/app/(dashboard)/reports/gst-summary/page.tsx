'use client';
import EmptyState from '@/components/common/EmptyState';
import toast from 'react-hot-toast';
import PageHeader from '@/components/common/PageHeader';
import { TableSkeleton, CardSkeleton } from '@/components/common/Skeleton';
import { useState, useEffect, useCallback } from 'react';
import { Download, FileText, AlertCircle } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function GstSummaryPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = 'GST Summary — SimpliRx'; }, []);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/gst-summary?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) { setError(e.message); toast.error('Export failed'); }
    finally { setLoading(false); }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function exportExcel() {
    if (!data) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`GSTR3B ${MONTHS[month-1]} ${year}`);
    ws.columns = [
      { header: 'GST Rate (%)', key: 'rate', width: 14 },
      { header: 'Taxable Value (₹)', key: 'taxable', width: 22 },
      { header: 'CGST (₹)', key: 'cgst', width: 16 },
      { header: 'SGST (₹)', key: 'sgst', width: 16 },
      { header: 'Total GST (₹)', key: 'gst', width: 18 },
      { header: 'Input Tax Credit (₹)', key: 'itc', width: 22 },
      { header: 'Net GST Payable (₹)', key: 'net', width: 22 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00475A' } };
    for (const r of data.breakdown) {
      ws.addRow({ rate: r.gst_rate + '%', taxable: r.taxable_value, cgst: r.cgst, sgst: r.sgst, gst: r.total_gst, itc: r.itc, net: r.net_gst_payable });
    }
    ws.addRow({});
    const tot = ws.addRow({ rate: 'TOTAL', taxable: data.totals.taxable_value, cgst: data.totals.cgst, sgst: data.totals.sgst, gst: data.totals.total_gst, itc: data.totals.itc, net: data.totals.net_gst_payable });
    tot.font = { bold: true };
    ws.addRow({});
    ws.addRow({ rate: `Generated: ${new Date().toLocaleDateString('en-IN')} | Period: ${MONTHS[month-1]} ${year}` });
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    Object.assign(document.createElement('a'), { href: url, download: `GSTR3B_${MONTHS[month-1]}_${year}.xlsx` }).click();
    URL.revokeObjectURL(url);
  }

  const t = data?.totals;
  return (
    <div className="max-w-5xl mx-auto">
      <div className="px-6 pb-6">
      <PageHeader
        title="GST Summary — GSTR-3B"
        subtitle="Output tax and input credit — share with your CA for monthly filing"
        crumbs={[{ label: 'Reports', href: '/reports' }, { label: 'GST Summary' }]}
        actions={
          <button onClick={exportExcel} disabled={!data} className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#003d4d] transition-colors">
            <Download size={16} /> Export Excel
          </button>
        }
      />

      <div className="flex gap-3 mb-6">
        <select value={month} onChange={e => setMonth(+e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(+e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg mb-4 text-sm"><AlertCircle size={16}/>{error}</div>}

      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Taxable Value', value: fmt(t.taxable_value), cls: 'text-gray-900' },
            { label: 'Total GST Collected', value: fmt(t.total_gst), cls: 'text-[#00475a]' },
            { label: 'Input Tax Credit', value: fmt(t.itc), cls: 'text-blue-600' },
            { label: 'Net GST Payable', value: fmt(t.net_gst_payable), cls: t.net_gst_payable > 0 ? 'text-red-600' : 'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-xl font-semibold ${c.cls}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <FileText size={16} className="text-[#00475a]"/>
          <span className="text-sm font-medium text-gray-700">Rate-wise Breakdown — {MONTHS[month-1]} {year}</span>
        </div>
        {loading ? (
          <CardSkeleton count={4} /><TableSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  {['GST Rate','Taxable Value','CGST','SGST','Total GST','Input Tax Credit','Net Payable'].map(h => (
                    <th key={h} className={`px-4 py-3 ${h === 'GST Rate' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.breakdown || []).map((r: any) => (
                  <tr key={r.gst_rate} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{r.gst_rate}%</td>
                    <td className="px-4 py-3 text-right">{fmt(r.taxable_value)}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.cgst)}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.sgst)}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.total_gst)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{fmt(r.itc)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.net_gst_payable > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(r.net_gst_payable)}</td>
                  </tr>
                ))}
              </tbody>
              {t && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-sm">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{fmt(t.taxable_value)}</td>
                    <td className="px-4 py-3 text-right">{fmt(t.cgst)}</td>
                    <td className="px-4 py-3 text-right">{fmt(t.sgst)}</td>
                    <td className="px-4 py-3 text-right">{fmt(t.total_gst)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{fmt(t.itc)}</td>
                    <td className={`px-4 py-3 text-right ${t.net_gst_payable > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(t.net_gst_payable)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-4">GST back-calculated from MRP-inclusive prices. CGST = SGST (intra-state Kerala). Verify with your CA before filing on GSTN portal.</p>
    </div>
  );
}
