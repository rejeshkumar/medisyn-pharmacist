'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  Clock,
  Shield,
  Package,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: () => api.get('/stock/alerts/low-stock').then((r) => r.data),
  });

  const { data: nearExpiry } = useQuery({
    queryKey: ['near-expiry-alerts'],
    queryFn: () => api.get('/stock/alerts/near-expiry?days=30').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="p-6 animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Today's Sales",
      value: formatCurrency(dashboard?.today_sales || 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
    {
      label: 'Total Bills',
      value: dashboard?.today_bill_count || 0,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Low Stock Items',
      value: dashboard?.low_stock_count || 0,
      icon: AlertTriangle,
      color: dashboard?.low_stock_count > 0 ? 'text-red-600' : 'text-gray-500',
      bg: dashboard?.low_stock_count > 0 ? 'bg-red-50' : 'bg-gray-50',
      border: dashboard?.low_stock_count > 0 ? 'border-red-100' : 'border-gray-100',
    },
    {
      label: 'Near Expiry (90d)',
      value: dashboard?.near_expiry_count || 0,
      icon: Clock,
      color: dashboard?.near_expiry_count > 0 ? 'text-amber-600' : 'text-gray-500',
      bg: dashboard?.near_expiry_count > 0 ? 'bg-amber-50' : 'bg-gray-50',
      border: dashboard?.near_expiry_count > 0 ? 'border-amber-100' : 'border-gray-100',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`card border ${kpi.border} flex items-start gap-4 p-5`}
            >
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Top Selling Medicines</h2>
            <span className="text-xs text-gray-400">All time</span>
          </div>
          {dashboard?.top_medicines?.length > 0 ? (
            <div className="space-y-2">
              {dashboard.top_medicines.slice(0, 8).map((med: any, i: number) => (
                <div key={med.medicine_id} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-gray-400 w-5 text-right font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{med.medicine_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{med.total_qty} units</p>
                    <p className="text-xs text-gray-400">{formatCurrency(med.total_revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sales data yet</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {lowStock && lowStock.length > 0 && (
            <div className="card border border-red-100">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="font-semibold text-gray-900">Low Stock Alert</h2>
                <span className="ml-auto badge bg-red-100 text-red-700 border-red-200">
                  {lowStock.length} items
                </span>
              </div>
              <div className="space-y-2">
                {lowStock.slice(0, 5).map((batch: any) => (
                  <div key={batch.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{batch.medicine?.brand_name}</p>
                      <p className="text-xs text-gray-400">{batch.batch_number}</p>
                    </div>
                    <span className="badge bg-red-50 text-red-600 border-red-200 flex-shrink-0">
                      {batch.quantity} left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nearExpiry && nearExpiry.length > 0 && (
            <div className="card border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-gray-900">Expiring Soon (30 days)</h2>
                <span className="ml-auto badge bg-amber-100 text-amber-700 border-amber-200">
                  {nearExpiry.length} batches
                </span>
              </div>
              <div className="space-y-2">
                {nearExpiry.slice(0, 5).map((batch: any) => (
                  <div key={batch.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{batch.medicine?.brand_name}</p>
                      <p className="text-xs text-gray-400">Batch: {batch.batch_number}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-amber-600 font-medium">{formatDate(batch.expiry_date)}</p>
                      <p className="text-xs text-gray-400">{batch.quantity} units</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
