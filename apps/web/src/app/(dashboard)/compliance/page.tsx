'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Shield, Download, FileText, Users, CheckCircle,
  AlertCircle, Loader2, Calendar, Check, RefreshCw,
  Mail, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MONTH_KEY = () => {
  const d = new Date();
  return `compliance_${d.getFullYear()}_${d.getMonth() + 1}`;
};

const CHECKLIST_ITEMS = [
  {
    id: 'schedule_h_log',
    label: 'Print and sign Schedule H log',
    detail: 'Go to Reports → Schedule Log → Export CSV → Print and sign',
    urgent: false,
    link: '/reports',
  },
  {
    id: 'form17',
    label: 'Download and sign Form 17 for Schedule X dispensing',
    detail: 'Download PDF below → Print → Sign → File with drug inspector',
    urgent: false,
    link: null,
  },
  {
    id: 'gstr1',
    label: 'Run GSTR-1 report and file by 10th of next month',
    detail: 'Go to Reports → GST Report → Export → File on GST portal',
    urgent: new Date().getDate() > 10,
    link: '/reports',
    hasFiledButton: true,
  },
  {
    id: 'stock_reconcile',
    label: 'Reconcile physical stock with MediSyn for top 20 fast-movers',
    detail: 'Go to Stock → compare physical count with system quantity',
    urgent: false,
    link: '/stock',
  },
  {
    id: 'deletion_requests',
    label: 'Review and action data deletion requests',
    detail: 'Go to Patients → check for pending deletion requests',
    urgent: false,
    link: '/patients',
  },
  {
    id: 'expiry_check',
    label: 'Check expiry alerts — remove expired stock from shelves',
    detail: 'Go to Stock → filter by Near Expiry → remove expired batches',
    urgent: false,
    link: '/stock',
  },
  {
    id: 'db_backup',
    label: 'Back up Railway database from Railway dashboard',
    detail: 'Go to railway.app → PostgreSQL → Backups → Download',
    urgent: false,
    link: null,
  },
];

