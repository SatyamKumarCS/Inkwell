const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Edited just now" / "Edited 5 min ago" / "Edited 3 h ago" / "Edited yesterday" / "Edited 12 Nov". */
export function editedLabel(editedMs: number, nowMs: number): string {
  const ago = nowMs - editedMs;
  if (ago < MINUTE) return 'Edited just now';
  if (ago < HOUR) return `Edited ${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) return `Edited ${Math.floor(ago / HOUR)} h ago`;
  if (ago < 2 * DAY) return 'Edited yesterday';
  const date = new Date(editedMs);
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `Edited ${date.getDate()} ${month}`;
}

/** Case-insensitive title match for the in-memory search. */
export function matchesQuery(title: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || title.toLowerCase().includes(q);
}
