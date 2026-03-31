// BillDocument.tsx — MediSyn 80mm Thermal Bill
// Drop this file into: apps/web/src/components/billing/BillDocument.tsx
// Usage: <BillDocument bill={billData} onPrint={() => window.print()} />

import React from 'react';

interface BillItem {
  sno: number;
  medicineName: string;
  manufacturer?: string;
  batchNo?: string;
  expiry?: string;
  qty: number;
  mrp?: number;
  rate?: number;
  amount: number;
  scheduleClass?: string; // 'H' | 'H1' | 'X' | 'OTC'
}

interface BillData {
  billNo: string | number;
  date: string;
  time?: string;
  patientName?: string;
  patientPhone?: string;
  doctorName?: string;
  items: BillItem[];
  subtotal: number;
  discount?: number;
  roundoff?: number;
  amountPaid: number;
  paymentMode?: string; // 'Cash' | 'UPI' | 'Card' | 'Credit'
  dueAmount?: number;
}

interface Props {
  bill: BillData;
  onPrint?: () => void;
}

const CLINIC = {
  name: 'MEDISYN SPECIALITY CLINIC',
  address: 'TMC XVII-1260,1261,1264,1265,',
  address2: 'CHIRVAKKU JUNCTION, TALIPARAMBA,',
  address3: 'KANNUR KERALA, PO 670141',
  gstin: '32ACEFM2008C1Z1',
  pan: 'ACEFM2008C',
  dl1: 'RLF20KL2025003081',
  dl2: 'RLF21KL2025003073',
  phone: '6282208880',
};

// ── Inline styles (thermal-safe, no Tailwind needed for print) ────────────
const S: Record<string, React.CSSProperties> = {
  wrapper: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '9px',
    lineHeight: '1.45',
    color: '#111',
    width: '276px', // 80mm - 6mm padding
    padding: '6px 8px',
    background: 'white',
  },
  clinicName: {
    fontSize: '13px',
    fontWeight: 900,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    marginBottom: '2px',
  },
  clinicAddr: {
    textAlign: 'center',
    fontSize: '8px',
    lineHeight: 1.55,
    color: '#333',
  },
  dashed: {
    borderTop: '1px dashed #888',
    margin: '5px 0',
  },
  dotted: {
    borderTop: '1px dotted #aaa',
    margin: '3px 0',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '8.5px',
    lineHeight: 1.65,
  },
  metaRight: {
    textAlign: 'right',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '8.5px',
    margin: '3px 0',
  },
  th: {
    textAlign: 'left',
    padding: '1px 2px',
    fontWeight: 700,
    borderTop: '1px solid #555',
    borderBottom: '1px solid #555',
    whiteSpace: 'nowrap' as const,
  },
  td: {
    padding: '2px 2px',
    verticalAlign: 'top',
  },
  itemName: {
    fontWeight: 700,
    fontSize: '9px',
  },
  itemSub: {
    fontSize: '7.5px',
    color: '#444',
  },
  totalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1px 0',
    fontSize: '9px',
  },
  totalsRowBold: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1px 0',
    fontSize: '10px',
    fontWeight: 700,
  },
  totalsRowPaid: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 0',
    fontSize: '11px',
    fontWeight: 900,
    borderTop: '1px solid #333',
    borderBottom: '2px solid #333',
    marginTop: '2px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '8px',
    color: '#555',
    marginTop: '2px',
  },
  footer: {
    textAlign: 'center',
    fontSize: '8px',
    color: '#555',
    lineHeight: 1.65,
    marginTop: '6px',
  },
  footerTagline: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#222',
  },
  scheduleNote: {
    textAlign: 'center',
    fontSize: '7.5px',
    color: '#333',
    margin: '3px 0',
  },
};

function fmt(n: number) {
  return n.toFixed(2);
}

