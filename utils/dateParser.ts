/**
 * Date Parser Utility for NyayaSutra
 * Handles Indian date formats and converts to standardized ISO format
 */

export interface ParsedDate {
  original: string;
  iso: string | null;
  display: string;
  confidence: 'high' | 'medium' | 'low';
  year?: number;
  month?: number;
  day?: number;
}

// Month name mappings (English and Hindi transliterations)
const MONTH_NAMES: Record<string, number> = {
  // English
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9, 'sept': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
  // Hindi transliterations
  'janvari': 1, 'janavarī': 1,
  'farvari': 2, 'farvarī': 2,
  'mārc': 3,
  'aprail': 4, 'aprel': 4,
  'mai': 5,
  'joon': 6, 'jūn': 6,
  'julai': 7, 'jūlāī': 7,
  'agast': 8, 'agust': 8,
  'sitambar': 9, 'sitamber': 9,
  'aktubar': 10, 'aktūbar': 10,
  'navambar': 11, 'navamber': 11,
  'disambar': 12, 'disamber': 12
};

// Ordinal suffixes
const ORDINAL_PATTERN = /(\d{1,2})(?:st|nd|rd|th)/gi;

/**
 * Parse date in DD/MM/YYYY or DD-MM-YYYY format (Indian standard)
 */
function parseDDMMYYYY(dateStr: string): ParsedDate | null {
  const pattern = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/;
  const match = dateStr.trim().match(pattern);

  if (!match) return null;

  let day = parseInt(match[1], 10);
  let month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);

  // Handle 2-digit year
  if (year < 100) {
    year = year > 50 ? 1900 + year : 2000 + year;
  }

  // Validate
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    original: dateStr,
    iso,
    display: formatDisplayDate(day, month, year),
    confidence: 'high',
    year,
    month,
    day
  };
}

/**
 * Parse date in YYYY-MM-DD format (ISO standard)
 */
function parseYYYYMMDD(dateStr: string): ParsedDate | null {
  const pattern = /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/;
  const match = dateStr.trim().match(pattern);

  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Validate
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return {
    original: dateStr,
    iso,
    display: formatDisplayDate(day, month, year),
    confidence: 'high',
    year,
    month,
    day
  };
}

/**
 * Parse date in "15th March 2024" or "March 15, 2024" format
 */
function parseWrittenDate(dateStr: string): ParsedDate | null {
  // Normalize ordinals
  let normalized = dateStr.replace(ORDINAL_PATTERN, '$1');

  // Pattern: "15 March 2024" or "15 March, 2024"
  const pattern1 = /(\d{1,2})\s+([a-zA-Z]+)[\s,]+(\d{4})/i;
  // Pattern: "March 15, 2024" or "March 15 2024"
  const pattern2 = /([a-zA-Z]+)\s+(\d{1,2})[\s,]+(\d{4})/i;
  // Pattern: "March 2024" (no day)
  const pattern3 = /([a-zA-Z]+)\s+(\d{4})/i;

  let match = normalized.match(pattern1);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const month = MONTH_NAMES[monthName];

    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        original: dateStr,
        iso,
        display: formatDisplayDate(day, month, year),
        confidence: 'high',
        year,
        month,
        day
      };
    }
  }

  match = normalized.match(pattern2);
  if (match) {
    const monthName = match[1].toLowerCase();
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const month = MONTH_NAMES[monthName];

    if (month && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        original: dateStr,
        iso,
        display: formatDisplayDate(day, month, year),
        confidence: 'high',
        year,
        month,
        day
      };
    }
  }

  match = normalized.match(pattern3);
  if (match) {
    const monthName = match[1].toLowerCase();
    const year = parseInt(match[2], 10);
    const month = MONTH_NAMES[monthName];

    if (month && year >= 1900 && year <= 2100) {
      const iso = `${year}-${String(month).padStart(2, '0')}-01`;
      return {
        original: dateStr,
        iso,
        display: `${Object.keys(MONTH_NAMES).find(k => MONTH_NAMES[k] === month && k.length > 3)?.replace(/^\w/, c => c.toUpperCase())} ${year}`,
        confidence: 'medium',
        year,
        month
      };
    }
  }

  return null;
}

