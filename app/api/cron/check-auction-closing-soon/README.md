# Auction Closing Soon Notification Cron Job

Deze cron job notificeert gebruikers 1 uur voordat een veiling sluit.

## Functionaliteit

### Wanneer wordt deze uitgevoerd?
- **Schema**: Elke 15 minuten (`*/15 * * * *`)
- **Max Duration**: 5 minuten

### Wat doet deze cron job?

1. **Zoekt naar veilingen die over ~1 uur sluiten**
   - Controleert alle games met auction periods
   - Filtert op `status: 'active'`
   - Zoekt periodes die eindigen tussen 55-65 minuten vanaf nu (1 uur met 10 min buffer)

2. **Bepaalt welke gebruikers genotificeerd moeten worden**
   - Alleen actieve deelnemers (`status: 'active'`)
   - Met beschikbaar budget OF actieve biedingen
   - Die email notificaties aan hebben staan (default: true)

3. **Verstuurt dubbele notificatie**
   - **In-app bericht**: Creëert een message in de database
   - **Email**: Verstuurt direct een email via Resend

4. **Voorkomt duplicaten**
   - Markeert auction period met `closingNotificationSent: true`
   - Slaat `closingNotificationSentAt` timestamp op

## Database Schema Uitbreidingen

### AuctionPeriod (binnen game.config.auctionPeriods)
```typescript
interface AuctionPeriod {
  // ... bestaande velden ...
  closingNotificationSent?: boolean;
  closingNotificationSentAt?: string;
}
```

## Notificatie Logica

### Criteria voor notificatie
Een gebruiker ontvangt een notificatie als:
- Ze actieve deelnemer zijn aan de game
- Ze **beschikbaar budget** hebben (totalBudget - spentBudget - committedBudget > 0)
- **OF** ze **actieve biedingen** hebben

### Bericht inhoud

**Als gebruiker actieve biedingen heeft:**
```
De veiling "[period.name]" in game "[game.name]" sluit over ongeveer [X] minuten.

Je hebt [aantal] actieve bieding(en) staan voor een totaal van €[committedBudget].

Je hebt nog €[availableBudget] beschikbaar om te bieden.

Log nu in om je laatste biedingen te plaatsen of aan te passen!
```

**Als gebruiker geen actieve biedingen heeft:**
```
De veiling "[period.name]" in game "[game.name]" sluit over ongeveer [X] minuten.

Je hebt nog €[availableBudget] beschikbaar om te bieden.

Log nu in om je laatste biedingen te plaatsen of aan te passen!
```

## Testing

### Dry-Run Mode
Test de cron job zonder daadwerkelijk notificaties te versturen:

```bash
curl -X GET "https://oracle-games.online/api/cron/check-auction-closing-soon?dryRun=true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Productie Test
```bash
curl -X GET "https://oracle-games.online/api/cron/check-auction-closing-soon" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Response Format
```json
{
  "success": true,
  "timestamp": "2025-01-10T14:30:00.000Z",
  "gamesChecked": 5,
  "auctionsClosingSoon": 2,
  "participantsNotified": 12,
  "messagesCreated": 12,
  "emailsSent": 10,
  "errors": [
    "User xyz has notifications disabled"
  ]
}
```

## Vercel Cron Configuratie

In `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-auction-closing-soon",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Rate Limiting

- **Resend API**: Max 2 requests/second
- **Delay tussen emails**: 600ms
- Dit voorkomt rate limit errors bij grote aantallen notificaties

## Logging

De cron job logt uitgebreid voor debugging:
- Aantal games gecheckt
- Gevonden veilingen die over 1 uur sluiten
- Per gebruiker: budget status en aantal actieve biedingen
- Email verzend status
- Errors en waarschuwingen

## Environment Variables

Vereiste environment variables:
- `CRON_SECRET`: Bearer token voor authenticatie
- `RESEND_API_KEY`: API key voor Resend email service
- `VERCEL_URL`: Base URL voor links in emails (optioneel, default: oracle-games.online)

## Best Practices

1. **Monitor de logs** in Vercel dashboard voor errors
2. **Check de errors array** in de response voor issues
3. **Test altijd eerst met dry-run mode** voordat je in productie gaat
4. **Valideer dat email notificaties werken** door een test gebruiker te maken

## Troubleshooting

### Geen notificaties verstuurd
- Check of er veilingen zijn die over 55-65 minuten sluiten
- Valideer dat gebruikers actief zijn en budget/biedingen hebben
- Controleer of `closingNotificationSent` niet al `true` is

### Duplicate notificaties
- De `closingNotificationSent` flag voorkomt dit
- Als er toch duplicaten zijn, check de update logica

### Rate limit errors
- Verhoog de delay tussen emails (nu 600ms)
- Resend's limit is 2 requests/second

### Emails komen niet aan
- Check spam folder
- Valideer `RESEND_API_KEY`
- Check of gebruiker `emailNotifications: true` heeft
- Check Resend dashboard voor delivery status
