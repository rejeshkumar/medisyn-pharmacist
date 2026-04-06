// apps/web/src/lib/use-offline-sync.ts
// Manages online/offline state, caches data, syncs bill queue

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import {
  cacheMedicines, cachePatients, getPendingBills,
  updateBillStatus, getPendingBillCount, getMedicineCount,
  setSyncMeta, getSyncMeta,
} from './offline-store';
import toast from 'react-hot-toast';

export type SyncStatus = 'online' | 'offline' | 'syncing';

interface OfflineSyncState {
  status:           SyncStatus;
  isOnline:         boolean;
  pendingBills:     number;
  medicinesCached:  number;
  lastCachedAt:     Date | null;
  isCaching:        boolean;
}

const CACHE_INTERVAL_MS  = 5 * 60 * 1000;  // refresh cache every 5 minutes
const SYNC_RETRY_MS      = 10 * 1000;       // retry sync every 10 seconds when online

export function useOfflineSync() {
  const [state, setState] = useState<OfflineSyncState>({
    status:          'online',
    isOnline:        true,
    pendingBills:    0,
    medicinesCached: 0,
    lastCachedAt:    null,
    isCaching:       false,
  });

  const syncTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const cacheTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cache medicines in background ───────────────────────────────────────
  const refreshCache = useCallback(async (force = false) => {
    try {
      const lastCached = await getSyncMeta('medicines_cached_at');
      const age        = Date.now() - (lastCached || 0);
      if (!force && age < CACHE_INTERVAL_MS) return; // fresh enough

      setState(s => ({ ...s, isCaching: true }));

      // Cache medicines
      const [medsRes, patientsRes] = await Promise.allSettled([
        api.get('/medicines?limit=5000').then(r => r.data),
        api.get('/patients?limit=500').then(r => r.data?.data || r.data || []),
      ]);

      if (medsRes.status === 'fulfilled') {
        const meds = Array.isArray(medsRes.value) ? medsRes.value : [];
        await cacheMedicines(meds);
      }

      if (patientsRes.status === 'fulfilled') {
        const patients = Array.isArray(patientsRes.value) ? patientsRes.value : [];
        await cachePatients(patients);
      }

      const count = await getMedicineCount();
      setState(s => ({
        ...s,
        isCaching:        false,
        medicinesCached:  count,
        lastCachedAt:     new Date(),
      }));
    } catch {
      setState(s => ({ ...s, isCaching: false }));
    }
  }, []);

  // ── Sync pending bills when back online ─────────────────────────────────
  const syncPendingBills = useCallback(async () => {
    const pending = await getPendingBills();
    if (!pending.length) return;

    setState(s => ({ ...s, status: 'syncing' }));
    let synced = 0;
    let failed = 0;

    for (const bill of pending) {
      try {
        await updateBillStatus(bill.id, 'syncing');
        await api.post('/sales', bill.bill_data);
        await updateBillStatus(bill.id, 'synced');
        synced++;
      } catch (err: any) {
        await updateBillStatus(bill.id, 'failed', err.message);
        failed++;
      }
    }

    const remaining = await getPendingBillCount();
    setState(s => ({ ...s, status: 'online', pendingBills: remaining }));

    if (synced > 0) toast.success(`✅ ${synced} offline bill${synced > 1 ? 's' : ''} synced`);
    if (failed > 0) toast.error(`❌ ${failed} bill${failed > 1 ? 's' : ''} failed to sync — will retry`);
  }, []);

  // ── Handle online/offline events ────────────────────────────────────────
  const handleOnline = useCallback(async () => {
    setState(s => ({ ...s, isOnline: true, status: 'syncing' }));
    toast.success('🟢 Back online — syncing...', { duration: 2000 });
    await refreshCache(true);
    await syncPendingBills();
    setState(s => ({ ...s, status: 'online' }));
  }, [refreshCache, syncPendingBills]);

  const handleOffline = useCallback(async () => {
    setState(s => ({ ...s, isOnline: false, status: 'offline' }));
    const count = await getPendingBillCount();
    const cached = await getMedicineCount();
    setState(s => ({ ...s, pendingBills: count, medicinesCached: cached }));
    toast('🟡 Offline — working from local cache', {
      duration: 4000,
      icon: '📶',
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial cache load
    refreshCache();

    // Listen for online/offline
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial online state
    if (!navigator.onLine) {
      handleOffline();
    }

    // Periodic cache refresh (every 5 min)
    cacheTimerRef.current = setInterval(() => {
      if (navigator.onLine) refreshCache();
    }, CACHE_INTERVAL_MS);

    // Periodic sync retry (every 10 sec when online)
    syncTimerRef.current = setInterval(async () => {
      if (navigator.onLine) {
        const count = await getPendingBillCount();
        if (count > 0) syncPendingBills();
        setState(s => ({ ...s, pendingBills: count }));
      }
    }, SYNC_RETRY_MS);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (cacheTimerRef.current) clearInterval(cacheTimerRef.current);
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [handleOnline, handleOffline, refreshCache, syncPendingBills]);

  return { ...state, refreshCache, syncPendingBills };
}
