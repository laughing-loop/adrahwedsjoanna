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

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Deploy with defaults (Next.js is auto-detected).
