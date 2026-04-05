// useAnalytics.ts
// Place at: apps/web/src/lib/analytics.ts
//
// Usage:
//   import { track, trackPage, trackTimed } from '@/lib/analytics';
//
//   // Track a simple action
//   track('barcode_scanned', { success: true, barcode: '123456' });
//
//   // Track with timing
//   const done = trackTimed('bill_generated');
//   await generateBill();
//   done({ bill_number: 'BILL-001', amount: 450 });
//
//   // Track page view (auto-called in layout)
//   trackPage('/dispensing');

import api from './api';

// ── Session ID (persists for browser session) ─────────────────────────────
const SESSION_ID = (() => {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('medisyn_session_id');
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('medisyn_session_id', id);
  }
  return id;
})();

// ── Event queue — batch sends every 5 seconds ─────────────────────────────
let eventQueue: any[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queueEvent(event: any) {
  if (typeof window === 'undefined') return;
  eventQueue.push({ ...event, session_id: SESSION_ID });

  // Flush after 5 seconds or when queue hits 10
  if (eventQueue.length >= 10) {
    flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flush, 5000);
  }
}

async function flush() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!eventQueue.length) return;

  const batch = [...eventQueue];
  eventQueue = [];

  try {
    await api.post('/analytics/track-batch', { events: batch });
  } catch {
    // Silently fail — never break the app for analytics
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Track a user action
 * @param eventName - e.g. 'bill_generated', 'barcode_scanned'
 * @param properties - any additional data
 */
export function track(eventName: string, properties?: Record<string, any>) {
  queueEvent({
    event_name:  eventName,
    event_type:  'action',
    page:        typeof window !== 'undefined' ? window.location.pathname : '',
    properties:  properties || {},
  });
}

/**
 * Track a page view with time spent
 */
export function trackPage(page: string) {
  const startTime = Date.now();
  queueEvent({
    event_name: 'page_view',
    event_type: 'page_view',
    page,
    properties: {},
  });

  // Return cleanup function to track time spent
  return () => {
    const duration = Date.now() - startTime;
    queueEvent({
      event_name:  'page_exit',
      event_type:  'page_view',
      page,
      duration_ms: duration,
      properties:  { duration_seconds: Math.round(duration / 1000) },
    });
  };
}

/**
 * Track a timed action — call the returned function when done
 * @example
 *   const done = trackTimed('bill_generated');
 *   await createBill();
 *   done({ bill_number: 'BILL-001' });
 */
export function trackTimed(eventName: string, startProperties?: Record<string, any>) {
  const startTime = Date.now();
  const page = typeof window !== 'undefined' ? window.location.pathname : '';

  return (endProperties?: Record<string, any>) => {
    const duration = Date.now() - startTime;
    queueEvent({
      event_name:  eventName,
      event_type:  'action',
      page,
      duration_ms: duration,
      properties:  { ...startProperties, ...endProperties },
    });
  };
}

/**
 * Track an error
 */
export function trackError(eventName: string, error: string, properties?: Record<string, any>) {
  queueEvent({
    event_name: eventName,
    event_type: 'error',
    page:       typeof window !== 'undefined' ? window.location.pathname : '',
    properties: { error, ...properties },
  });
}

/**
 * Track feature usage (for adoption metrics)
 */
export function trackFeature(feature: string, properties?: Record<string, any>) {
  queueEvent({
    event_name: `feature_${feature}`,
    event_type: 'feature',
    page:       typeof window !== 'undefined' ? window.location.pathname : '',
    properties: properties || {},
  });
}

// ── Pre-defined event names (use these for consistency) ──────────────────
export const Events = {
  // Billing
  BILL_GENERATED:        'bill_generated',
  BILL_VOIDED:           'bill_voided',
  BILL_PREVIEWED:        'bill_previewed',

  // Medicine
  MEDICINE_SEARCHED:     'medicine_searched',
  MEDICINE_SELECTED:     'medicine_selected',
  MEDICINE_NOT_FOUND:    'medicine_not_found',

  // Barcode
  BARCODE_SCANNED:       'barcode_scanned',
  BARCODE_SCAN_FAILED:   'barcode_scan_failed',
  BARCODE_MAPPED:        'barcode_mapped',

  // Prescription
  RX_UPLOADED:           'rx_uploaded',
  RX_AI_EXTRACTED:       'rx_ai_extracted',
  RX_AI_FAILED:          'rx_ai_failed',

  // Patients
  PATIENT_REGISTERED:    'patient_registered',
  PATIENT_SEARCHED:      'patient_searched',

  // Reports
  REPORT_VIEWED:         'report_viewed',
  REPORT_EXPORTED:       'report_exported',

  // AI Care
  AI_CARE_VIEWED:        'ai_care_viewed',
  REFILL_REMINDER_SENT:  'refill_reminder_sent',
  WHATSAPP_SENT:         'whatsapp_sent',

  // Stock
  STOCK_ADJUSTED:        'stock_adjusted',
  PURCHASE_ORDER_CREATED: 'purchase_order_created',
  INVOICE_UPLOADED:      'invoice_uploaded',

  // Auth
  LOGIN:                 'login',
  LOGOUT:                'logout',
} as const;
