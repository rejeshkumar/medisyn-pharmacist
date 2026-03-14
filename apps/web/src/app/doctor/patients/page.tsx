'use client';

import { useState, useEffect, useCallback } from 'react';
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
  medical_history?: string;
  chronic_conditions?: string;
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

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
    <div className="flex h-full">
      {/* Patient list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-900">Patients</h1>
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 max-w-sm text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
          />
          <span className="text-xs text-slate-400 flex-shrink-0">{filtered.length} patients</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-slate-400">No patients found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelected(patient)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                    selected?.id === patient.id
                      ? 'border-teal-400 shadow-sm shadow-teal-100'
                      : 'border-slate-200 hover:border-teal-300 hover:shadow-sm'
                  }`}
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
                    <p className="text-xs text-slate-400 mt-0.5">
                      DOB: {patient.date_of_birth || patient.dob}
                    </p>
                  )}
                  {patient.allergies && (
                    <p className="text-xs text-red-500 mt-1 truncate">⚠ {patient.allergies}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Patient detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0 border-l border-slate-100 bg-white flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 text-sm">Patient Details</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-bold text-teal-700">
                  {getName(selected).charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">{getName(selected)}</p>
                {selected.gender && (
                  <p className="text-xs text-slate-400 capitalize">{selected.gender}</p>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {(selected.date_of_birth || selected.dob) && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Date of Birth</p>
                  <p className="text-sm text-slate-700">{selected.date_of_birth || selected.dob}</p>
                </div>
              )}
              {(selected.phone || selected.mobile) && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                  <p className="text-sm text-slate-700">{selected.phone || selected.mobile}</p>
                </div>
              )}
              {selected.blood_group && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Blood Group</p>
                  <p className="text-sm font-medium text-red-600">{selected.blood_group}</p>
                </div>
              )}
              {selected.allergies && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Allergies</p>
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    ⚠ {selected.allergies}
                  </p>
                </div>
              )}
              {selected.chronic_conditions && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Chronic Conditions</p>
                  <p className="text-sm text-slate-700">{selected.chronic_conditions}</p>
                </div>
              )}
              {selected.medical_history && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Medical History</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.medical_history}</p>
                </div>
              )}
            </div>

            <div className="pt-2">
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 text-center">
                To start a consultation, select the patient from the queue on the My Queue page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
