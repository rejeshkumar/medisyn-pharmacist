'use client';
// ============================================================================
// apps/web/src/components/patient-health/PatientHealthCard.tsx
// Doctor-facing Patient Health Intelligence Card
// Props: patientId, patientName, tenantId (from JWT)
// Usage: Import inside doctor consultation page, pass patientId from queue
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

// ── Types ────────────────────────────────────────────────────────────────────
interface HealthSummary {
  total_visits: number;
  first_visit_date: string;
  last_visit_date: string;
  latest_bp_systolic: number;
  latest_bp_diastolic: number;
  latest_pulse: number;
  latest_weight: number;
  latest_bmi: number;
  latest_spo2: number;
  latest_blood_sugar: number;
  bp_trend: 'up' | 'down' | 'stable';
  weight_trend: 'up' | 'down' | 'stable';
  sugar_trend: 'up' | 'down' | 'stable';
  active_medicine_count: number;
  unique_molecules: string[];
  days_since_refill: number;
  flag_missed_refill: boolean;
  flag_polypharmacy: boolean;
  flag_bp_elevated: boolean;
  flag_sugar_elevated: boolean;
  flag_overdue_followup: boolean;
  flag_multiple_analgesics: boolean;
  risk_score: number;
  ai_brief: string;
}

interface TimelineEvent {
  visit_date: string;
  event_type: 'consultation' | 'dispensing';
  doctor_name: string;
  diagnosis: string;
  chief_complaint: string;
  bp_systolic: number;
  bp_diastolic: number;
  weight: number;
  blood_sugar: number;
  dispensed_medicines: string[];
  follow_up_date: string;
  advice: string;
}

