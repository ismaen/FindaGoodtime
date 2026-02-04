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
  
  // Create a date string and parse it as if in the target timezone
  // This is a simplification - we create the date and adjust for timezone offset
  const targetDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  
  // Get timezone offset for this date in the target timezone
  const utcDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(targetDate.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();
  
  return new Date(targetDate.getTime() + offset);
}
