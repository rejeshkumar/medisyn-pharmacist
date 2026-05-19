'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function VerificationTestPage() {
  const [pendingBatches, setPendingBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPendingBatches();
  }, []);

  const fetchPendingBatches = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://successful-playfulness-production-873f.up.railway.app/receiving/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data);
        setPendingBatches(data.batches || []);
      } else {
        setError(`API Error: ${response.status}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyBatch = async (batchId, verifiedQty, rejectedQty, notes) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('https://successful-playfulness-production-873f.up.railway.app/receiving/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch_id: batchId,
          verified_qty: verifiedQty,
          rejected_qty: rejectedQty || 0,
          discrepancy_notes: notes || '',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        fetchPendingBatches(); // Refresh list
      } else {
        const error = await response.json();
        alert(`❌ Error: ${error.message}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-gray-500">Loading pending verification...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Stock Verification Test</h1>
        <p className="text-sm text-gray-500 mt-1">Testing the verification API</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Pending Verification ({pendingBatches.length})
          </h2>
        </div>

        {pendingBatches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <AlertCircle className="mx-auto text-gray-300 mb-3" size={48} />
            <p className="text-gray-500">No pending batches</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingBatches.map((batch) => (
              <div key={batch.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{batch.medicine_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Batch: {batch.batch_no} | Expiry: {batch.expiry_date} | Qty: {batch.received_qty}
                    </p>
                    {batch.po_number && (
                      <p className="text-sm text-gray-500">PO: {batch.po_number}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyBatch(batch.id, batch.received_qty, 0, 'All good')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle size={18} />
                      Verify All
                    </button>
                    <button
                      onClick={() => {
                        const verified = prompt(`Verified quantity (out of ${batch.received_qty}):`);
                        if (verified !== null) {
                          const verifiedQty = parseFloat(verified);
                          const rejectedQty = batch.received_qty - verifiedQty;
                          const notes = prompt('Reason for rejection/shortage:');
                          verifyBatch(batch.id, verifiedQty, rejectedQty, notes);
                        }
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                      <AlertCircle size={18} />
                      Partial
                    </button>
                    <button
                      onClick={() => {
                        const notes = prompt('Reason for rejection:');
                        if (notes) {
                          verifyBatch(batch.id, 0, batch.received_qty, notes);
                        }
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle size={18} />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