interface VitalsPoint {
  date: string;
  bp_systolic: number;
  bp_diastolic: number;
  weight: number;
  blood_sugar: number;
  pulse_rate: number;
  spo2: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function trendIcon(trend: string) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function trendColor(trend: string, higherIsBad = true) {
  if (trend === 'stable') return '#6b7280';
  if (higherIsBad) return trend === 'up' ? '#ef4444' : '#22c55e';
  return trend === 'up' ? '#22c55e' : '#ef4444';
}

function riskColor(score: number) {
  if (score >= 60) return '#ef4444';
  if (score >= 30) return '#f59e0b';
  return '#22c55e';
}

function riskLabel(score: number) {
  if (score >= 60) return 'High Risk';
  if (score >= 30) return 'Moderate';
  return 'Low Risk';
}

function dayLabel(days: number | null) {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// Mini sparkline using SVG
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <span style={{ color: '#9ca3af' }}>—</span>;
  const clean = data.filter(Boolean);
  if (clean.length < 2) return <span style={{ color: '#9ca3af' }}>—</span>;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const w = 60, h = 24;
  const pts = clean.map((v, i) => {
    const x = (i / (clean.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle
        cx={parseFloat(pts.split(' ').pop()!.split(',')[0])}
        cy={parseFloat(pts.split(' ').pop()!.split(',')[1])}
        r="2.5" fill={color}
      />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PatientHealthCard({
  patientId,
  patientName,
  token,
}: {
  patientId: string;
  patientName?: string;
  token: string;
}) {
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [vitals, setVitals] = useState<VitalsPoint[]>([]);
  const [brief, setBrief] = useState<string>('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'vitals'>('overview');
  const [expanded, setExpanded] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchAll = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [sumRes, tlRes, vRes] = await Promise.all([
        fetch(`${API}/patient-health/${patientId}/summary`, { headers }),
        fetch(`${API}/patient-health/${patientId}/timeline`, { headers }),
        fetch(`${API}/patient-health/${patientId}/vitals-chart`, { headers }),
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());
      if (tlRes.ok) setTimeline(await tlRes.json());
      if (vRes.ok) setVitals(await vRes.json());
    } catch (_) {}
    setLoading(false);
  }, [patientId]);

  const fetchBrief = useCallback(async () => {
    if (!patientId) return;
    setBriefLoading(true);
    setBrief('');
    try {
      const res = await fetch(`${API}/patient-health/${patientId}/brief`, { headers });
      if (res.ok) {
        const data = await res.json();
        setBrief(data.brief || '');
      }
    } catch (_) {}
    setBriefLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchAll();
    fetchBrief();
  }, [patientId]);

  if (!patientId) return null;

  const flags = summary ? [
    summary.flag_bp_elevated     && { label: 'Elevated BP',       color: '#ef4444', icon: '🩺' },
    summary.flag_sugar_elevated  && { label: 'High Blood Sugar',   color: '#ef4444', icon: '🩸' },
    summary.flag_missed_refill   && { label: 'Missed Refill',      color: '#f59e0b', icon: '💊' },
    summary.flag_overdue_followup&& { label: 'Overdue Follow-up',  color: '#f59e0b', icon: '📅' },
    summary.flag_polypharmacy    && { label: 'Polypharmacy Risk',  color: '#f59e0b', icon: '⚠️' },
    summary.flag_multiple_analgesics && { label: 'Frequent Analgesics', color: '#6366f1', icon: '💉' },
  ].filter(Boolean) : [];

  const bpData = vitals.map(v => v.bp_systolic);
  const weightData = vitals.map(v => v.weight);
  const sugarData = vitals.map(v => v.blood_sugar);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      fontFamily: '"Inter", -apple-system, sans-serif',
      fontSize: 13,
    }}>
      {/* ── Header bar ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: '#00475a',
          color: '#fff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>🧠</span>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>
            Patient Health Intelligence
            {patientName ? ` — ${patientName}` : ''}
          </span>
          {summary && (
            <span style={{
              background: riskColor(summary.risk_score),
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 600,
            }}>
              {riskLabel(summary.risk_score)} · {summary.risk_score}/100
            </span>
          )}
        </div>
        <span style={{ fontSize: 16, opacity: 0.8 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {!expanded ? null : loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
          Loading patient health data…
        </div>
      ) : (
        <>
          {/* ── AI Brief ── */}
          <div style={{
            background: '#f0fdf4',
            borderBottom: '1px solid #e5e7eb',
            padding: '10px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, marginTop: 1 }}>✨</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#166534', marginBottom: 4, fontSize: 12 }}>
                  PRE-CONSULTATION BRIEF
                </div>
                {briefLoading ? (
                  <div style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 12 }}>
                    Generating AI brief…
                  </div>
                ) : brief ? (
                  <div style={{ color: '#1f2937', lineHeight: 1.6, fontSize: 12.5, whiteSpace: 'pre-line' }}>
                    {brief}
                  </div>
                ) : (
                  <div style={{ color: '#6b7280', fontSize: 12 }}>
                    No brief available.{' '}
                    <button onClick={fetchBrief} style={{
                      background: 'none', border: 'none', color: '#00475a',
                      cursor: 'pointer', textDecoration: 'underline', fontSize: 12,
                    }}>Generate now</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Risk Flags ── */}
          {flags.length > 0 && (
            <div style={{
              padding: '8px 16px',
              background: '#fff8f0',
              borderBottom: '1px solid #fed7aa',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}>
              {flags.map((f: any, i) => (
                <span key={i} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: f.color + '18',
                  color: f.color,
                  border: `1px solid ${f.color}44`,
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {f.icon} {f.label}
                </span>
              ))}
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
            {(['overview', 'timeline', 'vitals'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? '#00475a' : '#6b7280',
                borderBottom: activeTab === tab ? '2px solid #00475a' : '2px solid transparent',
                fontSize: 12,
                textTransform: 'capitalize',
              }}>
                {tab === 'overview' ? '📊 Overview' : tab === 'timeline' ? '📋 Visit History' : '📈 Vitals Trends'}
              </button>
            ))}
          </div>

          {/* ── Tab: Overview ── */}
          {activeTab === 'overview' && summary && (
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>

                {/* Vitals */}
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8, fontSize: 12 }}>
                    📟 LATEST VITALS
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {[
                        {
                          label: 'Blood Pressure',
                          value: summary.latest_bp_systolic
                            ? `${summary.latest_bp_systolic}/${summary.latest_bp_diastolic} mmHg`
                            : '—',
                          trend: summary.bp_trend,
                          bad: true,
                          spark: bpData,
                          color: summary.flag_bp_elevated ? '#ef4444' : '#1f2937',
                        },
                        {
                          label: 'Blood Sugar',
                          value: summary.latest_blood_sugar ? `${summary.latest_blood_sugar} mg/dL` : '—',
                          trend: summary.sugar_trend,
                          bad: true,
                          spark: sugarData,
                          color: summary.flag_sugar_elevated ? '#ef4444' : '#1f2937',
                        },
                        {
                          label: 'Weight',
                          value: summary.latest_weight ? `${summary.latest_weight} kg` : '—',
                          trend: summary.weight_trend,
                          bad: true,
                          spark: weightData,
                          color: '#1f2937',
                        },
                        {
                          label: 'SpO2',
                          value: summary.latest_spo2 ? `${summary.latest_spo2}%` : '—',
                          trend: null,
                          bad: false,
                          spark: vitals.map(v => v.spo2),
                          color: summary.latest_spo2 && summary.latest_spo2 < 95 ? '#ef4444' : '#1f2937',
                        },
                        {
                          label: 'Pulse',
                          value: summary.latest_pulse ? `${summary.latest_pulse} bpm` : '—',
                          trend: null,
                          bad: false,
                          spark: vitals.map(v => v.pulse_rate),
                          color: '#1f2937',
                        },
                        {
                          label: 'BMI',
                          value: summary.latest_bmi ? `${summary.latest_bmi}` : '—',
                          trend: null,
                          bad: false,
                          spark: [],
                          color: '#1f2937',
                        },
                      ].map((row, i) => (
                        <tr key={i}>
                          <td style={{ color: '#6b7280', paddingBottom: 4, paddingRight: 8, fontSize: 11 }}>
                            {row.label}
                          </td>
                          <td style={{ fontWeight: 600, color: row.color, paddingBottom: 4 }}>
                            {row.value}
                          </td>
                          <td style={{ paddingBottom: 4, paddingLeft: 6 }}>
                            <Sparkline data={row.spark} color={row.color === '#ef4444' ? '#ef4444' : '#00475a'} />
                          </td>
                          {row.trend && (
                            <td style={{
                              color: trendColor(row.trend, row.bad),
                              fontWeight: 700,
                              fontSize: 14,
                              paddingBottom: 4,
                              paddingLeft: 4,
                            }}>
                              {trendIcon(row.trend)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Medication profile */}
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8, fontSize: 12 }}>
                    💊 MEDICATION PROFILE
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>Active Molecules</span>
                      <span style={{
                        fontWeight: 700,
                        color: summary.flag_polypharmacy ? '#f59e0b' : '#1f2937',
                      }}>
                        {summary.active_medicine_count}
                        {summary.flag_polypharmacy && ' ⚠️'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>Last Refill</span>
                      <span style={{
                        fontWeight: 600,
                        color: summary.flag_missed_refill ? '#ef4444' : '#1f2937',
                      }}>
                        {dayLabel(summary.days_since_refill)}
                        {summary.flag_missed_refill && ' ⚠️'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>Total Visits</span>
                      <span style={{ fontWeight: 600, color: '#1f2937' }}>{summary.total_visits}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', fontSize: 11 }}>Last Visit</span>
                      <span style={{ fontWeight: 600, color: '#1f2937' }}>
                        {summary.last_visit_date
                          ? new Date(summary.last_visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>

                    {(summary.unique_molecules || []).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 4 }}>Molecules on record (last 6mo)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {summary.unique_molecules.slice(0, 8).map((mol, i) => (
                            <span key={i} style={{
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '1px 7px',
                              borderRadius: 10,
                              fontSize: 10,
                              fontWeight: 500,
                            }}>
                              {mol}
                            </span>
                          ))}
                          {summary.unique_molecules.length > 8 && (
                            <span style={{ color: '#6b7280', fontSize: 10 }}>
                              +{summary.unique_molecules.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Timeline ── */}
          {activeTab === 'timeline' && (
            <div style={{ padding: 16, maxHeight: 320, overflowY: 'auto' }}>
              {timeline.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                  No visit history found
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 16, top: 0, bottom: 0,
                    width: 2, background: '#e5e7eb',
                  }} />
                  {timeline.map((ev, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, paddingLeft: 8 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        background: ev.event_type === 'consultation' ? '#00475a' : '#0ea5e9',
                        border: '2px solid #fff',
                        boxShadow: '0 0 0 1px #e5e7eb',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff', fontWeight: 700,
                        zIndex: 1, position: 'relative',
                      }}>
                        {ev.event_type === 'consultation' ? 'C' : 'D'}
                      </div>
                      <div style={{
                        flex: 1, background: '#f9fafb', borderRadius: 8,
                        padding: '8px 10px', border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 11.5 }}>
                            {ev.event_type === 'consultation' ? `🩺 ${ev.diagnosis || 'Consultation'}` : '💊 Dispensing'}
                          </span>
                          <span style={{ color: '#9ca3af', fontSize: 10 }}>
                            {new Date(ev.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {ev.event_type === 'consultation' && (
                          <div style={{ color: '#6b7280', fontSize: 11, lineHeight: 1.5 }}>
                            {ev.chief_complaint && <div>Chief complaint: {ev.chief_complaint}</div>}
                            {ev.doctor_name && <div>Dr. {ev.doctor_name}</div>}
                            {ev.bp_systolic && <div>BP: {ev.bp_systolic}/{ev.bp_diastolic} mmHg</div>}
                            {ev.follow_up_date && (
                              <div style={{ color: '#f59e0b' }}>
                                Follow-up: {new Date(ev.follow_up_date).toLocaleDateString('en-IN')}
                              </div>
                            )}
                          </div>
                        )}
                        {ev.event_type === 'dispensing' && ev.dispensed_medicines && (
                          <div style={{ color: '#6b7280', fontSize: 11 }}>
                            {ev.dispensed_medicines.slice(0, 4).join(', ')}
                            {ev.dispensed_medicines.length > 4 && ` +${ev.dispensed_medicines.length - 4} more`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Vitals Trends ── */}
          {activeTab === 'vitals' && (
            <div style={{ padding: 16 }}>
              {vitals.length < 2 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>
                  Not enough vitals data for trends (need at least 2 visits)
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Systolic BP (mmHg)', data: bpData, color: '#ef4444', normal: '< 120' },
                    { label: 'Blood Sugar (mg/dL)', data: sugarData, color: '#f59e0b', normal: '< 140' },
                    { label: 'Weight (kg)', data: weightData, color: '#6366f1', normal: 'BMI 18.5–24.9' },
                    { label: 'SpO2 (%)', data: vitals.map(v => v.spo2), color: '#0ea5e9', normal: '> 95%' },
                  ].map((chart, i) => (
                    <div key={i} style={{
                      background: '#f9fafb', borderRadius: 8,
                      padding: 12, border: '1px solid #e5e7eb',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: '#374151', fontSize: 11 }}>{chart.label}</span>
                        <span style={{ color: '#9ca3af', fontSize: 10 }}>Normal: {chart.normal}</span>
                      </div>
                      {/* Simple table-based chart */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
                        {chart.data.filter(Boolean).slice(-8).map((val, idx, arr) => {
                          const max = Math.max(...arr);
                          const min = Math.min(...arr);
                          const range = max - min || 1;
                          const heightPct = ((val - min) / range) * 80 + 20;
                          return (
                            <div key={idx} style={{
                              flex: 1, background: chart.color + '33',
                              height: `${heightPct}%`,
                              borderRadius: '2px 2px 0 0',
                              position: 'relative',
                              cursor: 'default',
                              transition: 'background 0.2s',
                            }}
                              title={`${val}`}
                            >
                              {idx === arr.length - 1 && (
                                <div style={{
                                  position: 'absolute', top: -18, left: '50%',
                                  transform: 'translateX(-50%)',
                                  fontSize: 10, fontWeight: 700,
                                  color: chart.color, whiteSpace: 'nowrap',
                                }}>
                                  {val}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>
                          {vitals.length > 0 ? new Date(vitals[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                        </span>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>Today</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{
            padding: '6px 16px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: '#9ca3af', fontSize: 10 }}>
              Powered by MediSyn Health Intelligence
            </span>
            <button
              onClick={() => { fetchAll(); fetchBrief(); }}
              style={{
                background: 'none', border: '1px solid #d1d5db',
                borderRadius: 6, padding: '3px 10px',
                color: '#6b7280', cursor: 'pointer', fontSize: 10,
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
