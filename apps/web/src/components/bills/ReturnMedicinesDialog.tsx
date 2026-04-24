'use client';
// ============================================================
// components/bills/ReturnMedicinesDialog.tsx
// ============================================================
// Drop-in dialog that handles the full patient return flow:
//   1. Load returnable items for a bill
//   2. Pharmacist selects which items + qty to return
//   3. Pick reason and return type (refund / store credit / exchange)
//   4. Submit → credit note created, stock restored automatically
//   5. Show printable credit note summary
//
// Usage:
//   <ReturnMedicinesDialog saleId={sale.id} billNumber={sale.bill_number} onClose={() => {}} />
// ============================================================

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;
const BRAND = '#00475a';

const REASONS = [
  { value: 'patient_return',   label: 'Patient return — no longer needed' },
  { value: 'dispensing_error', label: 'Dispensing error — wrong medicine/strength' },
  { value: 'wrong_quantity',   label: 'Wrong quantity dispensed' },
  { value: 'damaged',          label: 'Damaged / defective packaging' },
  { value: 'expired',          label: 'Near-expiry concern' },
  { value: 'other',            label: 'Other (specify in notes)' },
];

const RETURN_TYPES = [
  { value: 'refund',        label: 'Cash / UPI refund',   desc: 'Return money to patient' },
  { value: 'store_credit',  label: 'Store credit',        desc: 'Apply to next purchase' },
  { value: 'exchange',      label: 'Exchange',            desc: 'Replace with correct medicine' },
];

const REFUND_MODES = ['Cash', 'UPI', 'Bank Transfer'];

interface ReturnablItem {
  sale_item_id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  qty_sold: number;
  qty_already_returned: number;
  qty_returnable: number;
  rate: number;
  line_total: number;
}

