'use client';

import { useState } from 'react';

interface ExpiryWarningModalProps {
  status: 'WARN' | 'BLOCK';
  message: string;
  medicineName: string;
  batchNumber: string;
  daysToExpiry: number;
  onConfirm: (overrideReason?: string) => void;
  onCancel: () => void;
}

export default function ExpiryWarningModal({
  status,
  message,
  medicineName,
  batchNumber,
  daysToExpiry,
  onConfirm,
  onCancel,
}: ExpiryWarningModalProps) {
  const [reason, setReason] = useState('');
  const isBlock = status === 'BLOCK';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* header */}
        <div className={`px-5 py-4 ${isBlock ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
              ${isBlock ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              {isBlock ? '✕' : '⚠'}
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${isBlock ? 'text-red-800' : 'text-amber-800'}`}>
                {isBlock ? 'Expiry blocked' : 'Expiry warning'}
              </h3>
              <p className={`text-xs mt-0.5 ${isBlock ? 'text-red-600' : 'text-amber-600'}`}>
                {medicineName} — Batch {batchNumber}
              </p>
            </div>
          </div>
        </div>

        {/* body */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`text-2xl font-bold ${daysToExpiry < 0 ? 'text-red-600' : daysToExpiry < 30 ? 'text-red-500' : 'text-amber-600'}`}>
              {daysToExpiry < 0 ? 'EXPIRED' : `${daysToExpiry}d`}
            </div>
            <p className="text-sm text-gray-600">{message}</p>
          </div>

          {isBlock && (
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Override reason (mandatory)
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="e.g., Patient informed of near-expiry, no alternative stock available..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400
                  resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                This override will be logged for audit purposes.
              </p>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg
              hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          {isBlock ? (
            <button
              disabled={!reason.trim()}
              onClick={() => onConfirm(reason)}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                ${reason.trim()
                  ? 'bg-red-600 hover:bg-red-700 cursor-pointer'
                  : 'bg-gray-300 cursor-not-allowed'
                }`}
            >
              Override & dispense
            </button>
          ) : (
            <button
              onClick={() => onConfirm()}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600
                hover:bg-amber-700 rounded-lg cursor-pointer transition-colors"
            >
              Proceed anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
