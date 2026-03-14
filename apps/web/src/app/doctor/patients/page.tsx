'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  mobile?: string;
  blood_group?: string;
  allergies?: string;
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const getName = (p: Patient) =>
    p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';

  const loadPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients');
      setPatients(Array.isArray(res.data) ? res.data : (res.data?.items || []));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPatients(); }, [loadPatients]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return getName(p).toLowerCase().includes(q) || (p.phone || p.mobile || '').includes(q);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
        <input
          type="text"
          placeholder="Search name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-teal-400"
        />
        <span className="text-xs text-slate-400">{filtered.length} patients</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
          <p className="text-sm">No patients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((patient) => (
            <div
              key={patient.id}
              onClick={() => router.push(`/doctor/consult?patientId=${patient.id}`)}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-teal-700">
                    {getName(patient).charAt(0).toUpperCase()}
                  </span>
                </div>
                {patient.blood_group && (
                  <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                    {patient.blood_group}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">{getName(patient)}</p>
              {(patient.phone || patient.mobile) && (
                <p className="text-xs text-slate-500">{patient.phone || patient.mobile}</p>
              )}
              {(patient.date_of_birth || patient.dob) && (
                <p className="text-xs text-slate-400 mt-0.5">DOB: {patient.date_of_birth || patient.dob}</p>
              )}
              {patient.allergies && (
                <p className="text-xs text-red-500 mt-1 truncate">⚠ {patient.allergies}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
