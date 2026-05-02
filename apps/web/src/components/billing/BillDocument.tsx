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
      fontFamily: "'Arial Narrow', 'Arial', sans-serif",
      fontSize: '12px',
      lineHeight: '1.45',
      color: '#000',
      width: '100%',
      maxWidth: '540px', // A5 at 96dpi ≈ 148mm
      margin: '0 auto',
      padding: '0',
      background: '#fff',
    }}>
      {/* ── HEADER — exactly 3 lines ── */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
        <div style={{ fontWeight: '900', fontSize: '15px', letterSpacing: '0.5px' }}>MEDISYN SPECIALITY CLINIC</div>
        <div style={{ fontSize: '11px', marginTop: '2px' }}>Chirvakku, Taliparamba, Kannur - 670141</div>
        <div style={{ fontSize: '11px' }}>Ph: {clinicPhone} &nbsp;|&nbsp; GST: {clinicGST}</div>
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
            <th style={{ textAlign: 'left',  fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '18px' }}>SNo</th>
            <th style={{ textAlign: 'left',  fontSize: '11px', fontWeight: 'bold', padding: '3px 2px' }}>Particulars</th>
            <th style={{ textAlign: 'left',  fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '42px' }}>Mfg</th>
            <th style={{ textAlign: 'left',  fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '54px' }}>Batch</th>
            <th style={{ textAlign: 'center',fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '32px' }}>Exp</th>
            <th style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '24px' }}>Qty</th>
            <th style={{ textAlign: 'right', fontSize: '11px', fontWeight: 'bold', padding: '3px 2px', width: '50px' }}>Amt(₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: '1px dotted #999' }}>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '12px' }}>{i + 1}</td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '12px', fontWeight: '600', wordBreak: 'break-word', maxWidth: '90px' }}>
                {item.medicineName}
                {item.isSubstituted && <span style={{ fontSize: '9px', fontWeight: 'normal', color: '#555' }}> *sub</span>}
              </td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '11px', overflow: 'hidden', maxWidth: '42px' }}>
                {(item.manufacturer || '').substring(0, 8)}
              </td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '11px' }}>{item.batchNumber || ''}</td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '11px', textAlign: 'center' }}>{fmtExp(item.expiryDate)}</td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>{item.qty}</td>
              <td style={{ padding: '3px 2px', verticalAlign: 'top', fontSize: '12px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page { size: 80mm auto; margin: 3mm; }
        body > *:not(#medisyn-print-frame) { display: none !important; }
      }
    `;

    const printContent = printRef.current?.innerHTML || '';
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bill – ${data.billNumber || ''}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #fff; }
          @page { size: A5; margin: 8mm; }
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
              padding: '16px',
              borderRadius: '4px',
              boxShadow: '0 1px 8px rgba(0,0,0,0.12)',
              width: '540px',
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
