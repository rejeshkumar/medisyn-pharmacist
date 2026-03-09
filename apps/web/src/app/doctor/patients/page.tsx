'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getToken, getUser } from '@/lib/auth';
import {
  Search, User, Phone, Calendar, Droplets, AlertCircle,
  ChevronRight, ClipboardList, Pill, X, Loader2, FileText
} from 'lucide-react';
import { format } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Patient {
  id: string;
  full_name: string;
  mobile: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  known_allergies?: string;
  chronic_conditions?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  created_at: string;
}

interface Consultation {
  id: string;
  created_at: string;
  chief_complaint: string;
  diagnosis: string;
  notes?: string;
  follow_up_date?: string;
  doctor?: { full_name: string };
  prescription?: {
    id: string;
    rx_number: string;
    status: string;
    items: { medicine_name: string; dosage: string; frequency: string; duration: string; quantity: number }[];
  };
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedConsult, setExpandedConsult] = useState<string | null>(null);

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setPatients([]); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/patients?search=${encodeURIComponent(q)}&limit=20`, { headers: headers() });
      setPatients(res.data?.data || res.data || []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(search), 400);
    return () => clearTimeout(t);
  }, [search, searchPatients]);

  const loadHistory = async (patient: Patient) => {
    setSelected(patient);
    setConsultations([]);
    setExpandedConsult(null);
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API}/consultations/patient/${patient.id}`, { headers: headers() });
      setConsultations(res.data || []);
    } catch {
      setConsultations([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const age = (dob?: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  return (
    <div className="flex h-full">
      {/* Left panel — search */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 mb-3">Patient Search</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name or mobile..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPatients([]); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Searching...</span>
            </div>
          )}
          {!loading && search && patients.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No patients found</div>
          )}
          {!loading && !search && (
            <div className="text-center py-12 text-slate-400 text-sm px-4">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Search by patient name or mobile number
            </div>
          )}
          {patients.map(p => (
            <button
              key={p.id}
              onClick={() => loadHistory(p)}
              className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center gap-3 ${selected?.id === p.id ? 'bg-teal-50 border-l-2 border-l-[#00475a]' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-[#00475a] font-bold text-sm flex-shrink-0">
                {p.full_name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.full_name}</p>
                <p className="text-xs text-slate-400">{p.mobile}{age(p.date_of_birth) ? ` · ${age(p.date_of_birth)}y` : ''}{p.gender ? ` · ${p.gender}` : ''}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — patient detail */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">Select a patient to view history</p>
          </div>
        ) : (
          <div className="p-6 max-w-3xl">
            {/* Patient card */}
            <div className="bg-white rounded-xl border border-slate-100 p-5 mb-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-[#00475a] font-bold text-xl flex-shrink-0">
                  {selected.full_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-slate-800">{selected.full_name}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="text-sm text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{selected.mobile}</span>
                    {selected.date_of_birth && <span className="text-sm text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{age(selected.date_of_birth)} years</span>}
                    {selected.gender && <span className="text-sm text-slate-500 capitalize">{selected.gender}</span>}
                    {selected.blood_group && <span className="text-sm text-slate-500 flex items-center gap-1"><Droplets className="w-3 h-3 text-red-400" />{selected.blood_group}</span>}
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/doctor/consult/new?patientId=${selected.id}`)}
                  className="text-xs bg-[#00475a] text-white px-3 py-1.5 rounded-lg hover:bg-[#00475a]/90 transition-colors flex-shrink-0"
                >
                  + New Consult
                </button>
              </div>

              {(selected.known_allergies || selected.chronic_conditions) && (
                <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                  {selected.known_allergies && (
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1"><AlertCircle className="w-3 h-3" />Allergies</p>
                      <p className="text-xs text-red-700">{selected.known_allergies}</p>
                    </div>
                  )}
                  {selected.chronic_conditions && (
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-600 mb-1">Chronic Conditions</p>
                      <p className="text-xs text-amber-700">{selected.chronic_conditions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Consultation history */}
            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Consultation History</h3>

            {loadingHistory && (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading history...</span>
              </div>
            )}

            {!loadingHistory && consultations.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-100 p-8 text-center text-slate-400 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No consultation history found
              </div>
            )}

            <div className="space-y-3">
              {consultations.map(c => (
                <div key={c.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedConsult(expandedConsult === c.id ? null : c.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-4 h-4 text-[#00475a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.chief_complaint}</p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(c.created_at), 'dd MMM yyyy')}
                        {c.doctor?.full_name ? ` · Dr. ${c.doctor.full_name}` : ''}
                      </p>
                    </div>
                    {c.prescription && (
                      <span className="text-xs bg-teal-50 text-[#00475a] px-2 py-0.5 rounded-full font-medium flex-shrink-0 flex items-center gap-1">
                        <Pill className="w-3 h-3" />{c.prescription.rx_number}
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandedConsult === c.id ? 'rotate-90' : ''}`} />
                  </button>

                  {expandedConsult === c.id && (
                    <div className="px-5 pb-5 border-t border-slate-50">
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-1">Diagnosis</p>
                          <p className="text-sm text-slate-800">{c.diagnosis}</p>
                        </div>
                        {c.notes && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
                            <p className="text-sm text-slate-800">{c.notes}</p>
                          </div>
                        )}
                        {c.follow_up_date && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">Follow-up</p>
                            <p className="text-sm text-slate-800">{format(new Date(c.follow_up_date), 'dd MMM yyyy')}</p>
                          </div>
                        )}
                      </div>

                      {c.prescription && c.prescription.items?.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                            <Pill className="w-3 h-3" />Prescription · {c.prescription.rx_number}
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${c.prescription.status === 'dispensed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {c.prescription.status}
                            </span>
                          </p>
                          <div className="bg-slate-50 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Medicine</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Dosage</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Frequency</th>
                                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Duration</th>
                                  <th className="text-right px-3 py-2 text-slate-500 font-medium">Qty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {c.prescription.items.map((item, i) => (
                                  <tr key={i} className="border-b border-slate-100 last:border-0">
                                    <td className="px-3 py-2 font-medium text-slate-800">{item.medicine_name}</td>
                                    <td className="px-3 py-2 text-slate-600">{item.dosage}</td>
                                    <td className="px-3 py-2 text-slate-600">{item.frequency}</td>
                                    <td className="px-3 py-2 text-slate-600">{item.duration}</td>
                                    <td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
