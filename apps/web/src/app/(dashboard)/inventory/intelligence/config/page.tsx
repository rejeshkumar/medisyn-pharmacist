'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

const DEFAULT_CONFIG = {
  fast_sales_count: 10,
  fast_days: 100,
  slow_min: 1,
  slow_max: 10,
  slow_days: 90,
  dead_days: 60,
};

export default function InventoryConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('inv_intelligence_config');
      if (stored) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) });
    } catch {}
  }, []);

  const handleSave = () => {
    localStorage.setItem('inv_intelligence_config', JSON.stringify(config));
    toast.success('Configuration saved');
    router.push('/inventory/intelligence');
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem('inv_intelligence_config');
    toast('Reset to defaults');
  };

  const set = (field: keyof typeof DEFAULT_CONFIG, value: number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Intelligence Configuration</h1>
        <p className="text-gray-500 mt-1">Configure thresholds for movement categorization</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        <div className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>Fast Moving Medicines
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sales Count</label>
              <input type="number" min="1" value={config.fast_sales_count}
                onChange={e => set('fast_sales_count', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Within Days</label>
              <input type="number" min="1" value={config.fast_days}
                onChange={e => set('fast_days', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Medicines sold <strong>{config.fast_sales_count}+</strong> times in <strong>{config.fast_days}</strong> days
            &nbsp;(≥ {(config.fast_sales_count / config.fast_days).toFixed(3)} sales/day)
          </p>
        </div>
        <div className="border-b border-gray-100 pb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>Slow Moving Medicines
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Sales</label>
              <input type="number" min="0" value={config.slow_min}
                onChange={e => set('slow_min', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Sales</label>
              <input type="number" min="1" value={config.slow_max}
                onChange={e => set('slow_max', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Within Days</label>
              <input type="number" min="1" value={config.slow_days}
                onChange={e => set('slow_days', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Medicines sold <strong>{config.slow_min}–{config.slow_max}</strong> times in <strong>{config.slow_days}</strong> days
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full"></span>Dead Stock
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No Sales for Days</label>
            <input type="number" min="1" value={config.dead_days}
              onChange={e => set('dead_days', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00475a]" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            No sales in <strong>{config.dead_days}</strong> days (with stock still available)
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button onClick={handleReset}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Reset to Defaults
          </button>
          <button onClick={handleSave}
            className="px-5 py-2 bg-[#00b8a0] text-white rounded-lg text-sm hover:bg-[#009d89]">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
