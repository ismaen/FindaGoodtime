import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getMeeting, upsertUser, linkParticipantByEmail } from '@/lib/db';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const meeting = await getMeeting(context.params.id);
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }
  return NextResponse.json({ meeting });
}

// POST: Link the authenticated user to this meeting if they're a participant
export async function POST(_request: Request, context: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const meeting = await getMeeting(context.params.id);
  if (!meeting) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  // Check if user's email is in the participant list
  const isParticipant = meeting.participants.some(
    (p: { email: string }) => p.email.toLowerCase() === session.user!.email!.toLowerCase()
  );

  if (!isParticipant) {
    return NextResponse.json({ error: 'Not a participant of this meeting' }, { status: 403 });
  }

  // Link the participant
  console.log(`[Meeting] Linking participant ${session.user.email} to meeting ${context.params.id}`);
  const userId = await upsertUser(session.user.email, session.user.name);
  console.log(`[Meeting] User ID for ${session.user.email}: ${userId}`);
  await linkParticipantByEmail(session.user.email, userId);
  console.log(`[Meeting] Successfully linked ${session.user.email}`);

  return NextResponse.json({ success: true, userId });
}
