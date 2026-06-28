'use client';
import React, { useRef } from 'react';
import { X, Printer, CheckCircle, Loader2 } from 'lucide-react';

export interface ConsolidatedBillData {
  billNumber?: string | number;
  date?: string;
  clinic?: { name?: string; address?: string; phone?: string; gst?: string; pan?: string; dl_no?: string; };
  patientName?: string;
  doctorName?: string;
  tokenNumber?: number | string;
  visitType?: string;
  paymentMode?: string;
  // Clinic section
  clinicItems: Array<{ category: string; name: string; qty: number; unit_rate: number; gst_percent: number; }>;
  clinicSubtotal: number;
  // Pharmacy section
  pharmacyBillNumber?: string;
  pharmacyItems: Array<{ medicineName: string; batchNumber?: string; expiryDate?: string; qty: number; rate: number; itemTotal: number; isSubstituted?: boolean; }>;
  pharmacySubtotal: number;
  hasScheduledDrugs?: boolean;
  // Totals
  grossTotal: number;
  discountAmount?: number;
  discountNote?: string;
  totalAmount: number;
  amountPaid?: number;
}

interface Props {
  data: ConsolidatedBillData;
  mode: 'preview' | 'print';
  onClose: () => void;
  onConfirm?: () => void;
  isLoading?: boolean;
}