export default function CompliancePage() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];

  const [form17From, setForm17From] = useState(firstOfMonth);
  const [form17To,   setForm17To]   = useState(today);
  const [downloading, setDownloading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [filedDates, setFiledDates] = useState<Record<string, string>>({});
  const [emailSetting, setEmailSetting] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Load saved state from localStorage (per month)
  useEffect(() => {
    const key = MONTH_KEY();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setChecked(data.checked || {});
        setFiledDates(data.filedDates || {});
      }
      const email = localStorage.getItem('compliance_email') || '';
      setEmailSetting(email);
    } catch {}
  }, []);

  // Save to localStorage whenever state changes
  const saveState = (newChecked: Record<string, boolean>, newFiledDates: Record<string, string>) => {
    const key = MONTH_KEY();
    localStorage.setItem(key, JSON.stringify({ checked: newChecked, filedDates: newFiledDates }));
  };

  const toggleCheck = (id: string) => {
    const newChecked = { ...checked, [id]: !checked[id] };
    setChecked(newChecked);
    saveState(newChecked, filedDates);
    if (!checked[id]) toast.success('Marked as done ✓');
  };

  const markFiled = (id: string) => {
    const now = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const newChecked = { ...checked, [id]: true };
    const newFiledDates = { ...filedDates, [id]: now };
    setChecked(newChecked);
    setFiledDates(newFiledDates);
    saveState(newChecked, newFiledDates);
    toast.success('GSTR-1 marked as filed ✓');
  };

  const resetChecklist = () => {
    if (!confirm('Reset all checklist items for this month?')) return;
    setChecked({});
    setFiledDates({});
    saveState({}, {});
    toast.success('Checklist reset');
  };

  const completedCount = CHECKLIST_ITEMS.filter(i => checked[i.id]).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const allDone = completedCount === totalCount;

  const { data: consent, isLoading: consentLoading } = useQuery({
    queryKey: ['consent-report'],
    queryFn: () => api.get('/patients/consent-report').then(r => r.data),
  });

  const { data: form17Entries, isLoading: form17Loading } = useQuery({
    queryKey: ['form17', form17From, form17To],
    queryFn: () => api.get(`/compliance/form17?from=${form17From}&to=${form17To}`).then(r => r.data).catch(() => []),
  });

  const downloadForm17Pdf = async () => {
    setDownloading(true);
    try {
      const response = await api.get(
        `/compliance/form17/pdf?from=${form17From}&to=${form17To}`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Form17_${form17From}_to_${form17To}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Form 17 downloaded');
    } catch {
      toast.error('Failed to download Form 17');
    } finally {
      setDownloading(false);
    }
  };

  const openGSTR1 = () => {
    window.open(`/reports?report=gst-report&from=${lastMonth}&to=${lastMonthEnd}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00475a]" />
            Compliance Dashboard
          </h1>
          <p className="text-sm text-gray-500">DPDPA consent · Schedule H/X registers · Drug law compliance</p>
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-1">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── Monthly Compliance Checklist ─────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Monthly Compliance Checklist</h2>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${allDone ? 'text-green-600' : 'text-gray-500'}`}>
              {completedCount}/{totalCount} done
            </span>
            <button onClick={resetChecklist}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-[#00475a] rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }} />
        </div>

        {allDone && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-700">
              All compliance tasks completed for {new Date().toLocaleDateString('en-IN', { month: 'long' })} ✓
            </p>
          </div>
        )}

        <div className="space-y-2">
          {CHECKLIST_ITEMS.map((item) => {
            const isUrgent = item.id === 'deletion_requests'
              ? consent?.deletion_requests > 0
              : item.urgent;
            const isDone = checked[item.id];

            return (
              <div key={item.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-green-50 border-green-100'
                    : isUrgent
                    ? 'bg-red-50 border-red-100'
                    : 'bg-gray-50 border-transparent'
                }`}>

                <button onClick={() => toggleCheck(item.id)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isDone
                      ? 'bg-green-500 border-green-500'
                      : isUrgent
                      ? 'border-red-400 hover:border-red-600'
                      : 'border-gray-300 hover:border-[#00475a]'
                  }`}>
                  {isDone && <Check className="w-3 h-3 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isDone ? 'line-through text-gray-400' : isUrgent ? 'text-red-700' : 'text-gray-700'
                  }`}>
                    {item.label}
                    {isUrgent && !isDone && (
                      <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                        Action Required
                      </span>
                    )}
                  </p>
                  {!isDone && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                  )}
                  {isDone && filedDates[item.id] && (
                    <p className="text-xs text-green-600 mt-0.5">
                      Filed on {filedDates[item.id]}
                    </p>
                  )}
                </div>

                {/* GSTR-1 special buttons */}
                {item.hasFiledButton && !isDone && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={openGSTR1}
                      className="text-xs bg-white border border-gray-200 hover:border-[#00475a] text-gray-600 hover:text-[#00475a] px-2.5 py-1 rounded-lg transition-all">
                      Open Report
                    </button>
                    <button onClick={() => markFiled(item.id)}
                      className="text-xs bg-[#00475a] text-white px-2.5 py-1 rounded-lg hover:bg-[#003d4d] transition-all flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark Filed
                    </button>
                  </div>
                )}

                {/* Link button for other items */}
                {item.link && !item.hasFiledButton && !isDone && (
                  <a href={item.link}
                    className="flex-shrink-0 text-xs text-[#00475a] hover:underline font-medium">
                    Go →
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* Auto-email setting */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Auto-email GSTR-1 on 5th of every month
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              className="input flex-1 text-sm"
              placeholder="Enter email address..."
              value={emailSetting}
              onChange={e => setEmailSetting(e.target.value)}
            />
            <button
              onClick={async () => {
                setSavingEmail(true);
                localStorage.setItem('compliance_email', emailSetting);
                await api.post('/settings/compliance-email', { email: emailSetting }).catch(() => {});
                setSavingEmail(false);
                toast.success('Email saved — GSTR-1 will be sent on 5th of each month');
              }}
              disabled={savingEmail || !emailSetting}
              className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
              {savingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            <Clock className="w-3 h-3 inline mr-1" />
            GSTR-1 CSV will be auto-generated and emailed on the 5th of every month
          </p>
        </div>
      </div>

      {/* ── DPDPA Consent Report ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#00475a]" />
          DPDPA 2023 — Patient Consent Status
        </h2>
        {consentLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : consent ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Total Patients', value: consent.total_patients, color: 'bg-gray-50 text-gray-900' },
                { label: 'Consent Given', value: consent.consent_given, color: 'bg-green-50 text-green-700' },
                { label: 'Pending Consent', value: consent.consent_pending, color: 'bg-amber-50 text-amber-700' },
                { label: 'Consent Rate', value: `${consent.consent_rate_pct}%`, color: 'bg-blue-50 text-blue-700' },
              ].map(s => (
                <div key={s.label} className={`${s.color} rounded-xl p-4 text-center`}>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs mt-1 opacity-70">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-[#00475a] rounded-full transition-all"
                style={{ width: `${consent.consent_rate_pct}%` }} />
            </div>
            {consent.deletion_requests > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {consent.deletion_requests} pending data deletion request(s)
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Action required within 30 days per DPDPA — Go to patient profile → anonymise data
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                No pending data deletion requests
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Could not load consent data</p>
        )}
      </div>

      {/* ── Form 17 ─────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#00475a]" />
          Form 17 — Schedule X Poison Register
          <span className="text-xs text-gray-400 font-normal">(Rule 65(11))</span>
        </h2>
        <div className="flex items-end gap-4 mb-4 flex-wrap">
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={form17From} onChange={e => setForm17From(e.target.value)} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={form17To} onChange={e => setForm17To(e.target.value)} />
          </div>
          <button onClick={downloadForm17Pdf} disabled={downloading} className="btn-primary flex items-center gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download Form 17 PDF
          </button>
        </div>
        {form17Loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading entries...
          </div>
        ) : form17Entries && form17Entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#','Date','Bill No','Drug Name','Batch','Qty','Patient','Doctor','Dispensed By'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form17Entries.map((e: any) => (
                  <tr key={e.serial_no} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{e.serial_no}</td>
                    <td className="px-3 py-2">{e.date}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.bill_number}</td>
                    <td className="px-3 py-2 font-medium">{e.medicine_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{e.batch_number}</td>
                    <td className="px-3 py-2">{e.quantity}</td>
                    <td className="px-3 py-2">{e.patient_name}</td>
                    <td className="px-3 py-2 text-xs">{e.doctor_name}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{e.pharmacist_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No Schedule X medicines dispensed in this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
