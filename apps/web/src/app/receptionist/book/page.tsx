'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getToken } from '@/lib/auth';
import { Search, X, Loader2, UserPlus, CheckCircle, Calendar, User, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const patientName = (p: any) => p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';
const patientInitial = (p: any) => patientName(p)[0]?.toUpperCase() || '?';

const VISIT_TYPES = [
  { value: 'general', label: 'General Consultation' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'emergency', label: 'Emergency' },
];

export default function BookAppointmentPage() {
  const router = useRouter();
  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  // Patient search
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Doctor search
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  // Form
  const [visitType, setVisitType] = useState('general');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<any>(null);

  // New patient form
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ full_name: '', mobile: '', gender: '', date_of_birth: '' });
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Load doctors on mount
  useEffect(() => {
    axios.get(`${API}/users?role=doctor&limit=50`, { headers: headers() })
      .then(r => setDoctors(r.data?.data || r.data || []))
      .catch(() => setDoctors([]));
  }, []);

  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setPatients([]); return; }
    setSearchingPatients(true);
    try {
      const r = await axios.get(`${API}/patients?search=${encodeURIComponent(q)}&limit=10`, { headers: headers() });
      setPatients(r.data?.data || r.data || []);
    } catch { setPatients([]); }
    finally { setSearchingPatients(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 400);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  const createPatient = async () => {
    if (!newPatient.full_name || !newPatient.mobile) {
      toast.error('Name and mobile are required');
      return;
    }
    setCreatingPatient(true);
    try {
      const r = await axios.post(`${API}/patients`, newPatient, { headers: headers() });
      setSelectedPatient(r.data);
      setShowNewPatient(false);
      setNewPatient({ full_name: '', mobile: '', gender: '', date_of_birth: '' });
      toast.success('Patient registered successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to register patient');
    } finally {
      setCreatingPatient(false);
    }
  };

  const handleBook = async () => {
    if (!selectedPatient) { toast.error('Please select a patient'); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        patient_id: selectedPatient.id,
        visit_type: visitType,
        chief_complaint: chiefComplaint || undefined,
        notes: notes || undefined,
      };
      if (selectedDoctor) payload.doctor_id = selectedDoctor.id;

      const r = await axios.post(`${API}/queue`, payload, { headers: headers() });
      setBooked(r.data);
      toast.success(`Token #${r.data.token_number} booked successfully!`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setBooked(null);
    setSelectedPatient(null);
    setSelectedDoctor(null);
    setPatientSearch('');
    setPatients([]);
    setChiefComplaint('');
    setNotes('');
    setVisitType('general');
  };

  // Success screen
  if (booked) {
    return (
      <div className="p-6 max-w-md mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">Appointment Booked!</h2>
          <div className="text-5xl font-black text-[#00475a] my-4">#{booked.token_number}</div>
          <p className="text-slate-600 font-medium mb-1">{selectedPatient?.full_name}</p>
          {selectedDoctor && <p className="text-sm text-slate-400 mb-1">Dr. {selectedDoctor.full_name}</p>}
          <p className="text-sm text-slate-400 capitalize">{visitType.replace('_', ' ')}</p>
          {chiefComplaint && <p className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2">"{chiefComplaint}"</p>}
          <div className="flex gap-3 mt-6">
            <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Book Another
            </button>
            <button onClick={() => router.push('/receptionist/queue')} className="flex-1 py-2.5 bg-[#00475a] text-white rounded-lg text-sm font-medium hover:bg-[#00475a]/90 transition-colors">
              View Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800 mb-1">Book Appointment</h1>
      <p className="text-sm text-slate-400 mb-6">Register a patient into today's queue</p>

      <div className="space-y-5">
        {/* Patient selection */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-[#00475a]" /> Patient
          </h2>

          {selectedPatient ? (
            <div className="flex items-center gap-3 bg-teal-50 rounded-lg px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-[#00475a] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {patientInitial(selectedPatient)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{patientName(selectedPatient)}</p>
                <p className="text-xs text-slate-500">{selectedPatient.mobile}</p>
              </div>
              <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search by name or mobile..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
                />
                {searchingPatients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
              </div>

              {patients.length > 0 && (
                <div className="border border-slate-100 rounded-lg overflow-hidden mb-3">
                  {patients.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(''); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-[#00475a] font-bold text-xs flex-shrink-0">
                        {patientInitial(p)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{patientName(p)}</p>
                        <p className="text-xs text-slate-400">{p.mobile}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowNewPatient(!showNewPatient)}
                className="flex items-center gap-2 text-sm text-[#00475a] font-medium hover:underline"
              >
                <UserPlus className="w-4 h-4" />
                Register new patient
              </button>

              {showNewPatient && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Full Name *</label>
                      <input value={newPatient.full_name} onChange={e => setNewPatient(p => ({ ...p, full_name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" placeholder="Full name" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">Mobile *</label>
                      <input value={newPatient.mobile} onChange={e => setNewPatient(p => ({ ...p, mobile: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" placeholder="10-digit mobile" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Gender</label>
                      <select value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]">
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Date of Birth</label>
                      <input type="date" value={newPatient.date_of_birth} onChange={e => setNewPatient(p => ({ ...p, date_of_birth: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
                    </div>
                  </div>
                  <button onClick={createPatient} disabled={creatingPatient}
                    className="w-full py-2 bg-[#00475a] text-white text-sm font-medium rounded-lg hover:bg-[#00475a]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {creatingPatient ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Register & Select
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Doctor selection */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-[#00475a]" /> Doctor <span className="text-slate-400 font-normal">(optional)</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedDoctor(null)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${!selectedDoctor ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-medium' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              Any Available
            </button>
            {doctors.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDoctor(d)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors text-left ${selectedDoctor?.id === d.id ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Dr. {d.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* Visit details */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00475a]" /> Visit Details
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Visit Type</label>
              <div className="grid grid-cols-2 gap-2">
                {VISIT_TYPES.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVisitType(v.value)}
                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${visitType === v.value ? 'border-[#00475a] bg-teal-50 text-[#00475a] font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Chief Complaint</label>
              <input
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                placeholder="e.g. Fever, headache for 2 days..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a] resize-none"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleBook}
          disabled={!selectedPatient || submitting}
          className="w-full py-3 bg-[#00475a] text-white font-semibold rounded-xl hover:bg-[#00475a]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
          {submitting ? 'Booking...' : 'Book Appointment'}
        </button>
      </div>
    </div>
  );
}
