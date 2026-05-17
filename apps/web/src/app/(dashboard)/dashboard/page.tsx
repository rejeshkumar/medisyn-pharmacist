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
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/reports/dashboard').then(r => r.data), refetchInterval: 60000 });
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: () => api.get('/stock/alerts/low-stock').then(r => r.data) });
  const { data: nearExpiry } = useQuery({ queryKey: ['near-expiry'], queryFn: () => api.get('/stock/alerts/near-expiry?days=30').then(r => r.data) });

  const fmt = (v: number) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const totalSales = dash?.today_sales || 0;
  const cashTotal = dash?.today_cash || 0;
  const upiTotal = dash?.today_upi || 0;
  const billCount = dash?.today_bill_count || 0;
  const dailyData = dash?.daily_sales || [];
  const recentBills = dash?.recent_bills || [];
  const topMeds = dash?.top_medicines || [];
  const maxQty = Math.max(...topMeds.map((m: any) => m.total_qty || 0), 1);
  const today = new Date().getDate().toString().padStart(2, '0');

  return (
    <div style={{ padding: '24px', background: '#f8f9fa', minHeight: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Order Details</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
            Overview › <span style={{ color: '#00b8a0' }}>Dashboard</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/day-close')}
            style={{ background: '#00b8a0', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            ✓ Day Close
          </button>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* Card 1 - Dark */}
        <div style={{ background: 'linear-gradient(135deg, #007a6e 0%, #00b8a0 100%)', borderRadius: 16, padding: '20px', color: 'white', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 16 }}>₹</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Total Revenue</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 6 }}>{fmt(totalSales)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ background: '#00b8a0', color: 'white', fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>{billCount} bills</span>
            <span>Since today</span>
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#f0fdf4' }} />
          <div style={{ width: 36, height: 36, background: '#dcfce7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#16a34a', fontSize: 16 }}>👥</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Total Patients</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>{billCount}</div>
          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>↑ Since today</span>
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: '#fef3c7' }} />
          <div style={{ width: 36, height: 36, background: '#fef3c7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#d97706', fontSize: 16 }}>🛒</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Total Orders</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>{billCount}</div>
          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#d97706', fontSize: 11, fontWeight: 600 }}>↑ Since today</span>
          </div>
        </div>

        {/* Card 4 - Alerts */}
        <div style={{ background: 'white', borderRadius: 16, padding: '20px', border: '0.5px solid #e5e7eb', cursor: 'pointer' }} onClick={() => router.push('/procurement')}>
          <div style={{ width: 36, height: 36, background: '#fee2e2', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#dc2626', fontSize: 16 }}>⚠</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Low Stock Items</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>{lowStock?.length || 0}</div>
          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>View in Procurement →</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Sales Analytics Chart */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Sales Analytics</span>
            <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '4px 10px', borderRadius: 6 }}>This Month</span>
          </div>
          <div style={{ padding: '0 16px 16px', height: 200 }}>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} labelFormatter={(l) => `Day ${l}`} contentStyle={{ fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb' }} />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {dailyData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.day === today ? '#00b8a0' : '#e1f5ee'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 13 }}>
                No sales data this month
              </div>
            )}
          </div>
        </div>

        {/* Expiring Soon */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer' }} onClick={() => router.push('/reports')}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #f3f4f6' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Expiring Soon</span>
            <span style={{ background: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>{nearExpiry?.length || 0} batches</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {(nearExpiry || []).slice(0, 6).map((b: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px', borderBottom: '0.5px solid #f9fafb' }}>
                <span style={{ fontSize: 12, color: '#374151', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: 8 }}>{b.medicine?.brand_name}</span>
                <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500, flexShrink: 0 }}>
                  {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                </span>
              </div>
            ))}
            {(nearExpiry?.length || 0) === 0 && (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No expiring batches</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Latest Orders Table */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #f3f4f6' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Latest Orders</span>
            <span onClick={() => router.push('/billing')} style={{ fontSize: 12, color: '#00b8a0', cursor: 'pointer', fontWeight: 500 }}>View All</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Bill No</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Patient</th>
                <th style={{ padding: '8px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Amount</th>
                <th style={{ padding: '8px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 500, fontSize: 11 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.length > 0 ? recentBills.map((bill: any, i: number) => (
                <tr key={i} style={{ borderTop: '0.5px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px', color: '#6b7280', fontSize: 11 }}>#{bill.bill_number?.split('-').pop()}</td>
                  <td style={{ padding: '10px 16px', color: '#1a1a2e', fontWeight: 500 }}>{bill.customer_name || 'Walk-in'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#1a1a2e', fontWeight: 600 }}>{fmt(bill.total_amount)}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>Paid</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No bills today</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Selling Medicines */}
        <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #f3f4f6' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>Top Selling Medicine</span>
            <span style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '4px 10px', borderRadius: 6 }}>This Month</span>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {topMeds.length > 0 ? topMeds.slice(0, 5).map((med: any, i: number) => {
              const colors = ['#00b8a0', '#1a2e1a', '#16a34a', '#0891b2', '#7c3aed'];
              const pct = Math.round((med.total_qty / maxQty) * 100);
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{med.medicine_name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: colors[i] }}>{fmt(med.total_revenue)}</span>
                  </div>
                  <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4 }}>
                    <div style={{ height: 8, background: colors[i], borderRadius: 4, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{med.total_qty} units sold</div>
                </div>
              );
            }) : (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No sales data yet</p>
            )}
          </div>
        </div>
      </div>
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

      {/* Today stats */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Bills Today" value={dash?.today_bill_count||0} icon={FileText} color="text-teal-600" bg="bg-teal-50" border="border-teal-100" onClick={() => router.push('/billing')} />
        <KpiCard label="Today's Sales" value={fmt(dash?.today_sales||0)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" border="border-green-100" />
      </div>

      {/* ── Prescriptions Waiting ── */}
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

      {/* URGENT: Low stock + expiry */}
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

      {/* Quick actions */}
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
  const { data: queue } = useQuery({ queryKey: ['queue-today'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 30000 });
  const { data: dash } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/reports/dashboard').then(r => r.data) });

  const waiting = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting').length : 0;
  const inConsult = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation').length : 0;
  const done = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reception</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-[#00b8a0] text-white border-[#00475a]" />
      </div>

      {/* Queue status */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{waiting}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Waiting</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-700">{inConsult}</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">In Consult</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{done}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Done</p>
        </div>
      </div>

      {/* Today's queue */}
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
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  q.status === 'waiting' ? 'bg-amber-100 text-amber-700' :
                  q.status === 'in_consultation' ? 'bg-blue-100 text-blue-700' :
                  q.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>{q.status?.replace('_',' ')}</span>
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

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-teal-50 text-teal-700 border-teal-200" />
        <QuickAction label="New Patient" icon={UserPlus} href="/patients" color="bg-blue-50 text-blue-700 border-blue-200" />
        <QuickAction label="Follow-ups" icon={Bell} href="/receptionist/followups" color="bg-purple-50 text-purple-700 border-purple-200" />
        <QuickAction label="Bills" icon={FileText} href="/billing" color="bg-amber-50 text-amber-700 border-amber-200" />
      </div>
    </div>
  );
}

// ── Doctor Dashboard ─────────────────────────────────────────────────────────
function DoctorDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['my-queue'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 15000 });

  const waiting = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting') : [];
  const done = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Queue</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{waiting.length}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Waiting</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{done}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Seen Today</p>
        </div>
      </div>

      {waiting.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Waiting Patients</h3>
          <div className="space-y-2">
            {waiting.map((q: any, i: number) => (
              <div key={q.id} onClick={() => router.push(`/doctor/consult/${q.id}`)}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-teal-50 transition-colors border border-slate-100 hover:border-teal-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#00b8a0]/10 rounded-full flex items-center justify-center text-[#00475a] text-xs font-bold">{i+1}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{q.patient_name || `${q.patient?.first_name} ${q.patient?.last_name||''}`}</p>
                    <p className="text-xs text-gray-500">{q.chief_complaint || 'Consultation'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{q.scheduled_time ? new Date(q.scheduled_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'Walk-in'}</span>
                  <ArrowRight className="w-4 h-4 text-[#00475a]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {waiting.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="font-semibold text-green-800">Queue is clear!</p>
          <p className="text-sm text-green-600 mt-1">No patients waiting</p>
        </div>
      )}
    </div>
  );
}

// ── Nurse Dashboard ──────────────────────────────────────────────────────────
function NurseDashboard() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['queue-precheck'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 15000 });

  const needsPrecheck = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting' && !q.precheck_done) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nurse Station</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
      </div>

      <KpiCard label="Vitals Pending" value={needsPrecheck.length} icon={Activity} color="text-red-600" bg="bg-red-50" border="border-red-100" />

      {needsPrecheck.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Pre-check Pending</h3>
          <div className="space-y-2">
            {needsPrecheck.map((q: any) => (
              <div key={q.id} onClick={() => router.push(`/nurse/precheck/${q.id}`)}
                className="flex items-center justify-between p-3 bg-red-50 rounded-xl cursor-pointer hover:bg-red-100 border border-red-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{q.patient_name || `${q.patient?.first_name}`}</p>
                  <p className="text-xs text-gray-500">{q.chief_complaint || 'Consultation'}</p>
                </div>
                <div className="flex items-center gap-1 text-red-600 text-xs font-medium">
                  Record vitals <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <QuickAction label="AI Care Plans" icon={Heart} href="/ai-care" color="bg-purple-50 text-purple-700 border-purple-200" />
        <QuickAction label="Patients" icon={Users} href="/patients" color="bg-blue-50 text-blue-700 border-blue-200" />
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
  if (role === 'doctor') return <div className="p-4"><DoctorDashboard /></div>;
  if (role === 'nurse') return <div className="p-4"><NurseDashboard /></div>;
  return <div className="p-4 lg:p-6"><OwnerDashboard /></div>;
}
