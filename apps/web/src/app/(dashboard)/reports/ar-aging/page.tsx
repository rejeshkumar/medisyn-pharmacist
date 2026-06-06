'use client';
import { TableSkeleton } from '@/components/common/Skeleton';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';
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
  useEffect(() => { document.title = 'AR Aging — SimpliRx'; }, []);
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
    
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Accounts Receivable Aging"
        subtitle="Outstanding credit bills — track overdue collections"
        crumbs={[{ label: 'Reports', href: '/reports' }, { label: 'AR Aging' }]}
      />
      <div className="px-6 pb-6">
      </div>
    </div>
  );
}