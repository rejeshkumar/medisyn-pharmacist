'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { ClipboardList, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DoctorHistoryPage() {
  const router = useRouter();
  const user = getUser();

  // We query all patients and for each show recent consultations
  // For now we show a generic recent consultations list via queue history
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['doctor-history'],
    queryFn: () => api.get(`/queue/today?doctor_id=${user?.id}`).then(r => r.data),
  });

  const completed = queue.filter((e: any) =>
    ['consultation_done', 'completed'].includes(e.status)
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
        <p className="text-slate-500 text-sm mt-1">Today's completed consultations</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : completed.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-10 text-center text-slate-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No completed consultations today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completed.map((entry: any) => (
            <div
              key={entry.id}
              onClick={() => router.push(`/doctor/consult/${entry.id}`)}
              className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-4 hover:border-slate-200 hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center font-bold text-green-700 flex-shrink-0">
                {entry.token_number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{entry.patient?.name || 'Unknown'}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(entry.completed_at || entry.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {entry.chief_complaint && ` · ${entry.chief_complaint}`}
                </p>
              </div>
              <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full flex-shrink-0">
                Done
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
