'use client';

// Place at: apps/web/src/app/(dashboard)/analytics/page.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  BarChart3, Users, Zap, AlertTriangle, Smartphone,
  Monitor, TrendingUp, Clock, Search, Loader2,
  Lightbulb, RefreshCw,
} from 'lucide-react';

const DAYS_OPTIONS = [
  { label: 'Today',    value: 1 },
  { label: '7 days',   value: 7 },
  { label: '30 days',  value: 30 },
];

const PAGE_LABELS: Record<string, string> = {
  '/dispensing':      'Dispensing',
  '/patients':        'Patients',
  '/dashboard':       'Dashboard',
  '/medicines':       'Medicines',
  '/stock':           'Stock',
  '/billing':         'Bills',
  '/reports':         'Reports',
  '/compliance':      'Compliance',
  '/procurement':     'Procurement',
  '/ai-care':         'AI Care',
  '/hr/roster':       'Roster',
  '/attendance':      'Attendance',
  '/barcode-mapping': 'Barcode Mapping',
  '/bulk':            'Bulk Upload',
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics-summary', days],
    queryFn: () => api.get(`/analytics/summary?days=${days}`).then(r => r.data),
  });

  const fetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await api.get('/analytics/insights');
      setInsights(res.data?.insights || []);
    } catch {
      setInsights([]);
    } finally {
      setLoadingInsights(false);
    }
  };

  const totalEvents = data?.daily_activity?.reduce((s: number, d: any) => s + d.events, 0) || 0;
  const totalUsers  = Math.max(...(data?.daily_activity?.map((d: any) => d.active_users) || [0]));
  const desktopPct  = data?.device_split?.find((d: any) => d.device_type === 'desktop')?.count || 0;
  const mobilePct   = data?.device_split?.find((d: any) => d.device_type === 'mobile')?.count || 0;
  const totalDevices = desktopPct + mobilePct || 1;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00475a]" />
            User Behaviour
          </h1>
          <p className="text-sm text-gray-500">How your team uses MediSyn</p>
        </div>
        <div className="flex items-center gap-2">
          {DAYS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                days === opt.value
                  ? 'bg-[#00475a] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {opt.label}
            </button>
          ))}
          <button onClick={() => refetch()} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#00475a]" />
        </div>
      ) : !data || totalEvents === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No activity data yet</p>
          <p className="text-xs mt-1">Events will appear here as staff use MediSyn</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Actions', value: totalEvents.toLocaleString(), icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Users', value: totalUsers, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Desktop Usage', value: `${Math.round((desktopPct/totalDevices)*100)}%`, icon: Monitor, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Mobile Usage', value: `${Math.round((mobilePct/totalDevices)*100)}%`, icon: Smartphone, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="card flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{card.value}</p>
                    <p className="text-xs text-gray-500">{card.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top actions */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#00475a]" /> Top Actions
              </h2>
              <div className="space-y-2">
                {(data?.top_events || []).map((e: any, i: number) => {
                  const maxCount = data.top_events[0]?.count || 1;
                  const pct = Math.round((e.count / maxCount) * 100);
                  return (
                    <div key={e.event_name} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {e.event_name.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{e.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00475a] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {e.avg_ms > 0 && (
                        <span className={`text-[10px] flex-shrink-0 ${e.avg_ms > 2000 ? 'text-red-500' : 'text-gray-400'}`}>
                          {e.avg_ms > 1000 ? `${(e.avg_ms/1000).toFixed(1)}s` : `${e.avg_ms}ms`}
                        </span>
                      )}
                    </div>
                  );
                })}
                {(!data?.top_events?.length) && <p className="text-sm text-gray-400 text-center py-4">No actions tracked yet</p>}
              </div>
            </div>

            {/* Top pages */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#00475a]" /> Most Visited Pages
              </h2>
              <div className="space-y-2">
                {(data?.top_pages || []).map((p: any, i: number) => {
                  const maxViews = data.top_pages[0]?.views || 1;
                  const pct = Math.round((p.views / maxViews) * 100);
                  const label = PAGE_LABELS[p.page] || p.page;
                  return (
                    <div key={p.page} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-4 text-right">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-gray-700">{label}</span>
                          <span className="text-xs text-gray-400">{p.views} views · {p.unique_users} users</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!data?.top_pages?.length) && <p className="text-sm text-gray-400 text-center py-4">No page views tracked yet</p>}
              </div>
            </div>

            {/* Daily activity */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00475a]" /> Daily Activity
              </h2>
              <div className="space-y-2">
                {(data?.daily_activity || []).map((d: any) => {
                  const maxEvents = Math.max(...(data.daily_activity.map((x: any) => x.events))) || 1;
                  const pct = Math.round((d.events / maxEvents) * 100);
                  const date = new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{date}</span>
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00475a]/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0 w-16 text-right">
                        {d.events} actions · {d.active_users} users
                      </span>
                    </div>
                  );
                })}
                {(!data?.daily_activity?.length) && <p className="text-sm text-gray-400 text-center py-4">No activity data yet</p>}
              </div>
            </div>

            {/* Slow actions + errors */}
            <div className="space-y-4">
              {data?.slow_actions?.length > 0 && (
                <div className="card border-amber-100">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" /> Slow Actions
                  </h2>
                  <div className="space-y-2">
                    {data.slow_actions.map((a: any) => (
                      <div key={a.event_name} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{a.event_name.replace(/_/g, ' ')}</span>
                        <span className="text-amber-600 font-medium">avg {(a.avg_ms/1000).toFixed(1)}s</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data?.errors?.length > 0 && (
                <div className="card border-red-100">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Errors
                  </h2>
                  <div className="space-y-2">
                    {data.errors.map((e: any) => (
                      <div key={e.event_name} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{e.event_name.replace(/_/g, ' ')}</span>
                        <span className="text-red-600 font-medium">{e.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search stats */}
              {data?.search_stats?.total_searches > 0 && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#00475a]" /> Medicine Search
                  </h2>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total searches</span>
                      <span className="font-medium">{data.search_stats.total_searches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Found</span>
                      <span className="font-medium text-green-600">{data.search_stats.found}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Not found</span>
                      <span className="font-medium text-red-600">{data.search_stats.not_found}</span>
                    </div>
                    {data.search_stats.most_searched && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Most searched</span>
                        <span className="font-medium">{data.search_stats.most_searched}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                AI Insights
              </h2>
              <button onClick={fetchInsights} disabled={loadingInsights}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#00475a] text-white rounded-lg text-xs font-medium hover:bg-[#003d4d] disabled:opacity-50">
                {loadingInsights ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
                {loadingInsights ? 'Analysing...' : 'Generate insights'}
              </button>
            </div>
            {insights.length > 0 ? (
              <div className="space-y-3">
                {insights.map((insight: any, i: number) => (
                  <div key={i} className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-sm font-semibold text-amber-900 mb-1">{insight.title}</p>
                    <p className="text-sm text-amber-800 mb-2">{insight.detail}</p>
                    {insight.action && (
                      <p className="text-xs text-amber-700 font-medium">
                        → {insight.action}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                Click "Generate insights" to get AI analysis of your team's behaviour
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
