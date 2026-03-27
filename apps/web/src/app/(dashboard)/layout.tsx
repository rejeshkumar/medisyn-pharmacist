'use client';
import NotificationBell from '@/components/hr/NotificationBell';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getUser, clearAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Users,
  Upload,
  Shield,
  LogOut,
  ChevronRight,
  Menu,
  X,
  HeartPulse,
  ClipboardList,
  Settings,
  Briefcase,
  RefreshCcw,
  ShoppingBag,
  Clock,
  Calendar,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import RoleSwitcher from '@/components/common/RoleSwitcher';


// Pending leave count badge
function PendingLeaveBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    import('@/lib/api').then(({ default: api }) => {
      const load = () => api.get('/hr/pending-leave-count')
        .then((r: any) => setCount(r.data?.count ?? 0)).catch(() => {});
      load();
      interval = setInterval(load, 60000);
    });
    return () => clearInterval(interval);
  }, []);
  if (count === 0) return null;
  return (
    <span className="ml-auto min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
      {count}
    </span>
  );
}

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',    icon: LayoutDashboard, roles: ['owner', 'pharmacist', 'assistant'] },
  { href: '/patients',   label: 'Patients',      icon: HeartPulse,      roles: ['owner', 'pharmacist', 'assistant'] },
  { href: '/dispensing', label: 'Dispense',      icon: ShoppingCart,    roles: ['owner', 'pharmacist'] },
  { href: '/medicines',  label: 'Medicines',     icon: Pill,            roles: ['owner', 'pharmacist', 'assistant'] },
  { href: '/stock',      label: 'Stock',         icon: Package,         roles: ['owner','pharmacist','assistant'] },
  { href: '/stock-adjustments', label: 'Adjustments', icon: RefreshCcw,      roles: ['owner','pharmacist'] },
  { href: '/procurement', label: 'Procurement', icon: ShoppingBag, roles: ['owner','pharmacist'] },
  { href: '/billing',    label: 'Bills',         icon: FileText,        roles: ['owner', 'pharmacist'] },
  { href: '/compliance', label: 'Schedule Log',  icon: Shield,          roles: ['owner', 'pharmacist'] },
  { href: '/reports',    label: 'Reports',       icon: BarChart3,       roles: ['owner', 'pharmacist'] },
  { href: '/audit',      label: 'Audit Log',     icon: ClipboardList,   roles: ['owner'] },
  { href: '/bulk',       label: 'Bulk Upload',   icon: Upload,          roles: ['owner'] },
  { href: '/users',      label: 'Users',         icon: Users,           roles: ['owner'] },
  { href: '/attendance',  label: 'Attendance',      icon: Clock,    roles: ['owner','pharmacist','assistant'] },
  { href: '/my-leave',  label: 'My Leave',        icon: Calendar,  roles: ['pharmacist','assistant'] },
  { href: '/hr/roster',  label: 'Roster',         icon: Briefcase, roles: ['owner'] },
  { href: '/hr/leaves',  label: 'Leave & Payroll', icon: Briefcase, roles: ['owner'] },
  { href: '/settings',   label: 'Settings',      icon: Settings,        roles: ['owner'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login');
      return;
    }
    setUser(u);
  }, []);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const visibleNav = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-100 z-30 transform transition-transform duration-200 flex flex-col',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:static lg:z-auto',
        )}
      >
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          <Image
            src="/images/logo.jpg"
            alt="MediSyn"
            width={36}
            height={36}
            className="rounded-lg flex-shrink-0 object-contain"
          />
          <div>
            <h1 className="font-bold text-[#00475a] text-sm leading-tight">MediSyn</h1>
            <p className="text-xs text-gray-400">Pharmacy System</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {user && <NotificationBell role={user.role} />}
            <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 scrollbar-thin">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                )}
              >
                <Icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
                {item.label}
                {item.href === '/hr/leaves' && <PendingLeaveBadge />}
                {active && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            );
          })}
        <RoleSwitcher />
        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo.jpg"
              alt="MediSyn"
              width={24}
              height={24}
              className="rounded object-contain"
            />
            <span className="font-bold text-[#00475a] text-sm">MediSyn</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}
