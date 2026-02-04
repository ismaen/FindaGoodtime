import { sql } from '@vercel/postgres';
import crypto from 'crypto';

// Initialize tables (run once on first request)
let initialized = false;

async function initDb() {
  if (initialized) return;
  
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calendar_connections (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at INTEGER,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      organizer_user_id TEXT,
      title TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      start_range TIMESTAMP NOT NULL,
      end_range TIMESTAMP NOT NULL,
      timezone TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meeting_participants (
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      email TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL,
      PRIMARY KEY(meeting_id, email)
    )
  `;

  initialized = true;
}

export async function upsertUser(email: string, name?: string | null) {
  await initDb();
  const id = crypto.randomUUID();
  
  // Check if user exists
  const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing.rows.length > 0) {
    return existing.rows[0].id as string;
  }
  
  await sql`
    INSERT INTO users (id, email, name)
    VALUES (${id}, ${email}, ${name ?? null})
  `;
  return id;
}

export async function linkParticipantByEmail(email: string, userId: string) {
  await initDb();
  await sql`
    UPDATE meeting_participants 
    SET user_id = ${userId}, status = 'connected' 
    WHERE email = ${email}
  `;
}

export async function upsertCalendarConnection(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt?: number | null
) {
  await initDb();
  
  const existing = await sql`SELECT user_id FROM calendar_connections WHERE user_id = ${userId}`;
  
  if (existing.rows.length > 0) {
    await sql`
      UPDATE calendar_connections 
      SET provider = ${provider}, 
          access_token = ${accessToken}, 
          refresh_token = ${refreshToken}, 
          expires_at = ${expiresAt ?? null}, 
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } else {
    await sql`
      INSERT INTO calendar_connections (user_id, provider, access_token, refresh_token, expires_at)
      VALUES (${userId}, ${provider}, ${accessToken}, ${refreshToken}, ${expiresAt ?? null})
    `;
  }
}

export async function createMeeting(input: {
  organizerUserId?: string | null;
  title: string;
  durationMinutes: number;
  startRange: string;
  endRange: string;
  timezone: string;
  participantEmails: string[];
}) {
  await initDb();
  const id = crypto.randomUUID();
  
  await sql`
    INSERT INTO meetings (id, organizer_user_id, title, duration_min, start_range, end_range, timezone)
    VALUES (
      ${id}, 
      ${input.organizerUserId ?? null}, 
      ${input.title}, 
      ${input.durationMinutes}, 
      ${input.startRange}, 
      ${input.endRange}, 
      ${input.timezone}
    )
  `;
  
  for (const email of input.participantEmails) {
    await sql`
      INSERT INTO meeting_participants (meeting_id, email, user_id, status)
      VALUES (${id}, ${email}, NULL, 'invited')
    `;
  }
  
  return id;
}

export async function getMeeting(id: string) {
  await initDb();
  
  const meetingResult = await sql`SELECT * FROM meetings WHERE id = ${id}`;
  if (meetingResult.rows.length === 0) {
    return null;
  }
  
  const meeting = meetingResult.rows[0];
  
  const participantsResult = await sql`
    SELECT email, status FROM meeting_participants 
    WHERE meeting_id = ${id} 
    ORDER BY email
  `;
  
  return {
    id: meeting.id,
    title: meeting.title,
    durationMinutes: meeting.duration_min,
    startRange: meeting.start_range,
    endRange: meeting.end_range,
    timezone: meeting.timezone,
    participants: participantsResult.rows.map(row => ({
      email: row.email as string,
      status: row.status as string
    }))
  };
}

export async function getMeetingParticipants(id: string) {
  await initDb();
  
  const result = await sql`
    SELECT email, user_id, status FROM meeting_participants 
    WHERE meeting_id = ${id} 
    ORDER BY email
  `;
  
  return result.rows.map(row => ({
    email: row.email as string,
    user_id: row.user_id as string | null,
    status: row.status as string
  }));
}

export async function getCalendarConnectionByUserId(userId: string) {
  await initDb();
  
  const result = await sql`SELECT * FROM calendar_connections WHERE user_id = ${userId}`;
  if (result.rows.length === 0) {
    return undefined;
  }
  
  const row = result.rows[0];
  return {
    user_id: row.user_id as string,
    provider: row.provider as string,
    access_token: row.access_token as string,
    refresh_token: row.refresh_token as string | null,
    expires_at: row.expires_at as number | null
  };
}
