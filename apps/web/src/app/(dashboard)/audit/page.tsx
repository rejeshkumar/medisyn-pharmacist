'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  ClipboardList,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Package,
  ShoppingCart,
  Settings,
  AlertTriangle,
  Download,
  BarChart3,
} from 'lucide-react';

const ACTION_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  DISPENSE:       { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Dispense'        },
  VOID:           { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'Void'            },
  CREATE:         { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Create'          },
  UPDATE:         { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Update'          },
  DELETE:         { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'Delete'          },
  STOCK_IN:       { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   label: 'Stock In'        },
  STOCK_ADJUST:   { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Stock Adjust'    },
  DEACTIVATE:     { bg: 'bg-gray-50',   text: 'text-gray-600',   border: 'border-gray-200',   label: 'Deactivate'      },
  ACTIVATE:       { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Activate'        },
  PASSWORD_RESET: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Password Reset'  },
  EXPORT:         { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Export'          },
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  DISPENSE:     <ShoppingCart className="w-3.5 h-3.5" />,
  VOID:         <AlertTriangle className="w-3.5 h-3.5" />,
  STOCK_IN:     <Package className="w-3.5 h-3.5" />,
  STOCK_ADJUST: <Settings className="w-3.5 h-3.5" />,
  EXPORT:       <Download className="w-3.5 h-3.5" />,
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_STYLES[action] ?? { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', label: action };
  const icon = ACTION_ICONS[action];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
      {icon}
      {style.label}
    </span>
  );
}

export default function AuditPage() {
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [action, setAction]     = useState('');
  const [entity, setEntity]     = useState('');
  const [page, setPage]         = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', from, to, action, entity, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from)   params.set('from', from);
      if (to)     params.set('to', to);
      if (action) params.set('action', action);
      if (entity) params.set('entity', entity);
      params.set('page', String(page));
      params.set('limit', '50');
      return api.get(`/audit/logs?${params}`).then((r) => r.data);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['audit-summary', from, to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      return api.get(`/audit/summary?${params}`).then((r) => r.data);
    },
  });

  const meta = logs?.meta;
  const data = logs?.data ?? [];

  const handleReset = () => {
    setFrom(''); setTo(''); setAction(''); setEntity(''); setPage(1);
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#00475a]" />
            Audit Log
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta ? `${meta.total.toLocaleString()} total events` : 'Full system activity trail'}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn-secondary flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filters
          {(from || to || action || entity) && (
            <span className="w-2 h-2 rounded-full bg-[#00475a]" />
          )}
        </button>
      </div>

      {/* Summary cards */}
      {summary && summary.by_action?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {summary.by_action.slice(0, 6).map((item: any) => {
            const style = ACTION_STYLES[item.action] ?? { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100', label: item.action };
            return (
              <button
                key={item.action}
                onClick={() => { setAction(action === item.action ? '' : item.action); setPage(1); }}
                className={`card p-3 text-left transition-all hover:shadow-md ${action === item.action ? 'ring-2 ring-[#00475a]' : ''}`}
              >
                <p className={`text-xs font-medium ${style.text} mb-1`}>{style.label}</p>
                <p className="text-2xl font-bold text-gray-900">{item.count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">From</label>
            <input type="date" className="input w-full" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">To</label>
            <input type="date" className="input w-full" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Action</label>
            <select className="input w-full" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {Object.entries(ACTION_STYLES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Entity</label>
            <select className="input w-full" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
              <option value="">All entities</option>
              <option value="Sale">Sale</option>
              <option value="Medicine">Medicine</option>
              <option value="StockBatch">Stock</option>
              <option value="Patient">Patient</option>
              <option value="User">User</option>
              <option value="Supplier">Supplier</option>
            </select>
          </div>
          {(from || to || action || entity) && (
            <div className="col-span-2 sm:col-span-4 flex justify-end">
              <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : data.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No audit events found</p>
          <p className="text-sm mt-1">Events will appear here as users take actions</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#00475a]/10 flex items-center justify-center text-[#00475a] text-xs font-bold flex-shrink-0">
                          {log.user_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{log.user_name}</p>
                          <p className="text-gray-400 text-xs capitalize">{log.user_role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.entity}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {log.entity_ref || log.entity_id || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {data.map((log: any) => (
              <div key={log.id} className="card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#00475a]/10 flex items-center justify-center text-[#00475a] text-xs font-bold flex-shrink-0">
                      {log.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{log.user_name}</p>
                      <p className="text-xs text-gray-400 capitalize">{log.user_role}</p>
                    </div>
                  </div>
                  <ActionBadge action={log.action} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{log.entity} {log.entity_ref ? `· ${log.entity_ref}` : ''}</span>
                  <span>{formatDateTime(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Page {meta.page} of {meta.pages} · {meta.total} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(meta.pages, p + 1))}
                  disabled={page === meta.pages}
                  className="btn-secondary px-3 py-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
