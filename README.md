# OSRS Bingo

A web app for running Old School RuneScape bingo events with your clan or friend group. Teams submit screenshot evidence for boss kills and other tasks on a 5×5 bingo board. An admin reviews submissions and the leaderboard updates in real time.

## Features

- 5×5 bingo board with configurable tiles (points, required count, reference images, auto-approve)
- Team accounts — each team registers one login and lists their members
- Screenshot submission with optional notes and per-member attribution
- Admin review queue (approve / reject with feedback)
- Live leaderboard with per-tile colour-coding by team member, MVP crown, Bingo Sweats and Leeches rankings
- KC snapshot system — capture OSRS hiscores at event start and track kills gained during the event
- Players tab for browsing per-member boss KCs
- Event countdown with configurable start/end dates
- OSRS stone-frame UI (BingoBG2) across all player-facing pages

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL via Prisma |
| Auth | NextAuth v5 (credentials) |
| File storage | Vercel Blob |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel (recommended) |

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database (see [Platform notes](#platform-notes))
- A Vercel Blob store (see [Platform notes](#platform-notes))

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd <repo-folder>
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) below for what each one means.

### 3. Run database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Create the first admin account

There is no sign-up UI — all accounts are created by an admin. Bootstrap the first admin with the included script:

```bash
npx tsx scripts/create-admin.ts <username> <password>
```

Example:
```bash
npx tsx scripts/create-admin.ts admin hunter2
```

Keep this username and password somewhere safe — it's the only way to access the admin panel.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the admin credentials.

---

## Environment Variables

Create a `.env.local` file (copy from `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooled). From Neon: the "pooled" URL. |
| `DATABASE_URL_UNPOOLED` | Yes | PostgreSQL direct connection string (used for migrations). From Neon: the "direct" URL. If your provider only gives one URL, use the same value for both. |
| `AUTH_SECRET` | Yes | Random secret used to sign session tokens. Generate with: `npx auth secret` |
| `BLOB_READ_WRITE_TOKEN` | Yes | Vercel Blob storage token. Auto-injected on Vercel; copy from your Blob store dashboard for local dev. |

---

## Deployment

### Vercel (recommended)

Vercel is the easiest deployment target because Blob storage integrates automatically.

1. Push the repo to GitHub
2. Import the project in the [Vercel dashboard](https://vercel.com/new)
3. Add a **Neon Postgres** integration (or paste your own `DATABASE_URL` / `DATABASE_URL_UNPOOLED`)
4. Add a **Vercel Blob** store and connect it to the project
5. Set `AUTH_SECRET` in the Vercel environment variables panel
6. Deploy — migrations run automatically as part of the build (`prisma migrate deploy`)
7. After the first deploy, run the admin bootstrap script from your local machine pointing at the production database:
   ```bash
   DATABASE_URL=<your-production-url> npx tsx scripts/create-admin.ts admin <password>
   ```

### Other hosts (Railway, Render, fly.io, self-hosted)

The app runs on any Node.js host that supports Next.js with the following caveats:

**Blob storage** — `@vercel/blob` only works with Vercel Blob. To use a different provider (S3, Cloudflare R2, Supabase Storage, etc.) you need to replace the `put` / `del` calls in two files:
- `app/api/submit/route.ts` — player submission uploads
- `app/api/admin/tiles/image/route.ts` — tile reference image uploads

**Prisma binary target** — `prisma/schema.prisma` includes `rhel-openssl-3.0.x` for Vercel's Linux environment. Other hosts may need a different target. Add the correct value for your platform to the `binaryTargets` array:
- Render / Railway (Debian): `debian-openssl-3.0.x`
- Alpine (Docker): `linux-musl-openssl-3.0.x`
- Check the [Prisma docs](https://www.prisma.io/docs/orm/reference/prisma-schema-reference#binarytargets-options) for the full list.

**Vercel Analytics / Speed Insights** — these are included in `app/layout.tsx` but silently do nothing on non-Vercel hosts. You can safely remove the `<Analytics />` and `<SpeedInsights />` components if you prefer.

---

## Admin Guide

Once logged in as an admin, visit `/bingo/admin` to:

- **Board** — configure tiles (title, points, required submission count, reference image, auto-approve toggle), set event start/end dates, reset the board, and take KC snapshots
- **Teams** — create team accounts, set passwords, manage team member rosters
- **Submissions** — review pending screenshots, approve or reject with optional feedback notes

### KC Snapshots

The KC snapshot system captures each team member's boss kill counts from the OSRS hiscores at event start, so the app can show kills *gained during the event* rather than lifetime totals.

1. Make sure all teams have their member rosters filled in before taking a snapshot
2. In Admin → Board, click **Take Snapshot** — this fetches live KC data for every team member
3. The snapshot is automatically deleted when you reset the board

Player names must exactly match their OSRS username (case-insensitive) to appear on hiscores.

---

## Platform Notes

### Database

Any PostgreSQL provider works. Recommended free tiers:
- [Neon](https://neon.tech) — serverless Postgres, generous free tier, native Vercel integration
- [Supabase](https://supabase.com) — also has a free tier; use the "direct connection" string for both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (Supabase's connection pooler uses a different protocol)

### File Storage

Vercel Blob is the only supported provider out of the box. The free tier (5 GB storage / 100 GB bandwidth per month) is more than enough for a bingo event.

---

## License

MIT
