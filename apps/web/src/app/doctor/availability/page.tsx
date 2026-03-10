'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import AvailabilityManager from '@/components/availability/AvailabilityManager';

export default function DoctorAvailabilityPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => { setUser(getUser()); }, []);

  if (!user) return null;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-1">My Availability</h1>
      <p className="text-sm text-slate-400 mb-6">Set your weekly schedule and leave days</p>
      <AvailabilityManager doctorId={user.sub || user.id} doctorName={user.name || user.full_name || 'Doctor'} canEdit={true} />
    </div>
  );
}
