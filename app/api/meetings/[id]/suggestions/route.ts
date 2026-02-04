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
    console.log(`[Suggestions] Checking participant: ${participant.email}, user_id: ${participant.user_id}, status: ${participant.status}`);
    
    if (!participant.user_id) {
      console.log(`[Suggestions] ${participant.email} has no user_id, adding to missing`);
      missing.push(participant.email);
      continue;
    }
    
    const connection = await getCalendarConnectionByUserId(participant.user_id);
    console.log(`[Suggestions] ${participant.email} calendar connection:`, connection ? 'EXISTS' : 'NONE');
    
    if (!connection) {
      console.log(`[Suggestions] ${participant.email} has no calendar connection, adding to missing`);
      missing.push(participant.email);
      continue;
    }

    const busy = await fetchFreeBusy(participant.user_id, meeting.startRange, meeting.endRange);
    console.log(`[Suggestions] Participant ${participant.email} busy times:`, busy);
    
    if (!busy) {
      console.log(`[Suggestions] No busy data for ${participant.email}, adding to missing`);
      missing.push(participant.email);
      continue;
    }

    const busyIntervals = busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    console.log(`[Suggestions] ${participant.email} has ${busyIntervals.length} busy intervals`);
    
    const freeIntervals = invertBusyToFree(busyIntervals, start, end);
    console.log(`[Suggestions] ${participant.email} has ${freeIntervals.length} free intervals`);
    
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
  }).slice(0, 10);
  return NextResponse.json({
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString()
    }))
  });
}
