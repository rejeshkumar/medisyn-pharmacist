'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ClipboardList, ChevronRight, Loader2, User, Pill, CheckCircle2, Clock, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface PrescriptionBridgeProps {
  onLoadPrescription: (data: {
    prescriptionId: string;
    patientName: string;
    doctorName: string;
    items: Array<{
      medicine_name: string;
      medicine_id?: string;
      dosage?: string;
      frequency?: string;
      quantity?: number;
    }>;
  }) => void;
  onPendingCountChange?: (count: number) => void;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  issued:              { label: 'Pending',    color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  partially_dispensed: { label: 'Partial',    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  fully_dispensed:     { label: 'Dispensed',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  draft:               { label: 'Draft',      color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
  cancelled:           { label: 'Cancelled',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
};

export default function PrescriptionBridge({ onLoadPrescription, onPendingCountChange }: PrescriptionBridgeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newArrival, setNewArrival] = useState(false);
  const prevPendingCount = useRef<number | null>(null);

  // Fetch today's queue entries that are consultation_done or dispensing — poll every 15s
  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ['dispensing-queue'],
    queryFn: () => api.get('/queue/today').then(r =>
      r.data.filter((e: any) => ['consultation_done', 'dispensing', 'completed'].includes(e.status))
    ),
    refetchInterval: 15000,
  });

  // Fetch prescription for selected queue entry
  const { data: prescription, isLoading: rxLoading } = useQuery({
    queryKey: ['prescription-by-queue', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const consult = await api.get(`/consultations/queue/${selectedId}`).then(r => r.data);
      const rx = await api.get(`/prescriptions/consultation/${consult.id}`).then(r => r.data);
      return { rx, consult };
    },
    enabled: !!selectedId,
    retry: false,
  });

  const handleLoad = () => {
    if (!prescription) return;
    const { rx, consult } = prescription;

    onLoadPrescription({
      prescriptionId: rx.id,
      patientName: rx.patient?.name || '',
      doctorName: consult.doctor?.full_name || '',
      items: rx.items || [],
    });

    toast.success(`Loaded prescription ${rx.prescription_no}`);
  };

  const pending = queue.filter((e: any) => e.status !== 'completed');
  const done = queue.filter((e: any) => e.status === 'completed');

  // Alert when new prescriptions arrive
  useEffect(() => {
    const count = pending.length;
    if (prevPendingCount.current !== null && count > prevPendingCount.current) {
      const added = count - prevPendingCount.current;
      toast.success(`${added} new prescription${added > 1 ? 's' : ''} ready for dispensing`, {
        icon: '🔔',
        duration: 6000,
      });
      setNewArrival(true);
      setTimeout(() => setNewArrival(false), 4000);
    }
    prevPendingCount.current = count;
    onPendingCountChange?.(count);
  }, [pending.length, onPendingCountChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            <ClipboardList className="w-4 h-4 text-[#00475a]" />
            Today's Prescriptions
          </h2>
          {pending.length > 0 && (
            <span className={cn(
              'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full',
              newArrival
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-amber-100 text-amber-700',
            )}>
              {newArrival && <Bell className="w-3 h-3" />}
              {pending.length} pending
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Select a patient to load their prescription</p>
      </div>

      {queueLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
          <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No prescriptions today</p>
          <p className="text-xs mt-1">Patients appear here after doctor consultation</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <p className={cn(
                'px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide flex items-center gap-1',
                newArrival ? 'text-amber-600' : 'text-gray-400',
              )}>
                <Clock className="w-3 h-3" /> Awaiting Dispensing
                {newArrival && <span className="ml-1 text-amber-600">● New</span>}
              </p>
              {pending.map((entry: any) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-gray-50',
                    selectedId === entry.id
                      ? 'bg-teal-50 border-l-2 border-l-[#00475a]'
                      : 'hover:bg-gray-50',
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0',
                    selectedId === entry.id ? 'bg-[#00475a] text-white' : 'bg-gray-100 text-gray-600',
                  )}>
                    {entry.token_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.patient?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 truncate">{entry.chief_complaint || 'No complaint'}</p>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-gray-300 flex-shrink-0 transition-transform', selectedId === entry.id && 'rotate-90')} />
                </button>
              ))}
            </div>
          )}

          {/* Expanded prescription detail */}
          {selectedId && (
            <div className="mx-3 my-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {rxLoading ? (
                <div className="p-4 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
                </div>
              ) : !prescription ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  No prescription found for this patient
                </div>
              ) : (
                <>
                  {/* Rx header */}
                  <div className="p-3 bg-teal-50 border-b border-teal-100">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#00475a]">{prescription.rx.prescription_no}</p>
                      <span className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full border',
                        STATUS_LABEL[prescription.rx.status]?.bg,
                        STATUS_LABEL[prescription.rx.status]?.color,
                      )}>
                        {STATUS_LABEL[prescription.rx.status]?.label || prescription.rx.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-teal-700">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{prescription.rx.patient?.name}</span>
                      <span>Dr. {prescription.consult.doctor?.full_name}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                      <Pill className="w-3 h-3" /> {prescription.rx.items?.length || 0} medicines
                    </p>
                    {prescription.rx.items?.map((item: any, i: number) => (
                      <div key={i} className={cn(
                        'flex items-start justify-between text-xs py-1.5 px-2 rounded-lg',
                        item.is_dispensed ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700',
                      )}>
                        <div>
                          <p className="font-medium">{item.medicine_name}</p>
                          <p className="text-gray-400">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          {item.quantity && <span className="text-gray-500">×{item.quantity}</span>}
                          {item.is_dispensed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Load button */}
                  {prescription.rx.status !== 'fully_dispensed' && prescription.rx.status !== 'cancelled' && (
                    <div className="p-3 border-t border-gray-100">
                      <button
                        onClick={handleLoad}
                        className="w-full py-2 bg-[#00475a] text-white text-sm font-medium rounded-lg hover:bg-[#003d4d] transition-colors flex items-center justify-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4" />
                        Load into Cart
                      </button>
                      {prescription.rx.notes && (
                        <p className="text-xs text-gray-400 mt-2 text-center">Note: {prescription.rx.notes}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Done today */}
          {done.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dispensed Today
              </p>
              {done.map((entry: any) => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 opacity-50 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                    {entry.token_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 truncate">{entry.patient?.name}</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
