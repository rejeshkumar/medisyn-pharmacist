'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Stethoscope, Save, Loader2, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DoctorFeeSettings() {
  const [doctors, setDoctors]   = useState<any[]>([]);
  const [fees, setFees]         = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  useEffect(() => {
    axios.get(`${API}/users?role=doctor`, { headers: headers() })
      .then(r => {
        const docs = (r.data || []).filter((u: any) => {
          const roles = u.roles?.length ? u.roles : [u.role];
          return roles.includes('doctor');
        });
        setDoctors(docs);
        const initial: Record<string, string> = {};
        docs.forEach((d: any) => { initial[d.id] = String(d.consultation_fee ?? 0); });
        setFees(initial);
      })
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, []);

  const saveFee = async (doctorId: string) => {
    setSaving(doctorId);
    try {
      await axios.patch(`${API}/users/${doctorId}/consultation-fee`,
        { consultation_fee: parseFloat(fees[doctorId]) || 0 },
        { headers: headers() }
      );
      toast.success('Consultation fee updated');
    } catch {
      toast.error('Failed to update fee');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-sm text-slate-400 py-4">Loading doctors...</div>;
  if (doctors.length === 0) return (
    <div className="text-sm text-slate-400 py-4 text-center">No doctors found. Add users with doctor role first.</div>
  );

  return (
    <div>
      <div className="space-y-3">
        {doctors.map(doc => (
          <div key={doc.id} className="flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-[#00475a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{doc.full_name}</p>
              <p className="text-xs text-slate-400">{doc.mobile}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={fees[doc.id] ?? '0'}
                  onChange={e => setFees(f => ({ ...f, [doc.id]: e.target.value }))}
                  className="w-28 text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-white text-right"
                />
              </div>
              <button onClick={() => saveFee(doc.id)} disabled={saving === doc.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white rounded-lg text-xs font-semibold hover:bg-[#003d4d] disabled:opacity-50 transition-colors">
                {saving === doc.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
