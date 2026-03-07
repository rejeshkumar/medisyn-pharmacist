'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Crown, Phone, MapPin, Calendar, Bell, CheckCircle2,
  Clock, AlertCircle, XCircle, Plus, X, Loader2, User, Pencil,
} from 'lucide-react';
import Link from 'next/link';

type Tab = 'overview' | 'appointments' | 'reminders';

const APPT_TYPES = ['consultation', 'follow_up', 'pharmacy_visit', 'vaccination', 'review'];
const REMINDER_TYPES = ['appointment', 'medication', 'follow_up', 'vip_renewal', 'general'];

const statusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'missed': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'cancelled': return <XCircle className="w-4 h-4 text-gray-400" />;
    default: return <Clock className="w-4 h-4 text-blue-500" />;
  }
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    missed: 'bg-red-100 text-red-600 border-red-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
    scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return `badge text-xs capitalize ${styles[status] || 'bg-gray-100 text-gray-600'}`;
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [showApptForm, setShowApptForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [apptForm, setApptForm] = useState({
    appointment_date: '', appointment_time: '', type: 'consultation', doctor_name: '', notes: '',
  });
  const [reminderForm, setReminderForm] = useState({
    title: '', message: '', remind_at: '', type: 'general',
  });

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => api.get(`/patients/${id}`).then((r) => r.data),
  });

  const { data: appointments } = useQuery({
    queryKey: ['patient-appointments', id],
    queryFn: () => api.get(`/patients/${id}/appointments`).then((r) => r.data),
    enabled: tab === 'appointments' || tab === 'overview',
  });

  const { data: reminders } = useQuery({
    queryKey: ['patient-reminders', id],
    queryFn: () => api.get(`/patients/${id}/reminders`).then((r) => r.data),
    enabled: tab === 'reminders' || tab === 'overview',
  });

  const createApptMutation = useMutation({
    mutationFn: (data: any) => api.post(`/patients/${id}/appointments`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Appointment booked');
      setShowApptForm(false);
      setApptForm({ appointment_date: '', appointment_time: '', type: 'consultation', doctor_name: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['patient-appointments', id] });
      qc.invalidateQueries({ queryKey: ['patient-stats'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to book appointment'),
  });

  const updateApptMutation = useMutation({
    mutationFn: ({ apptId, data }: { apptId: string; data: any }) =>
      api.patch(`/patients/appointments/${apptId}`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Appointment updated');
      qc.invalidateQueries({ queryKey: ['patient-appointments', id] });
      qc.invalidateQueries({ queryKey: ['patient-stats'] });
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: (data: any) => api.post(`/patients/${id}/reminders`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Reminder set');
      setShowReminderForm(false);
      setReminderForm({ title: '', message: '', remind_at: '', type: 'general' });
      qc.invalidateQueries({ queryKey: ['patient-reminders', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to set reminder'),
  });

  const markReminderDoneMutation = useMutation({
    mutationFn: (rid: string) => api.patch(`/patients/reminders/${rid}/done`).then((r) => r.data),
    onSuccess: () => {
      toast.success('Reminder marked done');
      qc.invalidateQueries({ queryKey: ['patient-reminders', id] });
    },
  });

  const todayStr = () => new Date().toISOString().split('T')[0];
  const oneYearFrom = (d: string) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() + 1); return dt.toISOString().split('T')[0]; };

  const toggleVipMutation = useMutation({
    mutationFn: () => {
      const start = todayStr();
      const end = oneYearFrom(start);
      return api.patch(`/patients/${id}`, {
        is_vip: !patient?.is_vip,
        ...((!patient?.is_vip) && { vip_start_date: start, vip_end_date: end }),
      }).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success(patient?.is_vip ? 'VIP pass removed' : 'VIP pass activated (1 year)');
      qc.invalidateQueries({ queryKey: ['patient', id] });
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient-stats'] });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  if (!patient) return <div className="p-6 text-gray-500">Patient not found.</div>;

  const upcoming = appointments?.filter((a: any) => a.status === 'scheduled' && a.appointment_date >= new Date().toISOString().split('T')[0]) || [];
  const missed = appointments?.filter((a: any) => a.status === 'missed') || [];
  const completed = appointments?.filter((a: any) => a.status === 'completed') || [];
  const pendingReminders = reminders?.filter((r: any) => !r.is_done) || [];

  const vipExpired = patient.vip_end_date && new Date(patient.vip_end_date) < new Date();

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">

      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Back to Patients
      </button>

      {/* Patient header card */}
      <div className="card">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-700 font-bold text-2xl flex-shrink-0">
            {patient.first_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {patient.salutation} {patient.first_name} {patient.last_name || ''}
              </h1>
              {patient.is_vip && !vipExpired && (
                <span className="badge bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> VIP Member
                </span>
              )}
              {patient.is_vip && vipExpired && (
                <span className="badge bg-red-100 text-red-600 border-red-200">VIP Expired</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{patient.uhid}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {patient.mobile}</span>
              {patient.area && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {patient.area}</span>}
              {patient.age && <span><User className="w-3.5 h-3.5 inline mr-1" />{patient.age} yrs · {patient.gender}</span>}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => toggleVipMutation.mutate()}
              disabled={toggleVipMutation.isPending}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium transition-colors ${
                patient.is_vip
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              {patient.is_vip ? 'Remove VIP' : 'Grant VIP'}
            </button>
          </div>
        </div>

        {/* VIP pass card */}
        {patient.is_vip && (
          <div className={`mt-4 rounded-xl p-4 border ${vipExpired ? 'bg-red-50 border-red-200' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Crown className={`w-5 h-5 ${vipExpired ? 'text-red-500' : 'text-amber-600'}`} />
                <div>
                  <p className={`font-bold text-sm ${vipExpired ? 'text-red-700' : 'text-amber-800'}`}>
                    MediSyn VIP Pass {vipExpired ? '(Expired)' : '(Active)'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(patient.vip_start_date)} → {formatDate(patient.vip_end_date)}
                    {patient.vip_registered_by && ` · Registered by: ${patient.vip_registered_by}`}
                  </p>
                </div>
              </div>
              {vipExpired && (
                <button
                  onClick={() => toggleVipMutation.mutate()}
                  className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700"
                >
                  Renew VIP · New end: {new Date(oneYearFrom(todayStr())).toLocaleDateString('en-IN')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Upcoming', value: upcoming.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed Visits', value: completed.length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Missed Visits', value: missed.length, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-0">
        {(['overview', 'appointments', 'reminders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t === 'reminders' && pendingReminders.length > 0
              ? `Reminders (${pendingReminders.length})`
              : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Patient Details</h3>
            {[
              { label: 'Category', value: patient.category },
              { label: 'Email', value: patient.email || '—' },
              { label: 'DOB', value: patient.dob ? formatDate(patient.dob) : '—' },
              { label: 'Residence No.', value: patient.residence_number || '—' },
              { label: 'Referred By', value: patient.ref_by || '—' },
              { label: 'Address', value: patient.address || '—' },
              { label: 'First Visit', value: patient.is_first_visit ? 'Yes' : 'No' },
              { label: 'Registered', value: formatDateTime(patient.created_at) },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-gray-500">{r.label}</span>
                <span className="text-gray-900 font-medium text-right max-w-48 capitalize">{r.value}</span>
              </div>
            ))}
            {patient.notes && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">{patient.notes}</div>
            )}
          </div>

          <div className="space-y-4">
            {/* Next appointment */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-500" /> Upcoming Appointments
                </h3>
                <button onClick={() => { setTab('appointments'); setShowApptForm(true); }} className="text-xs text-primary-600 hover:underline">+ Book</button>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-xs text-gray-400">No upcoming appointments</p>
              ) : upcoming.slice(0, 3).map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  {statusIcon(a.status)}
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800 capitalize">{a.type.replace('_', ' ')}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(a.appointment_date)}{a.appointment_time ? ` at ${a.appointment_time}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Due reminders */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-orange-500" /> Pending Reminders
                </h3>
                <button onClick={() => { setTab('reminders'); setShowReminderForm(true); }} className="text-xs text-primary-600 hover:underline">+ Add</button>
              </div>
              {pendingReminders.length === 0 ? (
                <p className="text-xs text-gray-400">No pending reminders</p>
              ) : pendingReminders.slice(0, 3).map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                  <Bell className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-gray-800">{r.title}</p>
                    <p className="text-[10px] text-gray-400">{formatDateTime(r.remind_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS TAB ──────────────────────────────────────────────────── */}
      {tab === 'appointments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">All Appointments</h3>
            <button onClick={() => setShowApptForm(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
              <Plus className="w-4 h-4" /> Book Appointment
            </button>
          </div>

          {showApptForm && (
            <div className="card bg-blue-50 border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-blue-900 text-sm">New Appointment</p>
                <button onClick={() => setShowApptForm(false)}><X className="w-4 h-4 text-blue-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Date *</label>
                  <input type="date" className="input text-sm" value={apptForm.appointment_date} onChange={(e) => setApptForm({ ...apptForm, appointment_date: e.target.value })} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="label text-xs">Time</label>
                  <input type="time" className="input text-sm" value={apptForm.appointment_time} onChange={(e) => setApptForm({ ...apptForm, appointment_time: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Type</label>
                  <select className="input text-sm" value={apptForm.type} onChange={(e) => setApptForm({ ...apptForm, type: e.target.value })}>
                    {APPT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Doctor</label>
                  <input className="input text-sm" value={apptForm.doctor_name} onChange={(e) => setApptForm({ ...apptForm, doctor_name: e.target.value })} placeholder="Doctor name" />
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Notes</label>
                  <input className="input text-sm" value={apptForm.notes} onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowApptForm(false)} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
                <button
                  onClick={() => createApptMutation.mutate(apptForm)}
                  disabled={!apptForm.appointment_date || createApptMutation.isPending}
                  className="btn-primary flex-1 text-sm py-2"
                >
                  {createApptMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                  Confirm Booking
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {!appointments?.length ? (
              <div className="text-center py-10 text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No appointments yet</p>
              </div>
            ) : appointments.map((a: any) => (
              <div key={a.id} className="card p-4 flex items-center gap-4">
                {statusIcon(a.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 capitalize">{a.type.replace('_', ' ')}</p>
                    <span className={statusBadge(a.status)}>{a.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(a.appointment_date)}{a.appointment_time ? ` at ${a.appointment_time}` : ''}
                    {a.doctor_name ? ` · Dr. ${a.doctor_name}` : ''}
                  </p>
                  {a.notes && <p className="text-xs text-gray-400 mt-0.5">{a.notes}</p>}
                </div>
                {a.status === 'scheduled' && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateApptMutation.mutate({ apptId: a.id, data: { status: 'completed' } })}
                      className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50"
                    >✓ Done</button>
                    <button
                      onClick={() => updateApptMutation.mutate({ apptId: a.id, data: { status: 'missed' } })}
                      className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                    >✗ Missed</button>
                    <button
                      onClick={() => updateApptMutation.mutate({ apptId: a.id, data: { status: 'cancelled' } })}
                      className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50"
                    >Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REMINDERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'reminders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Reminders</h3>
            <button onClick={() => setShowReminderForm(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2">
              <Plus className="w-4 h-4" /> Add Reminder
            </button>
          </div>

          {showReminderForm && (
            <div className="card bg-orange-50 border-orange-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-orange-900 text-sm">New Reminder</p>
                <button onClick={() => setShowReminderForm(false)}><X className="w-4 h-4 text-orange-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label text-xs">Title *</label>
                  <input className="input text-sm" value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} placeholder="e.g. Follow-up for BP medication" />
                </div>
                <div>
                  <label className="label text-xs">Remind On *</label>
                  <input type="datetime-local" className="input text-sm" value={reminderForm.remind_at} onChange={(e) => setReminderForm({ ...reminderForm, remind_at: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Type</label>
                  <select className="input text-sm" value={reminderForm.type} onChange={(e) => setReminderForm({ ...reminderForm, type: e.target.value })}>
                    {REMINDER_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label text-xs">Message</label>
                  <input className="input text-sm" value={reminderForm.message} onChange={(e) => setReminderForm({ ...reminderForm, message: e.target.value })} placeholder="Optional message to show with reminder" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowReminderForm(false)} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
                <button
                  onClick={() => createReminderMutation.mutate(reminderForm)}
                  disabled={!reminderForm.title || !reminderForm.remind_at || createReminderMutation.isPending}
                  className="btn-primary flex-1 text-sm py-2"
                >
                  {createReminderMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                  Set Reminder
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {!reminders?.length ? (
              <div className="text-center py-10 text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reminders set</p>
              </div>
            ) : reminders.map((r: any) => {
              const overdue = !r.is_done && new Date(r.remind_at) < new Date();
              return (
                <div key={r.id} className={`card p-4 flex items-center gap-4 ${r.is_done ? 'opacity-60' : ''} ${overdue ? 'border-orange-200 bg-orange-50' : ''}`}>
                  <Bell className={`w-4 h-4 flex-shrink-0 ${overdue ? 'text-orange-500' : r.is_done ? 'text-gray-300' : 'text-orange-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${r.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{r.title}</p>
                      {overdue && <span className="badge bg-orange-100 text-orange-700 border-orange-200 text-xs">Overdue</span>}
                      <span className="badge bg-gray-100 text-gray-500 border-gray-200 text-xs capitalize">{r.type.replace('_', ' ')}</span>
                    </div>
                    {r.message && <p className="text-xs text-gray-500 mt-0.5">{r.message}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(r.remind_at)}</p>
                  </div>
                  {!r.is_done && (
                    <button
                      onClick={() => markReminderDoneMutation.mutate(r.id)}
                      className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-50 flex-shrink-0"
                    >
                      ✓ Done
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
