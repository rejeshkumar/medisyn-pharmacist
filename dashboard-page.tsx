'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  TrendingUp, FileText, AlertTriangle, Clock, Package,
  Users, Calendar, ShoppingCart, DollarSign, Heart,
  Stethoscope, Activity, CheckCircle2, ArrowRight,
  Banknote, Smartphone, CreditCard, RefreshCw, Loader2,
  Pill, ClipboardList, Bell, UserPlus, BarChart3,
} from 'lucide-react';

function fmt(n: number) {
  return `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:0,maximumFractionDigits:0})}`;
}

function KpiCard({ label, value, icon: Icon, color, bg, border, sub, onClick }: any) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border ${border||'border-gray-100'} p-4 flex items-start gap-3 ${onClick?'cursor-pointer hover:shadow-md transition-shadow':''}`}>
      <div className={`w-10 h-10 rounded-xl ${bg||'bg-gray-50'} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${color||'text-gray-500'}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function QuickAction({ label, icon: Icon, color, href }: any) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(href)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm ${color}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

// ── Owner Dashboard ─────────────────────────────────────────────────────────
function OwnerDashboard() {
  const router = useRouter();

  // ── same queries as before, exact same keys + endpoints ──────────────────
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: lowStockRaw = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/stock/alerts/low-stock').then(r => r.data),
  });
  const { data: nearExpiry = [] } = useQuery({
    queryKey: ['near-expiry'],
    queryFn: () => api.get('/stock/alerts/near-expiry?days=30').then(r => r.data),
  });

  const totalSales   = dash?.today_sales      || 0;
  const cashTotal    = dash?.today_cash        || 0;
  const upiTotal     = dash?.today_upi         || 0;
  const billCount    = dash?.today_bill_count  || 0;
  const dailyData    = dash?.daily_sales       || [];
  const recentBills  = dash?.recent_bills      || [];
  const topMeds      = dash?.top_medicines     || [];
  const maxQty       = Math.max(...topMeds.map((m: any) => m.total_qty || 0), 1);
  const today        = new Date().getDate().toString().padStart(2, '0');

  // ── Triage: split low-stock array into priority buckets ──────────────────
  const outOfStock   = (lowStockRaw as any[]).filter(b => (b.quantity ?? b.current_stock ?? 0) <= 0);
  const belowReorder = (lowStockRaw as any[]).filter(b => {
    const qty = b.quantity ?? b.current_stock ?? 0;
    return qty > 0 && qty <= (b.reorder_level ?? b.medicine?.reorder_level ?? 5);
  });
  const lowOnly      = (lowStockRaw as any[]).filter(b => {
    const qty = b.quantity ?? b.current_stock ?? 0;
    const reorder = b.reorder_level ?? b.medicine?.reorder_level ?? 5;
    return qty > reorder;
  });

  const todayDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Good morning, Rejesh</h1>
          <p className="text-xs text-gray-400 mt-0.5">{todayDate}</p>
        </div>
        <button
          onClick={() => router.push('/day-close')}
          className="flex items-center gap-1.5 bg-[#00475a] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#003a4a] transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Day close
        </button>
      </div>

      {/* ── Stat cards 2×2 ── */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-3">
        <StatCard
          value={fmt(totalSales)}
          label="Today's revenue"
          icon={<TrendingUp className="w-4 h-4 text-[#3B6D11]" />}
          loading={dashLoading}
        />
        <StatCard
          value={String(billCount)}
          label="Bills today"
          icon={<FileText className="w-4 h-4 text-[#185FA5]" />}
          loading={dashLoading}
        />
        <StatCard
          value={fmt(cashTotal + upiTotal)}
          label="Cash + UPI collected"
          icon={<Banknote className="w-4 h-4 text-[#854F0B]" />}
          loading={dashLoading}
        />
        <StatCard
          value={String(dash?.today_patient_count || billCount)}
          label="Patients today"
          icon={<Users className="w-4 h-4 text-[#534AB7]" />}
          loading={dashLoading}
        />
      </div>

      {/* ── Stock priority triage ── */}
      {lowStockRaw.length > 0 && (
        <div className="px-4 mt-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Stock priority</p>
          <div className="grid grid-cols-3 gap-2">
            <TriageChip count={outOfStock.length}   label="Out of stock"   color="red"   />
            <TriageChip count={belowReorder.length} label="Below reorder"  color="amber" />
            <TriageChip count={lowOnly.length}      label="Low stock"      color="green" />
          </div>
        </div>
      )}

      {/* ── Critical alert (out of stock) ── */}
      {outOfStock.length > 0 && (
        <div className="px-4 mt-3">
          <AlertCard
            variant="danger"
            title="Critical — act today"
            badge={outOfStock.length}
            rows={outOfStock.slice(0, 4).map((b: any) => ({
              name: b.medicine?.brand_name || b.brand_name || '—',
              value: '0 units',
            }))}
            linkLabel={`View all ${outOfStock.length} · create purchase order`}
            onLink={() => router.push('/procurement')}
          />
        </div>
      )}

      {/* ── Expiry alert ── */}
      {(nearExpiry as any[]).length > 0 && (
        <div className="px-4 mt-2">
          <AlertCard
            variant="warning"
            title="Expiring within 30 days"
            badge={(nearExpiry as any[]).length}
            rows={(nearExpiry as any[]).slice(0, 4).map((b: any) => ({
              name: b.medicine?.brand_name || b.brand_name || '—',
              value: b.expiry_date
                ? new Date(b.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                : '—',
            }))}
            linkLabel="View expiry report · take action"
            onLink={() => router.push('/reports?report=expiry_report')}
          />
        </div>
      )}

      {/* ── Below reorder (only if no out-of-stock) ── */}
      {outOfStock.length === 0 && belowReorder.length > 0 && (
        <div className="px-4 mt-2">
          <AlertCard
            variant="warning"
            title="Below reorder level"
            badge={belowReorder.length}
            rows={belowReorder.slice(0, 4).map((b: any) => ({
              name: b.medicine?.brand_name || b.brand_name || '—',
              value: String(b.quantity ?? b.current_stock ?? '?'),
            }))}
            linkLabel={`View all ${belowReorder.length} · order now`}
            onLink={() => router.push('/procurement')}
          />
        </div>
      )}

      {/* ── Sales chart ── */}
      {dailyData.length > 0 && (
        <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm font-semibold text-gray-900">Sales analytics</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">This month</span>
          </div>
          <div style={{ height: 180 }} className="px-3 pb-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']}
                  labelFormatter={(l) => `Day ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {dailyData.map((entry: any, index: number) => (
                    <Cell key={index} fill={entry.day === today ? '#00b8a0' : '#e1f5ee'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Latest orders ── */}
      {recentBills.length > 0 && (
        <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-900">Latest orders</span>
            <button onClick={() => router.push('/billing')} className="text-xs text-[#00b8a0] font-medium">View all</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '7px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Bill</th>
                <th style={{ padding: '7px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '7px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.slice(0, 5).map((bill: any, i: number) => (
                <tr key={i} style={{ borderTop: '0.5px solid #f3f4f6' }}>
                  <td style={{ padding: '9px 16px', color: '#6b7280', fontSize: 11 }}>
                    #{bill.bill_number?.split('-').pop()}
                  </td>
                  <td style={{ padding: '9px 16px', color: '#1a1a2e', fontWeight: 500 }}>
                    {bill.customer_name || 'Walk-in'}
                  </td>
                  <td style={{ padding: '9px 16px', textAlign: 'right', color: '#1a1a2e', fontWeight: 600 }}>
                    {fmt(bill.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Top selling medicines ── */}
      {topMeds.length > 0 && (
        <div className="mx-4 mt-3 mb-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-900">Top selling medicines</span>
            <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">This month</span>
          </div>
          <div className="px-4 py-3">
            {topMeds.slice(0, 5).map((med: any, i: number) => {
              const colors = ['#00b8a0', '#1a2e1a', '#16a34a', '#0891b2', '#7c3aed'];
              const pct = Math.round((med.total_qty / maxQty) * 100);
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      {med.medicine_name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors[i] }}>{fmt(med.total_revenue)}</span>
                  </div>
                  <div style={{ height: 7, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ height: 7, background: colors[i], borderRadius: 4, width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{med.total_qty} units sold</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, icon, loading }: { value: string; label: string; icon: React.ReactNode; loading?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-3 py-3">
      {loading ? (
        <div className="h-7 w-20 bg-gray-100 rounded animate-pulse mb-1" />
      ) : (
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      )}
      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
        {icon} {label}
      </p>
    </div>
  );
}

// ── TriageChip ────────────────────────────────────────────────────────────────
function TriageChip({ count, label, color }: { count: number; label: string; color: 'red' | 'amber' | 'green' }) {
  const p = {
    red:   { bg: '#FCEBEB', border: '#F09595', num: '#A32D2D', lbl: '#791F1F' },
    amber: { bg: '#FAEEDA', border: '#FAC775', num: '#854F0B', lbl: '#633806' },
    green: { bg: '#EAF3DE', border: '#C0DD97', num: '#3B6D11', lbl: '#27500A' },
  }[color];
  return (
    <div style={{ background: p.bg, border: `0.5px solid ${p.border}`, borderRadius: 11, padding: '10px 6px', textAlign: 'center' }}>
      <span style={{ fontSize: 22, fontWeight: 700, display: 'block', color: p.num }}>{count}</span>
      <span style={{ fontSize: 10, display: 'block', marginTop: 2, color: p.lbl, lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

// ── AlertCard ─────────────────────────────────────────────────────────────────
function AlertCard({
  variant, title, badge, rows, linkLabel, onLink,
}: {
  variant: 'danger' | 'warning';
  title: string; badge: number;
  rows: { name: string; value: string }[];
  linkLabel: string; onLink: () => void;
}) {
  const s = variant === 'danger'
    ? { bg: '#FCEBEB', border: '#F09595', title: '#791F1F', nm: '#791F1F', valBg: '#F7C1C1', valTxt: '#A32D2D', bdg: '#E24B4A' }
    : { bg: '#FAEEDA', border: '#FAC775', title: '#633806', nm: '#633806', valBg: '#FAC775', valTxt: '#854F0B', bdg: '#EF9F27' };
  const Icon = variant === 'danger' ? AlertTriangle : Clock;
  return (
    <div style={{ background: s.bg, border: `0.5px solid ${s.border}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Icon style={{ width: 15, height: 15, color: s.title, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: s.title, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 600, background: s.bdg, color: '#fff', padding: '2px 9px', borderRadius: 10 }}>{badge}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < rows.length - 1 ? '0.5px solid rgba(0,0,0,0.06)' : 'none' }}>
          <span style={{ fontSize: 12, color: s.nm, flex: 1 }}>{r.name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, background: s.valBg, color: s.valTxt, padding: '1px 8px', borderRadius: 7 }}>{r.value}</span>
        </div>
      ))}
      <button onClick={onLink} style={{ fontSize: 12, fontWeight: 600, color: '#00475a', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ArrowRight style={{ width: 13, height: 13 }} /> {linkLabel}
      </button>
    </div>
  );
}

