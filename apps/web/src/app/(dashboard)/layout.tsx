'use client';
import NotificationBell from '@/components/hr/NotificationBell';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import OfflineBar from '@/components/common/OfflineBar';
import Image from 'next/image';
import { getUser, clearAuth } from '@/lib/auth';
import {
  CalendarPlus, LayoutDashboard, Pill, ShoppingCart, Package, FileText,
  BarChart3, Users, DollarSign, Upload, Shield, LogOut, ChevronRight,
  Menu, X, HeartPulse, ClipboardList, Settings, Briefcase,
  RefreshCcw, ShoppingBag, Clock, Calendar, Bell,
  Stethoscope, ReceiptText, ArrowLeftRight, ChevronUp, Cpu, Scan,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import RoleSwitcher from '@/components/common/RoleSwitcher';

// ── Pending leave badge ───────────────────────────────────────
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

// ── Role-based tab definitions ────────────────────────────────
const ROLE_TABS: Record<string, Array<{ href: string; label: string; icon: any; badge?: string }>> = {
  pharmacist: [
    { href: '/dashboard',          label: 'Home',        icon: LayoutDashboard },
    { href: '/dispensing',         label: 'Dispense',    icon: ShoppingCart },
    { href: '/billing',            label: 'Bills',       icon: ReceiptText  },
    { href: '/stock',              label: 'Stock',       icon: Package      },
  ],
  assistant: [
    { href: '/dispensing',         label: 'Dispense',    icon: ShoppingCart },
    { href: '/billing',            label: 'Bills',       icon: ReceiptText  },
    { href: '/stock',              label: 'Stock',       icon: Package      },
    { href: '/attendance',         label: 'Attendance',  icon: Clock        },
  ],
};

// ── Owner sidebar — grouped sections ─────────────────────────
// section: null = no header (top-level items)
const OWNER_NAV_SECTIONS = [
  {
    section: null,
    items: [
      { href: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
      { href: '/patients',     label: 'Patients',       icon: HeartPulse      },
      { href: '/receptionist/book-appointment', label: 'Book Appointment', icon: CalendarPlus },
      { href: '/receptionist/book-appointment', label: 'Book Appointment', icon: CalendarPlus },
      { href: '/dispensing',   label: 'Dispense',       icon: ShoppingCart    },
      { href: '/billing',      label: 'Bills',          icon: FileText        },
      { href: '/ai-care',      label: 'AI Care Engine', icon: Cpu             },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { href: '/medicines',         label: 'Medicines',    icon: Pill        },
      { href: '/stock',             label: 'Stock',        icon: Package     },
      { href: '/stock-adjustments', label: 'Adjustments',  icon: RefreshCcw  },
      { href: '/procurement',       label: 'Procurement',  icon: ShoppingBag },
    ],
  },
  {
    section: 'Reports & Compliance',
    items: [
      { href: '/compliance',         label: 'Compliance',    icon: Shield      },
      { href: '/reports',            label: 'Reports',       icon: BarChart3   },
      { href: '/financial', label: 'Financial', icon: DollarSign },
      { href: '/day-close', label: 'End of Day', icon: DollarSign },
      { href: '/analytics',          label: 'Behaviour',     icon: Users         },
    ],
  },
  {
    section: 'Administration',
    items: [
      { href: '/users',           label: 'Users',           icon: Users        },
      { href: '/bulk',            label: 'Bulk Upload',     icon: Upload       },
      { href: '/barcode-mapping', label: 'Barcode Mapping', icon: Scan         },
      { href: '/audit',           label: 'Audit Log',       icon: ClipboardList},
      { href: '/settings',        label: 'Settings',        icon: Settings     },
    ],
  },
  {
    section: 'HR',
    items: [
      { href: '/attendance',  label: 'Attendance',      icon: Clock     },
      { href: '/hr/roster',   label: 'Roster',          icon: Briefcase },
      { href: '/hr/leaves',   label: 'Leave & Payroll', icon: Briefcase },
    ],
  },
];

// Flat list for any code that iterates OWNER_NAV directly
const OWNER_NAV = OWNER_NAV_SECTIONS.flatMap(s => s.items);

// ── More menu items for pharmacist (overflow) ─────────────────
const PHARMACIST_MORE = [
  { href: '/procurement',      label: 'Reorder',        icon: ShoppingBag },
  { href: '/medicines',        label: 'Medicines',      icon: Pill        },
  { href: '/stock-adjustments',label: 'Adjustments',   icon: RefreshCcw  },
  { href: '/compliance',       label: 'Schedule Log',   icon: Shield      },
  { href: '/attendance',       label: 'Attendance',     icon: Clock       },
  { href: '/my-leave',         label: 'My Leave',       icon: Calendar    },
];

// ── Bottom tab bar layout (pharmacist/assistant) ──────────────
function BottomTabLayout({
  user, children, tabs, moreTabs, pathname,
}: {
  user: any; children: React.ReactNode;
  tabs: typeof ROLE_TABS['pharmacist'];
  moreTabs: typeof PHARMACIST_MORE;
  pathname: string;
}) {
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out');
    router.push('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ── Top header ── */}
      <header className="flex-shrink-0 h-14 bg-[#00475a] flex items-center px-4 gap-3 z-20">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
              <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">MediSyn</span>
        </div>

        <span className="text-white/60 text-xs capitalize hidden sm:block">{user?.role}</span>
        <div className="flex-1" />
        <NotificationBell role={user?.role} />

        <button onClick={handleLogout}
          className="w-8 h-8 bg-white/10 hover:bg-red-500/80 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
          title="Sign out">
          <LogOut className="w-4 h-4 text-white" />
        </button>

        <button
          onClick={() => setShowMore(v => !v)}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-xl px-3 py-1.5 transition-colors"
        >
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-white text-xs font-medium hidden sm:block truncate max-w-24">
            {user?.full_name?.split(' ')[0] || 'User'}
          </span>
          <ChevronUp className={`w-3 h-3 text-white/60 transition-transform ${showMore ? '' : 'rotate-180'}`} />
        </button>
      </header>

      {/* ── More menu overlay ── */}
      {showMore && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowMore(false)} />
          <div className="fixed top-14 right-0 left-0 z-40 bg-white border-b border-slate-200 shadow-lg">
            <div className="max-w-lg mx-auto">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center text-[#00475a] font-bold text-sm">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
                </div>
                <button onClick={handleLogout}
                  className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50">
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>

              <div className="grid grid-cols-4 gap-0 py-2">
                {moreTabs.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setShowMore(false)}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 hover:bg-slate-50 ${active ? 'text-[#00475a]' : 'text-slate-500'}`}>
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium text-center">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main content ── */}
      <OfflineBar />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-16">
        {children}
      </main>

      {/* ── Bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 flex h-16">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link key={tab.href} href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-[#00475a]' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setShowMore(v => !v)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
            showMore ? 'text-[#00475a]' : 'text-slate-400 hover:text-slate-600'
          }`}>
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>
    </div>
  );
}

// ── Owner sidebar layout (labelled, grouped) ───────────────────
function SidebarLayout({
  user, children, pathname,
}: {
  user: any; children: React.ReactNode; pathname: string;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out');
    router.push('/login');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-100 z-30 transform transition-transform duration-200 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:z-auto',
      )}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00475a] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
              <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[#00475a] text-sm leading-tight">MediSyn</h1>
            <p className="text-[10px] text-gray-400">Admin portal</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-gray-600"
            onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav — grouped sections */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-thin">
          {OWNER_NAV_SECTIONS.map((section, si) => (
            <div key={si} className={si > 0 ? 'mt-1' : ''}>
              {/* Section label */}
              {section.section && (
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1">
                  {section.section}
                </p>
              )}
              {/* Section items */}
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-[#00475a] text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.href === '/hr/leaves' && <PendingLeaveBadge />}
                      {active && <ChevronRight className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Divider before role switcher */}
          <div className="pt-2 mt-1 border-t border-gray-100">
            <RoleSwitcher />
          </div>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center text-[#00475a] font-bold text-xs flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
            </div>
            <NotificationBell role={user?.role} />
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="bg-[#00475a] border-b border-[#003d4d] px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-white/80 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="white">
                <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
                <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
              </svg>
            </div>
            <span className="font-bold text-white text-sm">MediSyn</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell role={user?.role} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Root layout — routes to correct layout by role ────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push('/login'); return; }
    setUser(u);
  }, []);

  if (!user) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 bg-[#00475a] rounded-xl flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
            <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
          </svg>
        </div>
        <div className="w-4 h-4 border-2 border-[#00475a] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  // Pharmacist / assistant → bottom tab layout
  if (['pharmacist', 'assistant'].includes(user.role)) {
    const tabs = ROLE_TABS[user.role] || ROLE_TABS.pharmacist;
    return (
      <BottomTabLayout
        user={user}
        tabs={tabs}
        moreTabs={PHARMACIST_MORE}
        pathname={pathname}
      >
        {children}
      </BottomTabLayout>
    );
  }

  // Owner / admin → labelled sidebar layout
  return (
    <SidebarLayout user={user} pathname={pathname}>
      {children}
    </SidebarLayout>
  );
}
