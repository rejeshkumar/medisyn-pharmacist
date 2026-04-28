/**
 * MediSyn — GS1 Barcode Parser
 * ================================
 * Parses GS1 DataMatrix and EAN-13 barcodes from Indian medicine boxes.
 *
 * GS1 Application Identifiers used in Indian pharma:
 *   (01) = GTIN-14 (14 digits)
 *   (10) = Batch / Lot number
 *   (17) = Expiry date (YYMMDD)
 *   (21) = Serial number
 *
 * Example GS1 DataMatrix string:
 *   010189012345678910LOT12345A1728023121ABC123
 *
 * Place this file at:
 *   apps/web/src/lib/gs1-parser.ts
 */

export interface GS1ParseResult {
  type: 'GS1_DATAMATRIX' | 'EAN13' | 'EAN8' | 'UNKNOWN';
  raw: string;
  gtin?: string;           // 14-digit GTIN
  gtin13?: string;         // 13-digit EAN (GTIN without leading zero)
  batch_number?: string;   // Lot / batch number
  expiry_date?: string;    // ISO format YYYY-MM-DD
  expiry_display?: string; // Human readable e.g. "Jan 2028"
  serial_number?: string;  // Serial number
  is_expired?: boolean;
  days_to_expiry?: number;
}

/**
 * Parse any medicine barcode — auto-detects GS1 DataMatrix or EAN-13
 */
export function parseBarcode(raw: string): GS1ParseResult {
  const s = raw.trim();

  if (!s) return { type: 'UNKNOWN', raw: s };

  // ── GS1 DataMatrix detection ──────────────────────────────────────────────
  // GS1 DataMatrix strings start with (01) or AI prefix patterns
  // Also detect raw AI format without parentheses: 01XXXXXX10YYYY17ZZZZ
  if (isGS1DataMatrix(s)) {
    return parseGS1DataMatrix(s);
  }

  // ── EAN-13 (13 digits) ────────────────────────────────────────────────────
  if (/^\d{13}$/.test(s)) {
    return {
      type:    'EAN13',
      raw:     s,
      gtin13:  s,
      gtin:    '0' + s, // Pad to GTIN-14
    };
  }

  // ── EAN-8 (8 digits) ─────────────────────────────────────────────────────
  if (/^\d{8}$/.test(s)) {
    return { type: 'EAN8', raw: s, gtin13: s };
  }

  // ── GTIN-14 (14 digits) ───────────────────────────────────────────────────
  if (/^\d{14}$/.test(s)) {
    return {
      type:   'EAN13',
      raw:    s,
      gtin:   s,
      gtin13: s.substring(1), // Remove leading zero
    };
  }

  return { type: 'UNKNOWN', raw: s };
}

/**
 * Detect if string is a GS1 DataMatrix format
 */
function isGS1DataMatrix(s: string): boolean {
  // Format with parentheses: (01)XXXXXX(10)YYYY
  if (s.startsWith('(01)') || s.startsWith('(00)')) return true;

  // Raw GS1 format without parentheses — starts with AI 01 followed by 14 digits
  if (/^01\d{14}/.test(s)) return true;

  // Contains multiple AIs — heuristic: length > 20 and contains digits + letters
  if (s.length > 20 && /\d{14}/.test(s)) return true;

  return false;
}

/**
 * Parse GS1 DataMatrix string and extract all Application Identifiers
 */
