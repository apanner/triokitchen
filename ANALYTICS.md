# Trio Kitchen — Analytics Backend

## API
- `POST /api/track` — record page views, bank taps, Interac copy, etc. (public)
- `GET /api/stats` — aggregated KPIs (header `x-admin-pin`)
- `GET /api/events?limit=100` — recent events (header `x-admin-pin`)

## Admin
- Open `/admin.html` (or `/admin`)
- Default PIN: `2026`
- Change with Vercel env `ADMIN_PIN`

## Durable storage (recommended)
Without Blob, events live in memory per serverless instance (fine for demos, not durable).

1. In Vercel Dashboard → Project → Storage → create **Blob**
2. Or CLI: link Blob so `BLOB_READ_WRITE_TOKEN` is set
3. Redeploy

Then events persist in `trio-analytics-events.json` on Blob.
