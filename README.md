# Find A Good Time (POC)

Lightweight POC to auto-suggest meeting times across Google Calendars.

## Setup

1. Create a Google OAuth app and add a Web client.
2. Set Authorized redirect URI to:
   - `http://localhost:3000/api/auth/callback/google`
3. Copy `.env.example` to `.env.local` and fill values.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- This POC uses SQLite at `data/app.db`.
- For hosted deployments, use a persistent disk or swap in a hosted database.
- The app only reads free/busy data. No event details or writes.
