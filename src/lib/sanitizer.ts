/**
 * Text sanitiser function (Section 4.9)
 * Replaces U+2014 (em dash) and U+2013 (en dash) with " - ", collapses double spaces, trims.
 */
export function clean(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Checks if a string contains illegal em/en dashes
 */
export function containsDashes(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[\u2014\u2013]/.test(text);
}
