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
  Stethoscope, ReceiptText, ArrowLeftRight, ChevronUp, Cpu, Scan, ClipboardCheck, BookOpen
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
      { href: '/returns',           label: 'Returns',      icon: RefreshCcw       },
      { href: '/procurement',       label: 'Procurement',  icon: ShoppingBag },
      { href: '/inventory/intelligence', label: 'Intelligence', icon: Cpu },
    ],
  },
  {
    section: 'Reports & Compliance',
    items: [
      { href: '/compliance',                    label: 'Compliance',          icon: Shield      },
      { href: '/reports',                       label: 'Reports Hub',         icon: BarChart3   },
      { href: '/reports/gst-summary',           label: 'GST Summary',         icon: FileText    },
      { href: '/reports/schedule-h-register',   label: 'Schedule H Register', icon: ClipboardCheck },
      { href: '/reports/ar-aging',              label: 'AR Aging',            icon: Clock       },
      { href: '/reports/profit-loss',           label: 'Profit & Loss',       icon: BarChart3   },
      { href: '/reports/stock-ledger',          label: 'Stock Ledger',        icon: BookOpen    },
      { href: '/financial',                     label: 'Financial',           icon: DollarSign  },
      { href: '/day-close',                     label: 'End of Day',          icon: DollarSign  },
      { href: '/analytics',                     label: 'Behaviour',           icon: Users       },
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
  { href: '/returns',          label: 'Returns',        icon: RefreshCcw       },
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

  const isActive = (href: string) => {
    // Sub-route parents — use startsWith
    const subRouteParents = ['/settings', '/hr', '/reports', '/patients', '/inventory'];
    if (subRouteParents.some(p => href === p)) return pathname === href;
    if (subRouteParents.some(p => href.startsWith(p + '/') || href === p)) {
      return pathname === href || pathname.startsWith(href + '/');
    }
    return pathname === href;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* ── Top header ── */}
      <header className="flex-shrink-0 h-14 bg-[#00b8a0] flex items-center px-4 gap-3 z-20">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
              <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">SimpliRx</span>
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


// ── Breadcrumb config ──────────────────────────────────────────────────────
const BREADCRUMB_MAP: Record<string, { label: string; parent?: string }> = {
  '/dashboard':          { label: 'Dashboard' },
  '/patients':           { label: 'Patients' },
  '/dispensing':         { label: 'Dispense' },
  '/billing':            { label: 'Bills' },
  '/medicines':          { label: 'Medicines',        parent: '/inventory' },
  '/stock':              { label: 'Stock',             parent: '/inventory' },
  '/stock-adjustments':  { label: 'Adjustments',      parent: '/inventory' },
  '/returns':            { label: 'Returns',           parent: '/inventory' },
  '/procurement':        { label: 'Procurement',       parent: '/inventory' },
  '/inventory/intelligence': { label: 'Intelligence', parent: '/inventory' },
  '/reports':            { label: 'Reports Hub',       parent: '/reports' },
  '/reports/gst-summary':         { label: 'GST Summary',         parent: '/reports' },
  '/reports/schedule-h-register': { label: 'Schedule H Register', parent: '/reports' },
  '/reports/ar-aging':            { label: 'AR Aging',            parent: '/reports' },
  '/reports/profit-loss':         { label: 'Profit & Loss',       parent: '/reports' },
  '/reports/stock-ledger':        { label: 'Stock Ledger',        parent: '/reports' },
  '/compliance':         { label: 'Compliance',        parent: '/reports' },
  '/financial':          { label: 'Financial',         parent: '/reports' },
  '/day-close':          { label: 'End of Day',        parent: '/reports' },
  '/analytics':          { label: 'Behaviour',         parent: '/reports' },
  '/users':              { label: 'Users',             parent: '/admin' },
  '/bulk':               { label: 'Bulk Upload',       parent: '/admin' },
  '/barcode-mapping':    { label: 'Barcode Mapping',   parent: '/admin' },
  '/audit':              { label: 'Audit Log',         parent: '/admin' },
  '/settings':           { label: 'Settings',          parent: '/admin' },
  '/attendance':         { label: 'Attendance',        parent: '/hr' },
  '/hr/roster':          { label: 'Roster',            parent: '/hr' },
  '/hr/leaves':          { label: 'Leave & Payroll',   parent: '/hr' },
  '/my-leave':           { label: 'My Leave',          parent: '/hr' },
  '/ai-care':            { label: 'AI Care Engine' },
};

const PARENT_LABELS: Record<string, string> = {
  '/inventory': 'Inventory',
  '/reports':   'Reports',
  '/admin':     'Administration',
  '/hr':        'HR',
};

function LayoutBreadcrumb({ pathname }: { pathname: string }) {
  // Find best matching route (handle dynamic routes like /patients/[id])
  const exactMatch = BREADCRUMB_MAP[pathname];
  const prefixMatch = !exactMatch
    ? Object.keys(BREADCRUMB_MAP)
        .filter(k => pathname.startsWith(k + '/'))
        .sort((a, b) => b.length - a.length)[0]
    : null;
  const route = exactMatch || (prefixMatch ? BREADCRUMB_MAP[prefixMatch] : null);
  if (!route || pathname === '/dashboard') return null;

  const parentKey = route.parent;
  const parentLabel = parentKey ? PARENT_LABELS[parentKey] : null;

  return (
    <div className="flex items-center gap-1.5 px-6 py-2 border-b border-gray-100 bg-gray-50/80 text-xs text-gray-400">
      <Link href="/dashboard" className="hover:text-[#00475a] transition-colors flex items-center gap-1">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Home
      </Link>
      {parentLabel && (
        <>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span>{parentLabel}</span>
        </>
      )}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
      <span className="text-gray-600 font-medium">{route.label}</span>
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
  // Sync browser tab title from pathname
  useEffect(() => {
    const route = BREADCRUMB_MAP[pathname] ||
      Object.entries(BREADCRUMB_MAP)
        .filter(([k]) => pathname.startsWith(k + '/'))
        .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
    if (route) document.title = `${route.label} — SimpliRx`;
    else document.title = 'SimpliRx';
  }, [pathname]);


  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out');
    router.push('/login');
  };

  const isActive = (href: string) => {
    // Sub-route parents — use startsWith
    const subRouteParents = ['/settings', '/hr', '/reports', '/patients', '/inventory'];
    if (subRouteParents.some(p => href === p)) return pathname === href;
    if (subRouteParents.some(p => href.startsWith(p + '/') || href === p)) {
      return pathname === href || pathname.startsWith(href + '/');
    }
    return pathname === href;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar - Material Design (Option 4) */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-56 bg-[#00b8a0] border-r border-white/10 z-30 transform transition-transform duration-200 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0 lg:static lg:z-auto',
      )}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#00475a">
              <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
              <rect x="1" y="6.5" width="14" height="3" rx="1.5"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-white text-sm leading-tight">SimpliRx</h1>
            <p className="text-[11px] text-white/60">Admin portal</p>
          </div>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav — grouped sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
          {OWNER_NAV_SECTIONS.filter(section => {
            const role = user?.role;
            if (role === 'owner' || role === 'office_manager') return true;
            if (role === 'pharmacist') return !['Administration', 'HR'].includes(section.section || '');
            if (role === 'receptionist') return !['Administration', 'HR', 'Reports'].includes(section.section || '');
            if (role === 'doctor' || role === 'nurse') return section.section === null;
            return true;
          }).map((section, si) => {
            const sectionKey = section.section || '__top__';
            const hasSection = !!section.section;
            const anyActive = section.items.some(item => {
              const h = (item as any).roleOverride?.[user?.role] || item.href;
              return pathname === h || pathname.startsWith(h + '/');
            });
            // Top-level (no section header) always visible, never collapsible
            if (!hasSection) {
              return (
                <div key={si} className="space-y-0.5 px-2 mb-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const resolvedHref = (item as any).roleOverride?.[user?.role] || item.href;
                    const active = pathname === resolvedHref;
                    return (
                      <Link key={item.href} href={resolvedHref}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all',
                          active ? 'bg-white/95 text-[#00475a] shadow-sm' : 'text-white hover:bg-white/10',
                        )}>
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            }

            // Collapsible section
            const isExpanded = expandedSections[sectionKey] ?? anyActive;
            return (
              <div key={si} className="mt-1">
                {/* Section header — clickable to collapse */}
                <button
                  onClick={() => setExpandedSections(prev => ({ ...prev, [sectionKey]: !isExpanded }))}
                  className="w-full flex items-center gap-2 px-4 pt-3 pb-2 group hover:bg-white/10 rounded-lg transition-colors"
                >
                  <p className="text-[11px] font-bold text-white uppercase tracking-widest flex-1 text-left transition-colors">
                    {section.section}
                  </p>
                  <ChevronRight className={cn(
                    'w-3.5 h-3.5 text-white transition-all flex-shrink-0',
                    isExpanded ? 'rotate-90' : ''
                  )} />
                </button>

                {/* Section items */}
                {isExpanded && (
                  <div className="space-y-0.5 px-2 mb-1">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const resolvedHref = (item as any).roleOverride?.[user?.role] || item.href;
                      const itemRoles = (item as any).roles as string[] | undefined;
                      const children = (item as any).children as any[] | undefined;

                      // Role filter — hide item if role not in allowed list
                      if (itemRoles && !itemRoles.includes(user?.role)) return null;

                      // Sub-group with label (groupLabel items render as a labeled cluster)
                      if ((item as any).groupLabel && children) {
                        const visible = children.filter((c: any) => !c.roles || c.roles.includes(user?.role));
                        if (visible.length === 0) return null;
                        return (
                          <div key={item.href} className="mt-2 first:mt-0">
                            <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-2 pb-1 pt-1">
                              {item.label}
                            </p>
                            {visible.map((child: any) => {
                              const ChildIcon = child.icon;
                              const childActive = pathname === child.href ||
                                (child.href !== '/reports' && pathname.startsWith(child.href + '/'));
                              return (
                                <Link key={child.href} href={child.href}
                                  onClick={() => setSidebarOpen(false)}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all',
                                    childActive
                                      ? 'bg-white/95 text-[#00475a] shadow-sm'
                                      : 'text-white hover:bg-white/10',
                                  )}>
                                  <ChildIcon className="w-[15px] h-[15px] flex-shrink-0" />
                                  <span className="truncate">{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        );
                      }

                      // Regular flat item
                      const active = pathname === resolvedHref || (resolvedHref !== '/reports' && pathname.startsWith(resolvedHref + '/'));
                      return (
                        <Link key={item.href} href={resolvedHref}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all',
                            active ? 'bg-white/95 text-[#00475a] shadow-sm' : 'text-white hover:bg-white/10',
                          )}>
                          <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {item.href === '/hr/leaves' && <PendingLeaveBadge />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 mt-1 border-t border-white/10">
            <RoleSwitcher />
          </div>
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-[10px] text-white/60 capitalize">{user?.role}</p>
            </div>
            <NotificationBell role={user?.role} />
          </div>
          <button onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/8 rounded-lg transition-all">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="bg-[#00b8a0] border-b border-[#003d4d] px-4 py-3 flex items-center gap-3 lg:hidden">
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
            <span className="font-bold text-white text-sm">SimpliRx</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell role={user?.role} />
          </div>
        </header>

        <LayoutBreadcrumb pathname={pathname} />
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
        <div className="w-10 h-10 bg-[#00b8a0] rounded-xl flex items-center justify-center">
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
// Mon May 25 18:30:39 IST 2026
// Sat Jun  6 19:52:13 IST 2026
