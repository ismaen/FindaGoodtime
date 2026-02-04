import { getCalendarConnectionByUserId, upsertCalendarConnection } from './db';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';

export async function getAccessToken(userId: string) {
  const conn = await getCalendarConnectionByUserId(userId);
  if (!conn) return null;

  const now = Math.floor(Date.now() / 1000);
  if (conn.expires_at && conn.expires_at > now + 60) {
    return conn.access_token;
  }

  if (!conn.refresh_token) return conn.access_token;

  const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token
    })
  });

  if (!refreshRes.ok) {
    return conn.access_token;
  }

  const data = await refreshRes.json();
  const expiresAt = data.expires_in ? now + data.expires_in : conn.expires_at;
  await upsertCalendarConnection(userId, conn.provider, data.access_token, conn.refresh_token, expiresAt);
  return data.access_token as string;
}

export async function fetchFreeBusy(userId: string, timeMin: string, timeMax: string) {
  const accessToken = await getAccessToken(userId);
  if (!accessToken) return null;

  const res = await fetch(GOOGLE_FREEBUSY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: 'primary' }]
    })
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data?.calendars?.primary?.busy as { start: string; end: string }[];
}
