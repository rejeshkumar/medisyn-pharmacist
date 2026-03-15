'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, Loader2, Star } from 'lucide-react';

const n = (v: any) => Number(v) || 0;
const fmt = (v: any) => n(v).toLocaleString('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2
});
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});
const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

const CAT_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  pharmacy:     'Pharmacy',
  lab:          'Lab & Diagnostics',
  procedure:    'Procedures',
  other:        'Other',
};

const PM_LABELS: Record<string, string> = {
  cash: 'Cash', upi: 'UPI', card: 'Card', credit: 'Credit',
};

export default function BillReceiptPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [bill, setBill]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tenantInfo, setTenantInfo] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/clinic-bills/${id}`),
      api.get('/tenants/me').catch(() => ({ data: null })),
    ]).then(([billRes, tenantRes]) => {
      setBill(billRes.data);
      setTenantInfo(tenantRes.data);
    }).catch(() => toast.error('Failed to load bill'))
    .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <html><head>
      <title>Bill ${bill?.bill_number ?? ''}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #00475a; padding-bottom: 12px; margin-bottom: 16px; }
        .clinic-name { font-size: 20px; font-weight: bold; color: #00475a; }
        .clinic-sub { font-size: 11px; color: #666; margin-top: 2px; }
        .bill-meta { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; }
        .bill-meta-box { padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .bill-meta-label { color: #6b7280; }
        .bill-meta-value { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f9fafb; padding: 8px; text-align: left; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
        td { padding: 7px 8px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 240px; }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
        .total-final { font-size: 14px; font-weight: bold; border-top: 2px solid #00475a; padding-top: 8px; margin-top: 4px; color: #00475a; }
        .footer { text-align: center; color: #9ca3af; font-size: 10px; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
        .vip-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; }
        .cat-header { background: #f0faf8; font-weight: bold; color: #00475a; }
        @media print { body { padding: 10px; } }
      </style>
      </head><body>${content.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#00475a]" />
    </div>
  );

  if (!bill) return (
    <div className="p-6 text-center text-slate-500">Bill not found</div>
  );

  const patientName = bill.patient?.first_name
    ? `${bill.patient.first_name} ${bill.patient.last_name ?? ''}`.trim()
    : bill.patient?.full_name ?? 'Patient';

  const totalDiscount = n(bill.vip_discount_amount) + n(bill.extra_discount_amt);

  // Group items by category
  const grouped: Record<string, any[]> = {};
  (bill.items || []).forEach((item: any) => {
    const cat = item.category ?? 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const clinic = tenantInfo ?? {
    name: 'MediSyn Specialty Clinic',
    address: 'Taliparamba, Kannur, Kerala – 670141',
    phone: '+91 XXXXX XXXXX',
    email: 'clinic@medisyn.in',
    gstin: '',
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Screen controls */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00475a] text-white text-sm font-medium rounded-xl hover:bg-[#003d4d] transition-colors"
        >
          <Printer className="w-4 h-4" /> Print receipt
        </button>
      </div>

      {/* Printable receipt */}
      <div
        ref={printRef}
        className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
      >
        {/* Clinic header */}
        <div className="header text-center border-b-2 border-[#00475a] pb-4 mb-5">
          <div className="clinic-name text-2xl font-bold text-[#00475a]">{clinic.name}</div>
          {clinic.address && (
            <p className="clinic-sub text-xs text-slate-500 mt-1">{clinic.address}</p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            {[clinic.phone && `Ph: ${clinic.phone}`, clinic.email].filter(Boolean).join(' | ')}
          </p>
          {clinic.gstin && (
            <p className="text-xs text-slate-400">GSTIN: {clinic.gstin}</p>
          )}
          <p className="text-sm font-semibold text-slate-700 tracking-widest mt-3">— RECEIPT —</p>
        </div>

        {/* Bill meta */}
        <div className="flex flex-wrap gap-4 mb-5 text-sm">
          <div className="flex-1 min-w-36">
            <p className="text-xs text-slate-500">Bill No.</p>
            <p className="font-bold text-[#00475a]">{bill.bill_number}</p>
          </div>
          <div className="flex-1 min-w-36">
            <p className="text-xs text-slate-500">Date & Time</p>
            <p className="font-medium text-slate-800">{fmtDateTime(bill.created_at)}</p>
          </div>
          <div className="flex-1 min-w-36">
            <p className="text-xs text-slate-500">Patient</p>
            <p className="font-medium text-slate-800 flex items-center gap-1">
              {patientName}
              {bill.patient?.vip_tier && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full border border-amber-200 font-medium">
                  <Star className="w-2.5 h-2.5" /> VIP
                </span>
              )}
            </p>
            {bill.patient?.mobile && (
              <p className="text-xs text-slate-400">{bill.patient.mobile}</p>
            )}
          </div>
          <div className="flex-1 min-w-36">
            <p className="text-xs text-slate-500">Payment mode</p>
            <p className="font-medium text-slate-800">
              {PM_LABELS[bill.payment_mode] ?? bill.payment_mode}
            </p>
          </div>
        </div>

        {/* Line items by category */}
        <table className="w-full border-collapse mb-5">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200">Service</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 w-16">Qty</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 w-24">Rate (₹)</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 w-16">GST%</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 border-b border-slate-200 w-24">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([cat, items]) => (
              <>
                <tr key={`cat-${cat}`}>
                  <td
                    colSpan={5}
                    className="px-3 py-1.5 text-xs font-semibold text-[#00475a] bg-teal-50 border-b border-teal-100"
                  >
                    {CAT_LABELS[cat] ?? cat}
                  </td>
                </tr>
                {items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-sm text-slate-800">{item.name}</td>
                    <td className="px-3 py-2 text-sm text-center text-slate-600">{item.qty}</td>
                    <td className="px-3 py-2 text-sm text-right text-slate-600">{fmt(item.unit_rate)}</td>
                    <td className="px-3 py-2 text-sm text-right text-slate-500">{n(item.gst_percent)}%</td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-slate-800">{fmt(item.line_total)}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto w-60">
          <div className="flex justify-between text-sm py-1">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">₹{fmt(bill.subtotal)}</span>
          </div>
          {n(bill.gst_amount) > 0 && (
            <div className="flex justify-between text-sm py-1">
              <span className="text-slate-500">GST</span>
              <span className="font-medium">₹{fmt(bill.gst_amount)}</span>
            </div>
          )}
          {n(bill.vip_discount_amount) > 0 && (
            <div className="flex justify-between text-sm py-1 text-amber-700">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3" /> VIP discount
              </span>
              <span className="font-medium">−₹{fmt(bill.vip_discount_amount)}</span>
            </div>
          )}
          {n(bill.extra_discount_amt) > 0 && (
            <div className="flex justify-between text-sm py-1 text-green-700">
              <span>
                Discount
                {bill.extra_discount_note && ` (${bill.extra_discount_note})`}
              </span>
              <span className="font-medium">−₹{fmt(bill.extra_discount_amt)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t-2 border-[#00475a] pt-2 mt-2 text-[#00475a]">
            <span>Total paid</span>
            <span>₹{fmt(bill.total_amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          <p>Thank you for choosing {clinic.name}</p>
          <p className="mt-1">This is a computer-generated receipt and does not require a signature.</p>
        </div>
      </div>
    </div>
  );
}
