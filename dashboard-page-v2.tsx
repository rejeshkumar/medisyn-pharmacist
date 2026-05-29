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

// ── Owner Dashboard ──────────────────────────────────────────────────────────
function OwnerDashboard() {
  const router = useRouter();

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
  const { data: queue = [] } = useQuery({
    queryKey: ['queue-today-owner'],
    queryFn: () => api.get('/queue?date=today&limit=50').then(r => r.data).catch(() => []),
    refetchInterval: 30000,
  });

  const totalSales  = dash?.today_sales     || 0;
  const billCount   = dash?.today_bill_count || 0;
  const dailyData   = dash?.daily_sales      || [];
  const recentBills = dash?.recent_bills     || [];
  const topMeds     = dash?.top_medicines    || [];
  const maxQty      = Math.max(...topMeds.map((m: any) => m.total_qty || 0), 1);
  const today       = new Date().getDate().toString().padStart(2, '0');

  const queueArr   = Array.isArray(queue) ? queue : [];
  const totalToday = queueArr.length;
  const waiting    = queueArr.filter((q: any) => q.status === 'waiting').length;
  const inConsult  = queueArr.filter((q: any) => q.status === 'in_consultation').length;
  const done       = queueArr.filter((q: any) => ['completed','dispensed'].includes(q.status)).length;

  const outOfStock   = (lowStockRaw as any[]).filter(b => (b.quantity ?? b.current_stock ?? 0) <= 0);
  const belowReorder = (lowStockRaw as any[]).filter(b => {
    const qty = b.quantity ?? b.current_stock ?? 0;
    return qty > 0 && qty <= (b.reorder_level ?? b.medicine?.reorder_level ?? 5);
  });

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ background: '#f4f6f8', minHeight: '100%' }} className="p-4 lg:p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{todayLabel}</p>
        </div>
        <button
          onClick={() => router.push('/day-close')}
          className="flex items-center gap-2 bg-[#00b8a0] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#009688] transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" /> Day Close
        </button>
      </div>

      {/* ── 4 stat cards — exactly like the screenshot ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

        {/* Card 1 — dark teal (Total Today) */}
        <div className="relative rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #007a6e 0%, #00b8a0 100%)', padding: 20, color: 'white' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', bottom: -30, left: -10, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>Total Today</p>
          <p className="text-4xl font-bold text-white mb-2">{dashLoading ? '—' : totalToday}</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>Patients</span>
        </div>

        {/* Card 2 — Waiting */}
        <div className="bg-white rounded-2xl border-2 border-[#00b8a0] p-5 relative overflow-hidden">
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#fef9eb' }} />
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 mb-1">Waiting</p>
          <p className="text-4xl font-bold text-amber-500 mb-1">{waiting}</p>
          <p className="text-xs font-semibold text-amber-500">In queue</p>
        </div>

        {/* Card 3 — In Consult */}
        <div className="bg-white rounded-2xl border-2 border-[#00b8a0] p-5 relative overflow-hidden">
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#eff6ff' }} />
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mb-1">In Consult</p>
          <p className="text-4xl font-bold text-blue-600 mb-1">{inConsult}</p>
          <p className="text-xs font-semibold text-blue-500">With doctor</p>
        </div>

        {/* Card 4 — Done */}
        <div className="bg-white rounded-2xl border-2 border-[#00b8a0] p-5 relative overflow-hidden">
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#f0fdf4' }} />
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mb-1">Done</p>
          <p className="text-4xl font-bold text-green-600 mb-1">{done}</p>
          <p className="text-xs font-semibold text-green-500">Completed</p>
        </div>
      </div>

      {/* ── Main grid — Queue left, Quick Actions + Monitor right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-4">

        {/* Today's Queue */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Today's Queue</h2>
            <button onClick={() => router.push('/receptionist/book-appointment')}
              className="text-xs font-semibold text-[#00475a] hover:underline">
              + Add patient
            </button>
          </div>
          {queueArr.length > 0 ? (
            <div>
              {queueArr.slice(0, 10).map((q: any) => {
                const name = q.patient_name || `${q.patient?.first_name || ''} ${q.patient?.last_name || ''}`.trim() || 'Walk-in';
                const statusStyle: Record<string, string> = {
                  waiting:         'bg-amber-100 text-amber-700',
                  in_consultation: 'bg-blue-100 text-blue-700',
                  completed:       'bg-green-100 text-green-700',
                  dispensed:       'bg-teal-100 text-teal-700',
                };
                return (
                  <div key={q.id} className="flex items-center gap-3 px-5 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-[#00475a] text-xs font-bold flex-shrink-0">
                      {q.token_number || name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                      <p className="text-xs text-gray-400">{q.chief_complaint || q.visit_type || 'Consultation'}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusStyle[q.status] || 'bg-gray-100 text-gray-600'}`}>
                      {q.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                );
              })}
              {queueArr.length > 10 && (
                <div className="px-5 py-3 text-center">
                  <button onClick={() => router.push('/receptionist/queue')} className="text-xs text-[#00475a] font-semibold hover:underline">
                    View all {queueArr.length} patients →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-10 h-10 mb-3 opacity-25" />
              <p className="text-sm font-medium text-gray-500">No patients in queue</p>
              <button onClick={() => router.push('/receptionist/book-appointment')}
                className="mt-3 text-sm font-semibold text-[#00b8a0] hover:underline">
                Book first appointment →
              </button>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionCard label="Book Appointment" icon={<Calendar className="w-5 h-5 text-teal-600" />} bg="bg-teal-50" href="/receptionist/book-appointment" router={router} />
              <QuickActionCard label="New Patient"      icon={<UserPlus className="w-5 h-5 text-blue-500" />}  bg="bg-blue-50"   href="/patients" router={router} />
              <QuickActionCard label="Follow-ups"       icon={<Bell className="w-5 h-5 text-purple-500" />}    bg="bg-purple-50" href="/receptionist/followups" router={router} />
              <QuickActionCard label="Bills"            icon={<FileText className="w-5 h-5 text-amber-500" />} bg="bg-amber-50"  href="/billing" router={router} />
            </div>
          </div>

          {/* Queue Monitor */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-900 mb-1">Queue Monitor</h2>
            <p className="text-xs text-gray-400 mb-4">Live updates every 30s</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-500">{waiting}</p>
                <p className="text-xs text-amber-500 font-medium mt-1">Waiting</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{inConsult}</p>
                <p className="text-xs text-blue-500 font-medium mt-1">In Consult</p>
              </div>
              <div className="rounded-xl bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{done}</p>
                <p className="text-xs text-green-500 font-medium mt-1">Done</p>
              </div>
            </div>
          </div>

          {/* Stock alerts — compact */}
          {(outOfStock.length > 0 || (nearExpiry as any[]).length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-bold text-gray-900 mb-3">Alerts</h2>
              {outOfStock.length > 0 && (
                <button onClick={() => router.push('/procurement')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-100 mb-2 text-left hover:bg-red-100 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">{outOfStock.length} out of stock</p>
                    <p className="text-xs text-red-500">Create purchase order →</p>
                  </div>
                </button>
              )}
              {belowReorder.length > 0 && (
                <button onClick={() => router.push('/procurement')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 mb-2 text-left hover:bg-amber-100 transition-colors">
                  <Package className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700">{belowReorder.length} below reorder level</p>
                    <p className="text-xs text-amber-500">View procurement →</p>
                  </div>
                </button>
              )}
              {(nearExpiry as any[]).length > 0 && (
                <button onClick={() => router.push('/reports?report=expiry_report')}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100 text-left hover:bg-orange-100 transition-colors">
                  <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-orange-700">{(nearExpiry as any[]).length} expiring in 30 days</p>
                    <p className="text-xs text-orange-500">View expiry report →</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Sales chart + Top medicines ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 mb-4">

        {/* Sales chart */}
        {dailyData.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <span className="font-bold text-gray-900">Sales Analytics</span>
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">This month</span>
            </div>
            <div style={{ height: 200 }} className="px-3 pb-3">
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
                  <Bar dataKey="total" radius={[4,4,0,0]}>
                    {dailyData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.day === today ? '#00b8a0' : '#e1f5ee'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top medicines */}
        {topMeds.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <span className="font-bold text-gray-900">Top Selling</span>
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">This month</span>
            </div>
            <div className="px-5 py-3">
              {topMeds.slice(0, 5).map((med: any, i: number) => {
                const colors = ['#00b8a0','#1a2e1a','#16a34a','#0891b2','#7c3aed'];
                const pct = Math.round((med.total_qty / maxQty) * 100);
                return (
                  <div key={i} className="mb-3 last:mb-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-700 font-medium truncate max-w-[65%]">{med.medicine_name}</span>
                      <span className="text-xs font-bold" style={{ color: colors[i] }}>{fmt(med.total_revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: colors[i] }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{med.total_qty} units</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Latest orders ── */}
      {recentBills.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <span className="font-bold text-gray-900">Latest Orders</span>
            <button onClick={() => router.push('/billing')} className="text-xs text-[#00b8a0] font-semibold hover:underline">View all</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 20px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Bill No</th>
                <th style={{ padding: '8px 20px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '8px 20px', textAlign: 'right', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Amount</th>
                <th style={{ padding: '8px 20px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.slice(0, 6).map((bill: any, i: number) => (
                <tr key={i} style={{ borderTop: '0.5px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 20px', color: '#6b7280', fontSize: 11 }}>#{bill.bill_number?.split('-').pop()}</td>
                  <td style={{ padding: '10px 20px', color: '#1a1a2e', fontWeight: 500 }}>{bill.customer_name || 'Walk-in'}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', color: '#1a1a2e', fontWeight: 600 }}>{fmt(bill.total_amount)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>Paid</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── QuickActionCard ───────────────────────────────────────────────────────────
function QuickActionCard({ label, icon, bg, href, router }: { label: string; icon: React.ReactNode; bg: string; href: string; router: any }) {
  return (
    <button onClick={() => router.push(href)}
      className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl ${bg} border border-transparent hover:border-gray-200 transition-all`}>
      {icon}
      <span className="text-xs font-semibold text-gray-700">{label}</span>
    </button>
  );
}

// ── Pharmacist Dashboard ─────────────────────────────────────────────────────
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
        <div className="bg-teal-50 border-2 border-teal-400 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dispensing')}>
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
            {rxQueue.slice(0,4).map((entry: any) => {
              const name = entry.patient ? `${entry.patient.first_name||''} ${entry.patient.last_name||''}`.trim() : entry.patient_name||'Unknown';
              return (
                <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-teal-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-teal-200 rounded-full flex items-center justify-center text-teal-800 text-xs font-bold flex-shrink-0">{entry.token_number}</div>
                    <div>
                      <p className="text-sm font-semibold text-teal-900">{name}</p>
                      <p className="text-xs text-teal-600">{entry.chief_complaint || 'Consultation'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-teal-600 font-medium">Tap to dispense →</span>
                </div>
              );
            })}
            {rxQueue.length > 4 && <p className="text-xs text-teal-600 text-center pt-1">+{rxQueue.length-4} more waiting</p>}
          </div>
          <div className="flex items-center justify-center gap-2 bg-teal-600 text-white text-sm font-semibold rounded-xl py-2.5">
            <ShoppingCart className="w-4 h-4" /> Open Dispensing
          </div>
        </div>
      )}
      {lowStock?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 cursor-pointer" onClick={() => router.push('/procurement')}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" /><h3 className="font-bold text-red-900">Low Stock — Reorder Needed</h3></div>
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
            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /><h3 className="font-bold text-amber-900">Expiring in 30 Days</h3></div>
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

// ── Receptionist Dashboard ───────────────────────────────────────────────────
function ReceptionistDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['queue-today'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 30000 });
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/reports/dashboard').then(r => r.data) });

  const waiting  = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting').length : 0;
  const inConsult= Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation').length : 0;
  const done     = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reception</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-[#00b8a0] text-white border-[#00475a]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-amber-700">{waiting}</p><p className="text-xs text-amber-600 mt-1 font-medium">Waiting</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-blue-700">{inConsult}</p><p className="text-xs text-blue-600 mt-1 font-medium">In Consult</p></div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center"><p className="text-3xl font-bold text-green-700">{done}</p><p className="text-xs text-green-600 mt-1 font-medium">Done</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Today's Queue</h3>
          <button onClick={() => router.push('/receptionist/book-appointment')} className="text-xs text-[#00475a] hover:underline">+ Add patient</button>
        </div>
        {Array.isArray(queue) && queue.length > 0 ? (
          <div className="space-y-2">
            {queue.slice(0,8).map((q: any) => (
              <div key={q.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-[#00475a] text-xs font-bold">
                    {(q.patient_name||q.patient?.first_name||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{q.patient_name || `${q.patient?.first_name} ${q.patient?.last_name||''}`}</p>
                    <p className="text-xs text-gray-400">{q.chief_complaint || q.visit_type || 'Consultation'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${q.status==='waiting'?'bg-amber-100 text-amber-700':q.status==='in_consultation'?'bg-blue-100 text-blue-700':q.status==='completed'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>
                  {q.status?.replace('_',' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No patients in queue</p>
            <button onClick={() => router.push('/receptionist/book-appointment')} className="mt-3 text-xs text-[#00475a] hover:underline">Book first appointment →</button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-teal-50 text-teal-700 border-teal-200" />
        <QuickAction label="New Patient"      icon={UserPlus} href="/patients"                        color="bg-blue-50 text-blue-700 border-blue-200" />
        <QuickAction label="Follow-ups"       icon={Bell}     href="/receptionist/followups"           color="bg-purple-50 text-purple-700 border-purple-200" />
        <QuickAction label="Bills"            icon={FileText} href="/billing"                          color="bg-amber-50 text-amber-700 border-amber-200" />
      </div>
    </div>
  );
}

// ── Doctor Dashboard ─────────────────────────────────────────────────────────
function DoctorDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['my-queue'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 15000 });

  const waiting  = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting') : [];
  const inConsult= Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation').length : 0;
  const done     = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;
  const total    = Array.isArray(queue) ? queue.length : 0;

  return (
    <div className="p-3 lg:p-6" style={{ background: '#f8f9fa', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>My Queue</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <button onClick={() => router.push('/doctor')} style={{ background: '#00b8a0', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Start Consultation
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div style={{ background: 'linear-gradient(135deg,#007a6e,#00b8a0)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>👨‍⚕️</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>Total Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>{total}</div>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>Patients</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>⏳</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Waiting</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d97706' }}>{waiting.length}</div>
          <span style={{ fontSize: 10, color: '#d97706', fontWeight: 500 }}>In queue</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dbeafe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>🩺</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>In Consult</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#2563eb' }}>{inConsult}</div>
          <span style={{ fontSize: 10, color: '#2563eb', fontWeight: 500 }}>With doctor</span>
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '1.5px solid #00b8a0' }}>
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>✅</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Seen Today</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{done}</div>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Completed</span>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '0.5px solid #f3f4f6' }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Waiting Patients</span>
        </div>
        {waiting.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['#','Patient','Complaint','Time','Action'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: h==='Action'?'center':'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waiting.map((q: any, i: number) => (
                <tr key={q.id} style={{ borderTop: '0.5px solid #f3f4f6', cursor: 'pointer' }} onClick={() => router.push(`/doctor/consult/${q.id}`)}>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{i+1}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e1f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00b8a0', fontSize: 11, fontWeight: 700 }}>
                        {(q.patient_name||q.patient?.first_name||'?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{q.patient_name || `${q.patient?.first_name} ${q.patient?.last_name||''}`}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.chief_complaint || 'Consultation'}</td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.scheduled_time ? new Date(q.scheduled_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'Walk-in'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ background: '#e1f5ee', color: '#007a6e', fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>Start →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#16a34a' }}>Queue is clear!</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No patients waiting</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nurse Dashboard ───────────────────────────────────────────────────────────
function NurseDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['queue-precheck'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 15000 });

  const needsPrecheck = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting' && !q.precheck_done) : [];
  const done  = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;
  const total = Array.isArray(queue) ? queue.length : 0;

  return (
    <div className="p-3 lg:p-6" style={{ background: '#f8f9fa', minHeight: '100%' }}>
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
                {['#','Patient','Complaint','Action'].map(h => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: h==='Action'?'center':'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>{h}</th>
                ))}
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
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e' }}>{q.patient_name||`${q.patient?.first_name}`}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 12 }}>{q.chief_complaint||'Consultation'}</td>
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
        {[{ label: 'AI Care Plans', emoji: '🤖', href: '/ai-care', bg: '#ede9fe', color: '#7c3aed' },
          { label: 'Patients', emoji: '👥', href: '/patients', bg: '#dbeafe', color: '#2563eb' }].map(({ label, emoji, href, bg, color }) => (
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

// ── Root — routes by role ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { const user = getUser(); setRole(user?.role || 'owner'); }, []);
  if (!role) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-[#00475a]" /></div>;
  if (role === 'pharmacist' || role === 'assistant') return <div className="p-4"><PharmacistDashboard /></div>;
  if (role === 'receptionist') return <div className="p-4"><ReceptionistDashboard /></div>;
  if (role === 'doctor') return <div className="p-4 lg:p-6"><DoctorDashboard /></div>;
  if (role === 'nurse') return <div className="p-4"><NurseDashboard /></div>;
  return <OwnerDashboard />;
}
