'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  date_of_birth?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  mobile?: string;
  blood_group?: string;
  allergies?: string;
  medical_history?: string;
}

interface QueueItem {
  id: string;
  patient?: Patient;
  patient_id?: string;
  status: string;
  visit_type?: string;
  chief_complaint?: string;
  created_at?: string;
  queue_number?: number;
  token_number?: number;
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<QueueItem | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const patientName = (p?: Patient | null) =>
    p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';

  const patientDob = (p: Patient) => p.date_of_birth || p.dob;

  const loadQueue = useCallback(async () => {
    try {
      const res = await api.get('/queue');
      const items: QueueItem[] = res?.data?.items || res?.data || [];
      const active = items.filter((q) =>
        ['waiting', 'precheck_done', 'in_consultation'].includes(q.status)
      );
      setQueue(active);
    } catch (err) {
      console.error('Failed to load queue', err);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients');
      setPatients(res?.data?.items || res?.data || []);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    loadPatients();
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, [loadQueue, loadPatients]);

  const handleSelectQueue = async (item: QueueItem) => {
    setSelectedQueue(item);
    if (item.patient) {
      setSelectedPatient(item.patient);
    } else if (item.patient_id) {
      try {
        const res = await api.get(`/patients/${item.patient_id}`);
        setSelectedPatient(res?.data || null);
      } catch {
        setSelectedPatient(null);
      }
    }
  };

  const handleStartConsultation = (item: QueueItem) => {
    const patientId = item.patient_id || item.patient?.id;
    if (patientId) {
      router.push(`/doctor/consultation?queueId=${item.id}&patientId=${patientId}`);
    }
  };

  const handleViewPatient = (patient: Patient) => {
    router.push(`/doctor/consultation?patientId=${patient.id}`);
  };

  const filteredPatients = patients.filter((p) => {
    const name = patientName(p).toLowerCase();
    const phone = (p.phone || p.mobile || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      waiting: 'bg-yellow-100 text-yellow-800',
      precheck_done: 'bg-blue-100 text-blue-800',
      in_consultation: 'bg-green-100 text-green-800',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      waiting: 'Waiting',
      precheck_done: 'Ready',
      in_consultation: 'In Progress',
    };
    return map[status] || status;
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 border-r border-slate-100 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm mb-3">Today's Queue</h2>
          {loading ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : queue.length === 0 ? (
            <p className="text-xs text-slate-400">No patients in queue</p>
          ) : (
            <div className="space-y-2">
              {queue.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectQueue(item)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedQueue?.id === item.id
                      ? 'border-teal-300 bg-teal-50'
                      : 'border-slate-200 hover:border-teal-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">
                      #{item.token_number || item.queue_number || '—'}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(item.status)}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {patientName(item.patient)}
                  </p>
                  {item.chief_complaint && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.chief_complaint}</p>
                  )}
                  {(item.status === 'precheck_done' || item.status === 'waiting') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartConsultation(item);
                      }}
                      className="mt-2 w-full text-xs bg-teal-600 text-white py-1.5 rounded-md hover:bg-teal-700 transition-colors"
                    >
                      Start Consultation
                    </button>
                  )}
                  {item.status === 'in_consultation' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartConsultation(item);
                      }}
                      className="mt-2 w-full text-xs bg-blue-600 text-white py-1.5 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Continue Consultation
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient details panel */}
        {selectedPatient && (
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Patient Details
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-400">Name</p>
                <p className="text-sm font-medium text-slate-800">{patientName(selectedPatient)}</p>
              </div>
              {patientDob(selectedPatient) && (
                <div>
                  <p className="text-xs text-slate-400">Date of Birth</p>
                  <p className="text-sm text-slate-700">{patientDob(selectedPatient)}</p>
                </div>
              )}
              {selectedPatient.gender && (
                <div>
                  <p className="text-xs text-slate-400">Gender</p>
                  <p className="text-sm text-slate-700 capitalize">{selectedPatient.gender}</p>
                </div>
              )}
              {(selectedPatient.phone || selectedPatient.mobile) && (
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="text-sm text-slate-700">
                    {selectedPatient.phone || selectedPatient.mobile}
                  </p>
                </div>
              )}
              {selectedPatient.blood_group && (
                <div>
                  <p className="text-xs text-slate-400">Blood Group</p>
                  <p className="text-sm text-slate-700">{selectedPatient.blood_group}</p>
                </div>
              )}
              {selectedPatient.allergies && (
                <div>
                  <p className="text-xs text-slate-400">Allergies</p>
                  <p className="text-sm text-red-600">{selectedPatient.allergies}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel — Patient list */}
      <div className="flex-1 flex flex-col bg-slate-50">
        <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-3">
          <h2 className="font-semibold text-slate-800">All Patients</h2>
          <div className="flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-teal-400"
            />
          </div>
          <span className="text-xs text-slate-400">{filteredPatients.length} patients</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-slate-400">Loading patients...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-slate-400">No patients found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="bg-white rounded-lg border border-slate-200 p-4 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => handleViewPatient(patient)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-teal-700">
                        {patientName(patient).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {patient.blood_group && (
                      <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                        {patient.blood_group}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    {patientName(patient)}
                  </p>
                  {(patient.phone || patient.mobile) && (
                    <p className="text-xs text-slate-500">{patient.phone || patient.mobile}</p>
                  )}
                  {patientDob(patient) && (
                    <p className="text-xs text-slate-400 mt-0.5">DOB: {patientDob(patient)}</p>
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
    </div>
  );
}
