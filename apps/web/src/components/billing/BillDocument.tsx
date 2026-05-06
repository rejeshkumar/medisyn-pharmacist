'use client';
import React, { useRef } from 'react';
import { X, Printer, CheckCircle, Loader2 } from 'lucide-react';

// ─── Interfaces ────────────────────────────────────────────────────────────────
export interface BillItem {
  medicineName: string;
  manufacturer?: string;
  batchNumber?: string;
  expiryDate?: string;
  qty: number;
  rate: number;
  gstPercent?: number;
  itemTotal: number;
  isSubstituted?: boolean;
}

export interface BillData {
  billNumber?: string | number;
  date?: string;
  clinic?: { name?: string; address?: string; phone?: string; gst?: string; pan?: string; dl_no?: string; };
  patientName?: string;
  patientId?: string;
  doctorName?: string;
  doctorRegNo?: string;
  paymentMode?: string;
  items: BillItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  amountPaid?: number;
  hasScheduledDrugs?: boolean;
}

interface Props {
  data: BillData;
  mode: 'preview' | 'print';
  onClose: () => void;
  onConfirm?: () => void;
  isLoading?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtExp = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getMonth() + 1).padStart(2,'0')}/${String(dt.getFullYear()).slice(-2)}`;
};

const fmtDate = (d?: string) => {
  if (!d) return new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
};

const fmtTime = (d?: string) => {
  if (!d) return new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: false });
  return new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: false });
};

const n = (v?: number | null) => Number(v || 0);

// ─── Thermal Receipt Content ───────────────────────────────────────────────────
function ReceiptContent({ data }: { data: BillData }) {
  const roundOff = Math.round(n(data.totalAmount)) - n(data.totalAmount);
  const netTotal = Math.round(n(data.totalAmount));
  const amtPaid = n(data.amountPaid) || netTotal;
  const due = Math.max(0, netTotal - amtPaid);
  const payMode = (data.paymentMode || 'cash').toUpperCase().replace('_', '+');
  const clinic = data.clinic;

  const clinicName   = clinic?.name   || 'MEDISYN SPECIALITY CLINIC';
  const clinicAddr   = clinic?.address || 'TMC XVII-1260,1261,1264,1265, CHIRVAKKU JUNCTION, TALIPARAMBA, KANNUR KERALA PO 670141';
  const clinicPhone  = clinic?.phone  || '6282238880';
  const clinicGST    = clinic?.gst    || '32ACEFM2008C1Z1';
  const clinicPAN    = clinic?.pan    || 'ACEFM2008C';
  const clinicDL     = clinic?.dl_no  || 'RLF20KL2025003081 / RLF21KL2025003073';

  return (
    <div style={{
      fontFamily: "'Courier New', 'Courier', monospace",
      fontSize: '11px',
      lineHeight: '1.4',
      color: '#000',
      width: '100%',
      maxWidth: '100%',
      margin: '0',
      padding: '0',
      background: '#fff',
    }}>
      {/* ── HEADER — exactly 3 lines ── */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
        <div style={{ fontWeight: '900', fontSize: '13px', letterSpacing: '0.5px' }}>MEDISYN SPECIALITY CLINIC</div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>Chirvakku, Taliparamba, Kannur - 670141</div>
        <div style={{ fontSize: '10px' }}>Ph: {clinicPhone} | GST: {clinicGST}</div>
      </div>

      {/* ── BILL META ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '12px' }}>
        <div>
          {data.patientName && <div><b>Patient:</b> {data.patientName}</div>}
          {data.doctorName  && <div><b>Doctor:</b> Dr.{data.doctorName.replace(/^Dr\.?\s*/i,'')}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><b>Bill No:</b> {data.billNumber || '—'}</div>
          <div><b>Date:</b> {fmtDate(data.date)}</div>
          <div style={{ fontSize: '11px' }}>{fmtTime(data.date)}</div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #000', marginTop: '4px' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left',  fontSize: '10px', fontWeight: 'bold', padding: '2px 1px', width: '14px' }}>No</th>
            <th style={{ textAlign: 'left',  fontSize: '10px', fontWeight: 'bold', padding: '2px 1px' }}>Particulars</th>
            <th style={{ textAlign: 'left',  fontSize: '10px', fontWeight: 'bold', padding: '2px 1px', width: '36px' }}>Mfg</th>
            <th style={{ textAlign: 'left',  fontSize: '10px', fontWeight: 'bold', padding: '2px 1px', width: '44px' }}>Batch</th>
            <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold', padding: '2px 1px', width: '20px' }}>Qty</th>
            <th style={{ textAlign: 'right', fontSize: '10px', fontWeight: 'bold', padding: '2px 1px', width: '44px' }}>Amt(₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '10px' }}>{i + 1}</td>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '10px', fontWeight: '600', wordBreak: 'break-word' }}>
                {item.medicineName}
                {item.isSubstituted && <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#555' }}> *sub</span>}
              </td>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '9px', overflow: 'hidden' }}>
                {(item.manufacturer || '').substring(0, 6)}
              </td>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '9px' }}>{item.batchNumber || ''}</td>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '10px', fontWeight: '600', textAlign: 'right' }}>{item.qty}</td>
              <td style={{ padding: '2px 1px', verticalAlign: 'top', fontSize: '10px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {n(item.itemTotal).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── SUMMARY LINE ── */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '3px', paddingTop: '3px', fontSize: '11px', color: '#333' }}>
        Items: {data.items.length} &nbsp; Qty: {data.items.reduce((s,i)=>s+i.qty,0)} &nbsp;
        {data.hasScheduledDrugs && <span>Schedule H/X included. &nbsp;</span>}
        GST incl. in MRP.
      </div>

      {/* ── TOTALS ── */}
      <div style={{ borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px' }}>
        {n(data.subtotal) !== n(data.totalAmount) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Subtotal:</span><span>₹{n(data.subtotal).toFixed(2)}</span>
          </div>
        )}
        {n(data.taxAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>GST:</span><span>₹{n(data.taxAmount).toFixed(2)}</span>
          </div>
        )}
        {n(data.discountAmount) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Discount:</span><span>-₹{n(data.discountAmount).toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>Total Amt:</span><span>₹{n(data.totalAmount).toFixed(2)}</span>
        </div>
        {Math.abs(roundOff) >= 0.01 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Roundoff:</span><span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px solid #000', marginTop: '3px', paddingTop: '3px' }}>
          <span>Amount Paid:</span><span>₹{amtPaid.toFixed(2)}</span>
        </div>
        {due > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Due:</span><span>₹{due.toFixed(2)}</span>
          </div>
        )}
        <div style={{ fontSize: '11px', marginTop: '3px' }}>Payment: {payMode}</div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '4px', fontSize: '11px', textAlign: 'center', color: '#333' }}>
        Medicines once dispensed cannot be returned. Verify before leaving.
      </div>
      <div style={{ fontSize: '10px', textAlign: 'center', marginTop: '3px', color: '#555' }}>
        Thank you — MediSyn Speciality Clinic
      </div>
    </div>
  );
}

// ─── Print Styles (injected once) ─────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  @page { size: 80mm auto; margin: 4mm; }
  body > * { display: none !important; }
  #medisyn-print-root { display: block !important; }
  #medisyn-print-root * { visibility: visible; }
}
`;

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function BillDocument({ data, mode, onClose, onConfirm, isLoading }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const receiptEl = printRef.current?.querySelector('div') || printRef.current;
    const printContent = receiptEl?.outerHTML || printRef.current?.innerHTML || '';

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bill – ${data.billNumber || ''}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body { background: #fff; }
          body {
            width: 100%;
            margin: 0;
            padding: 6px 8px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
          }
          @page {
            size: 150mm 280mm;
            margin: 4mm 6mm;
          }
          body > div {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          table { width: 100% !important; border-collapse: collapse; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:w-auto sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh] shadow-2xl overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0 bg-white">
          <div>
            <p className="font-bold text-slate-800 text-sm">
              {mode === 'preview' ? 'Preview Bill' : `Bill #${data.billNumber}`}
            </p>
            {data.patientName && (
              <p className="text-xs text-slate-400">{data.patientName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Receipt Preview ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 flex justify-center">
          {/* Shadow-boxed receipt */}
          <div
            ref={printRef}
            style={{
              background: '#fff',
              padding: '12px',
              borderRadius: '4px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
              width: '100%',
              maxWidth: '560px',
              flexShrink: 0,
            }}
          >
            <ReceiptContent data={data} />
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white p-3 flex gap-2"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {mode === 'preview' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-[2] py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#003d4d] disabled:opacity-50 transition-colors"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><CheckCircle className="w-4 h-4" /> Confirm &amp; Save</>
                }
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="flex-[2] py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#003d4d] transition-colors"
              >
                <Printer className="w-4 h-4" /> Print Bill
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
