'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ValidationResult {
  status: 'ALLOW' | 'WARN' | 'BLOCK';
  days_to_expiry: number;
  message: string;
  medicine_name: string;
  batch_number: string;
}

interface BatchWithValidation {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  sale_rate: number;
  validation: {
    status: 'ALLOW' | 'WARN' | 'BLOCK';
    days_to_expiry: number;
    message: string;
  };
  is_fefo_recommended: boolean;
}

interface ExpiryRule {
  id: string;
  category: 'ACUTE' | 'CHRONIC' | 'HIGH_RISK';
  hard_stop_days: number;
  warning_days: number;
  safety_buffer_days: number;
}

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

// ── Validate a specific batch before dispensing ─────────────
export function useExpiryValidation() {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(async (
    medicineId: string,
    batchId: string,
    qty: number,
    courseDays?: number,
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dispensing/validate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          medicine_id: medicineId,
          batch_id: batchId,
          qty,
          course_days: courseDays,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Validation failed');
      }
      const data = await res.json();
      setValidation(data);
      return data as ValidationResult;
    } catch (err: any) {
      setValidation(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { validation, loading, validate, reset: () => setValidation(null) };
}

// ── Fetch batches with validation status ────────────────────
export function useExpiryBatches() {
  const [batches, setBatches] = useState<BatchWithValidation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBatches = useCallback(async (medicineId: string, courseDays?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ medicine_id: medicineId });
      if (courseDays) params.set('course_days', String(courseDays));

      const res = await fetch(`${API_URL}/dispensing/batches?${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error('Failed to fetch batches');
      const data = await res.json();
      setBatches(data.batches || []);
      return data;
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { batches, loading, fetchBatches };
}

// ── Fetch / update expiry rules ─────────────────────────────
export function useExpiryRules() {
  const [rules, setRules] = useState<ExpiryRule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/dispensing/rules`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error('Failed to fetch rules');
      const data = await res.json();
      setRules(data);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRule = useCallback(async (
    category: string,
    data: { hard_stop_days?: number; warning_days?: number; safety_buffer_days?: number },
  ) => {
    const res = await fetch(`${API_URL}/dispensing/rules/${category}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update rule');
    await fetchRules(); // refresh
  }, [fetchRules]);

  return { rules, loading, fetchRules, updateRule };
}

// ── Fetch audit log ─────────────────────────────────────────
export function useDispenseAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (filters: {
    from?: string;
    to?: string;
    status?: string;
    medicine_id?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.status) params.set('status', filters.status);
      if (filters.medicine_id) params.set('medicine_id', filters.medicine_id);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));

      const res = await fetch(`${API_URL}/dispensing/audit-log?${params}`, {
        headers: headers(),
      });
      if (!res.ok) throw new Error('Failed to fetch audit log');
      const data = await res.json();
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { logs, total, loading, fetchLogs };
}
