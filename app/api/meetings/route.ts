import { NextResponse } from 'next/server';
import { createMeeting } from '@/lib/db';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, durationMinutes, startRange, endRange, timezone, participantEmails } = body;
  if (!title || !durationMinutes || !startRange || !endRange || !timezone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (new Date(startRange) >= new Date(endRange)) {
    return NextResponse.json({ error: 'Start range must be before end range' }, { status: 400 });
  }

  const emails = Array.isArray(participantEmails) ? participantEmails : [];

  try {
    const meetingId = await createMeeting({
      organizerUserId: null,
      title,
      durationMinutes: Number(durationMinutes),
      startRange,
      endRange,
      timezone,
      participantEmails: emails
    });

    return NextResponse.json({ meetingId });
  } catch (err) {
    console.error('Failed to create meeting:', err);
    return NextResponse.json(
      { error: 'Failed to create meeting. Please try again.' },
      { status: 500 }
    );
  }
}
