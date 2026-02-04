export type Interval = { start: Date; end: Date };

export function normalizeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  for (const interval of sorted) {
    if (!merged.length) {
      merged.push(interval);
      continue;
    }
    const last = merged[merged.length - 1];
    if (interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

export function invertBusyToFree(busy: Interval[], start: Date, end: Date): Interval[] {
  const mergedBusy = normalizeIntervals(busy);
  const free: Interval[] = [];
  let cursor = start;

  for (const interval of mergedBusy) {
    if (interval.end <= cursor) continue;
    if (interval.start > cursor) {
      free.push({ start: new Date(cursor), end: new Date(interval.start) });
    }
    cursor = interval.end > cursor ? interval.end : cursor;
  }

  if (cursor < end) {
    free.push({ start: new Date(cursor), end: new Date(end) });
  }
  return free;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  const left = normalizeIntervals(a);
  const right = normalizeIntervals(b);

  while (i < left.length && j < right.length) {
    const start = left[i].start > right[j].start ? left[i].start : right[j].start;
    const end = left[i].end < right[j].end ? left[i].end : right[j].end;
    if (start < end) result.push({ start: new Date(start), end: new Date(end) });
    if (left[i].end < right[j].end) i++;
    else j++;
  }

  return result;
}

export function generateSlots(
  intervals: Interval[],
  durationMinutes: number,
  stepMinutes = 30,
  options?: { timezone?: string; allowedDays?: number[] }
) {
  const slots: { start: Date; end: Date }[] = [];
  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = stepMinutes * 60 * 1000;
  
  // Default to Friday (5) and Saturday (6) only
  const allowedDays = options?.allowedDays ?? [5, 6];
  const timezone = options?.timezone ?? 'America/Los_Angeles';

  for (const interval of intervals) {
    let cursor = interval.start.getTime();
    const end = interval.end.getTime();
    while (cursor + durationMs <= end) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor + durationMs);
      
      // Get the day of week in the specified timezone
      const dayOfWeek = getDayOfWeekInTimezone(slotStart, timezone);
      
      // Only include slots on allowed days (Friday = 5, Saturday = 6)
      if (allowedDays.includes(dayOfWeek)) {
        slots.push({ start: slotStart, end: slotEnd });
      }
      
      cursor += stepMs;
    }
  }
  return slots;
}

// Helper to get day of week in a specific timezone
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  });
  const dayStr = formatter.format(date);
  const dayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  return dayMap[dayStr] ?? 0;
}
