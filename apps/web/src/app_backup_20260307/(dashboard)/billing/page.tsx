'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Search, FileText, Loader2, Eye } from 'lucide-react';
import BillDocument from '@/components/billing/BillDocument';

export default function BillingPage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [printSale, setPrintSale] = useState<any>(null);

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', from, to, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search) params.set('search', search);
      return api.get(`/sales?${params}`).then((r) => r.data);
    },
  });

  const totalRevenue = sales?.filter((s: any) => !s.is_voided).reduce((sum: number, s: any) => sum + Number(s.total_amount), 0) || 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bills & Sales</h1>
          <p className="text-sm text-gray-500">{sales?.length || 0} bills · Total: {formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search by bill no or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bill No</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date & Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Payment</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Scheduled</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : sales?.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No bills found
              </td></tr>
            ) : (
              sales?.map((sale: any) => (
                <tr key={sale.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{sale.bill_number}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDateTime(sale.created_at)}</td>
                  <td className="px-4 py-3 text-gray-700">{sale.customer_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-100 text-gray-600 border-gray-200 uppercase text-xs">{sale.payment_mode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {sale.has_scheduled_drugs && <span className="badge bg-orange-100 text-orange-700 border-orange-200 text-xs">🔐 Yes</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(sale.total_amount)}</td>
                  <td className="px-4 py-3">
                    {sale.is_voided ? (
                      <span className="badge bg-red-100 text-red-600 border-red-200">Voided</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700 border-green-200">Paid</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedSale(sale)} className="text-gray-400 hover:text-primary-600">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {printSale && (
        <BillDocument
          data={{
            billNumber: printSale.bill_number,
            date: printSale.created_at,
            pharmacist: printSale.pharmacist?.name,
            patientName: printSale.customer_name,
            doctorName: printSale.doctor_name,
            doctorRegNo: printSale.doctor_reg_no,
            paymentMode: printSale.payment_mode,
            items: printSale.items?.map((item: any) => ({
              medicineName: item.medicine?.brand_name || item.medicine_name,
              batchNumber: item.batch?.batch_number || item.batch_number,
              expiryDate: item.batch?.expiry_date,
              qty: item.qty,
              rate: Number(item.rate),
              gstPercent: Number(item.gst_percent),
              itemTotal: Number(item.item_total),
              isSubstituted: item.is_substituted,
            })) || [],
            subtotal: Number(printSale.subtotal),
            taxAmount: Number(printSale.tax_amount),
            discountAmount: Number(printSale.discount_amount),
            totalAmount: Number(printSale.total_amount),
            hasScheduledDrugs: printSale.has_scheduled_drugs,
          }}
          mode="print"
          onClose={() => setPrintSale(null)}
        />
      )}

      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Bill #{selectedSale.bill_number}</h3>
                <p className="text-xs text-gray-400">{formatDateTime(selectedSale.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPrintSale(selectedSale); setSelectedSale(null); }}
                  className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  🖨 Print Bill
                </button>
                <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {selectedSale.customer_name && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-gray-400 text-xs">Patient</p><p className="font-medium">{selectedSale.customer_name}</p></div>
                  {selectedSale.doctor_name && <div><p className="text-gray-400 text-xs">Doctor</p><p className="font-medium">{selectedSale.doctor_name}</p></div>}
                </div>
              )}
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100"><th className="text-left py-1.5 text-gray-500 font-medium">Item</th><th className="text-center py-1.5 text-gray-500 font-medium">Qty</th><th className="text-right py-1.5 text-gray-500 font-medium">Rate</th><th className="text-right py-1.5 text-gray-500 font-medium">Total</th></tr></thead>
                <tbody>
                  {selectedSale.items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2"><p className="font-medium text-gray-900">{item.medicine?.brand_name || item.medicine_name}</p>{item.is_substituted && <p className="text-xs text-blue-500">Substituted</p>}</td>
                      <td className="text-center py-2 text-gray-700">{item.qty}</td>
                      <td className="text-right py-2 text-gray-700">₹{Number(item.rate).toFixed(2)}</td>
                      <td className="text-right py-2 font-medium">₹{Number(item.item_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm space-y-1 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(selectedSale.subtotal)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Tax</span><span>{formatCurrency(selectedSale.tax_amount)}</span></div>
                <div className="flex justify-between text-gray-600"><span>Discount</span><span>-{formatCurrency(selectedSale.discount_amount)}</span></div>
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span>{formatCurrency(selectedSale.total_amount)}</span></div>
                <div className="flex justify-between text-gray-500 text-xs pt-1"><span>Payment</span><span className="uppercase">{selectedSale.payment_mode}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