function parseGS1DataMatrix(raw: string): GS1ParseResult {
  const result: GS1ParseResult = { type: 'GS1_DATAMATRIX', raw };

  let s = raw;

  // Normalise — remove parentheses format to raw AI format
  // Convert "(01)12345678901234(10)BATCH(17)280201" to "0112345678901234 10BATCH 17280201"
  if (s.includes('(')) {
    s = s.replace(/\((\d{2,4})\)/g, '$1');
  }

  // Parse Application Identifiers
  let pos = 0;
  while (pos < s.length) {
    // Try 2-digit AI first, then 3-digit, then 4-digit
    const ai2 = s.substring(pos, pos + 2);
    const ai3 = s.substring(pos, pos + 3);
    const ai4 = s.substring(pos, pos + 4);

    if (ai2 === '01') {
      // GTIN-14 — fixed 14 digits after AI
      const gtin = s.substring(pos + 2, pos + 16);
      if (/^\d{14}$/.test(gtin)) {
        result.gtin   = gtin;
        result.gtin13 = gtin.startsWith('0') ? gtin.substring(1) : gtin;
        pos += 16;
        continue;
      }
    }

    if (ai2 === '10') {
      // Batch/Lot — variable length, terminated by FNC1 or next AI
      pos += 2;
      const batch = extractVariableField(s, pos, 20);
      result.batch_number = batch.value.trim();
      pos += batch.length;
      continue;
    }

    if (ai2 === '17') {
      // Expiry date — fixed 6 digits YYMMDD
      const expRaw = s.substring(pos + 2, pos + 8);
      if (/^\d{6}$/.test(expRaw)) {
        result.expiry_date    = parseGS1Date(expRaw);
        result.expiry_display = formatExpiryDisplay(expRaw);
        const exp = new Date(result.expiry_date);
        const now = new Date();
        result.is_expired      = exp < now;
        result.days_to_expiry  = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        pos += 8;
        continue;
      }
    }

    if (ai2 === '21') {
      // Serial number — variable length
      pos += 2;
      const serial = extractVariableField(s, pos, 20);
      result.serial_number = serial.value.trim();
      pos += serial.length;
      continue;
    }

    if (ai2 === '00') {
      // SSCC — skip 18 digits
      pos += 20;
      continue;
    }

    if (ai3 === '310' || ai3 === '320') {
      // Net weight — skip 6 digits
      pos += 9;
      continue;
    }

    if (ai4 === '3102' || ai4 === '3202') {
      pos += 10;
      continue;
    }

    // Unknown AI — skip one character and try again
    pos++;
  }

  return result;
}

/**
 * Extract a variable-length field — reads until next AI pattern or end
 */
function extractVariableField(s: string, pos: number, maxLen: number): { value: string; length: number } {
  let end = pos;
  const limit = Math.min(pos + maxLen, s.length);

  while (end < limit) {
    // Check if next 2 chars look like an AI (digits followed by more structure)
    const next2 = s.substring(end, end + 2);
    if (/^\d{2}$/.test(next2) && end > pos) {
      // Possible AI boundary — check if it's a known AI
      if (['01','10','17','21','00','11','13','15'].includes(next2)) {
        break;
      }
    }
    end++;
  }

  return {
    value:  s.substring(pos, end),
    length: end - pos,
  };
}

/**
 * Parse GS1 date format YYMMDD → ISO YYYY-MM-DD
 * GS1 rule: if DD = 00, use last day of month
 */
function parseGS1Date(yymmdd: string): string {
  const yy = parseInt(yymmdd.substring(0, 2));
  const mm = parseInt(yymmdd.substring(2, 4));
  const dd = parseInt(yymmdd.substring(4, 6));

  // GS1 year threshold: 51+ = 1900s, 00-50 = 2000s
  const yyyy = yy <= 50 ? 2000 + yy : 1900 + yy;

  // If DD = 00, use last day of month
  const lastDay = dd === 0 ? new Date(yyyy, mm, 0).getDate() : dd;

  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Format expiry for display e.g. "Jan 2028"
 */
function formatExpiryDisplay(yymmdd: string): string {
  const iso = parseGS1Date(yymmdd);
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/**
 * Check if a barcode string contains batch information
 */
export function hasBatchInfo(parsed: GS1ParseResult): boolean {
  return parsed.type === 'GS1_DATAMATRIX' && !!parsed.batch_number;
}

/**
 * Get a summary string for display
 */
export function barcodeToString(parsed: GS1ParseResult): string {
  const parts: string[] = [];
  if (parsed.gtin13) parts.push(`GTIN: ${parsed.gtin13}`);
  if (parsed.batch_number) parts.push(`Batch: ${parsed.batch_number}`);
  if (parsed.expiry_display) parts.push(`Exp: ${parsed.expiry_display}`);
  return parts.join(' | ');
}
