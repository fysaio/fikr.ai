/**
 * Parses a relative or natural language due_text anchored to createdAt.
 * Returns ISO string if parsed, or null if cannot be reliably parsed.
 */
export function parseDueText(dueText: string | null, createdAtIso: string): string | null {
  if (!dueText || typeof dueText !== 'string') return null;

  const text = dueText.trim().toLowerCase();
  if (!text) return null;

  const baseDate = new Date(createdAtIso);
  if (isNaN(baseDate.getTime())) return null;

  // 1. "in X (days|weeks|months|hours)"
  const inMatch = text.match(/in\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|days|week|weeks|month|months|hour|hours)/i);
  if (inMatch) {
    const wordToNum: Record<string, number> = {
      a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    const num = wordToNum[inMatch[1].toLowerCase()] ?? parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    const d = new Date(baseDate);

    if (unit.startsWith('hour')) {
      d.setHours(d.getHours() + num);
    } else if (unit.startsWith('day')) {
      d.setDate(d.getDate() + num);
    } else if (unit.startsWith('week')) {
      d.setDate(d.getDate() + num * 7);
    } else if (unit.startsWith('month')) {
      d.setMonth(d.getMonth() + num);
    }
    return d.toISOString();
  }

  // 2. "tomorrow" / "day after tomorrow"
  if (text.includes('day after tomorrow')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 2);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }
  if (text.includes('tomorrow')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  // 3. "by tonight" / "tonight"
  if (text.includes('tonight')) {
    const d = new Date(baseDate);
    d.setHours(21, 0, 0, 0);
    return d.toISOString();
  }

  // 4. Days of week: (by|on|next) monday...sunday
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    const dayName = days[i];
    if (text.includes(dayName)) {
      const currentDay = baseDate.getDay();
      let diff = i - currentDay;
      if (text.includes('next ' + dayName) || diff <= 0) {
        diff += 7;
      }
      const d = new Date(baseDate);
      d.setDate(d.getDate() + diff);
      d.setHours(17, 0, 0, 0);
      return d.toISOString();
    }
  }

  // 5. "next week" / "end of the week" / "this weekend"
  if (text.includes('next week')) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }
  if (text.includes('end of the week') || text.includes('by the weekend') || text.includes('this weekend')) {
    const currentDay = baseDate.getDay();
    const diff = (5 - currentDay + 7) % 7 || 7; // Friday
    const d = new Date(baseDate);
    d.setDate(d.getDate() + diff);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  // 6. Direct ISO or standard parse
  const parsed = Date.parse(text);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return null;
}

/**
 * Formats a due date relative to today for display (e.g., "in 3 days", "tomorrow", "due Monday").
 */
export function formatRelativeDue(dueAt: string | null, dueText: string | null): string | null {
  if (!dueAt) return dueText || null;
  const target = new Date(dueAt);
  if (isNaN(target.getTime())) return dueText || null;

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return `${Math.abs(diffDays)}d overdue`;
  }
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'tomorrow';
  }
  if (diffDays <= 6) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `by ${days[target.getDay()]}`;
  }
  if (diffDays <= 30) {
    const weeks = Math.round(diffDays / 7);
    return `in ${weeks}w`;
  }

  return dueText || target.toLocaleDateString();
}
