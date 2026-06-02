'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Search, Plus, Users, Crown, CalendarClock, AlertCircle, Eye, MapPin, Loader2, Phone } from 'lucide-react';
import { PatientRegistrationModal } from '@/components/patients/PatientRegistrationModal';

const SALUTATIONS = ['Mr','Mrs','Ms','Dr','Baby','Other'];
const GENDERS = ['male','female','other'];
const CATEGORIES = ['general','insurance','corporate','senior'];

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'vip'>('all');
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['patient-stats'], queryFn: () => api.get('/patients/stats').then((r) => r.data) });
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search, filter],
    queryFn: () => { const p=new URLSearchParams(); if(search) p.set('search',search); if(filter==='vip') p.set('is_vip','true'); return api.get(`/patients?${p}`).then((r) => r.data); },
  });


  const vipUrl = typeof window !== 'undefined' ? `${window.location.origin}/vip-register` : '/vip-register';

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-xl font-bold text-gray-900">Patient Management</h1><p className="text-sm text-gray-500">{patients?.length || 0} patients</p></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { navigator.clipboard.writeText(vipUrl); toast.success('VIP link copied!'); }} className="btn-secondary flex items-center gap-2 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 text-xs sm:text-sm"><Crown className="w-4 h-4" /><span className="hidden sm:inline">Copy VIP Link</span><span className="sm:hidden">VIP Link</span></button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Register Patient</span><span className="sm:hidden">Register</span></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total Patients',value:stats?.totalPatients??0,icon:Users,color:'text-blue-600',bg:'bg-blue-50' },
          { label:'VIP Members',value:stats?.vipPatients??0,icon:Crown,color:'text-amber-600',bg:'bg-amber-50' },
          { label:"Today's Appts",value:stats?.todayAppointments??0,icon:CalendarClock,color:'text-green-600',bg:'bg-green-50' },
          { label:'Missed Visits',value:stats?.missedCount??0,icon:AlertCircle,color:'text-red-600',bg:'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500 leading-tight">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, mobile or UHID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm self-start">
          {(['all','vip'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 font-medium transition-colors ${filter===f?'bg-primary-600 text-white':'text-gray-600 hover:bg-gray-50'}`}>{f==='vip'?'⭐ VIP':'All'}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : !patients?.length ? (
        <div className="card text-center py-12 text-gray-400"><Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No patients found</p></div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {patients.map((p: any) => (
              <Link key={p.id} href={`/patients/${p.id}`} className="card p-4 block">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">{p.first_name?.[0]?.toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{p.salutation} {p.first_name} {p.last_name||''}</p>
                      {p.is_vip && <span className="badge bg-amber-100 text-amber-700 border-amber-200 text-xs flex items-center gap-1"><Crown className="w-3 h-3" />VIP</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="font-mono">{p.uhid}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.mobile}</span>
                      {p.area && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.area}</span>}
                    </div>
                  </div>
                  <Eye className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="card p-0 overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">UHID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mobile</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Area</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">VIP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Registered</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {patients.map((p: any) => (
                  <tr key={p.id} className="table-row">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">{p.first_name?.[0]?.toUpperCase()}</div><div><p className="font-medium text-gray-900">{p.salutation} {p.first_name} {p.last_name||''}</p><p className="text-xs text-gray-400">{p.gender}{p.age?` · ${p.age}y`:''}</p></div></div></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.uhid}</td>
                    <td className="px-4 py-3 text-gray-700"><div className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{p.mobile}</div></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{p.area?<div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{p.area}</div>:'—'}</td>
                    <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-600 border-gray-200 capitalize text-xs">{p.category}</span></td>
                    <td className="px-4 py-3">{p.is_vip?<span className="badge bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 w-fit"><Crown className="w-3 h-3" />VIP</span>:<span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3"><Link href={`/patients/${p.id}`} className="text-gray-400 hover:text-primary-600"><Eye className="w-4 h-4" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PatientRegistrationModal
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}
