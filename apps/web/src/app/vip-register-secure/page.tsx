'use client';

import Image from 'next/image';
import { useState, useEffect, Suspense } from 'react';
import api from '@/lib/api';
import { Crown, CheckCircle2, Loader2, Share2, Smartphone, Banknote, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

type Step = 'form' | 'payment' | 'success';
const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Other'];

const PLANS = [
  { key: 'individual' as const, label: 'Individual', price: 599,  desc: '1 person',    icon: '👤' },
  { key: 'family'     as const, label: 'Family',     price: 999, desc: 'Up to 4 members', icon: '👨‍👩‍👧‍👦' },
];

const PRICES: Record<string, number> = {
  individual: 599,
  family: 999,
};

function VipRegisterContent() {
  const [step, setStep]       = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const params      = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const agentCode   = params.get('agent') || '';
  const accessToken = params.get('token') || '';

  const [form, setForm] = useState({
    salutation:     'Mr',
    first_name:     '',
    mobile:         '',
    vip_category:   'individual' as 'individual' | 'family',
    payment_method: '' as 'upi' | 'cash' | '',
    upi_txn_id:     '',
  });

  useEffect(() => {
    const amount = PRICES[form.vip_category];
    const upiUrl = `upi://pay?pa=medisyn@paytm&pn=MediSyn Clinic&am=${amount}&cu=INR&tn=VIP Pass ${form.vip_category}`;
    QRCode.toDataURL(upiUrl, { width: 260, margin: 1 })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [form.vip_category]);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.mobile) { setError('Name and mobile are required.'); return; }
    if (form.mobile.replace(/\D/g, '').length < 10) { setError('Enter a valid 10-digit mobile.'); return; }
    if (!agentCode || !accessToken) { setError('Invalid registration link. Please use the link provided by your agent.'); return; }
    setError('');
    setStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!form.payment_method) { setError('Please select a payment method.'); return; }
    if (form.payment_method === 'upi' && !form.upi_txn_id) { setError('Please enter UPI transaction ID.'); return; }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/patients/vip-register-secure', {
        ...form,
        agent_code:     agentCode,
        access_token:   accessToken,
        payment_amount: PRICES[form.vip_category],
      });
      setPatient(data);
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareViaWhatsApp = () => {
    const message = `🎉 Welcome to MediSyn VIP Club!\n\nName: ${patient?.salutation} ${patient?.first_name}\nUHID: ${patient?.uhid}\nMobile: ${patient?.mobile}\nPlan: ${form.vip_category.toUpperCase()}\n\n✅ Benefits:\n• Priority Service\n• Exclusive Discounts\n• Health Reminders\n\nMediSyn Speciality Clinic, Taliparamba`;
    window.open(`https://wa.me/${patient?.mobile}?text=${encodeURIComponent(message)}`, '_blank');
  };

  /* ── Invalid link ── */
  if (!agentCode || !accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-sm text-center shadow-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-semibold text-red-700 mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">This VIP registration link is invalid. Please contact your agent for the correct link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">

      {/* ── Header — clean, no logo ── */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <Image src="/images/simplirx-logo.jpg" alt="SimpliRx" width={180} height={54} className="object-contain" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="w-5 h-5 text-[#00b8a0]" />
          <h1 className="text-xl font-bold text-[#00b8a0]">VIP Pass Registration</h1>
          <Crown className="w-5 h-5 text-[#00b8a0]" />
        </div>
        <p className="text-gray-400 text-sm mt-1">Exclusive benefits for one full year</p>
        {agentCode && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-[#e1f5ee] border border-[#9FE1CB] rounded-full px-3 py-1 text-xs font-medium text-[#085041]">
            Agent: {agentCode.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </div>
        )}
      </div>

      {/* ── Benefit pills ── */}
      <div className="flex gap-2 mb-6 flex-wrap justify-center">
        {['Priority Service', 'Exclusive Discounts', 'Health Reminders'].map(b => (
          <div key={b} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
            <CheckCircle2 className="w-3 h-3 text-[#00b8a0]" /> {b}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">

        {/* ── Step 1: Form ── */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

            <div className="bg-[#00b8a0] px-5 py-4 text-white text-center">
              <p className="font-semibold text-base">Step 1 of 2 — Member Details</p>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              {/* Name row */}
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b8a0] bg-white"
                    value={form.salutation} onChange={e => set('salutation', e.target.value)}>
                    {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b8a0]"
                    value={form.first_name} onChange={e => set('first_name', e.target.value)}
                    placeholder="Enter full name" required />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mobile *</label>
                <div className="flex gap-1.5">
                  <span className="border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-400 bg-gray-50">+91</span>
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b8a0]"
                    value={form.mobile} onChange={e => set('mobile', e.target.value)}
                    placeholder="10-digit mobile" required maxLength={10} inputMode="numeric" />
                </div>
              </div>

              {/* Plan selector — only 2 plans, side by side */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Select Plan *</label>
                <div className="grid grid-cols-2 gap-3">
                  {PLANS.map(plan => (
                    <button type="button" key={plan.key} onClick={() => set('vip_category', plan.key)}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${
                        form.vip_category === plan.key
                          ? 'border-[#00b8a0] bg-[#e1f5ee]'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <div className="text-2xl mb-1">{plan.icon}</div>
                      <p className={`text-sm font-bold ${form.vip_category === plan.key ? 'text-[#00b8a0]' : 'text-gray-700'}`}>
                        {plan.label}
                      </p>
                      <p className={`text-xl font-bold mt-1 ${form.vip_category === plan.key ? 'text-[#00b8a0]' : 'text-gray-800'}`}>
                        ₹{plan.price}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{plan.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit"
                className="w-full bg-[#00b8a0] text-white font-semibold py-3 rounded-xl hover:bg-[#009688] transition-colors">
                Continue to Payment →
              </button>
            </div>
          </form>
        )}

        {/* ── Step 2: Payment ── */}
        {step === 'payment' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

            <div className="bg-[#00b8a0] px-5 py-4 text-white text-center">
              <p className="font-semibold text-base">Step 2 of 2 — Payment</p>
              <p className="text-white/70 text-sm mt-0.5">
                {form.vip_category === 'individual' ? 'Individual' : 'Family'} Plan — ₹{PRICES[form.vip_category]}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              {/* Payment method */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Payment Method *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => set('payment_method', 'upi')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.payment_method === 'upi' ? 'border-[#00b8a0] bg-[#e1f5ee]' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <Smartphone className={`w-7 h-7 mx-auto mb-1.5 ${form.payment_method === 'upi' ? 'text-[#00b8a0]' : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold ${form.payment_method === 'upi' ? 'text-[#00b8a0]' : 'text-gray-600'}`}>UPI</p>
                  </button>
                  <button type="button" onClick={() => set('payment_method', 'cash')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.payment_method === 'cash' ? 'border-[#00b8a0] bg-[#e1f5ee]' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <Banknote className={`w-7 h-7 mx-auto mb-1.5 ${form.payment_method === 'cash' ? 'text-[#00b8a0]' : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold ${form.payment_method === 'cash' ? 'text-[#00b8a0]' : 'text-gray-600'}`}>Cash</p>
                  </button>
                </div>
              </div>

              {/* UPI panel */}
              {form.payment_method === 'upi' && (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-4 h-4 text-[#00b8a0]" />
                    <p className="text-sm font-medium text-gray-700">Scan to Pay ₹{PRICES[form.vip_category]}</p>
                  </div>
                  {qrDataUrl && (
                    <div className="bg-white p-3 rounded-lg border border-gray-100 inline-block w-full text-center">
                      <img src={qrDataUrl} alt="UPI QR Code" className="w-56 h-56 mx-auto" />
                      <p className="text-xs text-gray-400 mt-1">medisyn@paytm</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">UPI Transaction ID *</label>
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b8a0]"
                      value={form.upi_txn_id} onChange={e => set('upi_txn_id', e.target.value)}
                      placeholder="Enter UPI reference number" />
                  </div>
                </div>
              )}

              {/* Cash panel */}
              {form.payment_method === 'cash' && (
                <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 text-center">
                  <Banknote className="w-10 h-10 mx-auto mb-2 text-[#00b8a0]" />
                  <p className="text-sm text-gray-600 mb-1">Collect from customer</p>
                  <p className="text-3xl font-bold text-[#00b8a0]">₹{PRICES[form.vip_category]}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => { setStep('form'); setError(''); }}
                  className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 text-sm">
                  ← Back
                </button>
                <button onClick={handlePaymentSubmit} disabled={loading}
                  className="flex-[2] bg-[#00b8a0] text-white font-semibold py-3 px-6 rounded-xl hover:bg-[#009688] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'Processing…' : 'Complete Registration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm text-center">

            <div className="bg-[#00b8a0] p-6 text-white">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Welcome to VIP!</h2>
              <p className="text-white/70 text-sm mt-1">Registration successful</p>
            </div>

            <div className="p-5 space-y-4">
              {/* VIP Card */}
              <div className="bg-[#00b8a0] rounded-2xl p-5 text-white text-left">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Crown className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-sm">MediSyn VIP</span>
                  </div>
                  <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium capitalize">
                    {form.vip_category}
                  </span>
                </div>
                <p className="text-xl font-bold">{patient?.salutation} {patient?.first_name}</p>
                <p className="text-white/60 text-sm mt-0.5">{patient?.mobile}</p>
                <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-end">
                  <div>
                    <p className="text-white/50 text-xs">UHID</p>
                    <p className="font-mono font-bold text-sm">{patient?.uhid}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/50 text-xs">Valid for</p>
                    <p className="font-semibold text-sm">1 Year</p>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-2">
                {['Priority dispensing', 'Exclusive discounts', 'Health reminders', 'Loyalty rewards'].map(b => (
                  <div key={b} className="flex items-center gap-1.5 bg-[#e1f5ee] px-3 py-2 rounded-lg text-xs text-[#085041]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00b8a0] flex-shrink-0" /> {b}
                  </div>
                ))}
              </div>

              <button onClick={shareViaWhatsApp}
                className="w-full bg-green-500 text-white font-semibold py-3 rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-4 h-4" /> Share via WhatsApp
              </button>

              <button onClick={() => {
                setStep('form');
                setForm({ salutation: 'Mr', first_name: '', mobile: '', vip_category: 'individual', payment_method: '', upi_txn_id: '' });
                setPatient(null);
              }} className="w-full border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl hover:bg-gray-50 text-sm">
                Register Another Member
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-300 text-center">MediSyn Speciality Clinic, Taliparamba</p>
    </div>
  );
}

export default function VipRegisterSecurePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00b8a0]" />
      </div>
    }>
      <VipRegisterContent />
    </Suspense>
  );
}
