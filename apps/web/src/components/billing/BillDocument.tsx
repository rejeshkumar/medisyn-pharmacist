'use client';

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

// ── Clinic details ────────────────────────────────────────────────────────────
const CLINIC = {
  name: 'MediSyn Specialty Clinic',
  subname: 'Pharmacy',
  address: 'Taliparamba, Kannur, Kerala – 670141',
  phone: '+91 XXXXX XXXXX',
  email: 'pharmacy@medisyn.in',
  gstin: 'GSTIN: 32XXXXX0000X1ZX',
  dl_no: 'D.L. No: KL-XXXX / XXXX',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BillItem {
  medicineName: string;
  batchNumber?: string;
  expiryDate?: string;
  qty: number;
  rate: number;
  gstPercent: number;
  itemTotal: number;
  isSubstituted?: boolean;
}

export interface BillData {
  billNumber?: string;
  date?: Date | string;
  pharmacist?: string;
  patientName?: string;
  doctorName?: string;
  doctorRegNo?: string;
  paymentMode: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  hasScheduledDrugs?: boolean;
  notes?: string;
}

interface Props {
  data: BillData;
  mode: 'preview' | 'print';
  onClose: () => void;
  onConfirm?: () => void;
  isLoading?: boolean;
}

export default function BillDocument({ data, mode, onClose, onConfirm, isLoading }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContents = printRef.current?.innerHTML;
    if (!printContents) return;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill – ${data.billNumber || 'Preview'}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; }
            .bill-wrap { width: 100%; max-width: 720px; margin: 0 auto; padding: 24px; }

            /* Header */
            .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 12px; }
            .clinic-name { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
            .clinic-sub { font-size: 13px; font-weight: 600; color: #444; margin-top: 2px; }
            .clinic-meta { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
            .bill-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px; }

            /* Info grid */
            .info-row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 11.5px; }
            .info-box { width: 48%; }
            .info-box p { margin: 2px 0; }
            .info-label { color: #555; }
            .info-value { font-weight: 600; }

            /* Items table */
            .items-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11.5px; }
            .items-table th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; font-weight: 600; }
            .items-table td { border: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: top; }
            .items-table tr:nth-child(even) td { background: #fafafa; }
            .sub-tag { font-size: 10px; color: #2563eb; }

            /* Totals */
            .totals { width: 260px; margin-left: auto; font-size: 12px; margin-top: 4px; }
            .total-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
            .total-row.grand { border-top: 2px solid #111; border-bottom: none; font-weight: 700; font-size: 14px; padding-top: 6px; margin-top: 2px; }

            /* Payment */
            .payment-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 6px; }

            /* Scheduled drug notice */
            .schedule-notice { background: #fff7ed; border: 1px solid #fed7aa; padding: 8px 12px; border-radius: 6px; margin: 12px 0; font-size: 11px; color: #9a3412; }

            /* Footer */
            .footer { margin-top: 20px; border-top: 1px solid #d1d5db; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; }
            .sig-line { border-top: 1px solid #111; width: 140px; text-align: center; padding-top: 4px; margin-top: 28px; font-size: 10px; color: #555; }
            .thank-you { text-align: center; font-size: 11px; color: #666; margin-top: 14px; border-top: 1px dashed #ccc; padding-top: 10px; }

            /* Preview watermark */
            .preview-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.06); pointer-events: none; z-index: 0; text-transform: uppercase; white-space: nowrap; }

            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
              .bill-wrap { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${mode === 'preview' ? '<div class="preview-watermark">PREVIEW</div>' : ''}
          ${printContents}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  const isPreview = mode === 'preview';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 flex flex-col">

        {/* Modal header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isPreview ? 'bg-blue-50 border-blue-100' : 'bg-white'}`}>
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              {isPreview ? 'Bill Preview' : `Bill #${data.billNumber}`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isPreview
                ? 'Review the bill before confirming dispensing'
                : `Generated on ${data.date ? formatDateTime(data.date) : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isPreview && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Bill
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bill content */}
        <div className="overflow-y-auto max-h-[65vh] p-5">
          <div ref={printRef}>
            <div className="bill-wrap font-['Arial',sans-serif] text-[12px] text-gray-900 bg-white w-full">

              {/* Clinic header */}
              <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
                <p className="text-lg font-bold tracking-wide">{CLINIC.name}</p>
                <p className="text-sm font-semibold text-gray-600">{CLINIC.subname}</p>
                <p className="text-[11px] text-gray-500 mt-1 leading-5">
                  {CLINIC.address}<br />
                  Ph: {CLINIC.phone} &nbsp;|&nbsp; {CLINIC.email}<br />
                  {CLINIC.gstin} &nbsp;|&nbsp; {CLINIC.dl_no}
                </p>
                <p className="mt-2 text-sm font-bold uppercase tracking-widest text-gray-800">
                  {isPreview ? '— Bill Preview —' : 'Tax Invoice'}
                </p>
              </div>

              {/* Bill info + Patient info */}
              <div className="flex justify-between text-[11.5px] my-2.5">
                <div className="space-y-1">
                  <p><span className="text-gray-500">Bill No: </span>
                    <span className="font-semibold">{data.billNumber || <span className="italic text-gray-400">Will be assigned</span>}</span>
                  </p>
                  <p><span className="text-gray-500">Date: </span>
                    <span className="font-semibold">{data.date ? formatDateTime(data.date) : new Date().toLocaleString('en-IN')}</span>
                  </p>
                  {data.pharmacist && (
                    <p><span className="text-gray-500">Pharmacist: </span>
                      <span className="font-semibold">{data.pharmacist}</span>
                    </p>
                  )}
                  <p><span className="text-gray-500">Payment: </span>
                    <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase">{data.paymentMode}</span>
                  </p>
                </div>
                <div className="text-right space-y-1">
                  {data.patientName && (
                    <p><span className="text-gray-500">Patient: </span>
                      <span className="font-semibold">{data.patientName}</span>
                    </p>
                  )}
                  {data.doctorName && (
                    <p><span className="text-gray-500">Doctor: </span>
                      <span className="font-semibold">Dr. {data.doctorName}</span>
                    </p>
                  )}
                  {data.doctorRegNo && (
                    <p><span className="text-gray-500">Reg. No: </span>
                      <span className="font-semibold">{data.doctorRegNo}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Items table */}
              <table className="w-full border-collapse text-[11.5px] mt-3">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold w-6">#</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Medicine</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Batch</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Expiry</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold">Qty</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Rate (₹)</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold">GST%</th>
                    <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-500">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-1.5">
                        <p className="font-medium text-gray-900">{item.medicineName}</p>
                        {item.isSubstituted && (
                          <p className="text-[10px] text-blue-600">Substituted</p>
                        )}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-600 font-mono text-[10.5px]">
                        {item.batchNumber || '—'}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-600 text-[10.5px]">
                        {item.expiryDate ? formatDate(item.expiryDate) : '—'}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold">
                        {item.qty}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right">
                        {item.rate.toFixed(2)}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-600">
                        {item.gstPercent}%
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-right font-semibold">
                        {item.itemTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mt-3">
                <div className="w-64 text-[12px]">
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(data.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">GST</span>
                    <span>{formatCurrency(data.taxAmount)}</span>
                  </div>
                  {data.discountAmount > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-100 text-green-700">
                      <span>Discount</span>
                      <span>− {formatCurrency(data.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-[14px] mt-1">
                    <span>Net Total</span>
                    <span>{formatCurrency(data.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Scheduled drug notice */}
              {data.hasScheduledDrugs && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-[11px] text-orange-800">
                  <strong>Note:</strong> This bill contains Schedule H/H1/X drugs. Dispensed against valid prescription.
                  Patient compliance details recorded as per Drugs & Cosmetics Act.
                </div>
              )}

              {/* Footer */}
              <div className="mt-5 border-t border-gray-200 pt-3 flex justify-between items-end text-[11px] text-gray-500">
                <div>
                  <p>Items: {data.items.length} &nbsp;|&nbsp; Units: {data.items.reduce((s, i) => s + i.qty, 0)}</p>
                  {data.notes && <p className="mt-1">Note: {data.notes}</p>}
                </div>
                <div className="text-right">
                  <div className="border-t border-gray-800 w-36 text-center pt-1 mt-8 ml-auto">
                    Pharmacist Signature
                  </div>
                </div>
              </div>

              <div className="text-center mt-4 text-[11px] text-gray-400 border-t border-dashed border-gray-300 pt-3">
                Thank you for choosing MediSyn Specialty Clinic &nbsp;•&nbsp; Get well soon!<br />
                <span className="text-[10px]">This is a computer-generated bill</span>
              </div>

            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={`px-5 py-4 border-t flex gap-3 ${isPreview ? 'bg-blue-50 border-blue-100' : 'bg-gray-50'}`}>
          {isPreview ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                ← Edit Bill
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-2 flex-1 py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Processing...
                  </>
                ) : (
                  '✓ Confirm & Dispense'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-700 flex items-center justify-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print / Save as PDF
              </button>
              <button
                onClick={onClose}
                className="py-2.5 px-5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