export default function ReturnMedicinesDialog({
  saleId,
  billNumber,
  onClose,
  onSuccess,
}: {
  saleId: string;
  billNumber: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState<'items' | 'details' | 'done'>('items');
  const [items, setItems] = useState<ReturnablItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCN, setCreatedCN] = useState<any>(null);

  // Selected quantities per item
  const [selected, setSelected] = useState<Record<string, number>>({});

  // Return details
  const [reason, setReason] = useState('patient_return');
  const [reasonNotes, setReasonNotes] = useState('');
  const [returnType, setReturnType] = useState('refund');
  const [refundMode, setRefundMode] = useState('Cash');
  const [refundRef, setRefundRef] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/credit-notes/returnable/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load items');
      setItems(data.items || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [saleId, token]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const setQty = (id: string, qty: number, max: number) => {
    setSelected(s => ({ ...s, [id]: Math.min(Math.max(0, qty), max) }));
  };

  const selectedItems = items.filter(i => (selected[i.sale_item_id] || 0) > 0);
  const totalReturn = selectedItems.reduce(
    (s, i) => s + i.rate * (selected[i.sale_item_id] || 0), 0
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const dto = {
        original_sale_id: saleId,
        reason,
        reason_notes: reasonNotes || undefined,
        return_type: returnType,
        refund_mode: returnType === 'refund' ? refundMode : undefined,
        refund_reference: refundRef || undefined,
        items: selectedItems.map(i => ({
          sale_item_id: i.sale_item_id,
          qty_returned: selected[i.sale_item_id],
        })),
      };
      const res = await fetch(`${API}/credit-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(dto),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create credit note');
      setCreatedCN(data);
      setStep('done');
      onSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Done screen ────────────────────────────────────────────────────────
  if (step === 'done' && createdCN) {
    return (
      <div style={overlay}>
        <div style={{ ...modal, maxWidth: 480 }}>
          <div style={{ textAlign: 'center', padding: '1.5rem 1.5rem 1rem' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: BRAND }}>
              Credit note raised
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', margin: '8px 0 4px' }}>
              {createdCN.credit_note_number}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Against bill {createdCN.original_bill_number}
            </div>
          </div>

          <div style={{ margin: '0 1.5rem', background: '#f8fafc', borderRadius: 8, padding: '1rem' }}>
            <div style={row}><span style={label}>Total returned</span><span style={{ fontWeight: 500 }}>₹{parseFloat(createdCN.total_amount).toFixed(2)}</span></div>
            <div style={row}><span style={label}>Return type</span><span>{createdCN.return_type}</span></div>
            {createdCN.refund_mode && <div style={row}><span style={label}>Refund via</span><span>{createdCN.refund_mode}</span></div>}
            <div style={row}><span style={label}>Stock restored</span><span style={{ color: '#0f6e56' }}>Yes — automatically</span></div>
          </div>

          <div style={{ padding: '1rem 1.5rem 1.5rem', display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={secondaryBtn}>Print credit note</button>
            <button onClick={onClose} style={primaryBtn}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Items selection screen ─────────────────────────────────────────────
  if (step === 'items') {
    return (
      <div style={overlay}>
        <div style={modal}>
          {/* Header */}
          <div style={modalHeader}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1e293b' }}>Return medicines</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Bill {billNumber}</div>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              Loading returnable items...
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              No items available for return on this bill.
            </div>
          ) : (
            <>
              <div style={{ padding: '0 1.25rem', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                Select items and quantities to return
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '0 1.25rem' }}>
                {items.map(item => {
                  const qty = selected[item.sale_item_id] || 0;
                  const expiry = new Date(item.expiry_date);
                  const monthsLeft = Math.round((expiry.getTime() - Date.now()) / (1000*60*60*24*30));
                  return (
                    <div key={item.sale_item_id} style={{
                      border: qty > 0 ? `1.5px solid ${BRAND}` : '1px solid #e2e8f0',
                      borderRadius: 8, padding: '0.75rem', marginBottom: 8,
                      background: qty > 0 ? '#f0f9ff' : '#fff',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{item.medicine_name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                            Batch {item.batch_number} · Exp {item.expiry_date.slice(0,7)} ({monthsLeft}m)
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                            ₹{item.rate}/unit · Sold {item.qty_sold}
                            {item.qty_already_returned > 0 && ` · ${item.qty_already_returned} already returned`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                          <button
                            onClick={() => setQty(item.sale_item_id, qty - 1, item.qty_returnable)}
                            style={qtyBtn} disabled={qty === 0}
                          >−</button>
                          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                          <button
                            onClick={() => setQty(item.sale_item_id, qty + 1, item.qty_returnable)}
                            style={qtyBtn} disabled={qty >= item.qty_returnable}
                          >+</button>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>/ {item.qty_returnable}</span>
                        </div>
                      </div>
                      {qty > 0 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: BRAND, fontWeight: 500 }}>
                          Return value: ₹{(qty * item.rate).toFixed(2)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && <div style={errorBox}>{error}</div>}

              <div style={{ padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                  <span style={{ color: '#64748b' }}>Total to return</span>
                  <span style={{ fontWeight: 600, color: BRAND }}>₹{totalReturn.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={onClose} style={secondaryBtn}>Cancel</button>
                  <button
                    onClick={() => setStep('details')}
                    disabled={selectedItems.length === 0}
                    style={{ ...primaryBtn, opacity: selectedItems.length === 0 ? 0.4 : 1, cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Details screen ─────────────────────────────────────────────────────
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#1e293b' }}>Return details</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{selectedItems.length} item(s) · ₹{totalReturn.toFixed(2)}</div>
          </div>
          <button onClick={() => setStep('items')} style={closeBtn}>← Back</button>
        </div>

        <div style={{ padding: '0 1.25rem', maxHeight: 420, overflowY: 'auto' }}>
          {/* Selected items summary */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Returning</div>
            {selectedItems.map(i => (
              <div key={i.sale_item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '0.5px solid #f1f5f9' }}>
                <span>{i.medicine_name} × {selected[i.sale_item_id]}</span>
                <span style={{ color: BRAND, fontWeight: 500 }}>₹{(i.rate * selected[i.sale_item_id]).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabel}>Reason for return</div>
            <select style={inputStyle} value={reason} onChange={e => setReason(e.target.value)}>
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {(reason === 'other' || reason === 'dispensing_error') && (
            <div style={{ marginBottom: 12 }}>
              <div style={fieldLabel}>Details / notes</div>
              <input
                style={inputStyle}
                placeholder="Describe what happened..."
                value={reasonNotes}
                onChange={e => setReasonNotes(e.target.value)}
              />
            </div>
          )}

          {/* Return type */}
          <div style={{ marginBottom: 12 }}>
            <div style={fieldLabel}>How to settle</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RETURN_TYPES.map(rt => (
                <div
                  key={rt.value}
                  onClick={() => setReturnType(rt.value)}
                  style={{
                    flex: 1, minWidth: 120, border: returnType === rt.value ? `2px solid ${BRAND}` : '1px solid #e2e8f0',
                    borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                    background: returnType === rt.value ? '#f0f9ff' : '#fff',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#1e293b' }}>{rt.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{rt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {returnType === 'refund' && (
            <div style={{ marginBottom: 12 }}>
              <div style={fieldLabel}>Refund via</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {REFUND_MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => setRefundMode(m)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: 6, fontSize: 12,
                      border: refundMode === m ? `1.5px solid ${BRAND}` : '1px solid #e2e8f0',
                      background: refundMode === m ? '#f0f9ff' : '#fff',
                      cursor: 'pointer', color: '#1e293b',
                    }}
                  >{m}</button>
                ))}
              </div>
              {(refundMode === 'UPI' || refundMode === 'Bank Transfer') && (
                <input
                  style={{ ...inputStyle, marginTop: 8 }}
                  placeholder="Transaction / reference number"
                  value={refundRef}
                  onChange={e => setRefundRef(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        {error && <div style={{ ...errorBox, margin: '0 1.25rem' }}>{error}</div>}

        <div style={{ padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={() => setStep('items')} style={secondaryBtn}>Back</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Processing...' : `Confirm return — ₹${totalReturn.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};
const modalHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #f1f5f9',
};
const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 15,
};
const qtyBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0',
  background: '#f8fafc', cursor: 'pointer', fontSize: 16, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};
const primaryBtn: React.CSSProperties = {
  flex: 2, padding: '9px', background: '#00475a', border: 'none',
  borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '9px', background: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: 8, fontSize: 13, color: '#475569', cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0',
  borderRadius: 6, fontSize: 13, color: '#1e293b', background: '#f8fafc',
};
const fieldLabel: React.CSSProperties = {
  fontSize: 12, color: '#64748b', marginBottom: 6,
};
const errorBox: React.CSSProperties = {
  margin: '8px 0', padding: '8px 12px', background: '#fef2f2',
  border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, color: '#991b1b',
};
const row: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', padding: '5px 0',
  fontSize: 13, color: '#1e293b', borderBottom: '0.5px solid #e2e8f0',
};
const label: React.CSSProperties = { color: '#64748b' };
