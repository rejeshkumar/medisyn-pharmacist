'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Shield, Download, FileText, Users, CheckCircle, AlertCircle, Loader2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompliancePage() {
  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [form17From, setForm17From] = useState(firstOfMonth);
  const [form17To,   setForm17To]   = useState(today);
  const [downloading, setDownloading] = useState(false);

  // ── Consent report ────────────────────────────────────────────────────────
  const { data: consent, isLoading: consentLoading } = useQuery({
    queryKey: ['consent-report'],
    queryFn: () => api.get('/patients/consent-report').then(r => r.data),
  });

  // ── Form 17 entries ───────────────────────────────────────────────────────
  const { data: form17Entries, isLoading: form17Loading } = useQuery({
    queryKey: ['form17', form17From, form17To],
    queryFn: () => api.get(`/compliance/form17?from=${form17From}&to=${form17To}`).then(r => r.data),
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#00475a]" />
          Compliance Dashboard
        </h1>
        <p className="text-sm text-gray-500">DPDPA consent tracking · Schedule H/X registers · Drug law compliance</p>
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
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{consent.total_patients}</p>
                <p className="text-xs text-gray-500 mt-1">Total Patients</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{consent.consent_given}</p>
                <p className="text-xs text-green-600 mt-1">Consent Given</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{consent.consent_pending}</p>
                <p className="text-xs text-amber-600 mt-1">Pending Consent</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{consent.consent_rate_pct}%</p>
                <p className="text-xs text-blue-600 mt-1">Consent Rate</p>
              </div>
            </div>

            {/* Consent rate bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Consent coverage</span>
                <span>{consent.consent_rate_pct}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00475a] rounded-full transition-all"
                  style={{ width: `${consent.consent_rate_pct}%` }}
                />
              </div>
            </div>

            {/* Deletion requests */}
            {consent.deletion_requests > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {consent.deletion_requests} pending data deletion request(s)
                </p>
                <div className="mt-2 space-y-2">
                  {consent.pending_deletions?.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between text-xs text-red-600">
                      <span>{p.first_name} {p.last_name} — {p.uhid}</span>
                      <span>{new Date(p.data_deletion_requested_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-500 mt-2">
                  Action required: Go to patient profile → Delete icon to anonymise data within 30 days (DPDPA requirement)
                </p>
              </div>
            )}

            {consent.deletion_requests === 0 && (
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

      {/* ── Form 17 — Schedule X Register ───────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#00475a]" />
          Form 17 — Schedule X Poison Register
          <span className="text-xs text-gray-400 font-normal">(Rule 65(11), Drugs & Cosmetics Rules 1945)</span>
        </h2>

        {/* Date range selector */}
        <div className="flex items-end gap-4 mb-4 flex-wrap">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              className="input"
              value={form17From}
              onChange={e => setForm17From(e.target.value)}
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              className="input"
              value={form17To}
              onChange={e => setForm17To(e.target.value)}
            />
          </div>
          <button
            onClick={downloadForm17Pdf}
            disabled={downloading}
            className="btn-primary flex items-center gap-2"
          >
            {downloading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />
            }
            Download Form 17 PDF
          </button>
        </div>

        {/* Entries preview */}
        {form17Loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading entries...
          </div>
        ) : form17Entries && form17Entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#', 'Date', 'Bill No', 'Drug Name', 'Batch', 'Qty', 'Patient', 'Doctor', 'Dispensed By'].map(h => (
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
            <p className="text-xs text-gray-400 mt-2 text-right">
              {form17Entries.length} Schedule X dispensing record(s) — download PDF for drug inspector submission
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No Schedule X (narcotic/psychotropic) medicines dispensed in this period</p>
            <p className="text-xs mt-1">Schedule X includes narcotics and psychotropics requiring Form 17</p>
          </div>
        )}
      </div>

      {/* ── Compliance Checklist ─────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Monthly Compliance Checklist</h2>
        <div className="space-y-3">
          {[
            { label: 'Print and sign Schedule H log (Dispensing → Schedule Log → Export)', urgent: false },
            { label: 'Download and sign Form 17 for Schedule X dispensing (above)', urgent: false },
            { label: 'Run GSTR-1 report and file by 10th of next month', urgent: true },
            { label: 'Reconcile physical stock with MediSyn for top 20 fast-movers', urgent: false },
            { label: 'Review and action data deletion requests (if any)', urgent: consent?.deletion_requests > 0 },
            { label: 'Check expiry alerts — remove expired stock from shelves', urgent: false },
            { label: 'Back up Railway database from Railway dashboard', urgent: false },
          ].map((item, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${item.urgent ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00475a]" />
              <span className={`text-sm ${item.urgent ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                {item.label}
                {item.urgent && <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Action Required</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
