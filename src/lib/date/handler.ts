import { DuePrecision } from '@/lib/models/schema';

export interface ParsedDateResult {
  due_at: string | null; // ISO YYYY-MM-DD or full timestamp
  due_precision: DuePrecision;
  since_text?: string | null;
}

/**
 * Parses natural language and relative date expressions (Section 4.7).
 * Anchored to the provided reference date (defaults to current date in timezone).
 */
export function parseDateExpression(
  text: string | null | undefined,
  referenceDateInput: Date | string = new Date(),
  timezone = 'Africa/Lagos'
): ParsedDateResult {
  if (!text) {
    return { due_at: null, due_precision: null };
  }

  const raw = text.trim().toLowerCase();
  const base = typeof referenceDateInput === 'string'
    ? new Date(referenceDateInput)
    : new Date(referenceDateInput.getTime());

  // Helper to format YYYY-MM-DD in UTC/target
  const formatDateOnly = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Rule: past expressions go to since_text (e.g. "since last week", "since Monday")
  if (raw.startsWith('since ') || raw.includes('since last')) {
    return {
      due_at: null,
      due_precision: null,
      since_text: text.trim(),
    };
  }

  // 1. "friday week" (the Friday after next / a week on Friday)
  if (raw.includes('friday week')) {
    const dayOfWeek = base.getDay(); // 0 is Sunday, 2 is Tuesday, 5 is Friday
    const daysUntilNextFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const target = new Date(base);
    target.setDate(base.getDate() + daysUntilNextFriday + 7);
    return {
      due_at: formatDateOnly(target),
      due_precision: 'exact',
    };
  }

  // 2. "tomorrow"
  if (raw.includes('tomorrow')) {
    const target = new Date(base);
    target.setDate(base.getDate() + 1);
    return {
      due_at: formatDateOnly(target),
      due_precision: 'exact',
    };
  }

  // 3. "by monday", "on monday", or bare "monday" / days of week
  const daysMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const [dayName, dayIndex] of Object.entries(daysMap)) {
    // Check if day name is present
    const regex = new RegExp(`\\b(by\\s+|on\\s+|this\\s+)?${dayName}\\b`, 'i');
    if (regex.test(raw)) {
      const currentDay = base.getDay();
      let diff = dayIndex - currentDay;
      if (diff <= 0) diff += 7; // Nearest coming day
      const target = new Date(base);
      target.setDate(base.getDate() + diff);
      return {
        due_at: formatDateOnly(target),
        due_precision: 'exact',
      };
    }
  }

  // 4. "in X (days|weeks|months)"
  const inWeeksMatch = raw.match(/in\s+(\d+|one|two|three|four)\s+weeks?/i);
  if (inWeeksMatch) {
    const wordNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
    const weeks = wordNum[inWeeksMatch[1].toLowerCase()] ?? parseInt(inWeeksMatch[1], 10);
    const target = new Date(base);
    target.setDate(base.getDate() + weeks * 7);
    return {
      due_at: formatDateOnly(target),
      due_precision: 'approx',
    };
  }

  const inDaysMatch = raw.match(/in\s+(\d+)\s+days?/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const target = new Date(base);
    target.setDate(base.getDate() + days);
    return {
      due_at: formatDateOnly(target),
      due_precision: 'exact',
    };
  }

  // 5. "end of the month" / "end of month"
  if (raw.includes('end of the month') || raw.includes('end of month')) {
    const target = new Date(base.getFullYear(), base.getMonth() + 1, 0); // Last day of month
    return {
      due_at: formatDateOnly(target),
      due_precision: 'approx',
    };
  }

  // 6. "next week"
  if (raw.includes('next week')) {
    // Week of next Monday
    const currentDay = base.getDay();
    let diffToNextMonday = 1 - currentDay;
    if (diffToNextMonday <= 0) diffToNextMonday += 7;
    const target = new Date(base);
    target.setDate(base.getDate() + diffToNextMonday);
    return {
      due_at: formatDateOnly(target),
      due_precision: 'approx',
    };
  }

  // 7. Explicit ISO or standard date string
  const timestamp = Date.parse(raw);
  if (!isNaN(timestamp)) {
    const parsed = new Date(timestamp);
    return {
      due_at: formatDateOnly(parsed),
      due_precision: 'exact',
    };
  }

  // Unsure -> null. Never guess.
  return {
    due_at: null,
    due_precision: null,
  };
}

/**
 * Formats due date relative to today (e.g. "in 10 days", "Fri 16 Oct", "around Oct 31")
 */
export function formatRelativeDueDate(
  dueAt: string | null | undefined,
  dueText: string | null | undefined,
  precision?: DuePrecision,
  referenceDateInput: Date | string = new Date()
): string {
  if (!dueAt) return dueText || '';

  const target = new Date(dueAt + 'T00:00:00');
  const base = typeof referenceDateInput === 'string'
    ? new Date(referenceDateInput + 'T00:00:00')
    : new Date(referenceDateInput.getFullYear(), referenceDateInput.getMonth(), referenceDateInput.getDate());

  if (isNaN(target.getTime())) return dueText || '';

  const diffMs = target.getTime() - base.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const formattedAbs = target.toLocaleDateString('en-GB', options);

  const prefix = precision === 'approx' ? 'around ' : '';

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays > 1 && diffDays <= 14) {
    return `${prefix}${formattedAbs} (${diffDays} days)`;
  }
  if (diffDays > 14) {
    return `${prefix}${formattedAbs}`;
  }
  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`;
  }

  return `${prefix}${formattedAbs}`;
}
