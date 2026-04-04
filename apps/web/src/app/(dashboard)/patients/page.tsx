'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Search, Plus, X, Loader2, Users, Crown, CalendarClock, AlertCircle, Eye, Phone, MapPin, Shield, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

const SALUTATIONS = ['Mr','Mrs','Ms','Dr','Baby','Other'];
const GENDERS = ['male','female','other'];
const CATEGORIES = ['general','insurance','corporate','senior'];
const today = () => new Date().toISOString().split('T')[0];
const oneYearFromDate = (d: string) => { const dt=new Date(d); dt.setFullYear(dt.getFullYear()+1); return dt.toISOString().split('T')[0]; };
const EMPTY_FORM = { salutation:'Mr',first_name:'',last_name:'',gender:'male',dob:'',age:'',mobile:'',email:'',area:'',address:'',category:'general',ref_by:'',residence_number:'',is_first_visit:true,notes:'',is_vip:false,vip_start_date:'',vip_end_date:'',consent_given:false,consent_version:'1.0' };

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all'|'vip'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const qc = useQueryClient();
  const set = (f: string, v: any) => setForm((p: any) => ({ ...p, [f]: v }));
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [consentExpanded, setConsentExpanded] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['patient-stats'], queryFn: () => api.get('/patients/stats').then((r) => r.data) });
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search, filter],
    queryFn: () => { const p=new URLSearchParams(); if(search) p.set('search',search); if(filter==='vip') p.set('is_vip','true'); return api.get(`/patients?${p}`).then((r) => r.data); },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/patients', data).then((r) => r.data),
    onSuccess: () => { toast.success('Patient registered'); setShowForm(false); setForm({ ...EMPTY_FORM }); qc.invalidateQueries({ queryKey: ['patients'] }); qc.invalidateQueries({ queryKey: ['patient-stats'] }); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const handleSubmit = () => {
    if (!form.first_name || !form.mobile) { toast.error('Name and mobile are required'); return; }
    createMutation.mutate({ ...form, age:form.age?Number(form.age):undefined, dob:form.dob||undefined, vip_start_date:form.is_vip?(form.vip_start_date||today()):undefined, vip_end_date:form.is_vip?(form.vip_end_date||oneYearFromDate(today())):undefined });
  };

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

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0"><h3 className="font-semibold text-gray-900">Patient Registration</h3><button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button></div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              <div><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1 sm:col-span-2 flex flex-col sm:flex-row gap-2">
                    <div className="sm:w-28"><label className="label">Salutation</label><select className="input" value={form.salutation} onChange={(e) => set('salutation',e.target.value)}>{SALUTATIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
                    <div className="flex-1"><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={(e) => set('first_name',e.target.value)} placeholder="First name" /></div>
                    <div className="flex-1"><label className="label">Last Name</label><input className="input" value={form.last_name} onChange={(e) => set('last_name',e.target.value)} placeholder="Last name" /></div>
                  </div>
                  <div><label className="label">Gender</label><div className="flex gap-4 mt-2">{GENDERS.map((g) => <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize"><input type="radio" name="gender" value={g} checked={form.gender===g} onChange={() => set('gender',g)} />{g}</label>)}</div></div>
                  <div className="flex gap-2"><div className="flex-1"><label className="label">DOB</label><input type="date" className="input" value={form.dob} onChange={(e) => set('dob',e.target.value)} /></div><div className="w-20"><label className="label">Age</label><input type="number" className="input" value={form.age} onChange={(e) => set('age',e.target.value)} placeholder="yrs" min={0} /></div></div>
                  <div><label className="label">Mobile *</label><div className="flex gap-2"><span className="input w-14 text-center text-gray-500 bg-gray-50 flex-shrink-0">+91</span><input className="input flex-1" value={form.mobile} onChange={(e) => set('mobile',e.target.value)} placeholder="Mobile number" /></div></div>
                  <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => set('email',e.target.value)} placeholder="email@example.com" /></div>
                  <div><label className="label">Residence No.</label><input className="input" value={form.residence_number} onChange={(e) => set('residence_number',e.target.value)} placeholder="Landline / residence no." /></div>
                  <div><label className="label">Area</label><input className="input" value={form.area} onChange={(e) => set('area',e.target.value)} placeholder="Area / locality" /></div>
                  <div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => set('category',e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></div>
                  <div><label className="label">Referred By</label><input className="input" value={form.ref_by} onChange={(e) => set('ref_by',e.target.value)} placeholder="Doctor / person name" /></div>
                  <div className="col-span-1 sm:col-span-2"><label className="label">Address</label><textarea className="input resize-none" rows={2} value={form.address} onChange={(e) => set('address',e.target.value)} placeholder="Full address" /></div>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" /> MediSyn VIP Pass</p>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_vip} onChange={(e) => { const c=e.target.checked; const s=c?today():''; const en=c?oneYearFromDate(today()):''; setForm((p: any) => ({...p,is_vip:c,vip_start_date:s,vip_end_date:en})); }} className="w-4 h-4 accent-amber-600" /><span className="text-sm font-medium text-amber-800">Enroll as VIP Member</span></label>
                {form.is_vip && <div className="grid grid-cols-2 gap-3"><div><label className="label text-amber-700 text-xs">VIP Start</label><input type="date" className="input border-amber-200" value={form.vip_start_date} onChange={(e) => { const s=e.target.value; setForm((p: any) => ({...p,vip_start_date:s,vip_end_date:s?oneYearFromDate(s):''})); }} /></div><div><label className="label text-amber-700 text-xs">VIP End (1 year)</label><input type="date" className="input border-amber-300 bg-amber-100/60 text-amber-900 font-semibold" value={form.vip_end_date} onChange={(e) => set('vip_end_date',e.target.value)} /></div></div>}
              </div>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_first_visit} onChange={(e) => set('is_first_visit',e.target.checked)} className="w-4 h-4 accent-primary-600" /><span className="text-sm text-gray-700">Is First Visit</span></label>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes',e.target.value)} placeholder="Any notes..." /></div>

              {/* ── DPDPA Consent ── */}
              <div className={`rounded-xl border-2 p-4 transition-all ${form.consent_given ? 'border-[#00475a] bg-[#00475a]/5' : 'border-amber-300 bg-amber-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.consent_given} onChange={(e) => set('consent_given', e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#00475a] cursor-pointer flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#00475a] flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">Data Privacy Consent <span className="text-red-500">*</span></span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      I consent to MediSyn Speciality Clinic collecting and processing my personal and health data for pharmacy and medical services, as described in the{' '}
                      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#00475a] underline inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        Privacy Policy <ExternalLink className="w-3 h-3" />
                      </a>.
                    </p>
                  </div>
                </label>
                <button type="button" onClick={() => setConsentExpanded(!consentExpanded)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 ml-7">
                  {consentExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {consentExpanded ? 'Hide details' : 'What data do we collect?'}
                </button>
                {consentExpanded && (
                  <div className="ml-7 mt-2 text-xs text-gray-600 space-y-1 bg-white rounded-lg p-3 border border-gray-100">
                    <p className="font-medium">We collect: Name, mobile, DOB, address, prescriptions, visit history, billing records.</p>
                    <p className="font-medium mt-1">Your rights (DPDPA 2023): Access, correct, delete your data. Reply STOP to opt out of WhatsApp.</p>
                  </div>
                )}
                {!form.consent_given && <p className="text-xs text-amber-600 mt-2 ml-7">⚠️ Consent is required to register</p>}
              </div>
            </div>
            <div className="p-5 border-t flex gap-3 flex-shrink-0">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || !form.consent_given} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">{createMutation.isPending?<Loader2 className="w-4 h-4 animate-spin inline mr-1" />:null}Register Patient</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
