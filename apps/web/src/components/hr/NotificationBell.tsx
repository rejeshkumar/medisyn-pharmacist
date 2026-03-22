'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Bell, CheckCheck, X, Calendar, CheckCircle2, XCircle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  leave_request:  { icon: Calendar,      color: 'text-amber-600',  bg: 'bg-amber-50'  },
  leave_approved: { icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50'  },
  leave_rejected: { icon: XCircle,       color: 'text-red-600',    bg: 'bg-red-50'    },
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ role }: { role: string }) {
  const router = useRouter();
  const [count, setCount]   = useState(0);
  const [open, setOpen]     = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count every 30 seconds
  useEffect(() => {
    const load = () => {
      api.get('/hr/notifications/unread-count')
        .then(r => setCount(r.data?.count ?? 0))
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openPanel = async () => {
    setOpen(v => !v);
    if (!open) {
      setLoading(true);
      try {
        const r = await api.get('/hr/notifications?limit=15');
        setNotifs(r.data || []);
      } catch {}
      finally { setLoading(false); }
    }
  };

  const markAllRead = async () => {
    await api.patch('/hr/notifications/read-all', {}).catch(() => {});
    setCount(0);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotifClick = async (n: any) => {
    if (!n.is_read) {
      await api.patch(`/hr/notifications/${n.id}/read`, {}).catch(() => {});
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      setCount(c => Math.max(0, c - 1));
    }
    setOpen(false);
    // Navigate to relevant page
    if (n.type === 'leave_request') {
      router.push('/hr/leaves');
    } else {
      router.push('/attendance');
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={openPanel}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#00475a]" />
              <span className="font-semibold text-slate-900 text-sm">Notifications</span>
              {count > 0 && (
                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
                  {count} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-[#00475a] hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading...</div>
            ) : notifs.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">No notifications yet</p>
              </div>
            ) : (
              notifs.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.leave_request;
                const Icon = cfg.icon;
                return (
                  <button key={n.id} onClick={() => handleNotifClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 border-b border-slate-50 last:border-0 text-left hover:bg-slate-50 transition-colors ${
                      !n.is_read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs font-semibold text-slate-800 leading-tight ${!n.is_read ? 'font-bold' : ''}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
            <button
              onClick={() => { setOpen(false); router.push(role === 'owner' ? '/hr/leaves' : '/attendance'); }}
              className="text-xs text-[#00475a] font-medium hover:underline w-full text-center"
            >
              {role === 'owner' ? 'View all leave requests →' : 'View my leave history →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
