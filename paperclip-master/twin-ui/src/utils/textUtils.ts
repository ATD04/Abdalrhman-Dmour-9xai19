/**
 * Extract a clean executive snippet from a Markdown issue description.
 * Strips headers, tables, and links; returns first meaningful sentence (≤140 chars).
 */
export function extractSnippet(description?: string | null): string | undefined {
  if (!description) return undefined;

  // 1. Try "Situation Summary" section first
  const situationMatch = description.match(/## Situation Summary\s*\n+([^#\n][^\n]{20,})/);
  if (situationMatch) return clean(situationMatch[1]);

  // 2. Try "Context" section
  const contextMatch = description.match(/## Context\s*\n+([^#\n][^\n]{20,})/);
  if (contextMatch) return clean(contextMatch[1]);

  // 3. Try "Your Task" section
  const taskMatch = description.match(/## (?:Your Task|Task)\s*\n+([^#\n][^\n]{20,})/);
  if (taskMatch) return clean(taskMatch[1]);

  // 4. Fall back to first meaningful non-header, non-table line
  for (const line of description.split('\n')) {
    const stripped = cleanLine(line);
    if (stripped.length > 30) return stripped.slice(0, 140);
  }

  return undefined;
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')               // strip headers
    .replace(/\*+([^*]+)\*+/g, '$1')          // strip bold/italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // strip links → text
    .replace(/`[^`]+`/g, '')                  // strip code
    .replace(/^\s*[-*]\s+/, '')               // strip list bullets
    .replace(/^\|.*\|.*$/, '')               // strip table rows
    .trim();
}

function clean(text: string): string {
  return cleanLine(text).slice(0, 140);
}

/**
 * Format a date relative to now in short executive form:
 * "Today", "Yesterday", "Mon 14 Apr", etc.
 */
export function relativeDate(dateStr: string, isAr = false): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return isAr ? 'اليوم' : 'Today';
  if (diffDays === 1) return isAr ? 'أمس' : 'Yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' });
}
