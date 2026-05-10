'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';

// ── A5 Prescription Print Page ──────────────────────────────
// Route: /reports/prescription?id=<consultationId>
// Opens in new tab → receptionist clicks Print (Ctrl+P)
// Print settings: A5, no margins, portrait
// Future: server-side PDF generation for WhatsApp/email

export default function PrescriptionPrintPage() {
  const searchParams = useSearchParams();
  const consultationId = searchParams.get('id');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!consultationId) { setError('No consultation ID'); setLoading(false); return; }
    api.get(`/reports/prescription/${consultationId}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { setError('Failed to load'); setLoading(false); });
  }, [consultationId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial' }}>Loading prescription...</div>;
  if (error || !data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Arial', color: 'red' }}>{error || 'Not found'}</div>;

  const { clinic, patient, consultation, prescription, vitals, doctor } = data;
  const consultDate = new Date(consultation.date);
  const dateStr = consultDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = consultDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A5 portrait;
            margin: 8mm;
          }
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          body { background: #e5e5e5; margin: 0; padding: 20px; }
        }
      `}</style>

      {/* Print button bar — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#00475a', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: 'white', fontFamily: 'Arial', fontSize: 14, fontWeight: 600 }}>
          Prescription — {patient.name}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{
            background: 'white', color: '#00475a', border: 'none', borderRadius: 6,
            padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>
            🖨️ Print
          </button>
          <button onClick={() => window.close()} style={{
            background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
          }}>
            Close
          </button>
        </div>
      </div>

      {/* A5 Prescription Page */}
      <div className="print-page" style={{
        width: '148mm', minHeight: '210mm', background: 'white',
        margin: '50px auto 20px', padding: '10mm',
        fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '10px', lineHeight: 1.5,
        color: '#111', boxShadow: '0 2px 20px rgba(0,0,0,0.15)',
        position: 'relative', boxSizing: 'border-box',
      }}>

        {/* ── CLINIC HEADER ─────────────────────────────── */}
        <div style={{
          textAlign: 'center', borderBottom: '2px solid #00475a',
          paddingBottom: '6px', marginBottom: '8px',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#00475a', letterSpacing: '0.5px' }}>
            {clinic.name}
          </div>
          {clinic.address && (
            <div style={{ fontSize: '8px', color: '#555', marginTop: 2 }}>{clinic.address}</div>
          )}
          <div style={{ fontSize: '8px', color: '#555', marginTop: 1 }}>
            {[clinic.phone, clinic.email].filter(Boolean).join('  |  ')}
            {clinic.drug_license_no && `  |  DL: ${clinic.drug_license_no}`}
          </div>
        </div>

        {/* ── PATIENT + CONSULTATION INFO ────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '4px 16px', marginBottom: '8px', fontSize: '9px',
        }}>
          <div><b>Patient:</b> {patient.name}</div>
          <div style={{ textAlign: 'right' }}><b>Date:</b> {dateStr} {timeStr}</div>
          <div>
            <b>Age/Gender:</b> {patient.age} / {patient.gender || '—'}
            {patient.blood_group && ` | ${patient.blood_group}`}
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>Rx No:</b> {prescription.number || '—'}
          </div>
          <div><b>Mobile:</b> {patient.mobile || '—'}</div>
          <div style={{ textAlign: 'right' }}>
            {consultation.token && <span><b>Token:</b> #{consultation.token}</span>}
          </div>
        </div>

        {/* ── VITALS (if available) ──────────────────────── */}
        {vitals && (vitals.blood_pressure || vitals.pulse_rate || vitals.temperature) && (
          <div style={{
            background: '#f8fafb', border: '1px solid #e0e8ed', borderRadius: 4,
            padding: '4px 8px', marginBottom: '8px', fontSize: '8px', color: '#444',
            display: 'flex', gap: '12px', flexWrap: 'wrap',
          }}>
            {vitals.blood_pressure && <span><b>BP:</b> {vitals.blood_pressure}</span>}
            {vitals.pulse_rate && <span><b>Pulse:</b> {vitals.pulse_rate}/min</span>}
            {vitals.temperature && <span><b>Temp:</b> {vitals.temperature}°F</span>}
            {vitals.spo2 && <span><b>SpO₂:</b> {vitals.spo2}%</span>}
            {vitals.weight && <span><b>Wt:</b> {vitals.weight}kg</span>}
            {vitals.blood_sugar && <span><b>Sugar:</b> {vitals.blood_sugar}</span>}
          </div>
        )}

        {/* ── DIAGNOSIS ──────────────────────────────────── */}
        <div style={{ marginBottom: '6px' }}>
          {consultation.chief_complaint && (
            <div style={{ fontSize: '9px', marginBottom: 2 }}>
              <b>Chief complaint:</b> {consultation.chief_complaint}
            </div>
          )}
          {consultation.diagnosis && (
            <div style={{ fontSize: '9px' }}>
              <b>Diagnosis:</b> {consultation.diagnosis}
            </div>
          )}
        </div>

        {/* ── Rx SYMBOL + MEDICINES TABLE ─────────────────── */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{
            fontSize: '18px', fontWeight: 800, color: '#00475a',
            fontFamily: 'serif', marginBottom: '4px',
          }}>
            ℞
          </div>

          {prescription.items && prescription.items.length > 0 ? (
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: '9px',
            }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #00475a' }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 700, width: '5%', color: '#00475a' }}>#</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 700, color: '#00475a' }}>Medicine</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 700, color: '#00475a' }}>Dosage</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 700, color: '#00475a' }}>Frequency</th>
                  <th style={{ textAlign: 'left', padding: '3px 4px', fontWeight: 700, color: '#00475a' }}>Duration</th>
                  <th style={{ textAlign: 'center', padding: '3px 4px', fontWeight: 700, color: '#00475a' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {prescription.items.map((item: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #e5e5e5' }}>
                    <td style={{ padding: '4px', color: '#888' }}>{i + 1}</td>
                    <td style={{ padding: '4px', fontWeight: 600 }}>
                      {item.medicine_name}
                      {item.instructions && (
                        <div style={{ fontSize: '7.5px', color: '#666', fontWeight: 400, fontStyle: 'italic', marginTop: 1 }}>
                          {item.instructions}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '4px' }}>{item.dosage || '—'}</td>
                    <td style={{ padding: '4px' }}>{item.frequency || '—'}</td>
                    <td style={{ padding: '4px' }}>{item.duration || '—'}</td>
                    <td style={{ padding: '4px', textAlign: 'center' }}>{item.quantity || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: '9px', color: '#888', fontStyle: 'italic', padding: '8px 0' }}>
              No medications prescribed
            </div>
          )}
        </div>

        {/* ── NOTES / ADVICE ─────────────────────────────── */}
        {(prescription.notes || consultation.notes) && (
          <div style={{
            background: '#fffdf0', border: '1px solid #f0e8c0', borderRadius: 4,
            padding: '5px 8px', marginBottom: '8px', fontSize: '8.5px',
          }}>
            <b style={{ color: '#8B7500' }}>Advice / Notes:</b>
            <div style={{ marginTop: 2, color: '#555' }}>
              {prescription.notes || consultation.notes}
            </div>
          </div>
        )}

        {/* ── FOLLOW-UP ──────────────────────────────────── */}
        {consultation.follow_up && (
          <div style={{
            fontSize: '9px', marginBottom: '8px',
            padding: '4px 8px', background: '#f0f7ff', borderRadius: 4,
            border: '1px solid #d0e3f5',
          }}>
            <b style={{ color: '#00475a' }}>Follow-up:</b>{' '}
            {new Date(consultation.follow_up).toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
            })}
          </div>
        )}

        {/* ── DOCTOR SIGNATURE BLOCK ─────────────────────── */}
        <div style={{
          position: 'absolute', bottom: '10mm', right: '10mm',
          textAlign: 'right', fontSize: '9px',
        }}>
          <div style={{
            borderTop: '1px solid #333', paddingTop: '4px',
            minWidth: '140px', display: 'inline-block',
          }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#00475a' }}>
              Dr. {doctor.name}
            </div>
            {doctor.qualification && (
              <div style={{ fontSize: '8px', color: '#444' }}>{doctor.qualification}</div>
            )}
            {doctor.designation && (
              <div style={{ fontSize: '8px', color: '#444' }}>{doctor.designation}</div>
            )}
            {doctor.registration_no && (
              <div style={{ fontSize: '8px', color: '#666' }}>Reg. No: {doctor.registration_no}</div>
            )}
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: '4mm', left: '10mm', right: '10mm',
          textAlign: 'center', fontSize: '6.5px', color: '#aaa',
          borderTop: '0.5px solid #ddd', paddingTop: '3px',
        }}>
          This is a computer-generated prescription. Printed on {new Date().toLocaleDateString('en-IN')} via MediSyn.
        </div>
      </div>
    </>
  );
}
