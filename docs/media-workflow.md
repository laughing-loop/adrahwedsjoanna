# Media Workflow (Recommended)

## 1) Authorized uploads
- Access `/admin/login`.
- Only `ADMIN`, `COUPLE`, and `PHOTOGRAPHER` roles can upload.
- Uploads are signed server-side and sent directly to Cloudinary.

## 2) Guest downloads
- Public downloads are served from `public/downloads`.
- Program outline is available at `/downloads/program-outline-main.pdf`.
- Post-wedding gallery archive can be published in the same folder.

## 3) AI "Find My Photos" (next phase)
- Guest uploads one selfie.
- Backend extracts face embedding.
- Compare against embeddings generated from event photos.
- Return only matched photos above confidence threshold.
- Add consent text and automatic data deletion policy (recommended).

Current implementation in this repo:
- Guest intake route: `POST /api/find-my-photos/request`
- Status route: `GET /api/find-my-photos/status?requestId=...`
- Guest pages: `/find-my-photos` and `/find-my-photos/<requestId>`
- Match publishing convention: upload matched images to folder
  `adrah-joanna/find-my-photos/matches/<requestId>`

## 4) Suggested stack for AI matching
- Storage + delivery: Cloudinary
- Metadata + auth: Supabase (Postgres + RLS)
- Face matching: AWS Rekognition or Face API provider with explicit consent
- Queue processing: serverless queue/worker for batch indexing
