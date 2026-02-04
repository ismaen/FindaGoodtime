import type { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');

let dbPromise: Promise<SqlJsDatabase> | null = null;

async function getDb(): Promise<SqlJsDatabase> {
  if (dbPromise) return dbPromise;
  const initSqlJs = (await import('sql.js')).default;
  const SQL = await initSqlJs();
  let db: SqlJsDatabase;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode = WAL');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_connections (
      user_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at INTEGER,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      organizer_user_id TEXT,
      title TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      start_range TEXT NOT NULL,
      end_range TEXT NOT NULL,
      timezone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meeting_participants (
      meeting_id TEXT NOT NULL,
      email TEXT NOT NULL,
      user_id TEXT,
      status TEXT NOT NULL,
      PRIMARY KEY(meeting_id, email),
      FOREIGN KEY(meeting_id) REFERENCES meetings(id)
    );
  `);
  dbPromise = Promise.resolve(db);
  return db;
}

function persist(db: SqlJsDatabase) {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function upsertUser(email: string, name?: string | null) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?');
  existing.bind([email]);
  if (existing.step()) {
    const row = existing.getAsObject() as { id: string };
    existing.free();
    return row.id;
  }
  existing.free();
  db.run(
    'INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)',
    [id, email, name ?? null, createdAt]
  );
  persist(db);
  return id;
}

export async function linkParticipantByEmail(email: string, userId: string) {
  const db = await getDb();
  const stmt = db.prepare('UPDATE meeting_participants SET user_id = ?, status = ? WHERE email = ?');
  stmt.run([userId, 'connected', email]);
  stmt.free();
  persist(db);
}

export async function upsertCalendarConnection(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt?: number | null
) {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT user_id FROM calendar_connections WHERE user_id = ?');
  existing.bind([userId]);
  const hasExisting = existing.step();
  existing.free();
  if (hasExisting) {
    const stmt = db.prepare(
      'UPDATE calendar_connections SET provider = ?, access_token = ?, refresh_token = ?, expires_at = ?, updated_at = ? WHERE user_id = ?'
    );
    stmt.run([provider, accessToken, refreshToken, expiresAt ?? null, now, userId]);
    stmt.free();
  } else {
    db.run(
      'INSERT INTO calendar_connections (user_id, provider, access_token, refresh_token, expires_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, provider, accessToken, refreshToken, expiresAt ?? null, now]
    );
  }
  persist(db);
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
  const db = await getDb();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.run(
    'INSERT INTO meetings (id, organizer_user_id, title, duration_min, start_range, end_range, timezone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      input.organizerUserId ?? null,
      input.title,
      input.durationMinutes,
      input.startRange,
      input.endRange,
      input.timezone,
      createdAt
    ]
  );
  const insertStmt = db.prepare(
    'INSERT INTO meeting_participants (meeting_id, email, user_id, status) VALUES (?, ?, ?, ?)'
  );
  for (const email of input.participantEmails) {
    insertStmt.run([id, email, null, 'invited']);
  }
  insertStmt.free();
  persist(db);
  return id;
}

function rowToObject(columns: string[], values: unknown[]) {
  const o: Record<string, unknown> = {};
  columns.forEach((c, i) => (o[c] = values[i]));
  return o;
}

export async function getMeeting(id: string) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM meetings WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const meeting = rowToObject(stmt.getColumnNames(), stmt.get()) as Record<string, unknown>;
  stmt.free();

  const partStmt = db.prepare('SELECT email, status FROM meeting_participants WHERE meeting_id = ? ORDER BY email');
  partStmt.bind([id]);
  const participants: { email: string; status: string }[] = [];
  while (partStmt.step()) {
    const row = rowToObject(partStmt.getColumnNames(), partStmt.get());
    participants.push({ email: row.email as string, status: row.status as string });
  }
  partStmt.free();

  return {
    id: meeting.id,
    title: meeting.title,
    durationMinutes: meeting.duration_min,
    startRange: meeting.start_range,
    endRange: meeting.end_range,
    timezone: meeting.timezone,
    participants
  };
}

export async function getMeetingParticipants(id: string) {
  const db = await getDb();
  const stmt = db.prepare('SELECT email, user_id, status FROM meeting_participants WHERE meeting_id = ? ORDER BY email');
  stmt.bind([id]);
  const rows: { email: string; user_id: string | null; status: string }[] = [];
  while (stmt.step()) {
    const row = rowToObject(stmt.getColumnNames(), stmt.get());
    rows.push({
      email: row.email as string,
      user_id: row.user_id as string | null,
      status: row.status as string
    });
  }
  stmt.free();
  return rows;
}

export async function getCalendarConnectionByUserId(userId: string) {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM calendar_connections WHERE user_id = ?');
  stmt.bind([userId]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = rowToObject(stmt.getColumnNames(), stmt.get());
  stmt.free();
  return row as {
    user_id: string;
    provider: string;
    access_token: string;
    refresh_token: string | null;
    expires_at: number | null;
  };
}
