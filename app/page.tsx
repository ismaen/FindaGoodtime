'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Automatically set range to today through 3 months from now
    const now = new Date();
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const payload = {
      title: String(formData.get('title') || 'Meeting'),
      durationMinutes: Number(formData.get('durationMinutes') || 30),
      startRange: now.toISOString(),
      endRange: threeMonthsLater.toISOString(),
      timezone: 'America/Los_Angeles',
      participantEmails: String(formData.get('participantEmails') || '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean)
    };

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create meeting');
      }
      const data = await res.json();
      router.push(`/m/${data.meetingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <h1>Find a good time, automatically.</h1>
        <p>Create a meeting, invite people by email, and let calendars do the math.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="title">Meeting title</label>
          <input id="title" name="title" placeholder="Weekly sync" />

          <label htmlFor="durationMinutes">Duration (minutes)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" defaultValue={30} />

          <label htmlFor="participantEmails">Participant emails (comma separated)</label>
          <textarea id="participantEmails" name="participantEmails" rows={3} placeholder="alex@company.com, jamie@company.com" />
          <p>Include your own email so your calendar is considered.</p>

          {error ? <p className="notice">{error}</p> : null}
          <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create meeting'}</button>
        </form>
      </section>

      <section className="card">
        <h2>What happens next</h2>
        <p>
          Each participant connects Google Calendar and we pull only free/busy blocks.
          The app finds the best Friday or Saturday that works for everyone in the next 3 months.
        </p>
        <div>
          <span className="badge">Google Calendar only</span>
          <span className="badge">No event write-back</span>
          <span className="badge">Free/busy only</span>
        </div>
      </section>
    </div>
  );
}
