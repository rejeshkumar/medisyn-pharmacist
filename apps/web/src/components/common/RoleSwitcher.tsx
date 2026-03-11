'use client';

import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { LayoutDashboard, Stethoscope, ConciergeBell, Stethoscope as Nurse, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

const ROLE_PORTALS: Record<string, { label: string; path: string; icon: any; color: string }> = {
  owner:        { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard, color: 'text-[#00475a]' },
  pharmacist:   { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard, color: 'text-[#00475a]' },
  assistant:    { label: 'Dashboard',   path: '/dashboard',   icon: LayoutDashboard, color: 'text-[#00475a]' },
  doctor:       { label: 'Doctor',      path: '/doctor',      icon: Stethoscope,     color: 'text-teal-600' },
  receptionist: { label: 'Receptionist',path: '/receptionist',icon: ConciergeBell,   color: 'text-blue-600' },
  nurse:        { label: 'Nurse',       path: '/nurse',       icon: Nurse,           color: 'text-pink-600' },
};

export default function RoleSwitcher() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { setUser(getUser()); }, []);

  if (!user) return null;

  const roles: string[] = user.roles?.length ? user.roles : [user.role];

  // Deduplicate portals (owner+pharmacist both → dashboard, show once)
  const seen = new Set<string>();
  const portals = roles
    .map(r => ({ role: r, ...ROLE_PORTALS[r] }))
    .filter(p => p?.path && !seen.has(p.path) && seen.add(p.path));

  // Only show switcher if user has access to more than one distinct portal
  if (portals.length <= 1) return null;

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const current = portals.find(p => currentPath.startsWith(p.path)) || portals[0];

  return (
    <div className="relative px-3 mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors text-sm"
      >
        {current && <current.icon className={`w-4 h-4 flex-shrink-0 ${current.color}`} />}
        <span className="flex-1 text-left font-medium text-slate-700">{current?.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-slate-100 shadow-lg z-20 overflow-hidden">
            <p className="text-xs text-slate-400 px-3 pt-2 pb-1 font-medium uppercase tracking-wide">Switch Portal</p>
            {portals.map(p => {
              const Icon = p.icon;
              const isActive = currentPath.startsWith(p.path);
              return (
                <button
                  key={p.path}
                  onClick={() => { setOpen(false); router.push(p.path); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors ${isActive ? 'bg-slate-50 font-semibold' : ''}`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${p.color}`} />
                  <span className="text-slate-700">{p.label}</span>
                  {isActive && <span className="ml-auto text-xs text-slate-400">Current</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
