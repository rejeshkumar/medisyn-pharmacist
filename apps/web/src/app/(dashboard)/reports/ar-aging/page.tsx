'use client';
import { useState, useEffect, useCallback } from 'react';
import { Download, AlertCircle, TrendingUp } from 'lucide-react';

const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const BUCKETS = [
  { key: 'current',    label: 'Not Yet Due',  color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'days_1_30',  label: '1–30 Days',    color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { key: 'days_31_60', label: '31–60 Days',   color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'days_61_90', label: '61–90 Days',   color: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'over_90',    label: '90+ Days',     color: 'bg-red-100 text-red-800 border-red-300' },
];

export default function ArAgingPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeBucket, setActiveBucket] = useState('days_1_30');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/ar-aging?as_of=${asOf}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [asOf]);

  useEffect(() => { load(); }, [load]);

  async function exportExcel() {
    if (!data) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    for (const b of BUCKETS) {
      const ws = wb.addWorksheet(b.label);
      ws.columns = [
        { header: 'Bill No.', key: 'bill', width: 14 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Patient', key: 'patient', width: 24 },
        { header: 'Mobile', key: 'mobile', width: 14 },
        { header: 'Total Bill', key: 'total', width: 14 },
        { header: 'Paid', key: 'paid', width: 14 },
        { header: 'Outstanding', key: 'out', width: 16 },
        { header: 'Days', key: 'days', width: 8 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00475A' } };
      for (const r of (data.buckets[b.key] || [])) {
        ws.addRow({ bill: r.bill_number, date: r.bill_date, patient: r.patient_name, mobile: r.patient_mobile, total: r.total_amount, paid: r.paid_amount, out: r.outstanding, days: r.days_outstanding });
      }
    }
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    Object.assign(document.createElement('a'), { href: url, download: `AR_Aging_${asOf}.xlsx` }).click();
    URL.revokeObjectURL(url);
  }

  const s = data?.summary;
  const activeRows = data?.buckets?.[activeBucket] || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1"><TrendingUp size={20} className="text-[#00475a]"/>
            <h1 className="text-2xl font-semibold text-gray-900">Accounts Receivable Aging</h1>
          </div>
          <p className="text-sm text-gray-500">Credit bills outstanding — track overdue collections</p>
        </div>
        <button onClick={exportExcel} disabled={!data} className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#003d4d]">
          <Download size={16}/> Export Excel
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm text-gray-600">As of date</label>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
      </div>

      {error && <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg mb-4 text-sm"><AlertCircle size={16}/>{error}</div>}

      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Total Outstanding</p>
              <p className="text-2xl font-semibold text-red-600">{fmt(s.total)}</p>
            </div>
            {BUCKETS.map(b => (
              <div key={b.key} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">{b.label}</p>
                <p className="text-lg font-semibold text-gray-900">{fmt(s[b.key])}</p>
                <p className="text-xs text-gray-400 mt-1">{(data.buckets[b.key]?.length || 0)} bills</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            {BUCKETS.map(b => (
              <button key={b.key} onClick={() => setActiveBucket(b.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeBucket === b.key ? b.color : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {b.label} ({data.buckets[b.key]?.length || 0})
              </button>
            ))}
          </div>
        </>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  {['Bill No.','Date','Patient','Mobile','Total Bill','Paid','Outstanding','Days Overdue'].map(h => (
                    <th key={h} className={`px-4 py-3 ${h === 'Bill No.' || h === 'Date' || h === 'Patient' || h === 'Mobile' ? 'text-left' : 'text-right'} font-medium`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{r.bill_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.bill_date}</td>
                    <td className="px-4 py-3 font-medium">{r.patient_name}</td>
                    <td className="px-4 py-3">{r.patient_mobile}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(r.paid_amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(r.outstanding)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.days_outstanding > 90 ? 'bg-red-100 text-red-700' : r.days_outstanding > 60 ? 'bg-orange-100 text-orange-700' : r.days_outstanding > 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {r.days_outstanding}d
                      </span>
                    </td>
                  </tr>
                ))}
                {!activeRows.length && !loading && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No outstanding bills in this bucket</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