export function BillDocument({ bill, onPrint }: Props) {
  const totalQty = bill.items.reduce((s, i) => s + i.qty, 0);
  const hasScheduleH = bill.items.some(
    (i) => i.scheduleClass && ['H', 'H1', 'X'].includes(i.scheduleClass),
  );
  const nettAmt = bill.subtotal - (bill.discount || 0);
  const roundoff = bill.roundoff || 0;

  return (
    <>
      {/* ── Screen print button (hidden when printing) ── */}
      {onPrint && (
        <div className="no-print" style={{ marginBottom: 12, textAlign: 'center' }}>
          <button
            onClick={onPrint}
            style={{
              background: '#00475a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 28px',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🖨️ Print Bill
          </button>
        </div>
      )}

      {/* ── The Bill ── */}
      <div id="medisyn-bill" style={S.wrapper}>

        {/* HEADER */}
        <div style={S.clinicName}>{CLINIC.name}</div>
        <div style={S.clinicAddr}>
          {CLINIC.address}<br />
          {CLINIC.address2}<br />
          {CLINIC.address3}<br />
          GST: {CLINIC.gstin} | PAN: {CLINIC.pan}<br />
          DL: {CLINIC.dl1}<br />
          &nbsp;&nbsp;&nbsp;{CLINIC.dl2}<br />
          Ph: {CLINIC.phone}
        </div>

        <div style={S.dashed} />

        {/* PATIENT + BILL META */}
        <div style={S.metaRow}>
          <div>
            {bill.patientName && <div><b>Patient:</b> {bill.patientName}</div>}
            {bill.doctorName  && <div><b>Doctor:</b> {bill.doctorName}</div>}
            {bill.patientPhone && <div><b>Ph:</b> {bill.patientPhone}</div>}
          </div>
          <div style={S.metaRight}>
            <div><b>Bill No:</b> {bill.billNo}</div>
            <div><b>Date:</b> {bill.date}</div>
            {bill.time && <div><b>Time:</b> {bill.time}</div>}
          </div>
        </div>

        <div style={S.dashed} />

        {/* ITEMS TABLE */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: 14 }}>#</th>
              <th style={S.th}>Particulars</th>
              <th style={{ ...S.th, textAlign: 'center', width: 28 }}>Qty</th>
              <th style={{ ...S.th, textAlign: 'right', width: 48 }}>Amt(₹)</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((item, idx) => (
              <tr
                key={idx}
                style={idx === bill.items.length - 1
                  ? { borderBottom: '1px solid #555' }
                  : {}}
              >
                <td style={{ ...S.td, paddingTop: 3 }}>{item.sno}</td>
                <td style={S.td}>
                  <div style={S.itemName}>{item.medicineName}</div>
                  <div style={S.itemSub}>
                    {[
                      item.manufacturer && `Mfg:${item.manufacturer}`,
                      item.batchNo      && `Bt:${item.batchNo}`,
                      item.expiry       && `Exp:${item.expiry}`,
                    ]
                      .filter(Boolean)
                      .join(' | ')}
                  </div>
                  {item.scheduleClass && item.scheduleClass !== 'OTC' && (
                    <div style={{ ...S.itemSub, color: '#a00' }}>
                      ℞ Schedule {item.scheduleClass}
                    </div>
                  )}
                </td>
                <td style={{ ...S.td, textAlign: 'center', paddingTop: 3 }}>
                  {item.qty}
                </td>
                <td style={{ ...S.td, textAlign: 'right', paddingTop: 3 }}>
                  {fmt(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* SUMMARY */}
        <div style={S.summaryRow}>
          <span>Items: {bill.items.length} &nbsp;|&nbsp; Qty: {totalQty}</span>
        </div>

        <div style={S.dotted} />

        {/* TOTALS */}
        <div>
          <div style={S.totalsRow}>
            <span>Total Amt:</span>
            <span>₹{fmt(bill.subtotal)}</span>
          </div>

          {(bill.discount ?? 0) > 0 && (
            <div style={S.totalsRow}>
              <span>Discount:</span>
              <span>₹{fmt(bill.discount!)}</span>
            </div>
          )}

          <div style={S.totalsRowBold}>
            <span>Nett Amt:</span>
            <span>₹{fmt(nettAmt)}</span>
          </div>

          {roundoff !== 0 && (
            <div style={S.totalsRow}>
              <span>Roundoff:</span>
              <span>{roundoff < 0 ? '-' : '+'}₹{Math.abs(roundoff).toFixed(2)}</span>
            </div>
          )}

          <div style={S.totalsRowPaid}>
            <span>Amount Paid:</span>
            <span>₹{fmt(bill.amountPaid)}</span>
          </div>

          {(bill.dueAmount ?? 0) > 0 && (
            <div style={{ ...S.totalsRow, color: '#c00', fontWeight: 700 }}>
              <span>Balance Due:</span>
              <span>₹{fmt(bill.dueAmount!)}</span>
            </div>
          )}
        </div>

        {/* PAYMENT MODE */}
        {bill.paymentMode && (
          <div style={S.summaryRow}>
            <span>Payment Mode:</span>
            <span>{bill.paymentMode}</span>
          </div>
        )}

        <div style={S.dashed} />

        {/* SCHEDULE H NOTE */}
        {hasScheduleH && (
          <div style={S.scheduleNote}>
            ⚠ Dispensed on valid prescription (Sch H/H1)<br />
            <div style={S.dotted} />
          </div>
        )}

        {/* FOOTER */}
        <div style={S.footer}>
          <div style={S.footerTagline}>Thank you for choosing MediSyn!</div>
          Goods sold are not returnable.<br />
          All disputes subject to Taliparamba jurisdiction.<br />
          <div style={{ marginTop: 4, fontSize: '7.5px', color: '#999' }}>
            Powered by MediSyn Speciality Clinic Platform
          </div>
        </div>

      </div>

      {/* Print CSS — injected globally once */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #medisyn-bill, #medisyn-bill * { visibility: visible; }
          #medisyn-bill {
            position: absolute;
            left: 0; top: 0;
            width: 80mm !important;
            padding: 2mm 3mm !important;
          }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </>
  );
}

export default BillDocument;

// ── USAGE EXAMPLE ────────────────────────────────────────────────────────────
//
// import { BillDocument } from '@/components/billing/BillDocument';
//
// <BillDocument
//   bill={{
//     billNo: sale.bill_number,
//     date: new Date(sale.created_at).toLocaleDateString('en-IN'),
//     time: new Date(sale.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
//     patientName: sale.customer_name,
//     doctorName: sale.doctor_name,
//     items: sale.items.map((item, i) => ({
//       sno: i + 1,
//       medicineName: item.medicine?.brand_name,
//       manufacturer: item.medicine?.manufacturer,
//       batchNo: item.batch?.batch_number,
//       expiry: item.batch?.expiry_date
//         ? new Date(item.batch.expiry_date).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })
//         : undefined,
//       qty: item.quantity,
//       amount: item.total_amount,
//       scheduleClass: item.medicine?.schedule_class,
//     })),
//     subtotal: sale.total_amount,
//     discount: sale.discount_amount,
//     roundoff: sale.roundoff,
//     amountPaid: sale.amount_paid,
//     dueAmount: sale.due_amount,
//     paymentMode: sale.payment_mode,
//   }}
//   onPrint={() => window.print()}
// />
