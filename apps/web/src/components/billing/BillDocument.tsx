'use client';

import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';

// ── Fallback clinic details (used if tenant data not available) ──────────────
const CLINIC_FALLBACK = {
  name: 'MEDISYN SPECIALITY CLINIC',
  address: 'TMC XVII-1260,1261,1264,1265, CHIRVAKKU JUNCTION, TALIPARAMBA, KANNUR KERALA, PO 670141',
  phone: '6282208880',
  landline: '04602 220880',
  email: 'pharmacy@medisyn.in',
  gstin: '32ACEFM2008C1Z1',
  pan: 'ACEFM2008C',
  dl_numbers: 'RLF20KL2025003081 / RLF21KL2025003073',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BillItem {
  medicineName: string;
  manufacturer?: string;
  batchNumber?: string;
  expiryDate?: string;
  qty: number;
  rate: number;
  gstPercent: number;
  itemTotal: number;
  isSubstituted?: boolean;
}

export interface ClinicInfo {
  name: string;
  address?: string;
  phone?: string;
  landline?: string;
  email?: string;
  gstin?: string;
  pan?: string;
  dl_numbers?: string;
  logo_url?: string;
}

export interface BillData {
  billNumber?: string;
  clinic?: ClinicInfo;
  date?: Date | string;
  pharmacist?: string;
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  doctorRegNo?: string;
  paymentMode: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  hasScheduledDrugs?: boolean;
  amountPaid?: number;
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
  const CLINIC = data.clinic || CLINIC_FALLBACK;

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
            <div style={{fontFamily:'Arial,sans-serif', fontSize:'12px', color:'#111', background:'#fff', width:'100%', maxWidth:'680px', margin:'0 auto'}}>

              {/* ── Clinic Header ── */}
              <div style={{textAlign:'center', borderBottom:'2px solid #111', paddingBottom:'10px', marginBottom:'8px'}}>
                <p style={{fontSize:'18px', fontWeight:'700', letterSpacing:'0.5px'}}>{CLINIC.name}</p>
                <p style={{fontSize:'11px', color:'#333', marginTop:'3px', lineHeight:'1.7'}}>
                  {CLINIC.address}<br/>
                  {CLINIC.phone && <>Ph: {CLINIC.phone}</>}
                  {CLINIC.landline && <> &nbsp;|&nbsp; Land: {CLINIC.landline}</>}
                  {CLINIC.email && <> &nbsp;|&nbsp; {CLINIC.email}<br/></>}
                  {CLINIC.gstin && <>GST: {CLINIC.gstin}</>}
                  {CLINIC.pan && <> &nbsp;&nbsp; PAN: {CLINIC.pan}</>}
                  {CLINIC.dl_numbers && <><br/>DL NO: {CLINIC.dl_numbers}</>}
                </p>
              </div>

              {/* ── Patient + Bill Info ── */}
              <div style={{borderBottom:'1px dashed #555', paddingBottom:'6px', marginBottom:'6px', fontSize:'11.5px'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <div>
                    {data.patientName && <p><strong>Patient: {data.patientName}</strong></p>}
                    {data.doctorName && <p>Doctor: Dr. {data.doctorName}</p>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <p><strong>Bill No: {data.billNumber || 'Preview'}</strong></p>
                    <p>Date: {data.date ? formatDate(data.date) : new Date().toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
              </div>

              {/* ── Items Table ── */}
              <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px', marginBottom:'4px'}}>
                <thead>
                  <tr style={{borderTop:'1px solid #111', borderBottom:'1px solid #111'}}>
                    <th style={{padding:'4px 4px', textAlign:'left', fontWeight:'600', width:'28px'}}>SNo</th>
                    <th style={{padding:'4px 4px', textAlign:'left', fontWeight:'600'}}>Particulars</th>
                    <th style={{padding:'4px 4px', textAlign:'left', fontWeight:'600'}}>Mfg</th>
                    <th style={{padding:'4px 4px', textAlign:'left', fontWeight:'600'}}>Batch</th>
                    <th style={{padding:'4px 4px', textAlign:'left', fontWeight:'600', width:'60px'}}>Exp</th>
                    <th style={{padding:'4px 4px', textAlign:'center', fontWeight:'600', width:'32px'}}>Qty</th>
                    <th style={{padding:'4px 4px', textAlign:'right', fontWeight:'600', width:'80px'}}>Amount(INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} style={{borderBottom:'1px dashed #ddd'}}>
                      <td style={{padding:'4px 4px', color:'#555'}}>{i + 1}</td>
                      <td style={{padding:'4px 4px'}}>
                        <span style={{fontWeight:'600'}}>{item.medicineName}</span>
                        {item.isSubstituted && <span style={{fontSize:'10px', color:'#2563eb', display:'block'}}>Substituted</span>}
                      </td>
                      <td style={{padding:'4px 4px', color:'#555', fontSize:'10.5px'}}>{item.manufacturer || '—'}</td>
                      <td style={{padding:'4px 4px', color:'#555', fontSize:'10.5px', fontFamily:'monospace'}}>{item.batchNumber || '—'}</td>
                      <td style={{padding:'4px 4px', color:'#555', fontSize:'10.5px'}}>{item.expiryDate ? formatDate(item.expiryDate) : '—'}</td>
                      <td style={{padding:'4px 4px', textAlign:'center', fontWeight:'600'}}>{item.qty}</td>
                      <td style={{padding:'4px 4px', textAlign:'right', fontWeight:'600'}}>{item.itemTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Totals ── */}
              <div style={{borderTop:'1px solid #111', paddingTop:'6px', fontSize:'11.5px'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'3px'}}>
                  <span>Items: {data.items.length} &nbsp;&nbsp; Qty: {data.items.reduce((s, i) => s + i.qty, 0)}</span>
                </div>
                {data.taxAmount > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2px'}}>
                    <span>GST Amount:</span><span>{formatCurrency(data.taxAmount)}</span>
                  </div>
                )}
                {data.discountAmount > 0 && (
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'2px', color:'#16a34a'}}>
                    <span>Discount:</span><span>− {formatCurrency(data.discountAmount)}</span>
                  </div>
                )}
                <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px solid #111', paddingTop:'4px', fontWeight:'700', fontSize:'13px', marginTop:'4px'}}>
                  <span>Total Amt:</span><span>{formatCurrency(data.totalAmount)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', borderTop:'1px dashed #aaa', paddingTop:'3px', marginTop:'3px'}}>
                  <span>Amount Paid:</span>
                  <span style={{fontWeight:'600'}}>{formatCurrency((data as any).amountPaid ?? data.totalAmount)}</span>
                </div>
                {(data as any).amountPaid !== undefined && (data as any).amountPaid < data.totalAmount - 0.5 && (
                  <div style={{display:'flex', justifyContent:'space-between', color:'#dc2626', fontWeight:'700', marginTop:'2px'}}>
                    <span>Balance Due:</span><span>{formatCurrency(data.totalAmount - (data as any).amountPaid)}</span>
                  </div>
                )}
                <div style={{marginTop:'4px', fontSize:'10.5px', color:'#555'}}>
                  Payment: <strong style={{textTransform:'uppercase'}}>{data.paymentMode}</strong>
                </div>
              </div>

              {/* ── Schedule H notice ── */}
              {data.hasScheduledDrugs && (
                <div style={{marginTop:'8px', background:'#fff7ed', border:'1px solid #fed7aa', padding:'6px 10px', fontSize:'10px', color:'#9a3412', borderRadius:'4px'}}>
                  <strong>Note:</strong> Contains Schedule H/H1/X drugs. Dispensed against valid prescription per Drugs & Cosmetics Act.
                </div>
              )}

              {/* ── Footer ── */}
              <div style={{marginTop:'20px', borderTop:'1px dashed #aaa', paddingTop:'8px', display:'flex', justifyContent:'space-between', alignItems:'flex-end', fontSize:'10px', color:'#555'}}>
                <div style={{flex:1}}>
                  {data.notes && <p style={{marginBottom:'4px'}}>Note: {data.notes}</p>}
                  <p>Disclaimer: Medicines once dispensed cannot be returned or exchanged. Please verify medicines at time of purchase. Keep medicines out of reach of children. Store as per label instructions.</p>
                </div>
                <div style={{textAlign:'center', marginLeft:'20px', flexShrink:0}}>
                  <div style={{borderTop:'1px solid #111', width:'130px', paddingTop:'3px', marginTop:'36px', fontSize:'10px', textAlign:'center'}}>
                    PHARMACIST SIGN
                  </div>
                </div>
              </div>

              <div style={{textAlign:'center', marginTop:'10px', borderTop:'1px dashed #ccc', paddingTop:'8px', fontSize:'10px', color:'#888'}}>
                Thank you for choosing MediSyn Specialty Clinic • Get well soon!<br/>
                This is a computer-generated bill | Powered by MediSyn
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
