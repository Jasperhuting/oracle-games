# Match Chat — Design Document

Real-time chatrooms gekoppeld aan wedstrijden, beheerd door admins, met automatische sluiting.

## Beslissing

Firestore real-time (`onSnapshot`) op bestaande Firebase-infrastructuur. Geen externe services. Geschikt voor 50-200 gelijktijdige gebruikers per chatroom.

## Data Model

Drie collections in de default Firestore database.

### `chat_rooms`

| Veld | Type | Beschrijving |
|------|------|-------------|
| id | string (auto) | Document ID |
| title | string | "EK Finale Nederland - Duitsland" |
| description | string? | Korte beschrijving |
| gameType | string? | "football" \| "f1" \| "cycling" \| null |
| closesAt | Timestamp | Sluitingstijd (standaard 23:59 op wedstrijddag) |
| createdAt | Timestamp | Aanmaakmoment |
| createdBy | string | Admin UID |
| status | "open" \| "closed" | Actieve status |
| messageCount | number | Counter voor snelle weergave |

### `chat_rooms/{roomId}/messages`

| Veld | Type | Beschrijving |
|------|------|-------------|
| id | string (auto) | Document ID |
| text | string | Berichttekst |
| userId | string | Afzender UID |
| userName | string | Weergavenaam |
| userAvatar | string? | Avatar URL |
| replyTo | object? | `{ messageId, userName, text }` — snippet van origineel |
| reactions | map | `{ "emoji": ["userId1", "userId2"] }` |
| deleted | boolean | Soft delete voor moderatie |
| createdAt | Timestamp | Server timestamp |

### `chat_rooms/{roomId}/muted_users`

| Veld | Type | Beschrijving |
|------|------|-------------|
| userId | string | Gemute gebruiker UID |
| mutedBy | string | Admin UID |
| mutedUntil | Timestamp | Einde mute |
| reason | string? | Optionele reden |

## Chatroom Lifecycle

### Aanmaken
- Admin maakt chatroom aan via `/admin/chat` met titel, beschrijving, gameType, en sluitdatum+tijd.
- Document wordt aangemaakt in `chat_rooms` met `status: "open"`.

### Automatisch sluiten
- Cron job (vergelijkbaar met bestaande crons in `app/api/cron/`) draait periodiek.
- Checkt `chat_rooms` waar `status == "open"` en `closesAt <= now()`.
- Zet `status` naar `"closed"`.
- Client-side check als eerste verdedigingslinie: als `closesAt` verstreken is, toon chat als read-only.

### Handmatig beheer
- Admin kan chatrooms handmatig sluiten of heropenen.
- Admin kan berichten verwijderen (soft delete) en gebruikers muten.

### Meerdere instanties
- Meerdere `chat_rooms` documenten met `status: "open"` — geen limiet.

## Real-time Client Architectuur

### Listener
- Per chatroom één `onSnapshot` op `messages` subcollection, gesorteerd op `createdAt` asc.
- Laatste 100 berichten bij openen, pagination met `startBefore` cursor voor oudere berichten.
- Custom hook: `useChatMessages(roomId)`.

### Berichten versturen
- `addDoc` naar `messages` subcollection met `serverTimestamp()`.
- Optimistic UI: bericht direct tonen, bevestigen na write.
- Client + security rules checken `status` en `closesAt` voor write-toestemming.

### Replies
- `replyTo` object met messageId, userName, en snippet (~100 chars).
- Compact reply-blokje boven het bericht in de UI.

### Emoji reacties
- Toggle via `arrayUnion` / `arrayRemove` op `reactions` map.
- Weergave: emoji + count onder elk bericht.

### Moderatie
- Admin: delete-knop per bericht (soft delete), mute-knop per user.
- Gemute users zien melding en kunnen niet typen tot mute verloopt.

## Security Rules
- Alleen authenticated users lezen/schrijven in open chatrooms.
- Schrijven geblokkeerd als `status == "closed"` of `closesAt <= now()`.
- Alleen admins kunnen berichten deleten en users muten.
- Users kunnen alleen berichten aanmaken met eigen userId.

## UI Pagina's

### `/chat` — Overzicht
- Cards met open chatrooms: titel, beschrijving, gameType badge, berichtcount, sluit-tijdstip.
- Sectie "Recent gesloten" met read-only gesloten chats.
- Alleen voor ingelogde gebruikers.

### `/chat/[roomId]` — Chatroom
- Header: titel, countdown timer (`react-countdown`), status badge.
- Berichtenlijst: scrollbaar, auto-scroll bij nieuwe berichten.
- Per bericht: avatar, naam, timestamp, tekst, reply-blokje, emoji reacties.
- Input onderaan: tekstveld + verstuurknop, reply-preview.
- Gesloten: input disabled met melding.

### `/admin/chat` — Admin beheer
- Tabel met alle chatrooms (status, datums, berichtcount).
- "Nieuwe chat" knop met formulier.
- Per chatroom: sluiten/heropenen, verwijderen.
- Moderatie inline vanuit chatroom (delete/mute).

## Styling
Tailwind CSS, aansluitend bij bestaand design. Geen nieuwe UI libraries.
