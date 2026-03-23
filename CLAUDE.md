# CLAUDE.md

## Project overview

OpenCal is an open source, self-hostable meeting scheduler built with Next.js 16 (App Router), Neon Postgres, Drizzle ORM, Resend for email, and Tailwind CSS v4. It lets people book 1-hour meeting slots through a shareable link.

## Commands

- `pnpm dev` — start Next.js dev server (uses webpack)
- `pnpm build` — production build
- `pnpm start` — start production server
- `pnpm lint` — run ESLint
- `pnpm drizzle-kit push` — push schema changes to the database
- `pnpm drizzle-kit generate` — generate migration files
- `pnpm drizzle-kit studio` — open Drizzle Studio (database browser)

## Architecture

### Tech stack

- **Framework:** Next.js 16 with App Router (all routes under `app/`)
- **Database:** Neon Postgres via `@neondatabase/serverless` + Drizzle ORM
- **Email:** Resend SDK
- **Styling:** Tailwind CSS v4 with PostCSS
- **Auth:** Passwordless OTP via email + HMAC-SHA256 signed session cookies
- **Language:** TypeScript throughout

### Key directories

- `app/` — Next.js pages and API routes
- `app/api/` — all API endpoints (REST)
- `app/admin/` — admin dashboard and login pages
- `lib/` — shared server-side code (db, auth, email, schema, hosts)

### Database schema (`lib/schema.ts`)

Four tables:
- `slots` — available time slots, each owned by a host email. Has `isBooked` flag.
- `bookings` — links to a slot via `slotId` (unique). Stores booker name, email, notes, and participants (JSON array).
- `otpCodes` — temporary login codes with 10-minute expiry.
- `settings` — per-admin settings (currently just Zoom link), keyed by email.

### Authentication (`lib/auth.ts`)

- Admin emails are allowlisted in `ALLOWED_EMAILS` array
- Login: email → OTP code → verify → HMAC-signed session cookie (1 week)
- Session validation: extracts email from cookie, re-signs with `ADMIN_SECRET`, compares
- All admin API routes call `getSessionEmail()` to verify the caller

### Host configuration

Hosts are configured in three places that must stay in sync:
1. `lib/hosts.ts` — `HOSTS` array (email, name, slug)
2. `lib/auth.ts` — `ALLOWED_EMAILS` array (same emails)
3. `app/page.tsx` — `HOSTS` object (slug → display name and initial, for the booking page UI)

### API routes

Public (require `BOOKING_SECRET` as `key` param):
- `GET /api/slots` — available slots for a host
- `POST /api/book` — create a booking (atomically claims slot)

Admin (require session cookie):
- `POST /api/admin/login` — request OTP
- `POST /api/admin/login/verify` — verify OTP, set session
- `POST /api/admin/logout` — clear session
- `GET /api/admin/me` — current admin info + booking link
- `GET/POST /api/admin/slots` — list/create slots
- `DELETE /api/admin/slots/[id]` — delete a slot
- `GET /api/admin/bookings` — list bookings
- `DELETE /api/admin/bookings/[id]` — cancel a booking
- `GET/PUT /api/admin/settings` — read/update Zoom link

### Email (`lib/email.ts`)

Three email types: booking confirmation (to booker + participants), cancellation, and admin notification. All include `.ics` calendar attachments and Google Calendar links.

## Environment variables

All defined in `.env.example`:
- `DATABASE_URL` — Neon Postgres connection string
- `RESEND_API_KEY` — Resend API key
- `EMAIL_FROM` — sender email address
- `ADMIN_SECRET` — HMAC signing key for session cookies
- `BOOKING_SECRET` — access key for booking URLs
- `NEXT_PUBLIC_APP_URL` — public app URL

## Code style

- TypeScript strict mode
- Path alias: `@/*` maps to project root (e.g. `import { db } from "@/lib/db"`)
- Client components use `"use client"` directive
- API routes use Next.js route handlers (`export async function GET/POST/PUT/DELETE`)
- All times stored in UTC in the database; UI converts to user's local timezone
- UK timezone used as the "host timezone" for slot creation in the admin dashboard
