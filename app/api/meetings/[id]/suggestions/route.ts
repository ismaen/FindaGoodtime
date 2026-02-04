import { NextResponse } from 'next/server';
import { fetchFreeBusy } from '@/lib/calendar';
import { getMeeting, getMeetingParticipants, getCalendarConnectionByUserId } from '@/lib/db';
import { generateSlots, intersectIntervals, invertBusyToFree, type Interval } from '@/lib/scheduling';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const meeting = await getMeeting(context.params.id);
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  const participants = await getMeetingParticipants(context.params.id);
  const missing: string[] = [];
  const freeIntervalsPerUser: Interval[][] = [];
  const start = new Date(meeting.startRange);
  const end = new Date(meeting.endRange);

  for (const participant of participants) {
    if (!participant.user_id) {
      missing.push(participant.email);
      continue;
    }
    const connection = await getCalendarConnectionByUserId(participant.user_id);
    if (!connection) {
      missing.push(participant.email);
      continue;
    }

    const busy = await fetchFreeBusy(participant.user_id, meeting.startRange, meeting.endRange);
    if (!busy) {
      missing.push(participant.email);
      continue;
    }

    const busyIntervals = busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    const freeIntervals = invertBusyToFree(busyIntervals, start, end);
    freeIntervalsPerUser.push(freeIntervals);
  }

  if (missing.length > 0) {
    return NextResponse.json({ slots: [], missingParticipants: missing });
  }

  if (freeIntervalsPerUser.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  let intersection = freeIntervalsPerUser[0];
  for (let i = 1; i < freeIntervalsPerUser.length; i++) {
    intersection = intersectIntervals(intersection, freeIntervalsPerUser[i]);
  }

  const slots = generateSlots(intersection, meeting.durationMinutes, 30, {
    timezone: meeting.timezone,
    allowedDays: [5, 6], // Friday and Saturday only
  }).slice(0, 10);
  return NextResponse.json({
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString()
    }))
  });
}