/**
 * Parse year-only dates like "2024" or "in 2024"
 */
function parseYearOnly(dateStr: string): ParsedDate | null {
  const pattern = /\b(19|20)\d{2}\b/;
  const match = dateStr.match(pattern);

  if (!match) return null;

  const year = parseInt(match[0], 10);

  return {
    original: dateStr,
    iso: `${year}-01-01`,
    display: String(year),
    confidence: 'low',
    year
  };
}

/**
 * Parse relative dates like "yesterday", "last month", etc.
 */
function parseRelativeDate(dateStr: string, referenceDate: Date = new Date()): ParsedDate | null {
  const normalized = dateStr.toLowerCase().trim();

  const relativeMappings: Array<{ pattern: RegExp; calculate: (ref: Date) => Date; confidence: 'medium' | 'low' }> = [
    {
      pattern: /^today$/,
      calculate: (ref) => ref,
      confidence: 'medium'
    },
    {
      pattern: /^yesterday$/,
      calculate: (ref) => {
        const d = new Date(ref);
        d.setDate(d.getDate() - 1);
        return d;
      },
      confidence: 'medium'
    },
    {
      pattern: /^(\d+)\s*days?\s*ago$/,
      calculate: (ref) => {
        const match = normalized.match(/^(\d+)/);
        const days = match ? parseInt(match[1], 10) : 0;
        const d = new Date(ref);
        d.setDate(d.getDate() - days);
        return d;
      },
      confidence: 'medium'
    },
    {
      pattern: /^(\d+)\s*weeks?\s*ago$/,
      calculate: (ref) => {
        const match = normalized.match(/^(\d+)/);
        const weeks = match ? parseInt(match[1], 10) : 0;
        const d = new Date(ref);
        d.setDate(d.getDate() - (weeks * 7));
        return d;
      },
      confidence: 'low'
    },
    {
      pattern: /^(\d+)\s*months?\s*ago$/,
      calculate: (ref) => {
        const match = normalized.match(/^(\d+)/);
        const months = match ? parseInt(match[1], 10) : 0;
        const d = new Date(ref);
        d.setMonth(d.getMonth() - months);
        return d;
      },
      confidence: 'low'
    },
    {
      pattern: /^(\d+)\s*years?\s*ago$/,
      calculate: (ref) => {
        const match = normalized.match(/^(\d+)/);
        const years = match ? parseInt(match[1], 10) : 0;
        const d = new Date(ref);
        d.setFullYear(d.getFullYear() - years);
        return d;
      },
      confidence: 'low'
    },
    {
      pattern: /^last\s*week$/,
      calculate: (ref) => {
        const d = new Date(ref);
        d.setDate(d.getDate() - 7);
        return d;
      },
      confidence: 'low'
    },
    {
      pattern: /^last\s*month$/,
      calculate: (ref) => {
        const d = new Date(ref);
        d.setMonth(d.getMonth() - 1);
        return d;
      },
      confidence: 'low'
    },
    {
      pattern: /^last\s*year$/,
      calculate: (ref) => {
        const d = new Date(ref);
        d.setFullYear(d.getFullYear() - 1);
        return d;
      },
      confidence: 'low'
    }
  ];

  for (const { pattern, calculate, confidence } of relativeMappings) {
    if (pattern.test(normalized)) {
      const date = calculate(referenceDate);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      return {
        original: dateStr,
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        display: formatDisplayDate(day, month, year),
        confidence,
        year,
        month,
        day
      };
    }
  }

  return null;
}

/**
 * Parse Indian legal date formats commonly found in court documents
 * Examples: "dated 15.03.2024", "dt. 15/03/2024", "on 15-03-2024"
 */
