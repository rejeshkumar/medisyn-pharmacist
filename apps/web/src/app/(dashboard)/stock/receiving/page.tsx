'use client';

import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Package,
  Calendar,
  FileText,
  Loader2
} from 'lucide-react';

interface PendingBatch {
  id: string;
  medicine_name: string;
  generic_name: string;
  batch_no: string;
  expiry_date: string;
  received_qty: number;
  ordered_qty: number;
  purchase_price: number;
  mrp: number;
  po_number: string;
  supplier_name: string;
  received_at: string;
}

interface VerifyingBatch {
  id: string;
  verifiedQty: number;
  rejectedQty: number;
  notes: string;
}

export default function PendingVerificationPage() {
  const [batches, setBatches] = useState<PendingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState<VerifyingBatch | null>(null);

  useEffect(() => {
    fetchPendingBatches();
  }, []);

  const fetchPendingBatches = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(
        'https://successful-playfulness-production-873f.up.railway.app/receiving/pending',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches || []);
      } else {
        console.error('Failed to fetch batches:', response.status);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickVerify = async (batch: PendingBatch, status: 'verified' | 'rejected') => {
    setVerifying(batch.id);

    const verifiedQty = status === 'verified' ? batch.received_qty : 0;
    const rejectedQty = status === 'rejected' ? batch.received_qty : 0;

    await verifyBatch(
      batch.id,
      verifiedQty,
      rejectedQty,
      status === 'rejected' ? 'Batch rejected' : 'Verified - all good'
    );
  };

  const handlePartialVerify = (batch: PendingBatch) => {
    setEditingBatch({
      id: batch.id,
      verifiedQty: batch.received_qty,
      rejectedQty: 0,
      notes: '',
    });
  };

  const submitPartialVerify = async () => {
    if (!editingBatch) return;
    
    setVerifying(editingBatch.id);
    await verifyBatch(
      editingBatch.id,
      editingBatch.verifiedQty,
      editingBatch.rejectedQty,
      editingBatch.notes
    );
    setEditingBatch(null);
  };

  const verifyBatch = async (
    batchId: string,
    verifiedQty: number,
    rejectedQty: number,
    notes: string
  ) => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const response = await fetch(
        'https://successful-playfulness-production-873f.up.railway.app/receiving/verify',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batch_id: batchId,
            verified_qty: verifiedQty,
            rejected_qty: rejectedQty,
            discrepancy_notes: notes,
          }),
        }
      );

      if (response.ok) {
        // Remove verified batch from list
        setBatches(prev => prev.filter(b => b.id !== batchId));
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Failed to verify batch');
    } finally {
      setVerifying(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Pending Verification
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {batches.length} batch{batches.length !== 1 ? 'es' : ''} awaiting physical verification
        </p>
      </div>

      {batches.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-600 font-medium">No pending batches</p>
          <p className="text-sm text-gray-500 mt-1">
            All stock has been verified
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="bg-white rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between">
                {/* Medicine Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {batch.medicine_name}
                  </h3>
                  {batch.generic_name && (
                    <p className="text-sm text-gray-600 mt-1">
                      {batch.generic_name}
                    </p>
                  )}

                  {/* Batch Details */}
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Batch:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {batch.batch_no}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expiry:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatDate(batch.expiry_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Quantity:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {batch.received_qty}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">MRP:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        ₹{batch.mrp?.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* PO Info */}
                  {batch.po_number && (
                    <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FileText size={14} />
                        PO: {batch.po_number}
                      </span>
                      {batch.supplier_name && (
                        <span>Supplier: {batch.supplier_name}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        Received: {formatDate(batch.received_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {verifying === batch.id ? (
                  <div className="ml-4">
                    <Loader2 className="animate-spin text-[#00475a]" size={24} />
                  </div>
                ) : (
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handleQuickVerify(batch, 'verified')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
                    >
                      <CheckCircle size={16} />
                      Verify All
                    </button>
                    <button
                      onClick={() => handlePartialVerify(batch)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-sm font-medium"
                    >
                      <AlertTriangle size={16} />
                      Partial
                    </button>
                    <button
                      onClick={() => handleQuickVerify(batch, 'rejected')}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm font-medium"
                    >
                      <XCircle size={16} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Partial Verification Modal */}
      {editingBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Partial Verification</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verified Quantity
                </label>
                <input
                  type="number"
                  value={editingBatch.verifiedQty}
                  onChange={(e) =>
                    setEditingBatch({
                      ...editingBatch,
                      verifiedQty: parseFloat(e.target.value) || 0,
                      rejectedQty:
                        (batches.find(b => b.id === editingBatch.id)?.received_qty || 0) -
                        (parseFloat(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejected Quantity
                </label>
                <input
                  type="number"
                  value={editingBatch.rejectedQty}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Discrepancy
                </label>
                <textarea
                  value={editingBatch.notes}
                  onChange={(e) =>
                    setEditingBatch({ ...editingBatch, notes: e.target.value })
                  }
                  placeholder="E.g., 2 strips damaged, short supply, expired"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={submitPartialVerify}
                disabled={verifying === editingBatch.id}
                className="flex-1 px-4 py-2 bg-[#00475a] text-white rounded-lg hover:bg-[#003544] font-medium disabled:opacity-50"
              >
                {verifying === editingBatch.id ? 'Saving...' : 'Save Verification'}
              </button>
              <button
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
