'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle,
  User, Clock, Loader2, X, Calendar, UserPlus,
} from 'lucide-react';
import { PatientRegistrationModal } from '@/components/patients/PatientRegistrationModal';

// ── Helpers — IDENTICAL to original ──────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: Date, view: string): string {
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (view === 'day') {
    if (diff === 0) return `Today — ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (diff === 1) return `Tomorrow — ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (view === 'week') {
    const end = new Date(d); end.setDate(d.getDate() + 6);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function getWeekStart(d: Date): Date {
  const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0,0,0,0); return s;
}
function isPastSlot(date: Date, timeStr: string): boolean {
  const now = new Date(); const slotDate = new Date(date);
  const [h, m] = timeStr.split(':').map(Number); slotDate.setHours(h, m, 0, 0);
  return slotDate <= now;
}
function generateSlots(startH = 9, endH = 18, stepMin = 20): string[] {
  const slots: string[] = [];
  for (let h = startH; h < endH; h++)
    for (let m = 0; m < 60; m += stepMin)
      slots.push(`${pad(h)}:${pad(m)}`);
  return slots;
}

const SPECIALTIES = ['All','General Physician','Cardiologist','Dermatologist',
  'ENT','Gynaecology','Orthopaedics','Paediatrics','Neurology'];
const VISIT_TYPES = [
  { value: 'new',       label: 'New visit' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'emergency', label: 'Emergency' },
];
const AVATAR_COLORS = [
  { bg: '#e1f5ee', tc: '#0f6e56' }, { bg: '#e6f1fb', tc: '#185fa5' },
  { bg: '#fbeaf0', tc: '#993556' }, { bg: '#eeedfe', tc: '#534ab7' },
  { bg: '#faeeda', tc: '#854f0b' }, { bg: '#eaf3de', tc: '#3b6d11' },
];
const initials = (name: string) => name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

// ── Component ─────────────────────────────────────────────────────────────────
export default function BookAppointmentPage() {
  const router = useRouter();

  // ── ALL STATE — identical to original ────────────────────────────────────
  const [view, setView]       = useState<'day'|'week'|'month'>('day');
  const [cursor, setCursor]   = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [patientSearch, setPatientSearch]           = useState('');
  const [patients, setPatients]                     = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients]   = useState(false);
  const [selectedPatient, setSelectedPatient]       = useState<any>(null);
  const [showNewPatient, setShowNewPatient]         = useState(false);
  const [allDoctors, setAllDoctors]                 = useState<any[]>([]);
  const [docSearch, setDocSearch]                   = useState('');
  const [selSpecialty, setSelSpecialty]             = useState('All');
  const [selectedDoctor, setSelectedDoctor]         = useState<any>(null);
  const [selectedSlot, setSelectedSlot]             = useState<string|null>(null);
  const [bookedSlots, setBookedSlots]               = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots]             = useState(false);
  const [doctorSlots, setDoctorSlots]               = useState<string[]>([]);
  const [doctorUnavailable, setDoctorUnavailable]   = useState<string|null>(null);
  const [loadingDoctorSlots, setLoadingDoctorSlots] = useState(false);
  const [visitType, setVisitType]                   = useState('new');
  const [chiefComplaint, setChiefComplaint]         = useState('');
  const [submitting, setSubmitting]                 = useState(false);
  const [booked, setBooked]                         = useState<any>(null);
  // Queue counts per doctor (new — fetched alongside doctors)
  const [queueCounts, setQueueCounts]               = useState<Record<string, number>>({});

  // ── ALL EFFECTS — identical to original ──────────────────────────────────
  useEffect(() => {
    api.get('/users?role=doctor&limit=100')
      .then(r => {
        const docs = r.data?.data || r.data || [];
        setAllDoctors(docs);
        // Fetch today's queue counts for each doctor
        const dateStr = new Date().toISOString().split('T')[0];
        Promise.all(
          docs.map((d: any) =>
            api.get(`/queue?doctor_id=${d.id}&date=${dateStr}&limit=100`)
              .then(r2 => {
                const entries = r2.data?.data || r2.data || [];
                const active = entries.filter((e: any) => !['cancelled','no_show','completed','dispensed'].includes(e.status));
                return { id: d.id, count: active.length };
              })
              .catch(() => ({ id: d.id, count: 0 }))
          )
        ).then(counts => {
          const map: Record<string, number> = {};
          counts.forEach(c => { map[c.id] = c.count; });
          setQueueCounts(map);
        });
      })
      .catch(() => setAllDoctors([]));
  }, []);

  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) { setPatients([]); return; }
    setSearchingPatients(true);
    try {
      const r = await api.get(`/patients?search=${encodeURIComponent(q)}&limit=8`);
      setPatients(r.data?.data || r.data || []);
    } catch { setPatients([]); }
    finally { setSearchingPatients(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 350);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  useEffect(() => {
    if (!selectedDoctor || selectedDoctor.id === 'any') {
      setDoctorSlots(generateSlots()); setDoctorUnavailable(null); return;
    }
    setLoadingDoctorSlots(true); setDoctorUnavailable(null);
    const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(cursor.getDate())}`;
    api.get(`/availability/${selectedDoctor.id}/slots?date=${dateStr}`)
      .then(r => {
        const data = r.data;
        if (!data.is_available) {
          setDoctorSlots([]); setDoctorUnavailable(data.reason || 'Doctor not available');
        } else {
          setDoctorSlots(data.slots.filter((s: any) => s.available).map((s: any) => s.time));
          setDoctorUnavailable(null);
        }
      })
      .catch(() => { setDoctorSlots(generateSlots()); setDoctorUnavailable(null); })
      .finally(() => setLoadingDoctorSlots(false));
  }, [selectedDoctor, cursor]);

  useEffect(() => {
    if (!selectedDoctor) { setBookedSlots([]); return; }
    setLoadingSlots(true);
    const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(cursor.getDate())}`;
    api.get(`/queue?doctor_id=${selectedDoctor.id}&date=${dateStr}&limit=100`)
      .then(r => {
        const entries = r.data?.data || r.data || [];
        const taken = entries
          .filter((e: any) => e.scheduled_time && e.status !== 'cancelled' && e.status !== 'no_show')
          .map((e: any) => e.scheduled_time?.slice(11,16) ?? '');
        setBookedSlots(taken.filter(Boolean));
      })
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDoctor, cursor]);

  const navDate = (delta: number) => {
    const d = new Date(cursor);
    if (view === 'day')   d.setDate(d.getDate() + delta);
    if (view === 'week')  d.setDate(d.getDate() + delta * 7);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    setSelectedSlot(null); setCursor(d);
  };
  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setCursor(d); setSelectedSlot(null); };

  const filteredDoctors = allDoctors.filter(doc => {
    const matchSpec = selSpecialty === 'All' || doc.specialization === selSpecialty;
    const matchQ    = !docSearch
      || doc.full_name.toLowerCase().includes(docSearch.toLowerCase())
      || (doc.specialization ?? '').toLowerCase().includes(docSearch.toLowerCase());
    return matchSpec && matchQ;
  });

  const activeSlots = (selectedDoctor && selectedDoctor.id !== 'any' && doctorSlots.length > 0)
    ? doctorSlots.filter(s => !isPastSlot(cursor, s))
    : generateSlots().filter(s => !isPastSlot(cursor, s));
  const slots = {
    morning:   activeSlots.filter(s => parseInt(s) < 12),
    afternoon: activeSlots.filter(s => parseInt(s) >= 12 && parseInt(s) < 17),
    evening:   activeSlots.filter(s => parseInt(s) >= 17),
  };

  // ── handleBook — IDENTICAL to original ───────────────────────────────────
  const handleBook = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        patient_id:      selectedPatient.id,
        visit_type:      visitType,
        chief_complaint: chiefComplaint || undefined,
      };
      if (selectedDoctor && selectedDoctor.id !== 'any') payload.doctor_id = selectedDoctor.id;
      if (selectedSlot) {
        const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(cursor.getDate())}`;
        payload.scheduled_time = `${dateStr}T${selectedSlot}:00`;
      }
      const r = await api.post('/queue', payload);
      setBooked(r.data);
      toast.success(`Token #${r.data.token_number} booked`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to book');
    } finally { setSubmitting(false); }
  };

  const reset = () => {
    setBooked(null); setSelectedPatient(null); setSelectedDoctor(null);
    setSelectedSlot(null); setPatientSearch(''); setChiefComplaint('');
    setVisitType('new'); setDocSearch('');
  };

  const patientName = (p: any) =>
    p?.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : (p?.full_name ?? '');

  // ── Queue color helper ────────────────────────────────────────────────────
  const queueColor = (n: number) => {
    if (n === 0)  return { bg: '#EAF3DE', tc: '#27500A' };
    if (n <= 4)   return { bg: '#EAF3DE', tc: '#27500A' };
    if (n <= 7)   return { bg: '#FAEEDA', tc: '#633806' };
    return          { bg: '#FCEBEB', tc: '#791F1F' };
  };

  // ── Success screen — IDENTICAL to original ───────────────────────────────
  if (booked) return (
    <div className="p-6 max-w-md mx-auto mt-8">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Appointment booked!</h2>
        <div className="text-5xl font-black text-[#00475a] my-4">#{booked.token_number}</div>
        <p className="text-slate-600 font-medium mb-1">{patientName(selectedPatient)}</p>
        {selectedDoctor && <p className="text-sm text-slate-400 mb-1">{selectedDoctor.full_name}</p>}
        {selectedSlot && <p className="text-sm text-slate-400">{fmtDate(cursor,'day')} at {selectedSlot}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={reset} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            Book another
          </button>
          <button onClick={() => router.push('/receptionist/queue')} className="flex-1 py-2.5 bg-[#00b8a0] text-white rounded-xl text-sm font-medium hover:bg-[#009688]">
            View queue
          </button>
        </div>
      </div>
    </div>
  );

  // ── MAIN RENDER — matrix layout ─────────────────────────────────────────────
  const ALL_SLOTS = generateSlots(9, 18, 20);
  const NOON_MARKER = '12:00';

  const matrixDoctors = [
    { id: 'any', full_name: 'Any available', specialization: 'Walk-in', _any: true },
    ...filteredDoctors,
  ];

  return (
    <>
    <div className="flex flex-col h-full">

      <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-white">
        <h1 className="text-base font-semibold text-slate-800">Book appointment</h1>
        <p className="text-xs text-slate-400">Search patient, pick visit type, then select a doctor and time slot</p>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-100 bg-white">

        <div className="px-5 py-4 border-r border-slate-100">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <User className="w-3 h-3" /> Patient
          </p>
          {selectedPatient ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#00b8a0] bg-teal-50">
              <div className="w-7 h-7 rounded-full bg-[#00b8a0] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {initials(patientName(selectedPatient))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{patientName(selectedPatient)}</p>
                <p className="text-[10px] text-slate-500">{selectedPatient.mobile}</p>
              </div>
              <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text" value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search name or mobile..."
                className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#00b8a0]"
                autoComplete="off"
              />
              {searchingPatients && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-slate-400" />}
              {(patients.length > 0 || (patientSearch.length >= 2 && !searchingPatients)) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-20 overflow-hidden">
                  {patients.map(p => (
                    <button key={p.id} onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(''); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {initials(patientName(p))}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">{patientName(p)}</p>
                        <p className="text-[10px] text-slate-400">{p.mobile}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowNewPatient(true); setPatients([]); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-teal-50 text-left bg-teal-50/50 border-t border-slate-100">
                    <div className="w-7 h-7 rounded-full bg-[#00b8a0]/10 text-[#00475a] flex items-center justify-center text-xs font-bold flex-shrink-0">+</div>
                    <div>
                      <p className="text-xs font-semibold text-[#00475a]">Register new patient</p>
                      <p className="text-[10px] text-slate-400">Add "{patientSearch}"</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowNewPatient(true)}
            className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 border border-dashed border-slate-200 rounded-lg text-[11px] text-slate-400 hover:border-[#00b8a0] hover:text-[#00b8a0] transition-colors">
            <UserPlus className="w-3 h-3" /> Register new patient
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Visit type</p>
          <div className="flex gap-2 mb-3">
            {VISIT_TYPES.map(vt => (
              <button key={vt.value} onClick={() => setVisitType(vt.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                  visitType === vt.value
                    ? 'bg-[#00b8a0] text-white border-[#00b8a0]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}>
                {vt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Chief complaint <span className="normal-case font-normal">(optional)</span>
          </p>
          <textarea value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
            placeholder="e.g. Fever for 3 days, headache..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none focus:border-[#00b8a0]" />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex-wrap">
        <div className="relative w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input type="text" value={docSearch} onChange={e => setDocSearch(e.target.value)}
            placeholder="Search doctor..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#00b8a0]" />
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {SPECIALTIES.map(sp => (
            <button key={sp} onClick={() => setSelSpecialty(sp)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition-all flex-shrink-0 ${
                selSpecialty === sp
                  ? 'bg-[#00b8a0] text-white border-[#00b8a0]'
                  : 'border-slate-200 text-slate-500 hover:border-[#00b8a0] bg-white'
              }`}>
              {sp}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => navDate(-1)} className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-md bg-white hover:bg-slate-50">
            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <span className="text-xs font-semibold text-slate-700 min-w-[148px] text-center">{fmtDate(cursor, 'day')}</span>
          <button onClick={() => navDate(1)} className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-md bg-white hover:bg-slate-50">
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
          <button onClick={goToday} className="px-2.5 py-1 text-[11px] font-semibold border border-[#00b8a0] rounded-md text-[#00b8a0] bg-white hover:bg-teal-50">
            Today
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loadingDoctorSlots && (
          <div className="flex items-center justify-center py-4 gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading slots...
          </div>
        )}
        <table className="w-full border-collapse text-xs" style={{ minWidth: '700px' }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-100 text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider min-w-[150px]">
                Doctor
              </th>
              {ALL_SLOTS.map(slot => {
                const isNoon = slot === NOON_MARKER;
                return (
                  <th key={slot}
                    className={`border-b border-r border-slate-100 px-1 py-2 font-medium whitespace-nowrap text-center min-w-[48px] ${
                      isNoon ? 'bg-slate-100 text-slate-300 text-[9px] tracking-wider' : 'bg-slate-50 text-slate-400'
                    }`}>
                    {isNoon ? 'NOON' : slot}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {matrixDoctors.map((doc, idx) => {
              const color = doc._any
                ? { bg: '#f1f5f9', tc: '#64748b' }
                : AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const qCount = doc._any
                ? Object.values(queueCounts).reduce((a: number, b: number) => a + b, 0)
                : (queueCounts[doc.id] ?? 0);
              const qc = queueColor(qCount);
              const isSelectedDoc = selectedDoctor?.id === doc.id || (doc._any && !selectedDoctor);

              return (
                <tr key={doc.id}
                  className={`border-b border-slate-50 transition-colors ${
                    isSelectedDoc ? 'bg-teal-50/60' : 'hover:bg-slate-50/60'
                  }`}>
                  <td
                    className={`sticky left-0 z-10 border-r border-slate-100 px-2 py-2 cursor-pointer ${
                      isSelectedDoc ? 'bg-teal-50 border-l-2 border-l-[#00b8a0]' : 'bg-white'
                    }`}
                    onClick={() => {
                      if (doc._any) { setSelectedDoctor(null); } else { setSelectedDoctor(doc); }
                      setSelectedSlot(null);
                    }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold flex-shrink-0"
                        style={{ background: color.bg, color: color.tc }}>
                        {doc._any ? '?' : initials(doc.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700 truncate text-[11px]">{doc.full_name}</p>
                        <p className="text-slate-400 text-[10px]">{doc.specialization}</p>
                      </div>
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 whitespace-nowrap"
                        style={{ background: qc.bg, color: qc.tc }}>
                        {qCount}
                      </span>
                    </div>
                  </td>
                  {ALL_SLOTS.map(slot => {
                    const isNoon = slot === NOON_MARKER;
                    if (isNoon) return (
                      <td key={slot} className="border-r border-slate-100 bg-slate-50 text-center text-slate-200 text-base">—</td>
                    );
                    const isPast = isPastSlot(cursor, slot);
                    const isBooked = selectedDoctor?.id === doc.id && bookedSlots.includes(slot);
                    const isOff = !doc._any && selectedDoctor?.id === doc.id && doctorSlots.length > 0 && !doctorSlots.includes(slot) && !isPast;
                    const isSel = isSelectedDoc && selectedSlot === slot;
                    let cellClass = '';
                    let label = 'Free';
                    let clickable = true;
                    if (isSel) {
                      cellClass = 'bg-[#00b8a0] text-white font-semibold border-[#00b8a0]';
                      label = slot;
                      clickable = false;
                    } else if (isPast || isBooked) {
                      cellClass = 'bg-slate-50 text-slate-200 line-through cursor-not-allowed';
                      label = 'x';
                      clickable = false;
                    } else if (isOff) {
                      cellClass = 'text-slate-200 cursor-default';
                      label = '-';
                      clickable = false;
                    } else {
                      cellClass = 'border border-slate-200 text-slate-400 hover:border-[#00b8a0] hover:text-[#00b8a0] hover:bg-teal-50 cursor-pointer';
                    }
                    return (
                      <td key={slot} className="border-r border-slate-100 px-1 py-1.5 text-center">
                        <button
                          disabled={!clickable}
                          onClick={() => {
                            if (!clickable) return;
                            if (doc._any) { setSelectedDoctor(null); } else { setSelectedDoctor(doc); }
                            setSelectedSlot(slot);
                          }}
                          className={`w-10 h-6 rounded text-[10px] transition-all ${cellClass}`}>
                          {label}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {matrixDoctors.length <= 1 && docSearch && (
              <tr>
                <td colSpan={ALL_SLOTS.length + 1} className="text-center py-6 text-xs text-slate-400">
                  No doctors match "{docSearch}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center gap-5 px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#00b8a0]"></span>Selected</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-slate-100 border border-slate-200"></span>Booked / past</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded border border-slate-200"></span>Free</span>
          <span className="flex items-center gap-1.5 text-slate-300">— Not available</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-3 bg-white border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          {selectedPatient && (
            <>
              <span className="flex items-center gap-1"><User className="w-3 h-3" /><span className="font-semibold text-slate-700">{patientName(selectedPatient)}</span></span>
              <span className="w-px h-3 bg-slate-200" />
            </>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className="font-semibold text-slate-700">{selectedDoctor ? selectedDoctor.full_name : 'Any available doctor'}</span>
          </span>
          <span className="w-px h-3 bg-slate-200" />
          {selectedSlot ? (
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /><span className="font-semibold text-slate-700">{fmtDate(cursor,'day')} at {selectedSlot}</span></span>
          ) : (
            <span className="italic">No slot selected — will join general queue</span>
          )}
          <span className="w-px h-3 bg-slate-200" />
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#e1f5ee', color: '#085041' }}>
            {VISIT_TYPES.find(v => v.value === visitType)?.label}
          </span>
        </div>
        <button onClick={handleBook} disabled={submitting || !selectedPatient}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00b8a0] text-white rounded-lg text-xs font-semibold hover:bg-[#009688] disabled:opacity-50 transition-colors flex-shrink-0">
          {submitting
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Booking...</>
            : <><CheckCircle className="w-3.5 h-3.5" /> Confirm booking</>
          }
        </button>
      </div>
    </div>

    <PatientRegistrationModal
      open={showNewPatient}
      onClose={() => setShowNewPatient(false)}
      onSuccess={(patient) => { setSelectedPatient(patient); setPatientSearch(''); }}
      invalidateKeys={[['queue-today']]}
    />
    </>
  );
}