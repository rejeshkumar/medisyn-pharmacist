'use client';

import { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  AlertCircle, 
  Calendar,
  Building2,
  Plus,
  FileText,
  Clock
} from 'lucide-react';

type PeriodFilter = 'today' | 'week' | 'month' | 'year';

interface VendorPayment {
  vendor_id: string;
  vendor_name: string;
  pending_po_count: number;
  total_pending: number;
  oldest_due_date: string;
  is_overdue: boolean;
}

// Mock data - will be replaced with API calls later
const mockSummary = {
  total_purchases: 450000,
  total_paid: 320000,
  total_pending: 130000,
  overdue_count: 3,
};

const mockVendors: VendorPayment[] = [
  {
    vendor_id: '1',
    vendor_name: 'KAIRALI PHARMA',
    pending_po_count: 2,
    total_pending: 45000,
    oldest_due_date: '2026-05-10',
    is_overdue: true,
  },
  {
    vendor_id: '2',
    vendor_name: 'MEDICO DISTRIBUTORS',
    pending_po_count: 1,
    total_pending: 32000,
    oldest_due_date: '2026-05-15',
    is_overdue: true,
  },
  {
    vendor_id: '3',
    vendor_name: 'HEALTHCARE SUPPLIES',
    pending_po_count: 1,
    total_pending: 28000,
    oldest_due_date: '2026-05-20',
    is_overdue: false,
  },
  {
    vendor_id: '4',
    vendor_name: 'PHARMA SOLUTIONS',
    pending_po_count: 1,
    total_pending: 25000,
    oldest_due_date: '2026-05-25',
    is_overdue: false,
  },
];

export default function FinanceDashboard() {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDaysOverdue = (dueDateString: string) => {
    const dueDate = new Date(dueDateString);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Payment tracking and expense management</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsRecordingPayment(true)}
            className="px-4 py-2 bg-[#00475a] text-white rounded-lg hover:bg-[#003544] flex items-center gap-2"
          >
            <Plus size={18} />
            Record Payment
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <FileText size={18} />
            Reports
          </button>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex gap-2 mb-6">
        {(['today', 'week', 'month', 'year'] as PeriodFilter[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg capitalize ${
              period === p
                ? 'bg-[#00475a] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Purchases</span>
            <DollarSign className="text-blue-500" size={20} />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {formatCurrency(mockSummary.total_purchases)}
          </p>
          <p className="text-xs text-gray-500 mt-1">This {period}</p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Paid Amount</span>
            <TrendingUp className="text-green-500" size={20} />
          </div>
          <p className="text-2xl font-semibold text-green-600">
            {formatCurrency(mockSummary.total_paid)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {((mockSummary.total_paid / mockSummary.total_purchases) * 100).toFixed(0)}% of total
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Pending Amount</span>
            <Clock className="text-orange-500" size={20} />
          </div>
          <p className="text-2xl font-semibold text-orange-600">
            {formatCurrency(mockSummary.total_pending)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {((mockSummary.total_pending / mockSummary.total_purchases) * 100).toFixed(0)}% pending
          </p>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Overdue Payments</span>
            <AlertCircle className="text-red-500" size={20} />
          </div>
          <p className="text-2xl font-semibold text-red-600">
            {mockSummary.overdue_count}
          </p>
          <p className="text-xs text-gray-500 mt-1">Requires attention</p>
        </div>
      </div>

      {/* Pending Payments by Vendor */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Pending Payments by Vendor</h2>
          <p className="text-sm text-gray-500 mt-1">Vendors with outstanding payments</p>
        </div>

        <div className="divide-y divide-gray-200">
          {mockVendors.map((vendor) => (
            <div
              key={vendor.vendor_id}
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 bg-gray-100 rounded">
                    <Building2 size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{vendor.vendor_name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        {vendor.pending_po_count} PO{vendor.pending_po_count > 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        Due: {formatDate(vendor.oldest_due_date)}
                      </span>
                      {vendor.is_overdue && (
                        <span className="flex items-center gap-1 text-red-600 font-medium">
                          <AlertCircle size={14} />
                          {getDaysOverdue(vendor.oldest_due_date)} days overdue
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(vendor.total_pending)}
                  </p>
                  <button className="mt-1 px-3 py-1 text-sm bg-[#00475a] text-white rounded hover:bg-[#003544]">
                    Pay Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {mockVendors.length === 0 && (
          <div className="px-6 py-12 text-center">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No pending payments</p>
            <p className="text-sm text-gray-400 mt-1">All payments are up to date</p>
          </div>
        )}
      </div>

      {/* Record Payment Modal - Placeholder */}
      {isRecordingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Record Payment</h3>
            <p className="text-gray-600 mb-4">Payment recording form will go here</p>
            <button
              onClick={() => setIsRecordingPayment(false)}
              className="w-full px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
