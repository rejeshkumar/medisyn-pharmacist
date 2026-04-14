'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
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

  const cashTotal = dash?.today_cash || 0;
  const upiTotal = dash?.today_upi || 0;
  const totalSales = dash?.today_sales || 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Owner Dashboard</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <div className="flex gap-2">
          <QuickAction label="Day Close" icon={CheckCircle2} href="/day-close" color="bg-[#00475a] text-white border-[#00475a] hover:bg-[#003d4d]" />
        </div>
      </div>

      {/* URGENT ALERTS FIRST */}
      {((lowStock?.length > 0) || (nearExpiry?.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStock?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 cursor-pointer hover:shadow-md" onClick={() => router.push('/procurement')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h3 className="font-bold text-red-900">Low Stock Alert</h3>
                </div>
                <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{lowStock.length} items</span>
              </div>
              {lowStock.slice(0,4).map((b: any) => (
                <div key={b.id} className="flex justify-between py-1 border-b border-red-100 last:border-0">
                  <span className="text-sm text-red-800 truncate">{b.medicine?.brand_name}</span>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold ml-2 shrink-0">{b.quantity} left</span>
                </div>
              ))}
              {lowStock.length > 4 && <p className="text-xs text-red-600 mt-2 font-medium">+{lowStock.length-4} more → View in Procurement</p>}
            </div>
          )}
          {nearExpiry?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 cursor-pointer hover:shadow-md" onClick={() => router.push('/reports')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-amber-900">Expiring Soon (30d)</h3>
                </div>
                <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{nearExpiry.length} batches</span>
              </div>
              {nearExpiry.slice(0,4).map((b: any) => (
                <div key={b.id} className="flex justify-between py-1 border-b border-amber-100 last:border-0">
                  <span className="text-sm text-amber-900 truncate">{b.medicine?.brand_name}</span>
                  <span className="text-xs text-amber-700 font-medium ml-2 shrink-0">{formatDate(b.expiry_date)}</span>
                </div>
              ))}
              {nearExpiry.length > 4 && <p className="text-xs text-amber-600 mt-2 font-medium">+{nearExpiry.length-4} more → View Expiry Report</p>}
            </div>
          )}
        </div>
      )}

      {/* Today KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Today's Revenue" value={fmt(totalSales)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" border="border-green-100" sub={`${dash?.today_bill_count||0} bills`} />
        <KpiCard label="Cash Collected" value={fmt(cashTotal)} icon={Banknote} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
        <KpiCard label="UPI Received" value={fmt(upiTotal)} icon={Smartphone} color="text-purple-600" bg="bg-purple-50" border="border-purple-100" />
        <KpiCard label="Total Bills" value={dash?.today_bill_count||0} icon={FileText} color="text-teal-600" bg="bg-teal-50" border="border-teal-100" onClick={() => router.push('/billing')} />
      </div>

      {/* Top medicines */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Top Selling Medicines</h2>
          <button onClick={() => router.push('/reports')} className="text-xs text-[#00475a] hover:underline flex items-center gap-1">View report <ArrowRight className="w-3 h-3" /></button>
        </div>
        {dash?.top_medicines?.length > 0 ? (
          <div className="space-y-2">
            {dash.top_medicines.slice(0,8).map((med: any, i: number) => (
              <div key={med.medicine_id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 w-5 font-mono">{i+1}</span>
                <p className="text-sm font-medium text-gray-800 flex-1 truncate">{med.medicine_name}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{med.total_qty} units</p>
                  <p className="text-xs text-gray-400">{fmt(med.total_revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-8">No sales data yet</p>}
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pharmacy</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · {new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</p>
        </div>
        <QuickAction label="New Bill" icon={ShoppingCart} href="/dispensing" color="bg-[#00475a] text-white border-[#00475a]" />
      </div>

      {/* Today stats */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Bills Today" value={dash?.today_bill_count||0} icon={FileText} color="text-teal-600" bg="bg-teal-50" border="border-teal-100" onClick={() => router.push('/billing')} />
        <KpiCard label="Today's Sales" value={fmt(dash?.today_sales||0)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" border="border-green-100" />
      </div>

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
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-[#00475a] text-white border-[#00475a]" />
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
                  <div className="w-8 h-8 bg-[#00475a]/10 rounded-full flex items-center justify-center text-[#00475a] text-xs font-bold">{i+1}</div>
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
