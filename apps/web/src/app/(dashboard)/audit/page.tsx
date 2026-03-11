'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getToken, getUser } from '@/lib/auth';
import { Shield, Filter, Settings, ChevronDown, ChevronUp, Loader2, Lock, ToggleLeft, ToggleRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Action metadata ────────────────────────────────────────────────────
const ALL_ACTIONS = [
  // Mandatory
  { value: 'CREATE',         label: 'User Created',              category: 'Permissions & Users', mandatory: true },
  { value: 'UPDATE',         label: 'Permissions Changed',       category: 'Permissions & Users', mandatory: true },
  { value: 'DEACTIVATE',     label: 'User Deactivated',          category: 'Permissions & Users', mandatory: true },
  { value: 'ACTIVATE',       label: 'User Activated',            category: 'Permissions & Users', mandatory: true },
  { value: 'PASSWORD_RESET', label: 'Password Reset',            category: 'Permissions & Users', mandatory: true },
  { value: 'DISPENSE',       label: 'Medicine Dispensed',        category: 'Stock & Dispensing',  mandatory: true },
  { value: 'STOCK_IN',       label: 'Stock Received',            category: 'Stock & Dispensing',  mandatory: true },
  { value: 'STOCK_ADJUST',   label: 'Stock Adjusted',            category: 'Stock & Dispensing',  mandatory: true },
  { value: 'VOID',           label: 'Bill Voided',               category: 'Stock & Dispensing',  mandatory: true },
  { value: 'EXPORT',         label: 'Data Exported',             category: 'System',              mandatory: true },
  // Configurable
  { value: 'LOGIN',               label: 'Login',                    category: 'System',   mandatory: false, configKey: 'log_login_events' },
  { value: 'LOGOUT',              label: 'Logout',                   category: 'System',   mandatory: false, configKey: 'log_login_events' },
  { value: 'BULK_IMPORT',         label: 'Bulk Import',              category: 'System',   mandatory: false, configKey: 'log_bulk_imports' },
  { value: 'QUEUE_CREATE',        label: 'Queue Booking',            category: 'Clinical', mandatory: false, configKey: 'log_queue_booking' },
  { value: 'CONSULTATION_CREATE', label: 'Consultation',             category: 'Clinical', mandatory: false, configKey: 'log_consultation' },
  { value: 'PATIENT_CREATE',      label: 'Patient Created',          category: 'Clinical', mandatory: false, configKey: 'log_patient_changes' },
  { value: 'PATIENT_UPDATE',      label: 'Patient Updated',          category: 'Clinical', mandatory: false, configKey: 'log_patient_changes' },
  { value: 'VIEW_SCHEDULE',       label: 'Report Viewed',            category: 'System',   mandatory: false, configKey: 'log_report_views' },
  { value: 'AVAILABILITY_CHANGE', label: 'Availability Changed',     category: 'Clinical', mandatory: false, configKey: 'log_availability_changes' },
];

const CONFIGURABLE_SETTINGS = [
  { key: 'log_login_events',        label: 'Login / Logout events',       description: 'Track when users log in and out' },
  { key: 'log_bulk_imports',        label: 'Bulk imports',                description: 'Track medicine and stock bulk uploads' },
  { key: 'log_queue_booking',       label: 'Queue bookings',              description: 'Track appointment and queue creation' },
  { key: 'log_consultation',        label: 'Consultation notes',          description: 'Track when consultation records are created' },
  { key: 'log_patient_changes',     label: 'Patient created / updated',   description: 'Track patient record creation and edits' },
  { key: 'log_report_views',        label: 'Report views',                description: 'Track when reports are accessed' },
  { key: 'log_availability_changes',label: 'Doctor availability changes', description: 'Track schedule and leave modifications' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DEACTIVATE: 'bg-red-100 text-red-700',
  ACTIVATE: 'bg-green-100 text-green-700',
  PASSWORD_RESET: 'bg-purple-100 text-purple-700',
  DISPENSE: 'bg-teal-100 text-teal-700',
  STOCK_IN: 'bg-cyan-100 text-cyan-700',
  STOCK_ADJUST: 'bg-amber-100 text-amber-700',
  VOID: 'bg-red-100 text-red-700',
  EXPORT: 'bg-slate-100 text-slate-700',
  LOGIN: 'bg-slate-100 text-slate-600',
  LOGOUT: 'bg-slate-100 text-slate-600',
  BULK_IMPORT: 'bg-indigo-100 text-indigo-700',
  QUEUE_CREATE: 'bg-blue-100 text-blue-700',
  CONSULTATION_CREATE: 'bg-purple-100 text-purple-700',
  PATIENT_CREATE: 'bg-teal-100 text-teal-700',
  PATIENT_UPDATE: 'bg-teal-100 text-teal-700',
  VIEW_SCHEDULE: 'bg-slate-100 text-slate-600',
  AVAILABILITY_CHANGE: 'bg-amber-100 text-amber-700',
};

const CATEGORIES = ['All', 'Permissions & Users', 'Stock & Dispensing', 'Clinical', 'System'];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const user = getUser();
  const roles: string[] = user?.roles?.length ? user.roles : [user?.role];
  const canEditSettings = roles.some((r: string) => ['owner', 'admin'].includes(r));

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (filterAction) params.action = filterAction;
      if (filterFrom)   params.from   = filterFrom;
      if (filterTo)     params.to     = filterTo + 'T23:59:59';
      const r = await axios.get(`${API}/audit/logs`, { headers: headers(), params });
      setLogs(r.data.data || []);
      setTotal(r.data.total || 0);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [page, filterAction, filterFrom, filterTo]);

  const loadConfig = async () => {
    try {
      const r = await axios.get(`${API}/audit/config`, { headers: headers() });
      setConfig(r.data);
    } catch {}
  };

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadConfig(); }, []);

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.patch(`${API}/audit/config`, config, { headers: headers() });
      setShowSettings(false);
    } catch {}
    finally { setSavingConfig(false); }
  };

  // Filter actions by selected category
  const categoryActions = ALL_ACTIONS.filter(a =>
    filterCategory === 'All' || a.category === filterCategory
  );

  const getActionLabel = (action: string) =>
    ALL_ACTIONS.find(a => a.value === action)?.label || action;

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00475a]" />Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">{total.toLocaleString()} events recorded</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadLogs} className="flex items-center gap-2 text-sm text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
          {canEditSettings && (
            <button onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-colors ${showSettings ? 'bg-[#00475a] text-white border-[#00475a]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Settings className="w-4 h-4" />Audit Settings
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && config && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 mb-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Settings className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Audit Settings</h2>
              <p className="text-xs text-slate-400 mt-0.5">Configure which events are tracked. Mandatory regulatory events cannot be disabled.</p>
            </div>
          </div>

          {/* Mandatory events — read only */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mandatory (Regulatory — Always On)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ACTIONS.filter(a => a.mandatory).map(a => (
                <div key={a.value} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="w-4 h-4 rounded bg-[#00475a] flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span className="text-xs text-slate-600">{a.label}</span>
                  <Lock className="w-3 h-3 text-slate-300 ml-auto" />
                </div>
              ))}
            </div>
          </div>

          {/* Configurable events */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Configurable Events</span>
            </div>
            <div className="space-y-2">
              {CONFIGURABLE_SETTINGS.map(s => (
                <div key={s.key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.label}</p>
                    <p className="text-xs text-slate-400">{s.description}</p>
                  </div>
                  <button onClick={() => setConfig((c: any) => ({ ...c, [s.key]: !c[s.key] }))}
                    className="ml-4 flex-shrink-0 transition-colors">
                    {config[s.key]
                      ? <ToggleRight className="w-8 h-8 text-[#00475a]" />
                      : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button onClick={() => setShowSettings(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={saveConfig} disabled={savingConfig}
              className="flex-1 py-2 bg-[#00475a] text-white rounded-lg text-sm font-semibold hover:bg-[#00475a]/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <Filter className="w-3.5 h-3.5" />Filters
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Category filter */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Category</label>
            <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterAction(''); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Event type filter */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Event Type</label>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]">
              <option value="">All Events</option>
              {categoryActions.map(a => (
                <option key={a.value} value={a.value}>{a.label}{a.mandatory ? ' 🔒' : ''}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">From</label>
            <input type="date" value={filterFrom} max={today} onChange={e => { setFilterFrom(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
          </div>

          {/* Date to */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">To</label>
            <input type="date" value={filterTo} max={today} onChange={e => { setFilterTo(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00475a]/20 focus:border-[#00475a]" />
          </div>
        </div>

        {(filterAction || filterFrom || filterTo || filterCategory !== 'All') && (
          <button onClick={() => { setFilterAction(''); setFilterFrom(''); setFilterTo(''); setFilterCategory('All'); setPage(1); }}
            className="mt-2 text-xs text-[#00475a] hover:underline">Clear filters</button>
        )}
      </div>

      {/* Log list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Loading audit logs...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No audit events found for the selected filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Mandatory-only notice */}
          {filterAction && ALL_ACTIONS.find(a => a.value === filterAction)?.mandatory && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
              <Lock className="w-3.5 h-3.5" />This is a mandatory regulatory event — always captured regardless of audit settings
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {logs.map(log => {
              const isExpanded = expandedId === log.id;
              const hasDetails = log.old_value || log.new_value;
              return (
                <div key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <div className="px-5 py-3.5 flex items-center gap-4">
                    {/* Action badge */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                      {getActionLabel(log.action)}
                    </span>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{log.entity_ref || log.entity}</p>
                      <p className="text-xs text-slate-400">
                        {log.user_name} · <span className="capitalize">{log.user_role}</span>
                      </p>
                    </div>

                    {/* Time */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-500">{format(new Date(log.created_at), 'dd MMM yyyy')}</p>
                      <p className="text-xs text-slate-400">{format(new Date(log.created_at), 'hh:mm a')}</p>
                    </div>

                    {/* Expand */}
                    {hasDetails && (
                      <button onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>

                  {/* Expanded detail — before/after */}
                  {isExpanded && hasDetails && (
                    <div className="px-5 pb-4 grid grid-cols-2 gap-4">
                      {log.old_value && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Before</p>
                          <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-3 overflow-auto max-h-40 text-red-800">
                            {JSON.stringify(log.old_value, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.new_value && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">After</p>
                          <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-3 overflow-auto max-h-40 text-green-800">
                            {JSON.stringify(log.new_value, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 50 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">Showing {((page-1)*50)+1}–{Math.min(page*50, total)} of {total.toLocaleString()}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Previous</button>
                <button onClick={() => setPage(p => p+1)} disabled={page * 50 >= total}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
