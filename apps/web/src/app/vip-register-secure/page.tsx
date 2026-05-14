'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';
import { Crown, CheckCircle2, Loader2, Star, Share2, BarChart3, Smartphone, Banknote, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

type Step = 'form' | 'payment' | 'success';
const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Baby', 'Other'];

const PRICES = {
  individual: 599,
  family: 999,
  extended: 1499,
};

export default function VipRegisterSecurePage() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  
  const agentCode = searchParams?.get('agent') || '';
  const accessToken = searchParams?.get('token') || '';
  
  const [form, setForm] = useState({
    salutation: 'Mr',
    first_name: '',
    mobile: '',
    vip_category: 'individual' as keyof typeof PRICES,
    payment_method: '' as 'upi' | 'cash' | '',
    upi_txn_id: '',
  });

  // Generate UPI QR code
  useEffect(() => {
    if (form.vip_category) {
      const amount = PRICES[form.vip_category];
      const upiUrl = `upi://pay?pa=medisyn@paytm&pn=MediSyn Clinic&am=${amount}&cu=INR&tn=VIP Pass ${form.vip_category}`;
      
      QRCode.toDataURL(upiUrl, { width: 280, margin: 1 })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [form.vip_category]);

  const set = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.mobile) {
      setError('Name and mobile are required.');
      return;
    }
    if (form.mobile.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit mobile.');
      return;
    }
    if (!agentCode || !accessToken) {
      setError('Invalid registration link. Please use the link provided by your sales agent.');
      return;
    }
    setError('');
    setStep('payment');
  };

  const handlePaymentSubmit = async () => {
    if (!form.payment_method) {
      setError('Please select a payment method.');
      return;
    }
    if (form.payment_method === 'upi' && !form.upi_txn_id) {
      setError('Please enter UPI transaction ID.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/patients/vip-register-secure', {
        ...form,
        agent_code: agentCode,
        access_token: accessToken,
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
    const message = `🎉 Welcome to MediSyn VIP Club!

Name: ${patient?.salutation} ${patient?.first_name}
UHID: ${patient?.uhid}
Mobile: ${patient?.mobile}
Plan: ${form.vip_category.toUpperCase()}

✨ Benefits:
✓ Priority Service
✓ Exclusive Discounts
✓ Health Reminders

MediSyn Specialty Clinic, Taliparamba`;

    const whatsappUrl = `https://wa.me/${patient?.mobile}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const vipEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (!agentCode || !accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">Invalid Link</h2>
          <p className="text-gray-600 text-sm">
            This VIP registration link is invalid. Please contact your sales agent for the correct link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Image src="/images/logo.jpg" alt="MediSyn" width={44} height={44} className="rounded-xl object-contain" />
          <span className="text-2xl font-bold text-[#00475a]">MediSyn</span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="w-6 h-6 text-amber-500" />
          <h1 className="text-2xl font-bold text-amber-800">VIP Pass Registration</h1>
          <Crown className="w-6 h-6 text-amber-500" />
        </div>
        <p className="text-gray-500 text-sm">Exclusive benefits for one full year</p>

        {agentCode && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 text-xs font-medium text-teal-700">
            <BarChart3 className="w-3 h-3" />
            Agent: {agentCode.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap justify-center">
        {['Priority Service', 'Exclusive Discounts', 'Health Reminders'].map(b => (
          <div key={b} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-full px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {b}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md">
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-5 text-white text-center">
              <Crown className="w-8 h-8 mx-auto mb-1" />
              <p className="font-bold text-lg">Step 1: Patient Details</p>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                  <select className="w-full border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.salutation} onChange={e => set('salutation', e.target.value)}>
                    {SALUTATIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Enter full name" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mobile No. *</label>
                <div className="flex gap-1.5">
                  <span className="border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-500 bg-gray-50">+91</span>
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="10-digit mobile" required maxLength={10} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Select VIP Plan *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'individual' as const, label: 'Individual', price: 599, desc: '1 person' },
                    { key: 'family' as const, label: 'Family', price: 999, desc: 'Up to 4' },
                    { key: 'extended' as const, label: 'Extended', price: 1499, desc: 'Up to 8' },
                  ].map(cat => (
                    <button type="button" key={cat.key} onClick={() => set('vip_category', cat.key)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        form.vip_category === cat.key ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'
                      }`}>
                      <p className={`text-xs font-bold ${form.vip_category === cat.key ? 'text-amber-700' : 'text-gray-700'}`}>{cat.label}</p>
                      <p className={`text-lg font-bold mt-0.5 ${form.vip_category === cat.key ? 'text-amber-600' : 'text-gray-800'}`}>₹{cat.price}</p>
                      <p className="text-[10px] text-gray-400">{cat.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold py-3 rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2 shadow-md">
                Continue to Payment
              </button>
            </div>
          </form>
        )}

        {step === 'payment' && (
          <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-5 text-white text-center">
              <Banknote className="w-8 h-8 mx-auto mb-1" />
              <p className="font-bold text-lg">Step 2: Payment</p>
              <p className="text-amber-100 text-sm mt-1">Amount: ₹{PRICES[form.vip_category]}</p>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Choose Payment Method *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => set('payment_method', 'upi')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.payment_method === 'upi' ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                    }`}>
                    <Smartphone className={`w-8 h-8 mx-auto mb-2 ${form.payment_method === 'upi' ? 'text-teal-600' : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold ${form.payment_method === 'upi' ? 'text-teal-700' : 'text-gray-700'}`}>UPI Payment</p>
                  </button>

                  <button type="button" onClick={() => set('payment_method', 'cash')}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      form.payment_method === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'
                    }`}>
                    <Banknote className={`w-8 h-8 mx-auto mb-2 ${form.payment_method === 'cash' ? 'text-green-600' : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold ${form.payment_method === 'cash' ? 'text-green-700' : 'text-gray-700'}`}>Cash Payment</p>
                  </button>
                </div>
              </div>

              {form.payment_method === 'upi' && (
                <div className="border-2 border-teal-200 rounded-xl p-4 bg-teal-50">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-5 h-5 text-teal-600" />
                    <p className="text-sm font-semibold text-teal-800">Scan to Pay ₹{PRICES[form.vip_category]}</p>
                  </div>
                  {qrDataUrl && (
                    <div className="bg-white p-3 rounded-lg inline-block">
                      <img src={qrDataUrl} alt="UPI QR Code" className="w-64 h-64 mx-auto" />
                    </div>
                  )}
                  <p className="text-xs text-teal-700 mt-2 text-center">medisyn@paytm</p>

                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-600 mb-1">UPI Transaction ID *</label>
                    <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={form.upi_txn_id} onChange={e => set('upi_txn_id', e.target.value)} 
                      placeholder="Enter 12-digit UPI reference number" required />
                  </div>
                </div>
              )}

              {form.payment_method === 'cash' && (
                <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50 text-center">
                  <Banknote className="w-12 h-12 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-semibold text-green-800 mb-1">Cash Payment</p>
                  <p className="text-xl font-bold text-green-700">₹{PRICES[form.vip_category]}</p>
                  <p className="text-xs text-green-600 mt-2">Please collect cash from customer</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('form')}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-50">
                  Back
                </button>
                <button onClick={handlePaymentSubmit} disabled={loading}
                  className="flex-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'Processing...' : 'Complete Registration'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden text-center">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-500 p-6 text-white">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Welcome to VIP!</h2>
              <p className="text-amber-100 text-sm mt-1">Registration successful</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Image src="/images/logo.jpg" alt="MediSyn" width={22} height={22} className="rounded object-contain brightness-0 invert" />
                    <span className="font-bold text-sm">MediSyn</span>
                  </div>
                  <Crown className="w-6 h-6" />
                </div>
                <p className="text-xl font-bold mb-0.5">{patient?.salutation} {patient?.first_name}</p>
                <p className="text-amber-100 text-sm">{patient?.mobile}</p>
                <div className="mt-3 pt-3 border-t border-amber-300 flex justify-between items-end">
                  <div>
                    <p className="text-amber-200 text-xs">UHID</p>
                    <p className="font-mono font-bold text-sm">{patient?.uhid}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-200 text-xs">Plan</p>
                    <p className="font-bold text-sm capitalize">{form.vip_category}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                {['Priority dispensing', 'Exclusive discounts', 'Health reminders', 'Loyalty rewards'].map(b => (
                  <div key={b} className="flex items-center gap-1.5 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>

              <button onClick={shareViaWhatsApp}
                className="w-full bg-green-500 text-white font-semibold py-2.5 rounded-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2 shadow-md">
                <Share2 className="w-4 h-4" />
                Share VIP Card via WhatsApp
              </button>

              <button onClick={() => { setStep('form'); setForm({ salutation: 'Mr', first_name: '', mobile: '', vip_category: 'individual', payment_method: '', upi_txn_id: '' }); setPatient(null); }}
                className="w-full border border-amber-300 text-amber-700 font-medium py-2.5 rounded-xl hover:bg-amber-50 text-sm">
                Register Another Member
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">MediSyn Specialty Clinic, Taliparamba</p>
    </div>
  );
}
