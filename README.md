# OpenCal

Open source, self-hostable meeting scheduler. Let people book time with you through a simple, shareable link — no account required for bookers.

Built with Next.js 16, Drizzle ORM, Neon Postgres, Resend, and Tailwind CSS v4.

## Features

- **Shareable booking page** — calendar view with automatic timezone detection, date/time selection, and a clean booking form
- **Admin dashboard** — manage your availability, view upcoming bookings, and cancel with one click
- **Recurring availability** — create weekly slots in bulk (e.g. Mon–Fri, 09:00–17:00, for the next 4 weeks)
- **Email notifications** — booking confirmations, cancellation emails, and admin alerts — all with `.ics` calendar attachments
- **Multi-host support** — multiple people can each have their own booking link, availability, and Zoom link
- **Participant invites** — bookers can add additional attendees who all receive the calendar invite
- **Passwordless login** — admins log in via one-time codes sent to their email (OTP)
- **Mobile-first** — fully responsive across all pages

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** — [download here](https://nodejs.org)
- **pnpm** — install with `npm install -g pnpm`
- **A Neon Postgres database** — [sign up free](https://neon.tech) and create a project. Copy the connection string from the dashboard.
- **A Resend account** — [sign up free](https://resend.com) and create an API key. You'll also need a verified sending domain (or use Resend's test domain for development).

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/rcrebo/opencal.git
cd opencal
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in each value:

| Variable | Description | How to get it |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Copy from your [Neon dashboard](https://console.neon.tech) → project → Connection Details |
| `RESEND_API_KEY` | API key for sending emails | Create one at [Resend → API Keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | Sender email address (e.g. `bookings@yourdomain.com`) | Must match a verified domain in Resend, or use `onboarding@resend.dev` for testing |
| `ADMIN_SECRET` | Secret key for signing admin session cookies | Generate with: `openssl rand -base64 32` |
| `BOOKING_SECRET` | Access key included in booking URLs | Choose any string — this prevents random visitors from accessing the booking page |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | `http://localhost:3000` for local dev, or your production domain |

### 4. Configure your hosts

Hosts are the people who can receive bookings. Edit `lib/hosts.ts`:

```ts
export const HOSTS: HostConfig[] = [
  {
    email: "you@example.com",   // must match an allowed admin email
    name: "Your Name",          // displayed on the booking page
    slug: "your-name",          // used in the booking URL: /?host=your-name
  },
];
```

Then update the `ALLOWED_EMAILS` array in `lib/auth.ts` to include the same email addresses — only these emails can log into the admin dashboard:

```ts
const ALLOWED_EMAILS = ["you@example.com"];
```

Finally, update the `HOSTS` object in `app/page.tsx` (around line 17) to match your host slugs — this controls the name and avatar initial shown on the booking page:

```ts
const HOSTS: Record<string, { name: string; initial: string }> = {
  "your-name": { name: "Your Name", initial: "Y" },
};
```

### 5. Set up the database

Push the schema to your Neon database:

```bash
pnpm drizzle-kit push
```

This creates the required tables (`slots`, `bookings`, `otp_codes`, `settings`) in your database. You'll be prompted to confirm — type `yes`.

### 6. Start the dev server

```bash
pnpm dev
```

The app is now running at `http://localhost:3000`.

### 7. Log in to the admin dashboard

1. Go to `http://localhost:3000/admin`
2. Enter your admin email (must be in `ALLOWED_EMAILS`)
3. Check your inbox for a 6-digit code
4. Enter the code to log in

### 8. Create your availability

In the admin dashboard:

1. Go to the **Slots** tab
2. Choose **Single day** to add slots for a specific date, or **Recurring** to create weekly availability
3. For recurring: select the days of the week, how many weeks ahead, and the time range (e.g. 09:00–17:00)
4. Click **Create** — this generates 1-hour slots for each hour in the range

### 9. Share your booking link

Your booking link is shown at the top of the admin dashboard. It looks like:

```
https://your-domain.com/?key=YOUR_BOOKING_SECRET&host=your-slug
```

Send this link to anyone you want to let book time with you. They'll see a calendar with your available slots and can book without creating an account.

## Setting up Zoom links

1. In the admin dashboard, go to the **Settings** tab
2. Paste your Zoom meeting link
3. This link is included in all booking confirmation emails and `.ics` calendar invites

## Deploying to Vercel

### 1. Push your repo to GitHub

Make sure your repository is pushed to GitHub (it should already be if you forked/cloned).

### 2. Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will auto-detect it as a Next.js project

### 3. Add environment variables

In your Vercel project settings → Environment Variables, add all the variables from your `.env.local`:

- `DATABASE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ADMIN_SECRET`
- `BOOKING_SECRET`
- `NEXT_PUBLIC_APP_URL` — set this to your Vercel domain (e.g. `https://opencal.vercel.app` or your custom domain)

### 4. Deploy

Vercel will build and deploy automatically. Every push to `main` triggers a new deployment.

### 5. Set up a custom domain (optional)

In Vercel project settings → Domains, add your custom domain and update `NEXT_PUBLIC_APP_URL` to match.

## Project structure

```
opencal/
├── app/
│   ├── page.tsx                  # Public booking page
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── globals.css               # Global styles
│   ├── admin/
│   │   ├── page.tsx              # Admin dashboard (slots, bookings, settings)
│   │   └── login/page.tsx        # Admin login page
│   └── api/
│       ├── slots/route.ts        # GET available slots (public)
│       ├── book/route.ts         # POST create a booking (public)
│       └── admin/
│           ├── login/route.ts        # POST request OTP code
│           ├── login/verify/route.ts # POST verify OTP & create session
│           ├── logout/route.ts       # POST destroy session
│           ├── me/route.ts           # GET current admin info
│           ├── slots/route.ts        # GET/POST manage slots
│           ├── slots/[id]/route.ts   # DELETE a slot
│           ├── bookings/route.ts     # GET all bookings
│           ├── bookings/[id]/route.ts# DELETE (cancel) a booking
│           └── settings/route.ts     # GET/PUT admin settings (Zoom link)
├── lib/
│   ├── schema.ts                 # Database schema (Drizzle ORM)
│   ├── db.ts                     # Database client
│   ├── auth.ts                   # OTP auth & session management
│   ├── email.ts                  # Email templates & sending
│   └── hosts.ts                  # Host configuration
├── drizzle.config.ts             # Drizzle Kit config
├── package.json
└── .env.example                  # Environment variable template
```

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Database | [Neon Postgres](https://neon.tech) + [Drizzle ORM](https://orm.drizzle.team) |
| Email | [Resend](https://resend.com) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Auth | OTP via email, HMAC-signed session cookies |
| Hosting | [Vercel](https://vercel.com) (recommended) |

## How it works

**Booking flow:**
1. Visitor opens the booking link with a valid `key` and `host` parameter
2. The page fetches available (unbooked, future) slots for that host
3. Visitor picks a date, selects a time slot, fills in their name/email/notes, and optionally adds participant emails
4. The slot is atomically marked as booked (prevents double-booking)
5. Confirmation emails with `.ics` attachments are sent to the booker, all participants, and the host

**Admin flow:**
1. Admin goes to `/admin` and logs in with a one-time email code
2. In the dashboard they can create availability (single day or recurring weekly slots)
3. They can view all bookings, cancel them (with optional email notification), and delete unused slots
4. The Settings tab lets them set a Zoom link that's included in all booking emails

## Created by

[@rcrebo](https://github.com/rcrebo)

## License

[AGPL-3.0](LICENSE) — free to use and self-host. If you modify and host it as a service, you must share your changes.
