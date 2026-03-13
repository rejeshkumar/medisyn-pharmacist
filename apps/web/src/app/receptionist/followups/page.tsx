'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  CalendarClock, Phone, Mail, MessageCircle, CalendarPlus,
  AlertCircle, Clock, Calendar, User, Loader2, CheckCircle2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Filter = 'overdue' | 'today' | 'upcoming';

const TABS: { key: Filter; label: string; color: string; bg: string; icon: typeof AlertCircle }[] = [
  { key: 'overdue',  label: 'Overdue',      color: 'text-red-600',   bg: 'bg-red-50 border-red-200',    icon: AlertCircle },
  { key: 'today',   label: 'Due Today',    color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: Clock },
  { key: 'upcoming',label: 'Next 7 Days',  color: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200',   icon: Calendar },
];

const patientName = (p: any) =>
  p?.full_name || `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Unknown';

function buildWhatsAppLink(mobile: string, date: string, name: string): string {
  const cleaned = mobile.replace(/\D/g, '');
  const num = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
  const dateFormatted = (() => {
    try { return format(parseISO(date), 'dd MMM yyyy'); } catch { return date; }
  })();
  const text = encodeURIComponent(
    `Hello ${name}, this is a reminder from our clinic. Your follow-up appointment is scheduled for ${dateFormatted}. Please call us to confirm or reschedule. Thank you.`
  );
  return `https://wa.me/${num}?text=${text}`;
}

function FollowUpCard({ c, filter }: { c: any; filter: Filter }) {
  const patient = c.patient;
  const name    = patientName(patient);
  const mobile  = patient?.mobile || '';
  const email   = patient?.email || '';

  const dateLabel = (() => {
    if (!c.follow_up_date) return '';
    try { return format(parseISO(c.follow_up_date), 'dd MMM yyyy'); } catch { return c.follow_up_date; }
  })();

  const dateBadgeClass =
    filter === 'overdue'  ? 'bg-red-100 text-red-700 border-red-200' :
    filter === 'today'    ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-blue-100 text-blue-700 border-blue-200';

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center text-[#00475a] font-bold text-base flex-shrink-0">
          {name[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
            {mobile && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />{mobile}
              </span>
            )}
            {email && (
              <span className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
                <Mail className="w-3 h-3" />{email}
              </span>
            )}
          </div>
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0', dateBadgeClass)}>
          {dateLabel}
        </span>
      </div>

      {/* Clinical info */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {c.diagnosis && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Diagnosis</p>
            <p className="text-xs text-slate-700 line-clamp-2">{c.diagnosis}</p>
          </div>
        )}
        {c.doctor?.full_name && (
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Doctor</p>
            <p className="text-xs text-slate-700">Dr. {c.doctor.full_name}</p>
          </div>
        )}
        {!c.diagnosis && !c.doctor?.full_name && (
          <p className="text-xs text-slate-400 col-span-2">No clinical details</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {mobile && (
          <>
            <a
              href={buildWhatsAppLink(mobile, c.follow_up_date, name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <a
              href={`tel:${mobile}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00475a] text-white text-xs font-medium rounded-lg hover:bg-[#003d4d] transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </a>
          </>
        )}
        {email && (
          <a
            href={`mailto:${email}?subject=Follow-up%20Reminder&body=Dear%20${encodeURIComponent(name)}%2C%0A%0AThis%20is%20a%20follow-up%20reminder%20from%20our%20clinic.%20Your%20follow-up%20was%20scheduled%20for%20${encodeURIComponent(c.follow_up_date || '')}.%0A%0APlease%20contact%20us%20to%20schedule%20your%20appointment.%0A%0AThank%20you.`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </a>
        )}
        <Link
          href={`/receptionist/book?patient_id=${patient?.id}&visit_type=follow_up`}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-[#00475a] border border-teal-200 text-xs font-medium rounded-lg hover:bg-teal-100 transition-colors ml-auto"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          Rebook
        </Link>
      </div>
    </div>
  );
}

export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState<Filter>('today');

  const { data: followUps = [], isLoading } = useQuery<any[]>({
    queryKey: ['follow-ups', activeTab],
    queryFn: () =>
      api.get(`/consultations/follow-ups?filter=${activeTab}`).then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Counts for each tab badge — fetch all three in parallel
  const { data: counts } = useQuery<Record<Filter, number>>({
    queryKey: ['follow-up-counts'],
    queryFn: async () => {
      const [od, tod, up] = await Promise.all([
        api.get('/consultations/follow-ups?filter=overdue').then((r) => r.data.length),
        api.get('/consultations/follow-ups?filter=today').then((r) => r.data.length),
        api.get('/consultations/follow-ups?filter=upcoming').then((r) => r.data.length),
      ]);
      return { overdue: od, today: tod, upcoming: up };
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#00475a] flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Follow-up Manager</h1>
          <p className="text-sm text-slate-400">Track and contact patients due for follow-up visits</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map(({ key, label, color, bg, icon: Icon }) => {
          const count = counts?.[key] ?? 0;
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all flex-shrink-0',
                active
                  ? cn(bg, color, 'shadow-sm')
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                  active ? 'bg-white/60' : 'bg-slate-100 text-slate-600',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Loading follow-ups...</span>
        </div>
      ) : followUps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">
            {activeTab === 'overdue'  ? 'No overdue follow-ups' :
             activeTab === 'today'    ? 'No follow-ups due today' :
                                        'No follow-ups in the next 7 days'}
          </p>
          <p className="text-xs mt-1 text-slate-300">
            Follow-up dates are set by doctors during consultation
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-4">
            {followUps.length} patient{followUps.length !== 1 ? 's' : ''} — click WhatsApp / Call to reach them instantly
          </p>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {followUps.map((c: any) => (
              <FollowUpCard key={c.id} c={c} filter={activeTab} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