function parseLegalDate(dateStr: string): ParsedDate | null {
  // Remove common prefixes
  const cleaned = dateStr
    .replace(/^(dated|dt\.?|on|the|of)\s*/i, '')
    .trim();

  // Try standard formats
  return parseDDMMYYYY(cleaned) || parseYYYYMMDD(cleaned) || parseWrittenDate(cleaned);
}

/**
 * Format date for display (Indian format)
 */
function formatDisplayDate(day: number, month: number, year: number): string {
  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return `${day} ${monthNames[month]} ${year}`;
}

/**
 * Main date parser function - tries all formats
 */
export function parseDate(dateStr: string, referenceDate?: Date): ParsedDate {
  if (!dateStr || dateStr.trim() === '') {
    return {
      original: dateStr || '',
      iso: null,
      display: 'Unknown date',
      confidence: 'low'
    };
  }

  const trimmed = dateStr.trim();

  // Try each parser in order of preference
  const parsers = [
    () => parseLegalDate(trimmed),
    () => parseDDMMYYYY(trimmed),
    () => parseYYYYMMDD(trimmed),
    () => parseWrittenDate(trimmed),
    () => parseRelativeDate(trimmed, referenceDate),
    () => parseYearOnly(trimmed)
  ];

  for (const parser of parsers) {
    const result = parser();
    if (result && result.iso) {
      return result;
    }
  }

  // Return original if no parsing succeeded
  return {
    original: trimmed,
    iso: null,
    display: trimmed,
    confidence: 'low'
  };
}

/**
 * Extract and parse all dates from a text string
 */
export function extractDatesFromText(text: string): ParsedDate[] {
  const dates: ParsedDate[] = [];
  const seen = new Set<string>();

  // Patterns to match date-like strings
  const patterns = [
    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g,
    // YYYY-MM-DD
    /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/g,
    // "15th March 2024", "15 March 2024"
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)[\s,]+\d{4}\b/gi,
    // "March 15, 2024", "March 2024"
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}[\s,]+\d{4}\b/gi,
    // "dated 15.03.2024", "dt. 15/03/2024"
    /(?:dated|dt\.?)\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/gi
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      if (!seen.has(match.toLowerCase())) {
        seen.add(match.toLowerCase());
        const parsed = parseDate(match);
        if (parsed.iso) {
          dates.push(parsed);
        }
      }
    }
  }

  // Sort by ISO date
  dates.sort((a, b) => {
    if (!a.iso && !b.iso) return 0;
    if (!a.iso) return 1;
    if (!b.iso) return -1;
    return a.iso.localeCompare(b.iso);
  });

  return dates;
}

/**
 * Compare two dates for sorting
 */
export function compareDates(a: ParsedDate | string, b: ParsedDate | string): number {
  const dateA = typeof a === 'string' ? parseDate(a) : a;
  const dateB = typeof b === 'string' ? parseDate(b) : b;

  if (!dateA.iso && !dateB.iso) return 0;
  if (!dateA.iso) return 1;
  if (!dateB.iso) return -1;

  return dateA.iso.localeCompare(dateB.iso);
}

/**
 * Format date for chronology display
 */
export function formatForChronology(dateStr: string): string {
  const parsed = parseDate(dateStr);

  if (parsed.confidence === 'high') {
    return parsed.display;
  } else if (parsed.confidence === 'medium') {
    return `~${parsed.display}`;
  } else {
    return parsed.original || 'Date unknown';
  }
}

/**
 * Check if a string contains a parseable date
 */
export function containsDate(text: string): boolean {
  const parsed = parseDate(text);
  return parsed.iso !== null && parsed.confidence !== 'low';
}

/**
 * Get sortable key for a date string
 */
export function getSortKey(dateStr: string): string {
  const parsed = parseDate(dateStr);
  // Return ISO date or a far future date for unknown dates
  return parsed.iso || '9999-12-31';
}
