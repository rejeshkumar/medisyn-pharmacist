'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Search, ChevronLeft, ChevronRight, CheckCircle,
  User, Clock, Loader2, X, Calendar,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d: Date, view: string): string {
  const now = new Date();
  now.setHours(0,0,0,0);
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
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0,0,0,0);
  return s;
}

function isPastSlot(date: Date, timeStr: string): boolean {
  const now = new Date();
  const slotDate = new Date(date);
  const [h, m] = timeStr.split(':').map(Number);
  slotDate.setHours(h, m, 0, 0);
  return slotDate <= now;
}

function generateSlots(startH = 9, endH = 18, stepMin = 20): string[] {
  const slots: string[] = [];
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }
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

const initials = (name: string) =>
  name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();

// ── Component ─────────────────────────────────────────────────
export default function BookAppointmentPage() {
  const router = useRouter();

  // Calendar
  const [view, setView]       = useState<'day' | 'week' | 'month'>('day');
  const [cursor, setCursor]   = useState<Date>(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d;
  });

  // Patient
  const [patientSearch, setPatientSearch]   = useState('');
  const [patients, setPatients]             = useState<any[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient]     = useState<any>(null);

  // Doctors
  const [allDoctors, setAllDoctors]         = useState<any[]>([]);
  const [docSearch, setDocSearch]           = useState('');
  const [selSpecialty, setSelSpecialty]     = useState('All');
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  // Slots
  const [selectedSlot, setSelectedSlot]     = useState<string | null>(null);
  const [bookedSlots, setBookedSlots]       = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots]     = useState(false);

  // Form
  const [visitType, setVisitType]           = useState('new');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [booked, setBooked]                 = useState<any>(null);

  // ── Load doctors ─────────────────────────────────────────────
  useEffect(() => {
    api.get('/users?role=doctor&limit=100')
      .then(r => setAllDoctors(r.data?.data || r.data || []))
      .catch(() => setAllDoctors([]));
  }, []);

  // ── Patient search ───────────────────────────────────────────
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

  // ── Load booked slots when doctor+date change ────────────────
  useEffect(() => {
    if (!selectedDoctor) { setBookedSlots([]); return; }
    setLoadingSlots(true);
    const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(cursor.getDate())}`;
    api.get(`/queue?doctor_id=${selectedDoctor.id}&date=${dateStr}&limit=100`)
      .then(r => {
        const entries = r.data?.data || r.data || [];
        const taken = entries
          .filter((e: any) => e.scheduled_time && e.status !== 'cancelled' && e.status !== 'no_show')
          .map((e: any) => e.scheduled_time?.slice(11, 16) ?? '');
        setBookedSlots(taken.filter(Boolean));
      })
      .catch(() => setBookedSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDoctor, cursor]);

  // ── Date navigation ──────────────────────────────────────────
  const navDate = (delta: number) => {
    const d = new Date(cursor);
    if (view === 'day')   d.setDate(d.getDate() + delta);
    if (view === 'week')  d.setDate(d.getDate() + delta * 7);
    if (view === 'month') d.setMonth(d.getMonth() + delta);
    setSelectedSlot(null);
    setCursor(d);
  };

  const goToday = () => {
    const d = new Date(); d.setHours(0,0,0,0);
    setCursor(d);
    setSelectedSlot(null);
  };

  // ── Filtered doctors ─────────────────────────────────────────
  const filteredDoctors = allDoctors.filter(doc => {
    const matchSpec = selSpecialty === 'All' || doc.specialization === selSpecialty;
    const matchQ    = !docSearch ||
      doc.full_name.toLowerCase().includes(docSearch.toLowerCase()) ||
      (doc.specialization ?? '').toLowerCase().includes(docSearch.toLowerCase());
    return matchSpec && matchQ;
  });

  // ── Slot groups ──────────────────────────────────────────────
  const allSlots = generateSlots();
  const dateForSlots = view === 'day' ? cursor : cursor;
  const slots = {
    morning:   allSlots.filter(s => parseInt(s) < 12  && !isPastSlot(dateForSlots, s)),
    afternoon: allSlots.filter(s => parseInt(s) >= 12 && parseInt(s) < 17 && !isPastSlot(dateForSlots, s)),
    evening:   allSlots.filter(s => parseInt(s) >= 17 && !isPastSlot(dateForSlots, s)),
  };

  // ── Book ──────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!selectedPatient) { toast.error('Select a patient'); return; }
    setSubmitting(true);
    try {
      const payload: any = {
        patient_id:    selectedPatient.id,
        visit_type:    visitType,
        chief_complaint: chiefComplaint || undefined,
      };
      if (selectedDoctor)  payload.doctor_id = selectedDoctor.id;
      if (selectedSlot) {
        const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-${pad(cursor.getDate())}`;
        payload.scheduled_time = `${dateStr}T${selectedSlot}:00`;
      }
      const r = await api.post('/queue', payload);
      setBooked(r.data);
      toast.success(`Token #${r.data.token_number} booked`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to book');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setBooked(null); setSelectedPatient(null); setSelectedDoctor(null);
    setSelectedSlot(null); setPatientSearch(''); setChiefComplaint('');
    setVisitType('new'); setDocSearch('');
  };

  const patientName = (p: any) =>
    p?.first_name ? `${p.first_name} ${p.last_name ?? ''}`.trim() : (p?.full_name ?? '');

  // ── Success ───────────────────────────────────────────────────
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
          <button onClick={reset}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">
            Book another
          </button>
          <button onClick={() => router.push('/receptionist/queue')}
            className="flex-1 py-2.5 bg-[#00475a] text-white rounded-xl text-sm font-medium hover:bg-[#003d4d]">
            View queue
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-slate-800 mb-1">Book appointment</h1>
      <p className="text-sm text-slate-400 mb-6">Register a patient into the queue</p>

      <div className="space-y-4">
        {/* ── Patient ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-[#00475a]" /> Patient
          </h2>
          {selectedPatient ? (
            <div className="flex items-center gap-3 bg-teal-50 rounded-xl px-4 py-3 border border-teal-100">
              <div className="w-9 h-9 rounded-full bg-[#00475a] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                {initials(patientName(selectedPatient))}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-sm">{patientName(selectedPatient)}</p>
                <p className="text-xs text-slate-500">{selectedPatient.mobile}</p>
              </div>
              <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text" value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search by name or mobile..."
                className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
              />
              {searchingPatients && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
              )}
              {patients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-10 overflow-hidden">
                  {patients.map(p => (
                    <button key={p.id}
                      onClick={() => { setSelectedPatient(p); setPatients([]); setPatientSearch(''); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                        {initials(patientName(p))}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{patientName(p)}</p>
                        <p className="text-xs text-slate-400">{p.mobile}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Visit type ───────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Visit type</h2>
          <div className="flex gap-2">
            {VISIT_TYPES.map(vt => (
              <button key={vt.value}
                onClick={() => setVisitType(vt.value)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  visitType === vt.value
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {vt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Doctor ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Doctor</h2>

          {/* Search + specialty filter */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              placeholder="Search by name or specialty..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#00475a]"
            />
          </div>

          {/* Specialty chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
            {SPECIALTIES.map(sp => (
              <button key={sp}
                onClick={() => setSelSpecialty(sp)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 border transition-all ${
                  selSpecialty === sp
                    ? 'bg-[#00475a] text-white border-[#00475a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {sp}
              </button>
            ))}
          </div>

          {/* Doctor list */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {/* Any doctor option */}
            <div
              onClick={() => { setSelectedDoctor(null); setSelectedSlot(null); }}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                !selectedDoctor
                  ? 'border-[#00475a] bg-teal-50 border-2'
                  : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-medium flex-shrink-0">
                Any
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">Any available doctor</p>
                <p className="text-xs text-slate-400">Walk-in queue</p>
              </div>
            </div>

            {filteredDoctors.map((doc, idx) => {
              const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const isSelected = selectedDoctor?.id === doc.id;
              return (
                <div key={doc.id}
                  onClick={() => { setSelectedDoctor(doc); setSelectedSlot(null); }}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#00475a] bg-teal-50 border-2'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: color.bg, color: color.tc }}
                  >
                    {initials(doc.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.full_name}</p>
                    {doc.specialization && (
                      <p className="text-xs text-slate-400">{doc.specialization}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredDoctors.length === 0 && docSearch && (
              <p className="text-sm text-slate-400 text-center py-3">No doctors found</p>
            )}
          </div>
        </div>

        {/* ── Date & slot ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#00475a]" /> Date & time slot
            </h2>
            {/* View toggle */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden text-xs">
              {(['day','week','month'] as const).map(v => (
                <button key={v}
                  onClick={() => { setView(v); setSelectedSlot(null); }}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    view === v ? 'bg-[#00475a] text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navDate(-1)}
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-slate-800">
              {fmtDate(cursor, view)}
            </div>
            <button onClick={() => navDate(1)}
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
              Today
            </button>
          </div>

          {/* Week calendar mini-view */}
          {view === 'week' && (() => {
            const ws = getWeekStart(cursor);
            return (
              <div className="grid grid-cols-7 gap-1 mb-4">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = new Date(ws); d.setDate(ws.getDate() + i);
                  const isToday = d.toDateString() === new Date().toDateString();
                  const isSel   = d.toDateString() === cursor.toDateString();
                  return (
                    <button key={i}
                      onClick={() => { setCursor(d); setSelectedSlot(null); setView('day'); }}
                      className={`flex flex-col items-center py-2 rounded-xl text-xs transition-all ${
                        isSel ? 'bg-[#00475a] text-white' :
                        isToday ? 'bg-teal-50 text-[#00475a] border border-teal-200' :
                        'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="text-xs opacity-70">{DAYS[d.getDay()]}</span>
                      <span className="font-semibold mt-0.5">{d.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Month calendar mini-view */}
          {view === 'month' && (() => {
            const y = cursor.getFullYear(), m = cursor.getMonth();
            const first = new Date(y, m, 1);
            const last  = new Date(y, m+1, 0);
            const cells = [];
            for (let i = 0; i < first.getDay(); i++) cells.push(null);
            for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
            return (
              <div className="mb-4">
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => (
                    <div key={d} className="text-center text-xs text-slate-400 py-1">{d[0]}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isToday = d.toDateString() === new Date().toDateString();
                    const isSel   = d.toDateString() === cursor.toDateString();
                    return (
                      <button key={i}
                        onClick={() => { setCursor(d); setSelectedSlot(null); setView('day'); }}
                        className={`aspect-square flex items-center justify-center text-xs rounded-lg font-medium transition-all ${
                          isSel ? 'bg-[#00475a] text-white' :
                          isToday ? 'bg-teal-50 text-[#00475a] border border-teal-200' :
                          'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Slot picker — always shown on day view, shown after clicking day in week/month */}
          {view === 'day' && (
            <>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {!selectedDoctor && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3 text-center">
                      Select a doctor above to see available slots
                    </p>
                  )}
                  {(['morning','afternoon','evening'] as const).map(band => {
                    const bandSlots = slots[band];
                    if (!bandSlots.length) return null;
                    const freeCount = bandSlots.filter(s => !bookedSlots.includes(s)).length;
                    return (
                      <div key={band} className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                            {band}
                          </span>
                          <span className="text-xs text-slate-400">{freeCount} free</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {bandSlots.map(slot => {
                            const isBooked = bookedSlots.includes(slot);
                            const isSel    = selectedSlot === slot;
                            return (
                              <button key={slot}
                                onClick={() => !isBooked && selectedDoctor && setSelectedSlot(slot)}
                                disabled={isBooked || !selectedDoctor}
                                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  isSel    ? 'bg-[#00475a] text-white' :
                                  isBooked ? 'bg-slate-100 text-slate-300 line-through cursor-not-allowed' :
                                  !selectedDoctor ? 'bg-slate-50 text-slate-300 cursor-not-allowed' :
                                  'border border-slate-200 text-slate-600 hover:border-[#00475a] hover:text-[#00475a]'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {selectedSlot && (
                    <p className="text-xs text-teal-700 bg-teal-50 rounded-lg p-2 text-center mt-2">
                      Slot selected: <strong>{selectedSlot}</strong> on {fmtDate(cursor, 'day')}
                    </p>
                  )}
                  {!selectedSlot && selectedDoctor && (
                    <p className="text-xs text-slate-400 text-center mt-2">
                      No slot selected — patient will be added to general queue
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── Chief complaint ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Chief complaint (optional)</h2>
          <textarea
            value={chiefComplaint}
            onChange={e => setChiefComplaint(e.target.value)}
            placeholder="e.g. Fever for 3 days, headache..."
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:border-[#00475a]"
          />
        </div>

        {/* ── Book button ───────────────────────────────────────── */}
        <button
          onClick={handleBook}
          disabled={submitting || !selectedPatient}
          className="w-full py-3.5 bg-[#00475a] text-white rounded-xl text-sm font-bold hover:bg-[#003d4d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" />Booking...</>
            : <><CheckCircle className="w-4 h-4" />Confirm appointment</>
          }
        </button>
      </div>
    </div>
  );
}
