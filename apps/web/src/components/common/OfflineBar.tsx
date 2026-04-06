'use client';

// OfflineBar.tsx
// Place at: apps/web/src/components/common/OfflineBar.tsx
// Shows online/offline/syncing status at top of screen

import { useOfflineSync } from '@/lib/use-offline-sync';
import { Wifi, WifiOff, RefreshCw, CloudOff, CheckCircle2 } from 'lucide-react';

export default function OfflineBar() {
  const { status, isOnline, pendingBills, medicinesCached, isCaching, refreshCache } = useOfflineSync();

  // Online and no pending bills — show nothing (clean UI)
  if (isOnline && status === 'online' && pendingBills === 0) {
    return (
      <div className="hidden" aria-hidden>
        {/* Cache status available in dev tools */}
        {isCaching && <span>Caching {medicinesCached} medicines...</span>}
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-medium w-full">
        <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">
          Offline — working from local cache
          {medicinesCached > 0 && ` (${medicinesCached} medicines available)`}
        </span>
        {pendingBills > 0 && (
          <span className="bg-white/20 px-2 py-0.5 rounded-full">
            {pendingBills} bill{pendingBills > 1 ? 's' : ''} queued
          </span>
        )}
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-xs font-medium w-full">
        <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
        <span className="flex-1">
          Back online — syncing {pendingBills} bill{pendingBills !== 1 ? 's' : ''}...
        </span>
      </div>
    );
  }

  // Online but has pending bills (unusual — show warning)
  if (isOnline && pendingBills > 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-xs font-medium w-full">
        <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">
          {pendingBills} offline bill{pendingBills > 1 ? 's' : ''} pending sync
        </span>
        <button
          onClick={() => refreshCache(true)}
          className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-full transition-colors"
        >
          Sync now
        </button>
      </div>
    );
  }

  // Caching in progress
  if (isCaching) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-[#00475a]/10 text-[#00475a] text-xs w-full">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span>Updating offline cache...</span>
      </div>
    );
  }

  return null;
}
