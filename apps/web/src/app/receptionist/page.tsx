'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, UserPlus, Bell, FileText, Users } from 'lucide-react';

function QuickAction({ label, icon: Icon, href, color }: any) {
  const router = useRouter();
  return (
    <button onClick={() => router.push(href)}
      className={`flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-all hover:shadow-sm ${color}`}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );
}

export default function ReceptionistDashboardPage() {
  const router = useRouter();
  const { data: queue } = useQuery({ queryKey: ['queue-today'], queryFn: () => api.get('/queue?date=today&limit=20').then(r => r.data).catch(() => []), refetchInterval: 30000 });

  const waiting  = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'waiting').length : 0;
  const inConsult = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'in_consultation').length : 0;
  const done     = Array.isArray(queue) ? queue.filter((q: any) => q.status === 'completed').length : 0;

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reception</h1>
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <button onClick={() => router.push('/receptionist/book-appointment')}
          className="flex items-center gap-2 px-4 py-2 bg-[#00b8a0] text-white text-sm font-semibold rounded-xl hover:bg-[#009688]">
          <Calendar className="w-4 h-4" /> Book Appointment
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{waiting}</p>
          <p className="text-xs text-amber-600 mt-1 font-medium">Waiting</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-700">{inConsult}</p>
          <p className="text-xs text-blue-600 mt-1 font-medium">In Consult</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{done}</p>
          <p className="text-xs text-green-600 mt-1 font-medium">Done</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Today's Queue</h3>
          <button onClick={() => router.push('/receptionist/book-appointment')} className="text-xs text-[#00b8a0] hover:underline">+ Add patient</button>
        </div>
        {Array.isArray(queue) && queue.length > 0 ? (
          <div className="space-y-2">
            {queue.slice(0,8).map((q: any) => (
              <div key={q.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-[#00b8a0] text-xs font-bold">
                    {(q.patient_name||q.patient?.first_name||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{q.patient_name || `${q.patient?.first_name} ${q.patient?.last_name||''}`}</p>
                    <p className="text-xs text-gray-400">{q.chief_complaint || q.visit_type || 'Consultation'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  q.status === 'waiting' ? 'bg-amber-100 text-amber-700' :
                  q.status === 'in_consultation' ? 'bg-blue-100 text-blue-700' :
                  q.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>{q.status?.replace('_',' ')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No patients in queue</p>
            <button onClick={() => router.push('/receptionist/book-appointment')} className="mt-3 text-xs text-[#00b8a0] hover:underline">Book first appointment →</button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <QuickAction label="Book Appointment" icon={Calendar} href="/receptionist/book-appointment" color="bg-teal-50 text-teal-700 border-teal-200" />
        <QuickAction label="New Patient"      icon={UserPlus} href="/receptionist/patients"         color="bg-blue-50 text-blue-700 border-blue-200" />
        <QuickAction label="Follow-ups"       icon={Bell}     href="/receptionist/followups"        color="bg-purple-50 text-purple-700 border-purple-200" />
        <QuickAction label="Bills"            icon={FileText} href="/receptionist/bill-history"     color="bg-amber-50 text-amber-700 border-amber-200" />
      </div>
    </div>
  );
}
