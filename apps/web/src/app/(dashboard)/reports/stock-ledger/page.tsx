'use client';
import { TableSkeleton } from '@/components/common/Skeleton';
import PageHeader from '@/components/common/PageHeader';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Download, Search, BookOpen, AlertCircle } from 'lucide-react';

const fmt = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function StockLedgerPage() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const [medicines, setMedicines] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/reports/stock-ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        setMedicines(d.medicines || []);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('medisyn_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/reports/stock-ledger?medicine_id=${selectedId}&from=${from}&to=${to}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [selectedId, from, to]);

  useEffect(() => { load(); }, [load]);

  const filtered = medicines.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()) || m.manufacturer?.toLowerCase().includes(search.toLowerCase()));

  async function exportExcel() {
    if (!data) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stock Ledger');
    ws.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Reference', key: 'ref', width: 16 },
      { header: 'Party', key: 'party', width: 22 },
      { header: 'Batch No.', key: 'batch', width: 14 },
      { header: 'Expiry', key: 'expiry', width: 12 },
      { header: 'Qty In', key: 'in', width: 10 },
      { header: 'Qty Out', key: 'out', width: 10 },
      { header: 'Balance', key: 'bal', width: 10 },
      { header: 'Notes', key: 'notes', width: 24 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00475A' } };
    ws.addRow({ date: `Opening Balance as of ${from}`, type: '', ref: '', party: '', batch: '', expiry: '', in: data.opening_balance, out: '', bal: data.opening_balance, notes: '' }).font = { bold: true };
    for (const e of data.entries) {
      ws.addRow({ date: e.txn_date, type: e.txn_type, ref: e.reference, party: e.party, batch: e.batch_no, expiry: e.expiry_date, in: e.qty_in || '', out: e.qty_out || '', bal: e.balance, notes: e.notes });
    }
    ws.addRow({ date: `Closing Balance as of ${to}`, type: '', ref: '', party: '', batch: '', expiry: '', in: '', out: '', bal: data.closing_balance, notes: '' }).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    Object.assign(document.createElement('a'), { href: url, download: `StockLedger_${data.medicine?.name?.replace(/\s+/g,'_')}_${from}_${to}.xlsx` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Stock Ledger"
        subtitle="Per-drug running stock register"
        crumbs={[{ label: 'Reports', href: '/reports' }, { label: 'Stock Ledger' }]}
      />
      <div className="px-6 pb-6">

        {/* Ledger */}
        <div className="md:col-span-2">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
            </div>
          </div>

          {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg mb-4 text-sm"><AlertCircle size={14}/>{error}</div>}

          {!selectedId && <div className="py-16 text-center text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">Select a medicine from the list to view its ledger</div>}

          {selectedId && data && (
            <>
              <div className="flex gap-3 mb-3">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  <span className="text-gray-500">Opening: </span><span className="font-semibold">{data.opening_balance} units</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  <span className="text-gray-500">Closing: </span><span className="font-semibold text-[#00475a]">{data.closing_balance} units</span>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {loading ? (
                  <TableSkeleton rows={6} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide border-b border-gray-200">
                          {['Date','Type','Reference','Party','Batch','Expiry','In','Out','Balance','Notes'].map(h => (
                            <th key={h} className={`px-3 py-3 font-medium ${['In','Out','Balance'].includes(h) ? 'text-right' : 'text-left'} whitespace-nowrap`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-gray-50 font-medium border-b border-gray-200">
                          <td className="px-3 py-2" colSpan={6}>Opening Balance — {from}</td>
                          <td className="px-3 py-2 text-right text-blue-600 font-semibold">{data.opening_balance}</td>
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right font-semibold">{data.opening_balance}</td>
                          <td></td>
                        </tr>
                        {data.entries.map((e: any, i: number) => (
                          <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${e.txn_type === 'Sale' ? '' : e.txn_type === 'Purchase' ? 'bg-green-50/30' : 'bg-orange-50/30'}`}>
                            <td className="px-3 py-2 whitespace-nowrap">{e.txn_date}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${e.txn_type === 'Sale' ? 'bg-blue-100 text-blue-700' : e.txn_type === 'Purchase' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{e.txn_type}</span>
                            </td>
                            <td className="px-3 py-2 font-mono">{e.reference || '—'}</td>
                            <td className="px-3 py-2">{e.party || '—'}</td>
                            <td className="px-3 py-2 font-mono">{e.batch_no}</td>
                            <td className="px-3 py-2">{e.expiry_date || '—'}</td>
                            <td className="px-3 py-2 text-right text-green-700 font-medium">{e.qty_in > 0 ? e.qty_in : ''}</td>
                            <td className="px-3 py-2 text-right text-red-600 font-medium">{e.qty_out > 0 ? e.qty_out : ''}</td>
                            <td className="px-3 py-2 text-right font-semibold">{e.balance}</td>
                            <td className="px-3 py-2 text-gray-400">{e.notes}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-3 py-2" colSpan={6}>Closing Balance — {to}</td>
                          <td></td><td></td>
                          <td className="px-3 py-2 text-right text-[#00475a] font-bold">{data.closing_balance}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}