// ── Pharmacist Dashboard ────────────────────────────────────────────────────
function PharmacistDashboard() {
  const router = useRouter();
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/reports/dashboard').then(r => r.data), refetchInterval: 30000 });
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: () => api.get('/stock/alerts/low-stock').then(r => r.data) });
  const { data: nearExpiry } = useQuery({ queryKey: ['near-expiry'], queryFn: () => api.get('/stock/alerts/near-expiry?days=30').then(r => r.data) });
  const { data: rxQueue = [] } = useQuery({
    queryKey: ['rx-queue-home'],
    queryFn: () => api.get('/queue/today').then(r =>
      r.data.filter((e: any) => ['consultation_done', 'dispensing'].includes(e.status))
    ).catch(() => []),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · {new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</p>
        </div>
        <QuickAction label="New Bill" icon={ShoppingCart} href="/dispensing" color="bg-[#00b8a0] text-white border-[#00475a]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Bills Today" value={dash?.today_bill_count||0} icon={FileText} color="text-teal-600" bg="bg-teal-50" border="border-teal-100" onClick={() => router.push('/billing')} />
        <KpiCard label="Today's Sales" value={fmt(dash?.today_sales||0)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" border="border-green-100" />
      </div>

      {rxQueue.length > 0 && (
        <div
          className="bg-teal-50 border-2 border-teal-400 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow animate-pulse-once"
          onClick={() => router.push('/dispensing')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-700" />
              <h3 className="font-bold text-teal-900 text-base">Prescriptions Waiting</h3>
            </div>
            <span className="bg-teal-600 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              {rxQueue.length} patient{rxQueue.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2 mb-3">
            {rxQueue.slice(0, 4).map((entry: any) => {
              const name = entry.patient
                ? `${entry.patient.first_name || ''} ${entry.patient.last_name || ''}`.trim()
                : entry.patient_name || 'Unknown';
              return (
                <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-teal-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-teal-200 rounded-full flex items-center justify-center text-teal-800 text-xs font-bold flex-shrink-0">
                      {entry.token_number}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-teal-900">{name}</p>
                      <p className="text-xs text-teal-600">{entry.chief_complaint || 'Consultation'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-teal-600 font-medium">Tap to dispense →</span>
                </div>
              );
            })}
            {rxQueue.length > 4 && (
              <p className="text-xs text-teal-600 text-center pt-1">+{rxQueue.length - 4} more waiting</p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2 bg-teal-600 text-white text-sm font-semibold rounded-xl py-2.5">
            <ShoppingCart className="w-4 h-4" /> Open Dispensing
          </div>
        </div>
      )}

      {lowStock?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 cursor-pointer" onClick={() => router.push('/procurement')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-red-900">Low Stock — Reorder Needed</h3>
            </div>
            <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{lowStock.length}</span>
          </div>
          {lowStock.slice(0,5).map((b: any) => (
            <div key={b.id} className="flex justify-between py-1.5 border-b border-red-100 last:border-0">
              <span className="text-sm text-red-800 font-medium truncate">{b.medicine?.brand_name}</span>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold ml-2 shrink-0">{b.quantity} left</span>
            </div>
          ))}
        </div>
      )}

      {nearExpiry?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-amber-900">Expiring in 30 Days</h3>
            </div>
            <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{nearExpiry.length}</span>
          </div>
          {nearExpiry.slice(0,5).map((b: any) => (
            <div key={b.id} className="flex justify-between py-1.5 border-b border-amber-100 last:border-0">
              <span className="text-sm text-amber-900 truncate">{b.medicine?.brand_name}</span>
              <span className="text-xs text-amber-700 font-medium ml-2 shrink-0">{formatDate(b.expiry_date)} · {b.quantity} units</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <QuickAction label="Dispense" icon={ShoppingCart} href="/dispensing" color="bg-teal-50 text-teal-700 border-teal-200" />
          <QuickAction label="View Bills" icon={FileText} href="/billing" color="bg-blue-50 text-blue-700 border-blue-200" />
          <QuickAction label="Stock Check" icon={Package} href="/stock" color="bg-amber-50 text-amber-700 border-amber-200" />
          <QuickAction label="Procurement" icon={ClipboardList} href="/procurement" color="bg-red-50 text-red-700 border-red-200" />
        </div>
      </div>
    </div>
  );
}

// ── Receptionist Dashboard ──────────────────────────────────────────────────
function ReceptionistDashboard() {
  const router = useRouter();
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['queue-today'],
    queryFn: () => api.get('/queue?date=today&limit=50').then(r => r.data).catch(() => []),
    refetchInterval: 15000,
  });

  const waiting   = Array.isArray(queue) ? queue.filter((q: any) => ['waiting','precheck_done'].includes(q.status)) : [];
  const inConsult = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation') : [];
  const done      = Array.isArray(queue) ? queue.filter((q: any) => ['completed','dispensed'].includes(q.status)).length : 0;

  return (
    <div className="p-3 lg:p-6" style={{ background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Reception</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <button onClick={() => router.push('/receptionist/book-appointment')}
          style={{ background: '#00b8a0', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          + Book appointment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '16px', color: 'white' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Waiting</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{waiting.length}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', border: '1.5px solid #00b8a0' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>In consult</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e' }}>{inConsult.length}</div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '16px', border: '1.5px solid #00b8a0' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Done today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{done}</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Queue</span>
          <button onClick={() => router.push('/receptionist/queue')} style={{ fontSize: 12, color: '#00b8a0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View all →</button>
        </div>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af', fontSize: 13 }}>Loading...</div>
        ) : waiting.length > 0 ? (
          waiting.slice(0, 8).map((q: any, i: number) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e1f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00475a', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                {q.token_number}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>
                  {q.patient ? `${q.patient.first_name} ${q.patient.last_name || ''}`.trim() : q.patient_name || 'Walk-in'}
                </p>
                <p style={{ fontSize: 11, color: '#6b7280' }}>{q.chief_complaint || 'Consultation'}</p>
              </div>
              <span style={{ fontSize: 11, background: '#e1f5ee', color: '#00475a', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>Waiting</span>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>Queue is clear!</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No patients waiting</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nurse Dashboard ──────────────────────────────────────────────────────────
function NurseDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['queue-precheck'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 15000 });

  const needsPrecheck = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting' && !q.precheck_done) : [];
  const done = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;
  const total = Array.isArray(queue) ? queue.length : 0;

  return (
    <div className="p-3 lg:p-6" style={{ background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Nurse Station</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>🏥</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Total Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>{total}</div>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8, marginTop: 6, display: 'inline-block' }}>Patients</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#fee2e2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>💉</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Vitals Pending</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{needsPrecheck.length}</div>
          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 500 }}>Need pre-check</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>✅</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Completed</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{done}</div>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Done today</span>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Pre-check Pending</span>
          {needsPrecheck.length > 0 && <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>{needsPrecheck.length} patients</span>}
        </div>
        {needsPrecheck.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>#</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Complaint</th>
                <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {needsPrecheck.map((q: any, i: number) => (
                <tr key={q.id} style={{ borderTop: '0.5px solid #f3f4f6', cursor: 'pointer' }} onClick={() => router.push(`/nurse/precheck/${q.id}`)}>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{i+1}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                        {(q.patient_name||q.patient?.first_name||'?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{q.patient_name || `${q.patient?.first_name}`}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.chief_complaint || 'Consultation'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>Record vitals →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>All vitals recorded!</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No pre-checks pending</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'AI Care Plans', emoji: '🤖', href: '/ai-care', bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Patients', emoji: '👥', href: '/patients', bg: '#dbeafe', color: '#2563eb' },
        ].map(({ label, emoji, href, bg, color }) => (
          <button key={label} onClick={() => router.push(href)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: 'white', border: '0.5px solid #e5e7eb', borderRadius: 16, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{emoji}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Root Dashboard — routes by role ──────────────────────────────────────────
export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    setRole(user?.role || 'owner');
  }, []);

  if (!role) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-[#00475a]" />
    </div>
  );

  if (role === 'pharmacist' || role === 'assistant') return <div className="p-4"><PharmacistDashboard /></div>;
  if (role === 'receptionist') return <div className="p-4"><ReceptionistDashboard /></div>;
  if (role === 'doctor') return <div className="p-4 lg:p-6"><DoctorDashboard /></div>;
  if (role === 'nurse') return <div className="p-4"><NurseDashboard /></div>;
  return <OwnerDashboard />;
}

// ── DoctorDashboard placeholder — preserved from original ────────────────────
function DoctorDashboard() {
  const router = useRouter();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'View Queue', href: '/doctor', color: 'bg-teal-50 text-teal-700 border-teal-200' },
          { label: 'My Patients', href: '/doctor/patients', color: 'bg-blue-50 text-blue-700 border-blue-200' },
        ].map(({ label, href, color }) => (
          <button key={label} onClick={() => router.push(href)}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm ${color}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
