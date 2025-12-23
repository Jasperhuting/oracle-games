# Migratie naar Vercel Cron + Polling Architecture

Dit document beschrijft de migratie van Motia WebSocket + Fly.io naar Vercel Cron Jobs + Polling.

## ✅ Wat is er veranderd?

### Verwijderd
- **@motiadev/stream-client-react** package
- **MotiaProvider** component
- **useMotiaEndpoint** hook
- **useMotiaStream** hook
- Externe Motia backend dependency
- Fly.io configuratie
- WebSocket real-time streaming

### Toegevoegd
- **Job Queue systeem** met Firestore ([lib/firebase/job-queue.ts](lib/firebase/job-queue.ts))
- **Polling hook** ([hooks/useJobProgress.ts](hooks/useJobProgress.ts))
- **Job processing endpoints** ([app/api/jobs/](app/api/jobs/))
- **Vercel Cron Jobs** ([vercel.json](vercel.json))
- Persistent job tracking in Firestore

## 📋 Setup Instructies

### 1. Environment Variables

Kopieer `.env.example` naar `.env.local` en vul de waarden in:

```bash
cp .env.example .env.local
```

Voeg de nieuwe environment variables toe:

```bash
# Generate random secrets
CRON_SECRET=$(openssl rand -base64 32)
INTERNAL_API_KEY=$(openssl rand -base64 32)

# Add to .env.local
echo "CRON_SECRET=$CRON_SECRET" >> .env.local
echo "INTERNAL_API_KEY=$INTERNAL_API_KEY" >> .env.local
```

### 2. Verwijder oude environment variables

Deze zijn niet meer nodig:
- `NEXT_PUBLIC_MOTIA_WS`
- `MOTIA_HTTP_URL`
- `SYSTEM_API_KEY` (optioneel: kan herbruikt worden als INTERNAL_API_KEY)

### 3. Firestore Index

Maak een Firestore index voor jobs collectie:

```
Collection: jobs
Fields to index:
  - expiresAt (Ascending)
  - createdAt (Descending)
```

Dit kan via Firebase Console → Firestore → Indexes.

### 4. Vercel Setup

#### 4.1. Voeg Environment Variables toe aan Vercel

In Vercel Dashboard → Settings → Environment Variables:

```
CRON_SECRET=<jouw-gegenereerde-secret>
INTERNAL_API_KEY=<jouw-gegenereerde-secret>
```

**Belangrijk**: Deze moeten exact hetzelfde zijn als in je `.env.local`!

#### 4.2. Deploy naar Vercel

```bash
git add .
git commit -m "feat: migrate to Vercel Cron + polling architecture"
git push
```

Vercel zal automatisch de cron jobs configureren uit `vercel.json`.

#### 4.3. Verifieer Cron Jobs

Na deployment:
1. Ga naar Vercel Dashboard → Project → Cron Jobs
2. Je zou 3 cron jobs moeten zien:
   - **check-auction-finalizations** (elke minuut) - Replaces Motia finalization-checker
   - **send-message-notifications** (elke 5 minuten) - Replaces Motia send-messages
   - **cleanup-expired-jobs** (dagelijks om 2:00 AM) - Job queue cleanup

### 5. Test de migratie

#### Lokaal testen

```bash
npm run dev
```

Test de volgende functionaliteit:

1. **Team Update** (create-ranking page):
   ```
   - Klik op "update team"
   - Verwacht: Polling toasts met progress
   - Geen WebSocket errors in console
   ```

2. **Bulk Scraping**:
   ```bash
   curl -X POST http://localhost:3210/api/scraper/bulk \
     -H "Content-Type: application/json" \
     -d '{"race": "tour-de-france", "year": 2025}'
   ```

   Dit geeft een `jobId` terug. Check status met:
   ```bash
   curl http://localhost:3210/api/jobs/{jobId}
   ```

3. **Auction Finalization Check** (simuleer cron):
   ```bash
   curl http://localhost:3210/api/cron/check-auction-finalizations \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

4. **Message Notifications** (simuleer cron):
   ```bash
   curl http://localhost:3210/api/cron/send-message-notifications \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

   **Note**: Vereist `RESEND_API_KEY` env var (get free API key at https://resend.com).

## 🔄 Hoe werkt het nu?

### Oude flow (Motia + WebSocket)
```
Client → API → Motia Backend → WebSocket → Client updates
```

### Nieuwe flow (Vercel + Polling)
```
Client → API → Firestore Job → Background Processing
                     ↓
Client ← Polling ← Firestore Job Status
```

### Polling vs WebSocket

| Aspect | WebSocket (oud) | Polling (nieuw) |
|--------|-----------------|-----------------|
| Latency | ~100ms | ~2s |
| Complexity | Hoog (externe service) | Laag (native) |
| Reliability | Medium (connection drops) | Hoog (HTTP) |
| Cost | €5-15/maand Fly.io | €0 (included in Vercel) |

Voor achtergrond jobs (1-5 minuten) is 2-seconden polling **meer dan voldoende**.

## 📊 Monitoring

### Job Status Checken

Via API:
```bash
GET /api/jobs/{jobId}
```

Response:
```json
{
  "id": "job-123",
  "type": "bulk-scrape",
  "status": "running",
  "progress": {
    "current": 5,
    "total": 21,
    "percentage": 24,
    "stage": "Scraping stage 5/21"
  }
}
```

### Cron Job Logs

In Vercel Dashboard:
1. Go to Deployments → Latest Deployment
2. Click "View Function Logs"
3. Filter by `/api/cron/`

## ⚠️ Breaking Changes

### Voor users van de API

1. **`/api/run-scraper`**
   - Response format changed
   - Gebruik nu `/api/jobs/{jobId}` om status te checken
   - Geen `checkStatusUrl` meer met `/api/run-scraper/{jobId}`

2. **`/api/scraper/bulk`**
   - Response format changed
   - Gebruik nu `/api/jobs/{jobId}` om status te checken

3. **`/api/updateTeam`**
   - Geen `traceId` meer
   - Returns `jobId` in plaats daarvan

### Voor developers

1. **Geen WebSocket meer**
   - `useStreamGroup` bestaat niet meer
   - Gebruik `useJobProgress` voor polling

2. **Environment variables**
   - `NEXT_PUBLIC_MOTIA_WS` → verwijderd
   - `MOTIA_HTTP_URL` → verwijderd
   - Nieuwe: `CRON_SECRET`, `INTERNAL_API_KEY`

## 🆘 Troubleshooting

### "Job not found" errors

Jobs expiren na 24 uur. Check of:
1. Job ID correct is
2. Job niet ouder is dan 24 uur

### Cron jobs draaien niet

Verify:
1. `CRON_SECRET` is correct ingesteld in Vercel
2. Cron jobs zijn enabled in Vercel Dashboard
3. Check function logs voor errors

### Polling stopt niet

Check of:
1. Job status is `completed` of `failed`
2. `onComplete`/`onError` callbacks worden aangeroepen
3. Component unmounts correct (cleanup)

### "Unauthorized" bij cron endpoints

Check of:
1. `Authorization` header correct is: `Bearer {CRON_SECRET}`
2. `CRON_SECRET` is hetzelfde in Vercel en request

## 📚 Referenties

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Firebase Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## 🎉 Klaar!

De migratie is compleet. Je hebt nu:
- ✅ Geen externe dependencies meer (Motia, Fly.io)
- ✅ Persistent job tracking in Firestore
- ✅ Automated cron jobs via Vercel
- ✅ Simpelere architectuur
- ✅ Lagere kosten

Vragen? Check de code comments of open een issue.
