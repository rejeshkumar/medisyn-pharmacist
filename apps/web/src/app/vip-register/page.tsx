'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Crown, Pill, CheckCircle2, Loader2, Star } from 'lucide-react';

type Step = 'form' | 'success';

const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Other'];
const GENDERS = ['male', 'female', 'other'];

export default function VipRegisterPage() {
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [form, setForm] = useState({
    salutation: 'Mr', first_name: '', last_name: '', gender: 'male',
    dob: '', mobile: '', email: '', area: '', address: '',
    vip_registered_by: '',
  });

  const set = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.mobile) { setError('Name and mobile number are required.'); return; }
    if (form.mobile.replace(/\D/g, '').length < 10) { setError('Please enter a valid 10-digit mobile number.'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/patients/vip-register', form);
      setPatient(data);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const vipEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 flex flex-col items-center justify-center p-4">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900">MediSyn</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-amber-800">VIP Pass Registration</h1>
          <Crown className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-gray-500 text-sm max-w-md">
          Register for the MediSyn VIP Pass and enjoy exclusive benefits for one full year
        </p>
      </div>

      {/* VIP Benefits banner */}
      <div className="flex gap-4 mb-6 flex-wrap justify-center">
        {[
          'Priority Service',
          'Exclusive Discounts',
          'Free Delivery',
          'Health Reminders',
        ].map((b) => (
          <div key={b} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {b}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-5 text-white text-center">
              <Crown className="w-8 h-8 mx-auto mb-1" />
              <p className="font-bold text-lg">Register for VIP Pass</p>
              <p className="text-amber-100 text-xs mt-1">MediSyn Specialty Clinic, Taliparamba</p>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
              )}

              <div className="flex gap-2">
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Salutation</label>
                  <select className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.salutation} onChange={(e) => set('salutation', e.target.value)}>
                    {SALUTATIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} placeholder="First name" required />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} placeholder="Last name" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                <div className="flex gap-4">
                  {GENDERS.map((g) => (
                    <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                      <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={() => set('gender', g)} className="accent-amber-500" />
                      {g}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile No. *</label>
                  <div className="flex gap-1.5">
                    <span className="border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-500 bg-gray-50">+91</span>
                    <input className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="Mobile" required maxLength={10} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email ID</label>
                <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="email@example.com" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Area / Locality</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Area" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Registered By</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={form.vip_registered_by} onChange={(e) => set('vip_registered_by', e.target.value)} placeholder="Sales staff name" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Residential address" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span>VIP Pass will be active from today and valid for <strong>1 full year</strong> until <strong>{vipEndDate}</strong></span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold py-3 rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                {loading ? 'Registering...' : 'Register for VIP Pass'}
              </button>
            </div>
          </form>
        ) : (
          /* Success card */
          <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden text-center">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-white">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Welcome to VIP!</h2>
              <p className="text-amber-100 text-sm mt-1">Registration successful</p>
            </div>
            <div className="p-6 space-y-4">
              {/* VIP Card */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    <span className="font-bold text-sm">MediSyn</span>
                  </div>
                  <Crown className="w-6 h-6" />
                </div>
                <p className="text-xl font-bold mb-0.5">{patient?.salutation} {patient?.first_name} {patient?.last_name || ''}</p>
                <p className="text-amber-100 text-sm">{patient?.mobile}</p>
                <div className="mt-3 pt-3 border-t border-amber-300 flex justify-between items-end">
                  <div>
                    <p className="text-amber-200 text-xs">UHID</p>
                    <p className="font-mono font-bold text-sm">{patient?.uhid}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-200 text-xs">Valid Until</p>
                    <p className="font-bold text-sm">
                      {patient?.vip_end_date ? new Date(patient.vip_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : vipEndDate}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Your MediSyn VIP Pass is now active. Visit the clinic to enjoy exclusive benefits.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {['Priority dispensing', 'Exclusive discounts', 'Free health reminders', 'Loyalty rewards'].map((b) => (
                  <div key={b} className="flex items-center gap-1.5 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>

              <button
                onClick={() => { setStep('form'); setForm({ salutation: 'Mr', first_name: '', last_name: '', gender: 'male', dob: '', mobile: '', email: '', area: '', address: '', vip_registered_by: '' }); setPatient(null); }}
                className="w-full border border-amber-300 text-amber-700 font-medium py-2.5 rounded-xl hover:bg-amber-50 text-sm"
              >
                Register Another Member
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        MediSyn Specialty Clinic, Taliparamba · Pharmacy Management System
      </p>
    </div>
  );
}
