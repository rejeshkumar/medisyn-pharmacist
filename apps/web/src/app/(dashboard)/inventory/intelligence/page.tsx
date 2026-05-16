'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import api from '@/lib/api';

interface MovementSummary {
  fast_moving: { count: number; total_stock: number };
  slow_moving: { count: number; total_stock: number; total_value: number };
  dead_stock: { count: number; total_stock: number; cost_locked: number; mrp_locked: number };
  stockout_risk: { critical: number; high: number; medium: number };
}

interface Medicine {
  id: string;
  name: string;
  generic_name?: string;
  current_stock: number;
  avg_sales_per_day: number;
  days_of_stock_remaining?: number;
  risk_level?: string;
  days_since_last_sale?: number;
  cost_value_locked?: number;
  stock_value?: number;
}

export default function InventoryIntelligencePage() {
  const [summary, setSummary] = useState<MovementSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'fast' | 'slow' | 'dead' | 'stockout'>('stockout');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiPredicting, setAiPredicting] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchMedicinesByCategory(activeTab);
  }, [activeTab]);

  const fetchSummary = async () => {
    try {
      const response = await api.get('/inventory-intelligence/summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMedicinesByCategory = async (category: string) => {
    setLoading(true);
    try {
      const endpoints = {
        fast: '/inventory-intelligence/fast-moving',
        slow: '/inventory-intelligence/slow-moving',
        dead: '/inventory-intelligence/dead-stock',
        stockout: '/inventory-intelligence/stockout-risk',
      };

      const response = await api.get(endpoints[category]);
      setMedicines(response.data);
    } catch (error) {
      console.error('Failed to fetch medicines:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const response = await api.post('/inventory-intelligence/refresh-all-velocities');
      toast.success(`Refreshed velocity for ${response.data.count} medicines`);
      await fetchSummary();
      await fetchMedicinesByCategory(activeTab);
    } catch (error) {
      console.error('Failed to refresh:', error);
      toast.error('Failed to refresh velocity data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAIPrediction = async (medicineId: string) => {
    setAiPredicting(medicineId);
    try {
      const response = await api.post('/inventory-intelligence/ai-predict', {
        medicine_id: medicineId,
        prediction_type: 'STOCKOUT_RISK',
        forecast_horizon_days: 7,
      });

      const prediction = response.data;
      toast.success(
        <div>
          <p className="font-semibold">AI Prediction Complete</p>
          <p className="text-sm">{prediction.ai_reasoning}</p>
          <p className="text-sm font-medium mt-1">Action: {prediction.recommended_action}</p>
        </div>,
        { duration: 8000 }
      );
    } catch (error) {
      console.error('AI prediction failed:', error);
      toast.error('AI prediction failed. Check ANTHROPIC_API_KEY configuration.');
    } finally {
      setAiPredicting(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00475a]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence</h1>
          <p className="text-gray-600 mt-1">AI-powered stock movement analysis and predictions</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/inventory/intelligence/config"
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ⚙️ Configure
          </Link>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="px-4 py-2 bg-[#00475a] text-white rounded-md hover:bg-[#003845] disabled:opacity-50"
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh All'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Fast Moving</p>
              <p className="text-2xl font-bold text-green-900">{summary?.fast_moving.count || 0}</p>
              <p className="text-xs text-green-600 mt-1">{summary?.fast_moving.total_stock || 0} units</p>
            </div>
            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚀</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">Slow Moving</p>
              <p className="text-2xl font-bold text-yellow-900">{summary?.slow_moving.count || 0}</p>
              <p className="text-xs text-yellow-600 mt-1">{formatCurrency(summary?.slow_moving.total_value || 0)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">🐌</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">Dead Stock</p>
              <p className="text-2xl font-bold text-red-900">{summary?.dead_stock.count || 0}</p>
              <p className="text-xs text-red-600 mt-1">{formatCurrency(summary?.dead_stock.cost_locked || 0)} locked</p>
            </div>
            <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">💀</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 font-medium">Stockout Risk</p>
              <p className="text-2xl font-bold text-orange-900">
                {(summary?.stockout_risk.critical || 0) + (summary?.stockout_risk.high || 0)}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                {summary?.stockout_risk.critical || 0} critical
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'stockout', label: '⚠️ Stockout Risk', count: (summary?.stockout_risk.critical || 0) + (summary?.stockout_risk.high || 0) + (summary?.stockout_risk.medium || 0) },
              { key: 'fast', label: '🚀 Fast Moving', count: summary?.fast_moving.count || 0 },
              { key: 'slow', label: '🐌 Slow Moving', count: summary?.slow_moving.count || 0 },
              { key: 'dead', label: '💀 Dead Stock', count: summary?.dead_stock.count || 0 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-[#00475a] text-[#00475a]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00475a]"></div>
            </div>
          ) : medicines.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No medicines in this category
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    {activeTab === 'stockout' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales/Day</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk</th>
                      </>
                    )}
                    {activeTab === 'fast' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales/Day</th>
                    )}
                    {activeTab === 'slow' && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    )}
                    {activeTab === 'dead' && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Since Sale</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Locked</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{med.name}</div>
                        {med.generic_name && (
                          <div className="text-xs text-gray-500">{med.generic_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{med.current_stock}</td>
                      {activeTab === 'stockout' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {med.avg_sales_per_day?.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {med.days_of_stock_remaining?.toFixed(0) || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                med.risk_level === 'CRITICAL'
                                  ? 'bg-red-100 text-red-800'
                                  : med.risk_level === 'HIGH'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {med.risk_level}
                            </span>
                          </td>
                        </>
                      )}
                      {activeTab === 'fast' && (
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {med.avg_sales_per_day?.toFixed(1)}
                        </td>
                      )}
                      {activeTab === 'slow' && (
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatCurrency(med.stock_value || 0)}
                        </td>
                      )}
                      {activeTab === 'dead' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {med.days_since_last_sale || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {formatCurrency(med.cost_value_locked || 0)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleAIPrediction(med.id)}
                          disabled={aiPredicting === med.id}
                          className="text-sm text-[#00475a] hover:text-[#003845] font-medium disabled:opacity-50"
                        >
                          {aiPredicting === med.id ? '🤖 Analyzing...' : '🤖 AI Predict'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
