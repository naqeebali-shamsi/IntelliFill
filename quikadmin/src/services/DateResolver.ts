/**
 * Date Format Disambiguation Service
 *
 * Resolves ambiguous dates (e.g., 01/02/1990 could be Jan 2 or Feb 1)
 * using document category as a locale hint. UAE documents use DD/MM/YYYY,
 * US documents use MM/DD/YYYY.
 */

export interface ResolvedDate {
  /** ISO 8601 format: YYYY-MM-DD */
  iso: string;
  /** Display format based on source locale */
  display: string;
  /** Confidence in the disambiguation (0-100) */
  confidence: number;
  /** Which format was assumed */
  assumedFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'unambiguous';
}

/** Categories that use DD/MM/YYYY (Middle East, Europe, Asia) */
const DD_MM_CATEGORIES = [
  'PASSPORT',
  'EMIRATES_ID',
  'TRADE_LICENSE',
  'VISA',
  'LABOR_CARD',
  'ESTABLISHMENT_CARD',
];

/** Categories that might use MM/DD/YYYY (US documents) */
const MM_DD_CATEGORIES: string[] = [];

export function resolveDate(rawDate: string, category: string | null): ResolvedDate | null {
  if (!rawDate) return null;

  // Already ISO format — validate components
  const isoMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, yStr, mStr, dStr] = isoMatch;
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const check = new Date(y, m - 1, d);
    if (check.getDate() !== d || check.getMonth() !== m - 1) return null;
    return {
      iso: rawDate,
      display: rawDate,
      confidence: 100,
      assumedFormat: 'YYYY-MM-DD',
    };
  }

  // Parse DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = rawDate.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!slashMatch) return null;

  const [, a, b, yearStr] = slashMatch;
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  // Pivot-year heuristic for two-digit years: values > current short year + 10 assumed 1900s
  let year: number;
  if (yearStr.length === 2) {
    const shortYear = parseInt(yearStr, 10);
    const currentShortYear = new Date().getFullYear() % 100;
    year = shortYear > currentShortYear + 10 ? 1900 + shortYear : 2000 + shortYear;
  } else {
    year = parseInt(yearStr, 10);
  }

  // Unambiguous: one part > 12
  if (numA > 12 && numB <= 12) {
    // Must be DD/MM
    return makeResult(numA, numB, year, 'unambiguous', 98);
  }
  if (numB > 12 && numA <= 12) {
    // Must be MM/DD
    return makeResult(numB, numA, year, 'unambiguous', 98);
  }

  // Both <= 12: use category-based locale
  const isDDMM = category && DD_MM_CATEGORIES.includes(category);
  const isMMDD = category && MM_DD_CATEGORIES.includes(category);

  if (isDDMM) {
    return makeResult(numA, numB, year, 'DD/MM/YYYY', 85);
  }
  if (isMMDD) {
    return makeResult(numB, numA, year, 'MM/DD/YYYY', 85);
  }

  // Default: DD/MM/YYYY (UAE-centric product)
  return makeResult(numA, numB, year, 'DD/MM/YYYY', 65);
}

function makeResult(
  day: number,
  month: number,
  year: number,
  format: ResolvedDate['assumedFormat'],
  confidence: number
): ResolvedDate | null {
  // Validate date
  const date = new Date(year, month - 1, day);
  if (date.getDate() !== day || date.getMonth() !== month - 1) {
    // Invalid date - try swapping
    const swapped = new Date(year, day - 1, month);
    if (swapped.getDate() === month && swapped.getMonth() === day - 1) {
      return {
        iso: `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`,
        display: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`,
        confidence: Math.max(confidence - 20, 40),
        assumedFormat: format,
      };
    }
    return null; // Truly invalid date
  }

  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    display: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
    confidence,
    assumedFormat: format,
  };
}