const fmtExp = (d?: string) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(-2)}`;
};
const fmtDate = (d?: string) =>
  new Date(d || Date.now()).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' });
const fmtTime = (d?: string) =>
  new Date(d || Date.now()).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false });
const n = (v?: number | null) => Number(v || 0);
const fmt = (v?: number | null) => n(v).toFixed(2);

function ReceiptContent({ data }: { data: ConsolidatedBillData }) {
  const roundOff = Math.round(n(data.totalAmount)) - n(data.totalAmount);
  const netTotal = Math.round(n(data.totalAmount));
  const amtPaid  = n(data.amountPaid) || netTotal;
  const due      = Math.max(0, netTotal - amtPaid);
  const payMode  = (data.paymentMode || 'cash').toUpperCase().replace('_', '+');
  const clinic   = data.clinic;

  const clinicName  = clinic?.name    || 'MEDISYN SPECIALITY CLINIC';
  const clinicAddr  = clinic?.address || 'TMC XVII-1260,1261,1264,1265, CHIRVAKKU JUNCTION, TALIPARAMBA, KANNUR KERALA PO 670141';
  const clinicPhone = clinic?.phone   || '6282238880';
  const clinicGST   = clinic?.gst     || '32ACEFM2008C1Z1';
  const clinicPAN   = clinic?.pan     || 'ACEFM2008C';
  const clinicDL    = clinic?.dl_no   || 'RLF20KL2025003081 / RLF21KL2025003073';

  const S: React.CSSProperties = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '11px', lineHeight: '1.45', color: '#000',
    width: '100%', background: '#fff',
  };

  const thStyle = (right?: boolean): React.CSSProperties => ({
    textAlign: right ? 'right' : 'left',
    fontSize: '9.5px', fontWeight: 'bold', padding: '2px 1px',
  });
  const tdStyle = (right?: boolean, small?: boolean): React.CSSProperties => ({
    textAlign: right ? 'right' : 'left',
    fontSize: small ? '9px' : '10px',
    padding: '2px 1px', verticalAlign: 'top',
    borderBottom: '1px dotted #ccc',
  });

  return (
    <div style={S}>
      {/* HEADER */}
      <div style={{ textAlign:'center', borderBottom:'1px dashed #000', paddingBottom:'7px', marginBottom:'7px' }}>
        <div style={{ fontWeight:'900', fontSize:'14px', letterSpacing:'0.5px' }}>{clinicName}</div>
        <div style={{ fontSize:'9.5px', marginTop:'1px' }}>{clinicAddr}</div>
        <div style={{ fontSize:'9.5px' }}>Ph: {clinicPhone}</div>
        {clinicGST && <div style={{ fontSize:'9.5px' }}>GST: {clinicGST} | PAN: {clinicPAN}</div>}
        {clinicDL  && <div style={{ fontSize:'9.5px' }}>DL: {clinicDL}</div>}
        <div style={{ marginTop:'4px' }}>
          <span style={{ fontSize:'9px', border:'0.5px solid #000', padding:'1px 6px', letterSpacing:'0.3px' }}>
            CONSOLIDATED PATIENT BILL
          </span>
        </div>
      </div>

      {/* BILL META */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', fontSize:'11px' }}>
        <div>
          {data.patientName && <div><b>Patient:</b> {data.patientName}</div>}
          {data.doctorName  && <div><b>Doctor:</b> Dr.{data.doctorName.replace(/^Dr\.?\s*/i,'')}</div>}
          {data.tokenNumber && <div><b>Token:</b> #{data.tokenNumber} &nbsp; Visit: {(data.visitType||'new').replace(/_/g,' ')}</div>}
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div><b>Bill No:</b> {data.billNumber || '—'}</div>
          <div><b>Date:</b> {fmtDate(data.date)}</div>
          <div><b>Time:</b> {fmtTime(data.date)}</div>
          {data.pharmacyBillNumber && <div><b>Ref:</b> {data.pharmacyBillNumber}</div>}
        </div>
      </div>

      <div style={{ borderTop:'1px solid #000', marginBottom:'4px' }} />

      {/* CLINIC SECTION */}
      {data.clinicItems.length > 0 && (
        <>
          <div style={{ marginBottom:'3px' }}>
            <span style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'0.8px', textTransform:'uppercase', background:'#000', color:'#fff', padding:'1px 5px' }}>
              Clinic Charges
            </span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px dashed #000', borderTop:'1px solid #000' }}>
                <th style={thStyle()}>#</th>
                <th style={thStyle()}>Particulars</th>
                <th style={{ ...thStyle(true), width:'20px' }}>Qty</th>
                <th style={{ ...thStyle(true), width:'52px' }}>Rate(₹)</th>
                <th style={{ ...thStyle(true), width:'52px' }}>Amt(₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.clinicItems.map((it, i) => (
                <tr key={i}>
                  <td style={tdStyle()}>{i+1}</td>
                  <td style={{ ...tdStyle(), fontWeight:'600', wordBreak:'break-word' }}>
                    {it.name}
                    {it.gst_percent > 0 && <span style={{ fontSize:'9px', fontWeight:'normal', color:'#555' }}> (GST {it.gst_percent}%)</span>}
                  </td>
                  <td style={{ ...tdStyle(true), fontWeight:'600' }}>{it.qty}</td>
                  <td style={{ ...tdStyle(true) }}>₹{fmt(it.unit_rate)}</td>
                  <td style={{ ...tdStyle(true), fontWeight:'600' }}>₹{fmt(it.unit_rate * it.qty * (1 + it.gst_percent/100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop:'1px dashed #000', margin:'3px 0', display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
            <span>Clinic subtotal</span><span>₹{fmt(data.clinicSubtotal)}</span>
          </div>
        </>
      )}

      {/* PHARMACY SECTION */}
      {data.pharmacyItems.length > 0 && (
        <>
          <div style={{ margin:'5px 0 3px' }}>
            <span style={{ fontSize:'9px', fontWeight:'700', letterSpacing:'0.8px', textTransform:'uppercase', background:'#000', color:'#fff', padding:'1px 5px' }}>
              Pharmacy{data.pharmacyBillNumber ? ` — ${data.pharmacyBillNumber}` : ''}
            </span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px dashed #000', borderTop:'1px solid #000' }}>
                <th style={thStyle()}>#</th>
                <th style={thStyle()}>Medicine</th>
                <th style={{ ...thStyle(), width:'40px', fontSize:'9px' }}>Batch</th>
                <th style={{ ...thStyle(), width:'28px', fontSize:'9px' }}>Exp</th>
                <th style={{ ...thStyle(true), width:'20px' }}>Qty</th>
                <th style={{ ...thStyle(true), width:'52px' }}>Amt(₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.pharmacyItems.map((it, i) => (
                <tr key={i}>
                  <td style={tdStyle()}>{i+1}</td>
                  <td style={{ ...tdStyle(), fontWeight:'600', wordBreak:'break-word' }}>
                    {it.medicineName}
                    {it.isSubstituted && <span style={{ fontSize:'9px', fontWeight:'normal', color:'#555' }}> *sub</span>}
                  </td>
                  <td style={tdStyle(false, true)}>{it.batchNumber || ''}</td>
                  <td style={tdStyle(false, true)}>{fmtExp(it.expiryDate)}</td>
                  <td style={{ ...tdStyle(true), fontWeight:'600' }}>{it.qty}</td>
                  <td style={{ ...tdStyle(true), fontWeight:'600' }}>₹{fmt(it.itemTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop:'1px dashed #000', margin:'3px 0', fontSize:'10.5px', color:'#333' }}>
            Medicines: {data.pharmacyItems.length} &nbsp;|&nbsp;
            Qty: {data.pharmacyItems.reduce((s,i)=>s+i.qty,0)} &nbsp;|&nbsp;
            {data.hasScheduledDrugs && 'Schedule H/X incl. '} GST incl. in MRP.
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
            <span>Pharmacy subtotal</span><span>₹{fmt(data.pharmacySubtotal)}</span>
          </div>
        </>
      )}

      {/* GRAND TOTALS */}
      <div style={{ borderTop:'1px solid #000', marginTop:'4px', paddingTop:'4px' }}>
        {data.clinicItems.length > 0 && data.pharmacyItems.length > 0 && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
              <span>Clinic charges</span><span>₹{fmt(data.clinicSubtotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
              <span>Pharmacy charges</span><span>₹{fmt(data.pharmacySubtotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
              <span>Gross total</span><span>₹{fmt(data.grossTotal)}</span>
            </div>
          </>
        )}
        {n(data.discountAmount) > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
            <span>Discount{data.discountNote ? ` (${data.discountNote})` : ''}</span>
            <span>-₹{fmt(data.discountAmount)}</span>
          </div>
        )}
        {Math.abs(roundOff) >= 0.01 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'2px' }}>
            <span>Roundoff</span><span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'900', fontSize:'14px', borderTop:'1px solid #000', marginTop:'3px', paddingTop:'3px' }}>
          <span>AMOUNT PAID</span><span>₹{amtPaid.toFixed(2)}</span>
        </div>
        {due > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
            <span>Due</span><span>₹{due.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* PAYMENT MODE */}
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginTop:'4px' }}>
        <span><b>Mode:</b> {payMode}</span>
        <span><b>Status:</b> PAID ✓</span>
      </div>

      {/* COMPLIANCE NOTICE */}
      <div style={{ fontSize:'9px', color:'#555', border:'0.5px dashed #888', padding:'3px 5px', marginTop:'5px', textAlign:'center' }}>
        {data.hasScheduledDrugs && <>⚠ Schedule H/X drug(s) dispensed on valid prescription.<br/></>}
        Pharmacy billed under DL: {clinicDL.split('/')[0].trim()}.<br/>
        Clinic billed under GST: {clinicGST}.
      </div>

      {/* FOOTER */}
      <div style={{ borderTop:'1px dashed #000', marginTop:'8px', paddingTop:'6px' }}>
        <div style={{ textAlign:'center', fontSize:'10px', fontWeight:'700', letterSpacing:'0.3px' }}>
          Thank you for choosing {clinicName}
        </div>
        <div style={{ textAlign:'center', fontSize:'9px', color:'#555', marginTop:'2px' }}>
          Ph: {clinicPhone} &nbsp;|&nbsp; privacy@simplirx.co.in
        </div>
        <div style={{ textAlign:'center', fontSize:'9px', color:'#555', marginTop:'1px' }}>
          Powered by SimpliRx &nbsp;·&nbsp; simplirx.co.in
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:'20px' }}>
          <div style={{ textAlign:'center', fontSize:'9.5px' }}>
            <div style={{ borderTop:'0.5px solid #000', paddingTop:'2px', marginTop:'16px', minWidth:'80px' }}>RECEPTIONIST SIGN</div>
          </div>
          <div style={{ textAlign:'center', fontSize:'9.5px' }}>
            <div style={{ borderTop:'0.5px solid #000', paddingTop:'2px', marginTop:'16px', minWidth:'80px' }}>PHARMACIST SIGN</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConsolidatedBillDocument({ data, mode, onClose, onConfirm, isLoading }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const billHtml = printRef.current?.innerHTML;
    if (!billHtml) return;
    const stale = document.getElementById('medisyn-cons-print-frame');
    if (stale) stale.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'medisyn-cons-print-frame';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Consolidated Bill</title>
<style>
  @page { size: 241mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { padding: 3mm; width: 108mm; font-family: 'Courier New', Courier, monospace; }
  @media print { html, body { width: 241mm; } }
</style></head><body>${billHtml}</body></html>`);
    doc.close();
    const triggerPrint = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      catch(e) { console.error(e); }
      finally { setTimeout(() => iframe.remove(), 2000); }
    };
    if (doc.readyState === 'complete') setTimeout(triggerPrint, 100);
    else { iframe.addEventListener('load', triggerPrint, { once:true }); setTimeout(triggerPrint, 500); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:w-auto sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[92vh] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0 bg-white">
          <div>
            <p className="font-bold text-slate-800 text-sm">
              {mode === 'preview' ? 'Preview Consolidated Bill' : `Bill #${data.billNumber}`}
            </p>
            {data.patientName && <p className="text-xs text-slate-400">{data.patientName}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 flex justify-center">
          <div ref={printRef} style={{ background:'#fff', padding:'12px', borderRadius:'4px', boxShadow:'0 1px 8px rgba(0,0,0,0.12)', width:'100%', maxWidth:'560px', flexShrink:0 }}>
            <ReceiptContent data={data} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-slate-100 bg-white p-3 flex gap-2"
          style={{ paddingBottom:'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {mode === 'preview' ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                Back
              </button>
              <button onClick={onConfirm} disabled={isLoading}
                className="flex-[2] py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#003d4d] disabled:opacity-50">
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin"/>Processing…</>
                  : <><CheckCircle className="w-4 h-4"/>Confirm &amp; Save</>}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose}
                className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50">
                Close
              </button>
              <button onClick={handlePrint}
                className="flex-[2] py-3 bg-[#00475a] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#003d4d]">
                <Printer className="w-4 h-4"/> Print Consolidated Bill
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
