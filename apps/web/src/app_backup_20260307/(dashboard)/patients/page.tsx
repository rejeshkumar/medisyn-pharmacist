'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';
import {
  Search, Plus, X, Loader2, Users, Crown, CalendarClock,
  AlertCircle, Eye, Star, Phone, MapPin,
} from 'lucide-react';

const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Other'];
const GENDERS = ['male', 'female', 'other'];
const CATEGORIES = ['general', 'insurance', 'corporate', 'senior'];

const today = () => new Date().toISOString().split('T')[0];
const oneYearFromDate = (dateStr: string) => {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
};

const EMPTY_FORM = {
  salutation: 'Mr', first_name: '', last_name: '', gender: 'male',
  dob: '', age: '', mobile: '', email: '', area: '', address: '',
  category: 'general', ref_by: '', residence_number: '', is_first_visit: true,
  notes: '', is_vip: false, vip_start_date: '', vip_end_date: '',
};

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'vip'>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY_FORM });
  const qc = useQueryClient();
  const set = (f: string, v: any) => setForm((p: any) => ({ ...p, [f]: v }));

  const { data: stats } = useQuery({
    queryKey: ['patient-stats'],
    queryFn: () => api.get('/patients/stats').then((r) => r.data),
  });

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search, filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter === 'vip') params.set('is_vip', 'true');
      return api.get(`/patients?${params}`).then((r) => r.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/patients', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Patient registered successfully');
      setShowForm(false);
      setForm({ ...EMPTY_FORM });
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient-stats'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Registration failed'),
  });

  const handleSubmit = () => {
    if (!form.first_name || !form.mobile) { toast.error('Name and mobile are required'); return; }
    createMutation.mutate({
      ...form,
      age: form.age ? Number(form.age) : undefined,
      dob: form.dob || undefined,
      vip_start_date: form.is_vip ? (form.vip_start_date || today()) : undefined,
      vip_end_date: form.is_vip ? (form.vip_end_date || oneYearFromDate(today())) : undefined,
    });
  };

  const vipUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/vip-register`
    : '/vip-register';

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-sm text-gray-500">{patients?.length || 0} patients registered</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { navigator.clipboard.writeText(vipUrl); toast.success('VIP registration link copied!'); }}
            className="btn-secondary flex items-center gap-2 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100"
          >
            <Crown className="w-4 h-4" />
            Copy VIP Link
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Patient
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', value: stats?.totalPatients ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'VIP Members', value: stats?.vipPatients ?? 0, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: "Today's Appointments", value: stats?.todayAppointments ?? 0, icon: CalendarClock, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Missed Visits', value: stats?.missedCount ?? 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name, mobile or UHID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {(['all', 'vip'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-medium transition-colors ${filter === f ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {f === 'vip' ? '⭐ VIP Only' : 'All Patients'}
            </button>
          ))}
        </div>
      </div>

      {/* Patient table */}
      <div className="card p-0 overflow-hidden">
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
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : patients?.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No patients found
              </td></tr>
            ) : (
              patients?.map((p: any) => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-xs flex-shrink-0">
                        {p.first_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.salutation} {p.first_name} {p.last_name || ''}</p>
                        <p className="text-xs text-gray-400">{p.gender} {p.age ? `· ${p.age}y` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.uhid}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{p.mobile}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.area ? <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400" />{p.area}</div> : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-100 text-gray-600 border-gray-200 capitalize text-xs">{p.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    {p.is_vip ? (
                      <div>
                        <span className="badge bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1 w-fit">
                          <Crown className="w-3 h-3" /> VIP
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">till {formatDate(p.vip_end_date)}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`} className="text-gray-400 hover:text-primary-600">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Registration Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Patient Registration</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex gap-2">
                    <div className="w-28">
                      <label className="label">Salutation</label>
                      <select className="input" value={form.salutation} onChange={(e) => set('salutation', e.target.value)}>
                        {SALUTATIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="label">First Name *</label>
                      <input className="input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="First name" />
                    </div>
                    <div className="flex-1">
                      <label className="label">Last Name</label>
                      <input className="input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Last name" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <div className="flex gap-4 mt-2">
                      {GENDERS.map((g) => (
                        <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                          <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} />
                          {g}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="label">DOB</label>
                      <input type="date" className="input" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
                    </div>
                    <div className="w-20">
                      <label className="label">Age</label>
                      <input type="number" className="input" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="yrs" min={0} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Mobile No. *</label>
                    <div className="flex gap-2">
                      <span className="input w-14 text-center text-gray-500 bg-gray-50 flex-shrink-0">+91</span>
                      <input className="input flex-1" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="Mobile number" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Email ID</label>
                    <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="label">Residence No.</label>
                    <input className="input" value={form.residence_number} onChange={(e) => set('residence_number', e.target.value)} placeholder="Res. number" />
                  </div>
                  <div>
                    <label className="label">Referred By</label>
                    <input className="input" value={form.ref_by} onChange={(e) => set('ref_by', e.target.value)} placeholder="Doctor / person name" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Address</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Area</label>
                    <input className="input" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Area / locality" />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Residential Address</label>
                    <textarea className="input resize-none" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Full address" />
                  </div>
                </div>
              </div>

              {/* VIP Pass */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" /> MediSyn VIP Pass
                </p>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_vip}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const start = checked ? today() : '';
                      const end = checked ? oneYearFromDate(today()) : '';
                      setForm((p: any) => ({ ...p, is_vip: checked, vip_start_date: start, vip_end_date: end }));
                    }}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="text-sm font-medium text-amber-800">Enroll as VIP Member</span>
                </label>

                {form.is_vip && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-amber-700 text-xs">VIP Start Date</label>
                      <input
                        type="date"
                        className="input border-amber-200 bg-white focus:ring-amber-400"
                        value={form.vip_start_date}
                        onChange={(e) => {
                          const start = e.target.value;
                          setForm((p: any) => ({ ...p, vip_start_date: start, vip_end_date: start ? oneYearFromDate(start) : '' }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="label text-amber-700 text-xs">VIP End Date <span className="text-amber-500 font-normal">(auto: 1 year)</span></label>
                      <input
                        type="date"
                        className="input border-amber-300 bg-amber-100/60 text-amber-900 font-semibold focus:ring-amber-400"
                        value={form.vip_end_date}
                        onChange={(e) => set('vip_end_date', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        VIP Pass valid for <strong className="mx-1">1 year</strong> —
                        from <strong className="mx-1">{form.vip_start_date ? new Date(form.vip_start_date).toLocaleDateString('en-IN') : '—'}</strong>
                        to <strong className="ml-1">{form.vip_end_date ? new Date(form.vip_end_date).toLocaleDateString('en-IN') : '—'}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_first_visit} onChange={(e) => set('is_first_visit', e.target.checked)} className="w-4 h-4 accent-primary-600" />
                  <span className="text-sm text-gray-700">Is First Visit</span>
                </label>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any notes about the patient..." />
              </div>

            </div>

            <div className="p-5 border-t flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending} className="btn-primary flex-1">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Register Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
