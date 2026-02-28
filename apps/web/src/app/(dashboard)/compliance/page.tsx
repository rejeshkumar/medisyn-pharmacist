'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { Shield, Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompliancePage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [scheduleClass, setScheduleClass] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['compliance-log', from, to, doctorName, scheduleClass],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (doctorName) params.set('doctor_name', doctorName);
      if (scheduleClass) params.set('schedule_class', scheduleClass);
      return api.get(`/compliance/log?${params}`).then((r) => r.data);
    },
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await api.get(`/compliance/log/export?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `schedule-drug-register-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Schedule Drug Register</h1>
          <p className="text-sm text-gray-500">{logs?.length || 0} records</p>
        </div>
        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        <input className="input w-auto" placeholder="Doctor name..." value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
        <select className="input w-auto" value={scheduleClass} onChange={(e) => setScheduleClass(e.target.value)}>
          <option value="">All schedules</option>
          <option value="H">Schedule H</option>
          <option value="H1">Schedule H1</option>
          <option value="X">Schedule X</option>
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date & Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Patient</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Doctor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Medicine</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Schedule</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Batch</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pharmacist</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Substituted</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" /></td></tr>
            ) : logs?.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No records found
              </td></tr>
            ) : (
              logs?.map((log: any) => (
                <tr key={log.id} className="table-row">
                  <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{log.patient_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <p>{log.doctor_name}</p>
                    {log.doctor_reg_no && <p className="text-xs text-gray-400">{log.doctor_reg_no}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{log.medicine_name}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${
                      log.schedule_class === 'X' ? 'bg-red-100 text-red-700 border-red-200' :
                      log.schedule_class === 'H1' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                      'bg-yellow-100 text-yellow-700 border-yellow-200'
                    }`}>
                      {log.schedule_class}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{log.quantity_dispensed}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.batch_number}</td>
                  <td className="px-4 py-3 text-gray-600">{log.pharmacist?.full_name || '-'}</td>
                  <td className="px-4 py-3">
                    {log.is_substituted ? (
                      <span className="badge bg-blue-50 text-blue-600 border-blue-200 text-xs">Yes</span>
                    ) : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
