'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import PatientHealthCard from '@/components/patient-health/PatientHealthCard';

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
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<Patient | null>(null);
  const [token, setToken]         = useState('');

  const getName = (p: Patient) =>
    p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';

  const getAge = (p: Patient) => {
    const dob = p.date_of_birth || p.dob;
    if (!dob) return null;
    const age = Math.floor(
      (new Date().getTime() - new Date(dob).getTime()) / (365.25 * 86400_000)
    );
    return isNaN(age) ? null : age;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(localStorage.getItem('token') || '');
    }
  }, []);

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

  // Live search — debounced API search for larger datasets
  const [searching, setSearching] = useState(false);
  const searchTimer = useState<any>(null);

  const handleSearch = (q: string) => {
    setSearch(q);
  };

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      getName(p).toLowerCase().includes(q) ||
      (p.phone || p.mobile || '').includes(q)
    );
  });

  return (
    <div className="flex h-full min-h-screen bg-slate-50">

      {/* ── Left: Patient list ───────────────────────────────────────────────── */}
      <div className={`flex flex-col bg-white border-r border-slate-200 transition-all ${selected ? 'w-72 flex-shrink-0' : 'flex-1'}`}>

        {/* Header */}
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-base font-bold text-slate-900 mb-3">Patient Records</h1>
          <input
            type="text"
            placeholder="🔍 Search name or mobile..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] bg-slate-50"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-slate-400">{filtered.length} patients</span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-[#00475a] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm">No patients found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map((patient) => {
                const age = getAge(patient);
                const isSelected = selected?.id === patient.id;
                return (
                  <div
                    key={patient.id}
                    onClick={() => setSelected(isSelected ? null : patient)}
                    className={`px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#00b8a0]/5 border-l-2 border-[#00475a]'
                        : 'hover:bg-slate-50 border-l-2 border-transparent'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      isSelected ? 'bg-[#00b8a0] text-white' : 'bg-teal-100 text-teal-700'
                    }`}>
                      {getName(patient).charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {getName(patient)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {age && <span className="text-xs text-slate-400">{age}y</span>}
                        {patient.gender && (
                          <span className="text-xs text-slate-400 capitalize">{patient.gender}</span>
                        )}
                        {(patient.phone || patient.mobile) && (
                          <span className="text-xs text-slate-400 font-mono">
                            {(patient.phone || patient.mobile)?.slice(-4).padStart(10, '•')}
                          </span>
                        )}
                      </div>
                      {patient.allergies && (
                        <p className="text-xs text-red-500 truncate mt-0.5">⚠ {patient.allergies}</p>
                      )}
                    </div>

                    {/* Blood group badge */}
                    {patient.blood_group && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                        {patient.blood_group}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Patient Health Intelligence panel ─────────────────────────── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          {/* Panel header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00b8a0] text-white flex items-center justify-center font-bold">
                {getName(selected).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-slate-900">{getName(selected)}</h2>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {getAge(selected) && <span>{getAge(selected)}y</span>}
                  {selected.gender && <span className="capitalize">{selected.gender}</span>}
                  {(selected.phone || selected.mobile) && (
                    <span className="font-mono">{selected.phone || selected.mobile}</span>
                  )}
                  {selected.blood_group && (
                    <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">
                      {selected.blood_group}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2"
            >
              ✕
            </button>
          </div>

          <div className="p-6 max-w-3xl">

            {/* Allergies + chronic conditions — always visible at top */}
            {(selected.allergies || selected.chronic_conditions) && (
              <div className="flex gap-3 mb-5 flex-wrap">
                {selected.allergies && (
                  <div className="flex-1 min-w-48 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">⚠ Known Allergies</p>
                    <p className="text-sm text-red-700">{selected.allergies}</p>
                  </div>
                )}
                {selected.chronic_conditions && (
                  <div className="flex-1 min-w-48 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">🩺 Chronic Conditions</p>
                    <p className="text-sm text-amber-700">{selected.chronic_conditions}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Patient Health Intelligence Card ── */}
            {token ? (
              <PatientHealthCard
                patientId={selected.id}
                patientName={getName(selected)}
                token={token}
              />
            ) : (
              <div className="bg-slate-100 rounded-xl p-6 text-center text-slate-400 text-sm">
                Loading health intelligence…
              </div>
            )}

            {/* Medical history (free text) */}
            {selected.medical_history && (
              <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">📝 Medical History Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selected.medical_history}
                </p>
              </div>
            )}

            {/* Note about consultation */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 text-center">
              👁 Viewing as read-only. To start a consultation, the patient must be in today's queue.
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
          <div className="text-6xl mb-4">🧠</div>
          <p className="text-base font-semibold text-slate-600 mb-1">Patient Health Intelligence</p>
          <p className="text-sm text-slate-400">Select a patient to view their full health history and AI brief</p>
        </div>
      )}
    </div>
  );
}
