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

// Specific time slots: Friday 5pm, Saturday 10am, Saturday 5pm
const ALLOWED_SLOTS = [
  { dayOfWeek: 5, hour: 17 }, // Friday 5pm
  { dayOfWeek: 6, hour: 10 }, // Saturday 10am
  { dayOfWeek: 6, hour: 17 }, // Saturday 5pm
];

export function generateSlots(
  freeIntervals: Interval[],
  durationMinutes: number,
  _stepMinutes = 30,
  options?: { timezone?: string }
) {
  const timezone = options?.timezone ?? 'America/Los_Angeles';
  const durationMs = durationMinutes * 60 * 1000;
  const slots: { start: Date; end: Date }[] = [];
  
  // Generate all possible slots for the date range
  if (freeIntervals.length === 0) return slots;
  
  // Find the overall date range from free intervals
  const minDate = new Date(Math.min(...freeIntervals.map(i => i.start.getTime())));
  const maxDate = new Date(Math.max(...freeIntervals.map(i => i.end.getTime())));
  
  // Iterate through each day in the range
  const cursor = new Date(minDate);
  cursor.setHours(0, 0, 0, 0);
  
  while (cursor <= maxDate) {
    const dayOfWeek = getDayOfWeekInTimezone(cursor, timezone);
    
    // Check each allowed slot for this day
    for (const slotDef of ALLOWED_SLOTS) {
      if (dayOfWeek === slotDef.dayOfWeek) {
        // Create the slot time in the target timezone
        const slotStart = createDateInTimezone(cursor, slotDef.hour, 0, timezone);
        const slotEnd = new Date(slotStart.getTime() + durationMs);
        
        // Check if this slot falls within any free interval
        const isAvailable = freeIntervals.some(interval => 
          slotStart >= interval.start && slotEnd <= interval.end
        );
        
        if (isAvailable) {
          slots.push({ start: slotStart, end: slotEnd });
        }
      }
    }
    
    // Move to next day
    cursor.setDate(cursor.getDate() + 1);
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

// Helper to create a date at a specific hour in a timezone
function createDateInTimezone(baseDate: Date, hour: number, minute: number, timezone: string): Date {
  // Get the date parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  });
  const parts = formatter.format(baseDate).split('/');
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  
  // Create a reference date at noon UTC on this day to get the timezone offset
  const refDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMinutes = getTimezoneOffset(refDate, timezone);
  
  // Create the local time we want, then convert to UTC
  // offsetMinutes is positive for timezones behind UTC (like Pacific)
  // So if we want 5pm Pacific (UTC-8), offset is 480 minutes
  // UTC time = local time + offset = 17:00 + 8:00 = 25:00 = 01:00 next day
  const localTimeMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const utcTimeMs = localTimeMs + (offsetMinutes * 60 * 1000);
  
  return new Date(utcTimeMs);
}

// Get timezone offset in minutes for a given date and timezone
// Returns positive for timezones behind UTC (e.g., Pacific = +480)
function getTimezoneOffset(date: Date, timezone: string): number {
  const utcString = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzString = date.toLocaleString('en-US', { timeZone: timezone });
  
  const utcDate = new Date(utcString);
  const tzDate = new Date(tzString);
  
  return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
}
