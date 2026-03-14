'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth } from '@/lib/auth';
import {
  LayoutDashboard, CalendarPlus, Users, ClipboardList,
  LogOut, ChevronRight, Menu, X, ConciergeBell, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import RoleSwitcher from '@/components/common/RoleSwitcher';

const navItems = [
  { href: '/receptionist',                      label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/receptionist/book-appointment',     label: 'Book Appointment', icon: CalendarPlus },
  { href: '/receptionist/billing',              label: 'Billing',          icon: Receipt },
  { href: '/receptionist/queue',                label: 'Queue Monitor',    icon: ClipboardList },
  { href: '/receptionist/patients',             label: 'Patients',         icon: Users },
];

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    if (!['receptionist', 'owner', 'nurse'].includes(u.role)) {
      router.push('/dashboard');
      return;
    }
    setUser(u);
  }, []);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 transform transition-transform duration-200 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:z-auto',
      )}>
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#00475a] flex items-center justify-center flex-shrink-0">
            <ConciergeBell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-[#00475a] text-sm leading-tight">MediSyn</h1>
            <p className="text-xs text-slate-400">Reception</p>
          </div>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/receptionist' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-[#00475a] text-white'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon style={{ width: 18, height: 18 }} className="flex-shrink-0" />
                {item.label}
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        <RoleSwitcher />
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-[#00475a] font-bold text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'R'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-500">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ConciergeBell className="w-5 h-5 text-[#00475a]" />
            <span className="font-bold text-[#00475a] text-sm">Reception</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
