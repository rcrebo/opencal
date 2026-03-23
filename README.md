# OpenCal

Open source meeting scheduler. Let people book 1-hour meetings with you via a simple, shareable link.

Built with Next.js, Drizzle ORM, Neon Postgres, Resend, and Tailwind CSS.

## Features

- **Booking page** — shareable link with calendar view, timezone detection, slot selection
- **Admin dashboard** — manage availability, view bookings, cancel with email notifications
- **Recurring slots** — set weekly availability (e.g. Mon-Fri 09:00-17:00) in one click
- **Email confirmations** — booking, cancellation, and admin notification emails with .ics calendar attachments
- **Multi-host** — support multiple people with separate booking links and availability
- **Participant invites** — bookers can add additional attendees who all receive the invite
- **OTP login** — passwordless admin authentication via email codes
- **Mobile-first** — responsive design across all pages

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A [Neon](https://neon.tech) Postgres database (free tier works)
- A [Resend](https://resend.com) account for sending emails (free tier works)

### Setup

```bash
git clone https://github.com/rcrebo/opencal.git
cd opencal
pnpm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

### Configure Hosts

Edit `lib/hosts.ts` to add your hosts:

```ts
export const HOSTS: HostConfig[] = [
  {
    email: "you@example.com",
    name: "Your Name",
    slug: "your-name",
  },
];
```

Add the same email(s) to the `ALLOWED_EMAILS` array in `lib/auth.ts`.

### Database

Push the schema to your Neon database:

```bash
pnpm drizzle-kit push
```

### Run

```bash
pnpm dev
```

- Admin: `http://localhost:3000/admin`
- Booking page: `http://localhost:3000/?key=YOUR_BOOKING_SECRET&host=your-slug`

## Deploy

Works out of the box on [Vercel](https://vercel.com). Just connect the repo and add your environment variables.

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **Database** — Neon Postgres + Drizzle ORM
- **Email** — Resend
- **Styling** — Tailwind CSS v4
- **Auth** — OTP via email, HMAC session cookies

## Created by

[@rcrebo](https://github.com/rcrebo)

## License

[AGPL-3.0](LICENSE) — free to use and self-host. If you modify and host it as a service, you must share your changes.
