'use client';
import PageHeader from '@/components/common/PageHeader';
import { TableSkeleton } from '@/components/common/Skeleton';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Download, Shield, AlertCircle, Printer } from 'lucide-react';

const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function ScheduleHRegisterPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [schedule, setSchedule] = useState('H');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { document.title = 'Schedule H Register — SimpliRx'; }, []);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/schedule-h-register?from=${from}&to=${to}&schedule=${schedule}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [from, to, schedule]);

  useEffect(() => { load(); }, [load]);

  async function exportExcel() {
    if (!data) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Schedule ${schedule} Register`);
    ws.columns = [
      { header: 'Entry No.', key: 'entry', width: 10 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Bill No.', key: 'bill', width: 14 },
      { header: 'Patient Name', key: 'patient', width: 22 },
      { header: 'Patient Mobile', key: 'mobile', width: 16 },
      { header: 'Patient Address', key: 'address', width: 28 },
      { header: 'Prescriber', key: 'prescriber', width: 22 },
      { header: 'Drug Name', key: 'drug', width: 30 },
      { header: 'Manufacturer', key: 'mfg', width: 22 },
      { header: 'Batch No.', key: 'batch', width: 14 },
      { header: 'Schedule', key: 'sched', width: 10 },
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'MRP (₹)', key: 'mrp', width: 12 },
      { header: 'Amount (₹)', key: 'amount', width: 14 },
      { header: 'Dispensed By', key: 'dispensed', width: 18 },
      { header: "Pharmacist's Signature", key: 'sig', width: 22 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00475A' } };
    for (const e of (data.entries || [])) {
      ws.addRow({
        entry: e.entry_no, date: e.sale_date, bill: e.bill_number,
        patient: e.patient_name, mobile: e.patient_mobile, address: e.patient_address,
        prescriber: e.prescriber_name, drug: e.drug_name, mfg: e.manufacturer,
        batch: e.batch_no, sched: e.schedule_class, qty: e.qty,
        mrp: e.unit_mrp, amount: e.total_amount, dispensed: e.dispensed_by, sig: '',
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    Object.assign(document.createElement('a'), { href: url, download: `Schedule_${schedule}_Register_${from}_to_${to}.xlsx` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={20} className="text-[#00475a]"/>
            <h1 className="text-2xl font-semibold text-gray-900">Schedule H/H1 Prescription Register</h1>
          </div>
          <p className="text-sm text-gray-500">Statutory register under Drugs & Cosmetics Rules — must be produced on inspector demand</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Printer size={16}/> Print
          </button>
          <button onClick={exportExcel} disabled={!data} className="flex items-center gap-2 px-4 py-2 bg-[#00475a] text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-[#003d4d]">
            <Download size={16}/> Export Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
        </div>
        <select value={schedule} onChange={e => setSchedule(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="H">Schedule H (all)</option>
          <option value="H1">Schedule H1 only</option>
        </select>
      </div>

      {error && <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg mb-4 text-sm"><AlertCircle size={16}/>{error}</div>}

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
        <strong>{data?.total || 0} entries</strong> found for period {from} to {to} · Schedule {schedule} drugs only · Keep this register for minimum 3 years
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                  {['#','Date','Bill No.','Patient','Mobile','Prescriber','Drug Name','Batch','Sched.','Qty','MRP','Amount','Dispensed By','Pharmacist Sign'].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.entries || []).map((e: any) => (
                  <tr key={e.entry_no} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{e.entry_no}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.sale_date}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.bill_number}</td>
                    <td className="px-3 py-2 font-medium">{e.patient_name}</td>
                    <td className="px-3 py-2">{e.patient_mobile}</td>
                    <td className="px-3 py-2">{e.prescriber_name || '—'}</td>
                    <td className="px-3 py-2 font-medium max-w-[180px] truncate" title={e.drug_name}>{e.drug_name}</td>
                    <td className="px-3 py-2 font-mono">{e.batch_no}</td>
                    <td className="px-3 py-2"><span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">{e.schedule_class}</span></td>
                    <td className="px-3 py-2 text-center font-medium">{e.qty}</td>
                    <td className="px-3 py-2 text-right">{fmt(e.unit_mrp)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(e.total_amount)}</td>
                    <td className="px-3 py-2">{e.dispensed_by}</td>
                    <td className="px-3 py-2 min-w-[120px] border-b border-dashed border-gray-300"></td>
                  </tr>
                ))}
                {(!data?.entries?.length && !loading) && (
                  <tr><td colSpan={14} className="px-4 py-12 text-center text-gray-400">No Schedule {schedule} entries found for this period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
