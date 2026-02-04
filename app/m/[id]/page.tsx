'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { signIn, signOut, useSession } from 'next-auth/react';

type Meeting = {
  id: string;
  title: string;
  durationMinutes: number;
  startRange: string;
  endRange: string;
  timezone: string;
  participants: { email: string; status: string }[];
};

type Slot = {
  start: string;
  end: string;
};

function formatSlot(startIso: string, endIso: string, timezone: string): string {
  const startDate = new Date(startIso);
  const endDate = new Date(endIso);
  
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  };
  
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    hour12: true,
    timeZone: timezone,
  };
  
  const dateStr = startDate.toLocaleString('en-US', dateOptions);
  const startTime = startDate.toLocaleString('en-US', timeOptions).toLowerCase();
  const endTime = endDate.toLocaleString('en-US', timeOptions).toLowerCase();
  
  return `${dateStr}, ${startTime} - ${endTime} PT`;
}

export default function MeetingPage() {
  const params = useParams();
  const meetingId = params?.id as string;
  const { data: session } = useSession();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (res.ok) {
        const data = await res.json();
        setMeeting(data.meeting);
      }
    }
    if (meetingId) load();
  }, [meetingId]);

  // Link the authenticated user to this meeting if they're a participant
  useEffect(() => {
    async function linkParticipant() {
      if (!session?.user?.email || !meeting) return;
      
      // Check if user is a participant
      const isParticipant = meeting.participants.some(
        (p) => p.email.toLowerCase() === session.user!.email!.toLowerCase()
      );
      
      if (isParticipant) {
        // Call the API to link the participant
        await fetch(`/api/meetings/${meetingId}`, { method: 'POST' });
        // Reload meeting data to get updated status
        const res = await fetch(`/api/meetings/${meetingId}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data.meeting);
        }
      }
    }
    linkParticipant();
  }, [session, meeting?.id, meetingId]);

  async function fetchSuggestions() {
    setLoading(true);
    setError('');
    try {
      // Refresh meeting data first to get latest participant statuses
      const meetingRes = await fetch(`/api/meetings/${meetingId}`);
      if (meetingRes.ok) {
        const meetingData = await meetingRes.json();
        setMeeting(meetingData.meeting);
      }

      // Then fetch suggestions with fresh data
      const res = await fetch(`/api/meetings/${meetingId}/suggestions`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch suggestions');
      }
      const data = await res.json();
      setSlots(data.slots || []);
      setMissing(data.missingParticipants || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h1>{meeting?.title || 'Meeting'}</h1>
      <p>
        Finding available Fridays @ 5pm and Saturdays @ 10am or 5pm (Pacific Time) for the next 3 months.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {session ? (
          <>
            <span className="badge">Signed in as {session.user?.email}</span>
            <button className="secondary" onClick={() => signOut()}>Sign out</button>
          </>
        ) : (
          <button onClick={() => signIn('google', { callbackUrl: `/m/${meetingId}` })}>Connect Google Calendar</button>
        )}
      </div>

      <div className="notice">
        All participants need to connect their Google Calendar so we can find times that work for everyone.
      </div>

      <button onClick={fetchSuggestions} disabled={loading}>
        {loading ? 'Computing...' : 'Get suggested times'}
      </button>

      {error ? <p className="notice">{error}</p> : null}

      {missing.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <h2>Missing calendar connections</h2>
          {missing.map((email) => (
            <div key={email} className="slot">{email}</div>
          ))}
        </div>
      ) : null}

      {slots.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <h2>Available times</h2>
          {slots.map((slot) => (
            <div key={`${slot.start}-${slot.end}`} className="slot">
              {formatSlot(slot.start, slot.end, meeting?.timezone || 'America/Los_Angeles')}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <h2>Participants</h2>
        {meeting?.participants?.map((p) => (
          <div key={p.email} className="slot">
            {p.email} <span className="badge">{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
