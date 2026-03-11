'use client';

import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { LayoutDashboard, Stethoscope, ConciergeBell, Stethoscope as Nurse, ArrowLeftRight } from 'lucide-react';
import { useState, useEffect } from 'react';

const ROLE_PORTALS: Record<string, { label: string; path: string; icon: any; color: string; bg: string }> = {
  owner:        { label: 'Pharmacy',     path: '/dashboard',    icon: LayoutDashboard, color: 'text-[#00475a]',  bg: 'bg-teal-50' },
  pharmacist:   { label: 'Pharmacy',     path: '/dashboard',    icon: LayoutDashboard, color: 'text-[#00475a]',  bg: 'bg-teal-50' },
  assistant:    { label: 'Pharmacy',     path: '/dashboard',    icon: LayoutDashboard, color: 'text-[#00475a]',  bg: 'bg-teal-50' },
  doctor:       { label: 'Doctor',       path: '/doctor',       icon: Stethoscope,     color: 'text-teal-600',   bg: 'bg-teal-50' },
  receptionist: { label: 'Receptionist', path: '/receptionist', icon: ConciergeBell,   color: 'text-blue-600',   bg: 'bg-blue-50' },
  nurse:        { label: 'Nurse',        path: '/nurse',        icon: Nurse,           color: 'text-pink-600',   bg: 'bg-pink-50' },
};

export default function RoleSwitcher() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);

  // Re-read from localStorage on every mount so it reflects latest login
  useEffect(() => { setUser(getUser()); }, []);

  if (!user) return null;

  const roles: string[] = user.roles?.length ? user.roles : [user.role];

  // Deduplicate portals (owner + pharmacist + assistant → same /dashboard)
  const seen = new Set<string>();
  const portals = roles
    .map(r => ({ role: r, ...ROLE_PORTALS[r] }))
    .filter(p => p?.path && !seen.has(p.path) && seen.add(p.path));

  if (portals.length <= 1) return null;

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const current = portals.find(p => currentPath.startsWith(p.path)) || portals[0];

  return (
    <div className="relative px-3 mt-3 mb-1">
      {/* Trigger button — clearly labelled as a switcher */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all text-sm group"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs text-slate-400 leading-none mb-0.5">Switch Role</p>
          <p className="text-sm font-semibold text-slate-700 leading-none truncate">{current?.label}</p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-slate-100 shadow-xl z-20 overflow-hidden">
            <p className="text-xs text-slate-400 px-3 pt-3 pb-1.5 font-semibold uppercase tracking-wider">
              Switch to
            </p>
            {portals.map(p => {
              const Icon = p.icon;
              const isActive = currentPath.startsWith(p.path);
              return (
                <button
                  key={p.path}
                  onClick={() => { setOpen(false); fetch('http://127.0.0.1:7877/ingest/e4777394-aee8-41e2-8183-900979d7c179',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e68e7d'},body:JSON.stringify({sessionId:'e68e7d',location:'RoleSwitcher.tsx:click',message:'portal switch clicked',data:{target_path:p.path,target_label:p.label,user_role:user?.role,user_roles:user?.roles},timestamp:Date.now()})}).catch(()=>{}); router.push(p.path); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    isActive ? 'bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${p.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                  </div>
                  <span className={`flex-1 text-left ${isActive ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                    {p.label}
                  </span>
                  {isActive && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
            <div className="h-1" />
          </div>
        </>
      )}
    </div>
  );
}
