# VITALS — Health Tracker & Analytics (v2.0, web)

A full rewrite of the desktop Tkinter health tracker as a web app:
a Node/Express/MySQL API plus a React front end styled to match my
portfolio's dark, brutalist design system — near-black background,
acid-yellow accent, Space Mono everywhere, zero border-radius, hard
offset shadows instead of blur, and a floating icon rail instead of
a boxed sidebar.

## Architecture

```
health-tracker-web/
  backend/                 Node + Express + MySQL API
    src/
      server.js            App entry point
      db.js                Connection pool + schema migrations
      middleware/auth.js   JWT verification
      routes/
        auth.js            Register / login / profile
        logs.js             Health log CRUD (BMI computed server-side)
        analytics.js        Rolling averages, trends, CSV export
      utils/health.js       BMI / BP staging / moving-average math
    .env.example
    package.json

  frontend/                 React (Vite) single-page app
    src/
      main.jsx / App.jsx     Routing + auth gate
      styles/theme.css        Design tokens + brutalist component styles
      context/AuthContext.jsx JWT-backed auth state
      api/client.js           Typed fetch wrapper
      components/
        FloatingNav.jsx        Floating icon rail (Dashboard/Log/Analytics/History)
        MetricTile.jsx          Headline metric card with trend badge
        LogForm.jsx              Daily check-in form
        HistoryTable.jsx         Scrollable log history + delete
        charts/                  Recharts: weight & BMI, activity & sleep, BP & HR
      pages/
        LoginPage / DashboardPage / LogEntryPage / AnalyticsPage / HistoryPage
    package.json
```

## What changed from the original desktop app

- **MySQL access moved server-side.** The React app never talks to
  MySQL directly — it calls a REST API, which is the only thing with
  DB credentials.
- **Passwords are hashed** (bcrypt) instead of stored in plaintext,
  and the DB password is read from an environment variable instead
  of being hard-coded.
- **BMI, BMI category, and BP staging are computed on the server**
  (`utils/health.js`), so the calculation is consistent no matter
  which client calls the API.
- **Auth uses JWTs** instead of a `user_id` kept in memory, so a
  session survives a page refresh.
- **The schema matches the original spec**: `users` (id, username,
  age, gender, height_cm, target_weight, created_at) and
  `health_logs` (id, user_id, log_date, weight_kg, height_cm, bmi,
  bmi_category, systolic_bp, diastolic_bp, resting_hr, daily_steps,
  water_liters, sleep_hours, notes, created_at).

## Setup

### 1. MySQL

Create the database (tables are created automatically on server boot):

```sql
CREATE DATABASE health_tracker CHARACTER SET utf8mb4;
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: DB_PASSWORD, JWT_SECRET at minimum
npm run dev
```

The API starts on `http://localhost:4000` and creates the `users`
and `health_logs` tables on first boot.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app starts on `http://localhost:5173` and proxies `/api` calls
to the backend (see `vite.config.js`). Register a new account from
the login screen to get started — there's no seed data.

### 4. Production build

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
```

Serve `frontend/dist` from any static host (or from Express with
`express.static`), and point `CORS_ORIGIN` in the backend's `.env`
at that origin.

## API reference

| Method | Path                        | Auth | Description                          |
|--------|-----------------------------|------|---------------------------------------|
| POST   | /api/auth/register          | —    | Create account, returns JWT           |
| POST   | /api/auth/login              | —    | Returns JWT                            |
| GET    | /api/auth/me                  | ✓    | Current user profile                   |
| PATCH  | /api/auth/me                  | ✓    | Update profile fields                  |
| GET    | /api/logs?limit=90            | ✓    | Recent logs, oldest first              |
| POST   | /api/logs                      | ✓    | Create a log entry (BMI auto-computed) |
| PATCH  | /api/logs/:id                  | ✓    | Update a log entry                     |
| DELETE | /api/logs/:id                  | ✓    | Delete a log entry                     |
| GET    | /api/analytics/summary?limit=  | ✓    | Enriched logs + headline metrics       |
| GET    | /api/analytics/export?format=csv | ✓  | Full history as CSV                    |

## Design system reference

| Token           | Value                          |
|-----------------|---------------------------------|
| `--bg`          | `#0a0a0a`                       |
| `--accent`      | `#e8ff00`                       |
| `--text`        | `#f2f2ea`                       |
| `--border`      | `#2a2a26`                       |
| Font            | Space Mono                      |
| Border-radius   | `0` everywhere                  |
| Shadows         | Hard offset (`5px 5px 0 #000`), no blur |

Tiles lift 2px on hover and their shadow deepens — no soft grey
SaaS-card shadow, no gradients.
