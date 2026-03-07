'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart3, Download, TrendingUp, Package, Clock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function ReportsPage() {
  const [tab, setTab] = useState<'top'|'low-stock'|'near-expiry'|'valuation'>('top');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: topMedicines, isLoading: topLoading } = useQuery({ queryKey: ['top-medicines',from,to], queryFn: () => { const p=new URLSearchParams(); if(from) p.set('from',from); if(to) p.set('to',to); return api.get(`/reports/top-medicines?${p}`).then((r) => r.data); }, enabled: tab==='top' });
  const { data: lowStock } = useQuery({ queryKey: ['low-stock-report'], queryFn: () => api.get('/reports/low-stock').then((r) => r.data), enabled: tab==='low-stock' });
  const { data: nearExpiry } = useQuery({ queryKey: ['near-expiry-report'], queryFn: () => api.get('/reports/near-expiry?days=90').then((r) => r.data), enabled: tab==='near-expiry' });
  const { data: valuation } = useQuery({ queryKey: ['stock-valuation'], queryFn: () => api.get('/reports/stock-valuation').then((r) => r.data), enabled: tab==='valuation' });

  const handleExportSales = async () => {
    if (!from || !to) { toast.error('Please select date range'); return; }
    try {
      const response = await api.get(`/reports/export/sales?from=${from}&to=${to}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a'); a.href=url; a.download=`sales-report-${from}-to-${to}.xlsx`; a.click();
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const tabs = [{ id:'top',label:'Top Medicines',icon:TrendingUp },{ id:'low-stock',label:'Low Stock',icon:Package },{ id:'near-expiry',label:'Near Expiry',icon:Clock },{ id:'valuation',label:'Valuation',icon:BarChart3 }];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input w-auto flex-1 sm:flex-none" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="input w-auto flex-1 sm:flex-none" value={to} onChange={(e) => setTo(e.target.value)} />
          <button onClick={handleExportSales} className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center"><Download className="w-4 h-4" /> Export Sales</button>
        </div>
      </div>

      {/* Tab switcher - scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-max md:w-fit min-w-full md:min-w-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${tab===t.id?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'top' && (
        <div className="space-y-5">
          {topMedicines && topMedicines.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Top Medicines by Units Sold</h3>
              <div className="min-w-[320px]">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topMedicines.slice(0,10)} margin={{ top:5, right:10, left:0, bottom:60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="medicine_name" angle={-45} textAnchor="end" fontSize={10} tick={{ fill:'#6b7280' }} />
                    <YAxis fontSize={10} tick={{ fill:'#6b7280' }} />
                    <Tooltip formatter={(val: any) => [val,'Units Sold']} contentStyle={{ borderRadius:'8px', fontSize:'12px' }} />
                    <Bar dataKey="total_qty" fill="#00475a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-4 py-3 font-medium text-gray-600">#</th><th className="text-left px-4 py-3 font-medium text-gray-600">Medicine</th><th className="text-right px-4 py-3 font-medium text-gray-600">Units</th><th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th></tr></thead>
              <tbody>{topLoading ? <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr> : topMedicines?.map((med: any, i: number) => (<tr key={med.medicine_id} className="table-row"><td className="px-4 py-3 text-gray-400 font-mono text-xs">{i+1}</td><td className="px-4 py-3 font-medium text-gray-900">{med.medicine_name}</td><td className="px-4 py-3 text-right text-gray-700">{med.total_qty}</td><td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(med.total_revenue)}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'low-stock' && (
        <>
          <div className="space-y-3 md:hidden">
            {lowStock?.map((batch: any) => (
              <div key={batch.id} className="card p-4">
                <div className="flex justify-between gap-2"><div><p className="font-semibold text-gray-900 text-sm">{batch.medicine?.brand_name}</p><p className="text-xs text-gray-400">{batch.medicine?.molecule}</p></div><span className="font-bold text-red-600 text-xl">{batch.quantity}</span></div>
                <div className="mt-2 text-xs text-gray-500"><span className="font-mono">{batch.batch_number}</span> · {formatDate(batch.expiry_date)}{batch.supplier?.name && ` · ${batch.supplier.name}`}</div>
              </div>
            ))}
          </div>
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-4 py-3 font-medium text-gray-600">Medicine</th><th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th><th className="text-left px-4 py-3 font-medium text-gray-600">Expiry</th><th className="text-right px-4 py-3 font-medium text-gray-600">Qty Left</th><th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th></tr></thead>
            <tbody>{lowStock?.map((batch: any) => (<tr key={batch.id} className="table-row"><td className="px-4 py-3"><p className="font-medium text-gray-900">{batch.medicine?.brand_name}</p><p className="text-xs text-gray-400">{batch.medicine?.molecule}</p></td><td className="px-4 py-3 font-mono text-xs text-gray-600">{batch.batch_number}</td><td className="px-4 py-3 text-xs text-gray-600">{formatDate(batch.expiry_date)}</td><td className="px-4 py-3 text-right"><span className="font-bold text-red-600">{batch.quantity}</span></td><td className="px-4 py-3 text-gray-500 text-xs">{batch.supplier?.name||'-'}</td></tr>))}</tbody></table>
          </div>
        </>
      )}

      {tab === 'near-expiry' && (
        <>
          <div className="space-y-3 md:hidden">
            {nearExpiry?.map((batch: any) => {
              const daysLeft = Math.ceil((new Date(batch.expiry_date).getTime()-Date.now())/86400000);
              return (<div key={batch.id} className="card p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold text-gray-900 text-sm">{batch.medicine?.brand_name}</p><p className="text-xs text-gray-400">{batch.medicine?.molecule}</p></div><div className="text-right"><p className={`text-xs font-medium ${daysLeft<=30?'text-red-600':'text-amber-600'}`}>{formatDate(batch.expiry_date)}</p><p className="text-xs text-gray-400">{daysLeft}d left</p></div></div><div className="mt-1 text-xs text-gray-500"><span className="font-mono">{batch.batch_number}</span> · {batch.quantity} units · {formatCurrency(batch.quantity*Number(batch.mrp))}</div></div>);
            })}
          </div>
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-100"><tr><th className="text-left px-4 py-3 font-medium text-gray-600">Medicine</th><th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th><th className="text-left px-4 py-3 font-medium text-gray-600">Expiry Date</th><th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th><th className="text-right px-4 py-3 font-medium text-gray-600">Stock Value</th></tr></thead>
            <tbody>{nearExpiry?.map((batch: any) => { const daysLeft=Math.ceil((new Date(batch.expiry_date).getTime()-Date.now())/86400000); return (<tr key={batch.id} className="table-row"><td className="px-4 py-3"><p className="font-medium text-gray-900">{batch.medicine?.brand_name}</p><p className="text-xs text-gray-400">{batch.medicine?.molecule}</p></td><td className="px-4 py-3 font-mono text-xs text-gray-600">{batch.batch_number}</td><td className="px-4 py-3"><p className={`text-xs font-medium ${daysLeft<=30?'text-red-600':'text-amber-600'}`}>{formatDate(batch.expiry_date)}</p><p className="text-xs text-gray-400">{daysLeft} days left</p></td><td className="px-4 py-3 text-right font-semibold">{batch.quantity}</td><td className="px-4 py-3 text-right text-gray-700">{formatCurrency(batch.quantity*Number(batch.mrp))}</td></tr>); })}</tbody></table>
          </div>
        </>
      )}

      {tab === 'valuation' && valuation && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card border border-blue-100"><p className="text-xs text-gray-500">Total Purchase Value</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(valuation.total_purchase_value)}</p></div>
          <div className="card border border-green-100"><p className="text-xs text-gray-500">Total MRP Value</p><p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(valuation.total_mrp_value)}</p></div>
          <div className="card border border-primary-100"><p className="text-xs text-gray-500">Potential Profit</p><p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency(valuation.potential_profit)}</p></div>
        </div>
      )}
    </div>
  );
}
