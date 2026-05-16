'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '@/lib/api';

interface InventoryConfig {
  fast_moving_sales_count: number;
  fast_moving_days: number;
  fast_moving_description: string;
  slow_moving_sales_count_min: number;
  slow_moving_sales_count_max: number;
  slow_moving_days: number;
  slow_moving_description: string;
  dead_stock_days: number;
  dead_stock_description: string;
}

export default function InventoryConfigPage() {
  const [config, setConfig] = useState<InventoryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/inventory-intelligence/config');
      setConfig(response.data);
    } catch (error) {
      console.error('Failed to fetch config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api.put('/inventory-intelligence/config', config);
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof InventoryConfig, value: number | string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00475a]"></div>
      </div>
    );
  }

  if (!config) {
    return <div className="text-center p-8">Configuration not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence Configuration</h1>
        <p className="text-gray-600 mt-2">Configure thresholds for movement categorization</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-8">
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Fast Moving Medicines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sales Count</label>
              <input
                type="number"
                min="1"
                value={config.fast_moving_sales_count}
                onChange={(e) => handleChange('fast_moving_sales_count', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Within Days</label>
              <input
                type="number"
                min="1"
                value={config.fast_moving_days}
                onChange={(e) => handleChange('fast_moving_days', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Medicines sold <strong>{config.fast_moving_sales_count}+</strong> times in <strong>{config.fast_moving_days}</strong> days
          </p>
        </div>

        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
            Slow Moving Medicines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Min Sales</label>
              <input
                type="number"
                min="0"
                value={config.slow_moving_sales_count_min}
                onChange={(e) => handleChange('slow_moving_sales_count_min', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Sales</label>
              <input
                type="number"
                min="1"
                value={config.slow_moving_sales_count_max}
                onChange={(e) => handleChange('slow_moving_sales_count_max', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Within Days</label>
              <input
                type="number"
                min="1"
                value={config.slow_moving_days}
                onChange={(e) => handleChange('slow_moving_days', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Medicines sold <strong>{config.slow_moving_sales_count_min}-{config.slow_moving_sales_count_max}</strong> times in <strong>{config.slow_moving_days}</strong> days
          </p>
        </div>

        <div className="pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
            Dead Stock
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">No Sales for Days</label>
            <input
              type="number"
              min="1"
              value={config.dead_stock_days}
              onChange={(e) => handleChange('dead_stock_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00475a]"
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            No sales in <strong>{config.dead_stock_days}</strong> days
          </p>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            onClick={fetchConfig}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[#00475a] text-white rounded-md hover:bg-[#003845] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
