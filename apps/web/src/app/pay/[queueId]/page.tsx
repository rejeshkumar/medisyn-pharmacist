'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { getToken, getUser } from '@/lib/auth';
import {
  ArrowLeft, CreditCard, Smartphone, Banknote,
  CheckCircle2, Loader2, Receipt, User, Stethoscope, Pill,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash',  icon: Banknote,    color: 'border-green-200 bg-green-50 text-green-700' },
  { value: 'upi',  label: 'UPI',   icon: Smartphone,  color: 'border-blue-200 bg-blue-50 text-blue-700' },
  { value: 'card', label: 'Card',  icon: CreditCard,  color: 'border-purple-200 bg-purple-50 text-purple-700' },
];

export default function PaymentPage() {
  const { queueId } = useParams<{ queueId: string }>();
  const router = useRouter();
  const user = getUser();
  const roles: string[] = user?.roles?.length ? user.roles : [user?.role];
  const backPath = roles.includes('receptionist') ? '/receptionist' : '/dashboard';

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const [method, setMethod]     = useState<'cash' | 'upi' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount]   = useState('0');
  const [upiRef, setUpiRef]       = useState('');
  const [card4, setCard4]         = useState('');
  const [notes, setNotes]         = useState('');

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    axios.get(`${API}/payments/bill/${queueId}`, { headers: headers() })
      .then(r => {
        setBill(r.data);
        setAmountPaid(String(r.data.total_amount));
        if (r.data.already_paid) setDone(true);
      })
      .catch(() => toast.error('Failed to load bill'))
      .finally(() => setLoading(false));
  }, [queueId]);

  const discountNum   = parseFloat(discount)   || 0;
  const total         = bill ? (Number(bill.consultation_fee) + Number(bill.medicine_cost) - discountNum) : 0;
  const paid          = parseFloat(amountPaid) || 0;
  const change        = method === 'cash' ? Math.max(0, paid - total) : 0;
  const shortfall     = paid < total && method !== 'cash';

  const handleSubmit = async () => {
    if (!bill) return;
    if (paid < total && method !== 'cash') {
      toast.error('Amount paid is less than total');
      return;
    }
    if (method === 'upi' && !upiRef.trim()) {
      toast.error('Enter UPI reference number');
      return;
    }
    if (method === 'card' && card4.length !== 4) {
      toast.error('Enter last 4 digits of card');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/payments`, {
        queue_id:         queueId,
        payment_method:   method,
        amount_paid:      paid,
        discount:         discountNum,
        consultation_fee: bill.consultation_fee,
        medicine_cost:    bill.medicine_cost,
        upi_ref:          upiRef || undefined,
        card_last4:       card4  || undefined,
        notes:            notes  || undefined,
      }, { headers: headers() });
      setReceipt(res.data);
      setDone(true);
      toast.success(`Payment recorded — ${res.data.receipt_no}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-[#00475a]" />
    </div>
  );

  if (done) return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Payment Complete</h2>
        {receipt && (
          <>
            <p className="text-slate-500 text-sm mb-5">Receipt: <span className="font-semibold text-slate-700">{receipt.receipt_no}</span></p>
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Consultation fee</span><span className="font-medium">₹{Number(receipt.consultation_fee).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Medicine cost</span><span className="font-medium">₹{Number(receipt.medicine_cost).toFixed(2)}</span></div>
              {Number(receipt.discount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{Number(receipt.discount).toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 mt-1"><span>Total</span><span>₹{Number(receipt.total_amount).toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Paid ({receipt.payment_method.toUpperCase()})</span><span>₹{Number(receipt.amount_paid).toFixed(2)}</span></div>
              {Number(receipt.change_returned) > 0 && <div className="flex justify-between text-blue-600"><span>Change returned</span><span>₹{Number(receipt.change_returned).toFixed(2)}</span></div>}
            </div>
          </>
        )}
        <button onClick={() => router.push(backPath)}
          className="w-full py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-semibold hover:bg-[#003d4d] transition-colors">
          Back to Queue
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-lg mx-auto">
      <button onClick={() => router.push(backPath)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-[#00475a]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Collect Payment</h1>
          <p className="text-xs text-slate-400">Queue entry #{queueId?.slice(-6)}</p>
        </div>
      </div>

      {/* Bill breakdown */}
      {bill && (
        <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Bill Summary</h3>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <Stethoscope className="w-3.5 h-3.5 text-teal-500" />Consultation fee
              </span>
              <span className="font-medium">₹{Number(bill.consultation_fee).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <Pill className="w-3.5 h-3.5 text-blue-500" />Medicine cost
              </span>
              <span className="font-medium">₹{Number(bill.medicine_cost).toFixed(2)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-sm text-slate-500 flex-1">Discount (₹)</span>
              <input type="number" min="0" value={discount}
                onChange={e => setDiscount(e.target.value)}
                className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
              />
            </div>

            <div className="flex justify-between font-bold text-base border-t border-slate-100 pt-2 mt-1">
              <span>Total</span>
              <span className="text-[#00475a]">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment method */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment Method</h3>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {METHOD_OPTIONS.map(m => {
            const Icon = m.icon;
            return (
              <button key={m.value} onClick={() => setMethod(m.value as any)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-sm font-medium
                  ${method === m.value ? m.color + ' border-2' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                <Icon className="w-5 h-5" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Amount paid */}
        <div className="mb-3">
          <label className="text-xs font-medium text-slate-600 mb-1 block">Amount Received (₹)</label>
          <input type="number" min="0" step="0.01" value={amountPaid}
            onChange={e => setAmountPaid(e.target.value)}
            className="w-full text-lg font-bold border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] text-right"
          />
        </div>

        {/* Cash change */}
        {method === 'cash' && change > 0 && (
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-3">
            <span className="text-sm text-blue-700 font-medium">Change to return</span>
            <span className="text-lg font-bold text-blue-700">₹{change.toFixed(2)}</span>
          </div>
        )}

        {shortfall && (
          <p className="text-xs text-red-500 mb-3">Amount paid is less than total ₹{total.toFixed(2)}</p>
        )}

        {/* UPI ref */}
        {method === 'upi' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600 mb-1 block">UPI Reference Number *</label>
            <input type="text" value={upiRef} onChange={e => setUpiRef(e.target.value)}
              placeholder="e.g. 324567891234"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
            />
          </div>
        )}

        {/* Card last 4 */}
        {method === 'card' && (
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600 mb-1 block">Last 4 digits of card *</label>
            <input type="text" maxLength={4} value={card4} onChange={e => setCard4(e.target.value.replace(/\D/g, ''))}
              placeholder="e.g. 4321"
              className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] tracking-widest font-mono"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Any remarks..."
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
          />
        </div>
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={submitting || !bill}
        className="w-full py-3.5 bg-[#00475a] text-white rounded-xl text-sm font-bold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
          : <><CheckCircle2 className="w-4 h-4" />Confirm Payment — ₹{total.toFixed(2)}</>}
      </button>
    </div>
  );
}
