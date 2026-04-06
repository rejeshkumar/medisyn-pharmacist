// apps/web/src/lib/offline-store.ts
// IndexedDB wrapper for offline medicine cache + bill queue

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface MediSynDB extends DBSchema {
  medicines: {
    key: string;
    value: {
      id: string;
      brand_name: string;
      molecule: string;
      strength: string;
      dosage_form: string;
      schedule_class: string;
      gst_percent: number;
      mrp: number;
      sale_rate: number;
      manufacturer: string;
      rack_location: string;
      category: string;
      total_stock: number;
      fefo_batch: any;
      cached_at: number;
    };
    indexes: { 'by-brand': string; 'by-molecule': string };
  };
  patients: {
    key: string;
    value: {
      id: string;
      first_name: string;
      last_name: string;
      mobile: string;
      cached_at: number;
    };
    indexes: { 'by-mobile': string; 'by-name': string };
  };
  bill_queue: {
    key: string;
    value: {
      id: string;
      bill_data: any;
      created_at: number;
      status: 'pending' | 'syncing' | 'synced' | 'failed';
      retry_count: number;
      error?: string;
    };
    indexes: { 'by-status': string };
  };
  sync_meta: {
    key: string;
    value: { key: string; value: any };
  };
}

let db: IDBPDatabase<MediSynDB> | null = null;

async function getDB(): Promise<IDBPDatabase<MediSynDB>> {
  if (db) return db;
  db = await openDB<MediSynDB>('medisyn-offline', 2, {
    upgrade(database, oldVersion) {
      // Medicines store
      if (!database.objectStoreNames.contains('medicines')) {
        const medStore = database.createObjectStore('medicines', { keyPath: 'id' });
        medStore.createIndex('by-brand', 'brand_name');
        medStore.createIndex('by-molecule', 'molecule');
      }
      // Patients store
      if (!database.objectStoreNames.contains('patients')) {
        const patStore = database.createObjectStore('patients', { keyPath: 'id' });
        patStore.createIndex('by-mobile', 'mobile');
        patStore.createIndex('by-name', 'first_name');
      }
      // Bill queue
      if (!database.objectStoreNames.contains('bill_queue')) {
        const billStore = database.createObjectStore('bill_queue', { keyPath: 'id' });
        billStore.createIndex('by-status', 'status');
      }
      // Sync metadata
      if (!database.objectStoreNames.contains('sync_meta')) {
        database.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    },
  });
  return db;
}

// ── Medicine Cache ─────────────────────────────────────────────────────────

export async function cacheMedicines(medicines: any[]): Promise<void> {
  const database = await getDB();
  const tx = database.transaction('medicines', 'readwrite');
  const now = Date.now();
  await Promise.all([
    ...medicines.map(m => tx.store.put({ ...m, cached_at: now })),
    tx.done,
  ]);
  await setSyncMeta('medicines_cached_at', now);
  await setSyncMeta('medicines_count', medicines.length);
}

export async function searchMedicinesOffline(query: string): Promise<any[]> {
  if (!query || query.length < 2) return [];
  const database = await getDB();
  const all = await database.getAll('medicines');
  const q = query.toLowerCase();
  return all
    .filter(m =>
      m.brand_name?.toLowerCase().includes(q) ||
      m.molecule?.toLowerCase().includes(q) ||
      m.category?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      // Prioritize in-stock medicines and exact matches
      const aStock = a.total_stock > 0 ? 0 : 1;
      const bStock = b.total_stock > 0 ? 0 : 1;
      if (aStock !== bStock) return aStock - bStock;
      const aExact = a.brand_name?.toLowerCase().startsWith(q) ? 0 : 1;
      const bExact = b.brand_name?.toLowerCase().startsWith(q) ? 0 : 1;
      return aExact - bExact;
    })
    .slice(0, 12);
}

export async function getMedicineCount(): Promise<number> {
  const database = await getDB();
  return database.count('medicines');
}

// ── Patient Cache ──────────────────────────────────────────────────────────

export async function cachePatients(patients: any[]): Promise<void> {
  const database = await getDB();
  const tx = database.transaction('patients', 'readwrite');
  const now = Date.now();
  await Promise.all([
    ...patients.map(p => tx.store.put({ ...p, cached_at: now })),
    tx.done,
  ]);
}

export async function searchPatientsOffline(query: string): Promise<any[]> {
  if (!query || query.length < 2) return [];
  const database = await getDB();
  const all = await database.getAll('patients');
  const q = query.toLowerCase();
  return all
    .filter(p =>
      p.first_name?.toLowerCase().includes(q) ||
      p.last_name?.toLowerCase().includes(q) ||
      p.mobile?.includes(q)
    )
    .slice(0, 8);
}

// ── Bill Queue ─────────────────────────────────────────────────────────────

export async function queueBill(billData: any): Promise<string> {
  const database = await getDB();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await database.put('bill_queue', {
    id,
    bill_data: billData,
    created_at: Date.now(),
    status: 'pending',
    retry_count: 0,
  });
  return id;
}

export async function getPendingBills(): Promise<any[]> {
  const database = await getDB();
  return database.getAllFromIndex('bill_queue', 'by-status', 'pending');
}

export async function updateBillStatus(
  id: string,
  status: 'pending' | 'syncing' | 'synced' | 'failed',
  error?: string
): Promise<void> {
  const database = await getDB();
  const bill = await database.get('bill_queue', id);
  if (bill) {
    await database.put('bill_queue', {
      ...bill,
      status,
      error,
      retry_count: status === 'failed' ? bill.retry_count + 1 : bill.retry_count,
    });
  }
}

export async function getPendingBillCount(): Promise<number> {
  const database = await getDB();
  const pending = await database.getAllFromIndex('bill_queue', 'by-status', 'pending');
  return pending.length;
}

// ── Sync Metadata ──────────────────────────────────────────────────────────

export async function getSyncMeta(key: string): Promise<any> {
  const database = await getDB();
  const entry = await database.get('sync_meta', key);
  return entry?.value;
}

export async function setSyncMeta(key: string, value: any): Promise<void> {
  const database = await getDB();
  await database.put('sync_meta', { key, value });
}

export async function getLastCachedAt(): Promise<Date | null> {
  const ts = await getSyncMeta('medicines_cached_at');
  return ts ? new Date(ts) : null;
}
