'use client';
// ============================================================================
// apps/web/src/components/patient-health/PatientHealthCard.tsx
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';

interface HealthSummary {
  total_visits: number;
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
  days_since_refill: number;
  unique_molecules: string[];
  active_medicine_count: number;
  flag_missed_refill: boolean;
  flag_bp_elevated: boolean;
  flag_sugar_elevated: boolean;
  flag_overdue_followup: boolean;
  flag_polypharmacy: boolean;
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
  follow_up_date: string;
  dispensed_medicines: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function trendIcon(trend: string) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
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
  return `${days}d ago`;
}

// ── Parse the 4-section brief from Claude ────────────────────────────────────
function parseBrief(brief: string) {
  const sections: { icon: string; title: string; content: string; color: string }[] = [];
  const sectionDefs = [
    { key: '🔴 RED FLAGS',        icon: '🔴', title: 'Red Flags',         color: '#fef2f2', border: '#fecaca' },
    { key: '📊 HEALTH TRAJECTORY',icon: '📊', title: 'Health Trajectory', color: '#eff6ff', border: '#bfdbfe' },
    { key: '🩺 WHAT TO CHECK',    icon: '🩺', title: 'What to Check Today',color: '#f0fdf4', border: '#bbf7d0' },
    { key: '💡 CLINICAL INSIGHT', icon: '💡', title: 'Clinical Insight',   color: '#fefce8', border: '#fde68a' },
  ];

  sectionDefs.forEach(def => {
    const regex = new RegExp(`${def.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=${sectionDefs.map(s => s.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}|$)`, 'i');
    const match = brief.match(regex);
    if (match) {
      const raw = match[0].replace(def.key, '').trim();
      if (raw.length > 5) {
        sections.push({ icon: def.icon, title: def.title, content: raw, color: def.color });
      }
    }
  });

  // Fallback: show raw brief if parsing fails
  if (sections.length === 0 && brief.length > 10) {
    sections.push({ icon: '✨', title: 'Clinical Brief', content: brief, color: '#f0fdf4' });
  }
  return sections;
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBar({ data, color }: { data: number[]; color: string }) {
  const clean = (data || []).filter(Boolean);
  if (clean.length < 2) return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
      {clean.slice(-6).map((v, i) => (
        <div key={i} style={{
          width: 6, borderRadius: 2,
          height: `${Math.max(((v - min) / range) * 100, 15)}%`,
          background: i === clean.length - 1 ? color : color + '66',
        }} title={String(v)} />
      ))}
    </div>
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
  const [summary, setSummary]     = useState<HealthSummary | null>(null);
  const [timeline, setTimeline]   = useState<TimelineEvent[]>([]);
  const [vitals, setVitals]       = useState<any[]>([]);
  const [brief, setBrief]         = useState<string>('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<'brief' | 'vitals' | 'history'>('brief');
  const [collapsed, setCollapsed] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

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
        // Also refresh summary for updated flags
        const sumRes = await fetch(`${API}/patient-health/${patientId}/summary`, { headers });
        if (sumRes.ok) setSummary(await sumRes.json());
      }
    } catch (_) {}
    setBriefLoading(false);
  }, [patientId]);

  useEffect(() => {
    fetchAll();
    fetchBrief();
  }, [patientId]);

  if (!patientId) return null;

  const activeFlags = summary ? [
    summary.flag_bp_elevated      && { label: 'High BP',         color: '#ef4444' },
    summary.flag_sugar_elevated   && { label: 'High Sugar',      color: '#ef4444' },
    summary.flag_missed_refill    && { label: `No visit ${dayLabel(summary.days_since_refill)}`, color: '#f59e0b' },
    summary.flag_overdue_followup && { label: 'Follow-up overdue', color: '#f59e0b' },
    summary.flag_polypharmacy     && { label: 'Polypharmacy',    color: '#8b5cf6' },
  ].filter(Boolean) : [];

  const briefSections = parseBrief(brief);
  const bpData     = vitals.map(v => v.bp_systolic);
  const sugarData  = vitals.map(v => v.blood_sugar);
  const weightData = vitals.map(v => parseFloat(v.weight));

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      fontFamily: '-apple-system, sans-serif',
      fontSize: 13,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>

      {/* ── Header ── */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          background: 'linear-gradient(135deg, #00475a, #006b82)',
          color: '#fff',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15 }}>🧠</span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>Health Intelligence</span>
          {patientName && <span style={{ opacity: 0.8, fontSize: 12 }}>— {patientName}</span>}
          {summary && (
            <span style={{
              background: riskColor(summary.risk_score),
              color: '#fff',
              padding: '1px 8px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
            }}>
              {riskLabel(summary.risk_score)} {summary.risk_score}/100
            </span>
          )}
          {activeFlags.map((f: any, i) => (
            <span key={i} style={{
              background: f.color + '33',
              color: f.color,
              border: `1px solid ${f.color}66`,
              padding: '1px 7px',
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 600,
            }}>
              {f.label}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 14, opacity: 0.7 }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {collapsed ? null : loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
          Loading patient intelligence…
        </div>
      ) : (
        <>
          {/* ── Tab bar ── */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb',
          }}>
            {([
              { id: 'brief',   label: '✨ AI Brief' },
              { id: 'vitals',  label: '📈 Vitals' },
              { id: 'history', label: '📋 History' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '7px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: tab === t.id ? 700 : 400,
                color: tab === t.id ? '#00475a' : '#6b7280',
                borderBottom: tab === t.id ? '2px solid #00475a' : '2px solid transparent',
                fontSize: 12,
              }}>
                {t.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={(e) => { e.stopPropagation(); fetchBrief(); }}
              disabled={briefLoading}
              style={{
                margin: '5px 10px',
                padding: '3px 10px',
                background: 'none',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 10,
                opacity: briefLoading ? 0.5 : 1,
              }}
            >
              {briefLoading ? '⏳ Generating…' : '↻ Refresh Brief'}
            </button>
          </div>

          {/* ── AI Brief tab ── */}
          {tab === 'brief' && (
            <div style={{ padding: 14 }}>
              {briefLoading ? (
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  padding: 16,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
                  <div style={{ color: '#166534', fontWeight: 600, fontSize: 13 }}>
                    Analysing patient history…
                  </div>
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                    Claude is reading all visits, vitals trends, and diagnosis patterns
                  </div>
                </div>
              ) : briefSections.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {briefSections.map((s, i) => (
                    <div key={i} style={{
                      background: s.color,
                      border: `1px solid ${s.color === '#fef2f2' ? '#fecaca' : s.color === '#eff6ff' ? '#bfdbfe' : s.color === '#f0fdf4' ? '#bbf7d0' : '#fde68a'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {s.icon} {s.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#1f2937', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                        {s.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 12 }}>
                  Click ↻ Refresh Brief to generate AI analysis
                </div>
              )}
            </div>
          )}

          {/* ── Vitals tab ── */}
          {tab === 'vitals' && (
            <div style={{ padding: 14 }}>
              {/* Latest vitals row */}
              {summary && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  {[
                    {
                      label: 'Blood Pressure',
                      value: summary.latest_bp_systolic
                        ? `${summary.latest_bp_systolic}/${summary.latest_bp_diastolic}`
                        : '—',
                      unit: 'mmHg',
                      trend: summary.bp_trend,
                      alert: summary.flag_bp_elevated,
                      data: bpData,
                      color: '#ef4444',
                    },
                    {
                      label: 'Blood Sugar',
                      value: summary.latest_blood_sugar ? `${summary.latest_blood_sugar}` : '—',
                      unit: 'mg/dL',
                      trend: summary.sugar_trend,
                      alert: summary.flag_sugar_elevated,
                      data: sugarData,
                      color: '#f59e0b',
                    },
                    {
                      label: 'Weight',
                      value: summary.latest_weight ? `${summary.latest_weight}` : '—',
                      unit: 'kg',
                      trend: summary.weight_trend,
                      alert: false,
                      data: weightData,
                      color: '#6366f1',
                    },
                    {
                      label: 'SpO2',
                      value: summary.latest_spo2 ? `${summary.latest_spo2}` : '—',
                      unit: '%',
                      trend: null,
                      alert: summary.latest_spo2 && summary.latest_spo2 < 95,
                      data: vitals.map(v => v.spo2),
                      color: '#0ea5e9',
                    },
                    {
                      label: 'Pulse',
                      value: summary.latest_pulse ? `${summary.latest_pulse}` : '—',
                      unit: 'bpm',
                      trend: null,
                      alert: false,
                      data: vitals.map(v => v.pulse_rate),
                      color: '#ec4899',
                    },
                    {
                      label: 'BMI',
                      value: summary.latest_bmi ? `${summary.latest_bmi}` : '—',
                      unit: '',
                      trend: null,
                      alert: false,
                      data: [],
                      color: '#8b5cf6',
                    },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: item.alert ? '#fef2f2' : '#f9fafb',
                      border: `1px solid ${item.alert ? '#fecaca' : '#e5e7eb'}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: item.alert ? '#ef4444' : '#111827' }}>
                          {item.value}
                        </span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.unit}</span>
                        {item.trend && (
                          <span style={{
                            fontSize: 12,
                            color: item.trend === 'up' ? '#ef4444' : item.trend === 'down' ? '#22c55e' : '#6b7280',
                            fontWeight: 700,
                          }}>
                            {trendIcon(item.trend)}
                          </span>
                        )}
                      </div>
                      <MiniBar data={item.data} color={item.color} />
                    </div>
                  ))}
                </div>
              )}

              {/* Vitals table */}
              {vitals.length > 0 && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        {['Date', 'BP', 'Pulse', 'Weight', 'Sugar', 'SpO2', 'Temp'].map(h => (
                          <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...vitals].reverse().map((v, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '4px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                            {new Date(v.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td style={{ padding: '4px 8px', fontWeight: 600, color: v.bp_systolic > 140 ? '#ef4444' : '#111827' }}>
                            {v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}
                          </td>
                          <td style={{ padding: '4px 8px' }}>{v.pulse_rate || '—'}</td>
                          <td style={{ padding: '4px 8px' }}>{v.weight ? `${v.weight}kg` : '—'}</td>
                          <td style={{ padding: '4px 8px', color: v.blood_sugar > 200 ? '#ef4444' : '#111827' }}>
                            {v.blood_sugar || '—'}
                          </td>
                          <td style={{ padding: '4px 8px', color: v.spo2 < 95 ? '#ef4444' : '#111827' }}>
                            {v.spo2 ? `${v.spo2}%` : '—'}
                          </td>
                          <td style={{ padding: '4px 8px' }}>{v.temperature ? `${v.temperature}°` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── History tab ── */}
          {tab === 'history' && (
            <div style={{ padding: 14, maxHeight: 340, overflowY: 'auto' }}>
              {timeline.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 12 }}>
                  No visit history found
                </div>
              ) : (
                timeline.map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 10,
                    paddingBottom: 10,
                    borderBottom: i < timeline.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: ev.event_type === 'consultation' ? '#00475a' : '#0ea5e9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: '#fff', fontWeight: 700,
                    }}>
                      {ev.event_type === 'consultation' ? '🩺' : '💊'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: '#111827', fontSize: 12 }}>
                          {ev.event_type === 'consultation'
                            ? (ev.diagnosis || 'Consultation')
                            : 'Dispensing'}
                        </span>
                        <span style={{ color: '#9ca3af', fontSize: 10 }}>
                          {new Date(ev.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </span>
                      </div>
                      {ev.event_type === 'consultation' && (
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                          {ev.chief_complaint && <span>{ev.chief_complaint} · </span>}
                          {ev.bp_systolic && <span>BP {ev.bp_systolic}/{ev.bp_diastolic} · </span>}
                          {ev.doctor_name && <span>Dr. {ev.doctor_name}</span>}
                          {ev.follow_up_date && (
                            <div style={{ color: '#f59e0b', marginTop: 2, fontSize: 10 }}>
                              Follow-up: {new Date(ev.follow_up_date).toLocaleDateString('en-IN')}
                            </div>
                          )}
                        </div>
                      )}
                      {ev.event_type === 'dispensing' && ev.dispensed_medicines && (
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {ev.dispensed_medicines.slice(0, 3).join(', ')}
                          {ev.dispensed_medicines.length > 3 && ` +${ev.dispensed_medicines.length - 3} more`}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Stats footer ── */}
          {summary && (
            <div style={{
              padding: '6px 14px',
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: 16,
              fontSize: 10,
              color: '#6b7280',
              flexWrap: 'wrap',
            }}>
              <span>👁 {summary.total_visits} visits</span>
              <span>📅 Last: {summary.last_visit_date
                ? new Date(summary.last_visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}</span>
              {summary.days_since_refill !== null && (
                <span style={{ color: summary.flag_missed_refill ? '#f59e0b' : '#6b7280' }}>
                  ⏱ {dayLabel(summary.days_since_refill)} since last visit
                </span>
              )}
              <span style={{ marginLeft: 'auto', color: '#d1d5db' }}>MediSyn Health Intelligence</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
