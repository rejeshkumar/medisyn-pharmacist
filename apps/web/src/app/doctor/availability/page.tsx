'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import AvailabilityManager from '@/components/availability/AvailabilityManager';
import { Clock } from 'lucide-react';

export default function DoctorAvailabilityPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => { setUser(getUser()); }, []);

  if (!user) return null;

  const doctorId = user.sub || user.id;
  const doctorName = user.name || user.full_name || 'Doctor';

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
          <Clock className="w-5 h-5 text-[#00475a]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Availability</h1>
          <p className="text-sm text-slate-400">Set your weekly schedule and leave days</p>
        </div>
      </div>

      <div className="mt-6">
        <AvailabilityManager
          doctorId={doctorId}
          doctorName={doctorName}
          canEdit={true}
        />
      </div>
    </div>
  );
}
