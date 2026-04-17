# Joanna & Innocent Wedding Site (Next.js)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Authorized media uploads (Cloudinary)

1. Copy `.env.example` to `.env.local` and fill values.
2. Generate password hashes:

```bash
npm run hash:password -- "StrongPasswordHere"
```

3. Add users to `AUTH_USERS_JSON` with roles:
- `ADMIN`
- `COUPLE`
- `PHOTOGRAPHER`

4. Go to `/admin/login` and upload images/videos.
5. See `docs/media-workflow.md` for the AI photo-matching rollout plan.

## Automated Find My Photos

This project now includes:
- guest request intake at `/find-my-photos`
- automatic status page at `/find-my-photos/<requestId>`
- admin trigger at `/api/find-my-photos/run`
- scheduled trigger at `/api/find-my-photos/cron` via `vercel.json` (every 15 minutes)

Set these environment variables in local and Vercel:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `FIND_MY_PHOTOS_SIMILARITY` (recommended `92`)
- `CRON_SECRET` (must also be set in Vercel so cron calls are authorized)

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Deploy with defaults (Next.js is auto-detected).
