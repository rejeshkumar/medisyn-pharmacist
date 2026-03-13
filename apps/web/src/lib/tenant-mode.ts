'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

// Tenant mode values: 'full' | 'pharmacy_only' | 'clinic_only'
// Used by layout to conditionally render nav items

let cachedMode: string | null = null;

export async function getTenantMode(): Promise<string> {
  if (cachedMode) return cachedMode;
  try {
    const res = await api.get('/tenants/me');
    cachedMode = res.data?.mode ?? 'full';
    return cachedMode;
  } catch {
    return 'full';
  }
}

// Clears the cache when tenant settings change
export function clearTenantModeCache() {
  cachedMode = null;
}

// Hook for components
export function useTenantMode() {
  const [mode, setMode] = useState<string>('full');
  useEffect(() => {
    getTenantMode().then(setMode);
  }, []);
  return mode;
}

// Helper: should this nav item show?
export function isNavVisible(href: string, mode: string): boolean {
  if (mode === 'pharmacy_only') {
    // Hide clinic-only routes
    const clinicRoutes = ['/queue', '/doctor', '/receptionist', '/nurse', '/availability'];
    return !clinicRoutes.some(r => href.startsWith(r));
  }
  if (mode === 'clinic_only') {
    // Hide pharmacy-only routes
    const pharmacyRoutes = ['/dispensing', '/stock', '/medicines', '/compliance', '/bulk'];
    return !pharmacyRoutes.some(r => href.startsWith(r));
  }
  return true; // 'full' mode shows everything
}
