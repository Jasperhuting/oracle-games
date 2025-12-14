# Messaging System - Gebruikershandleiding

## Overzicht

Het messaging systeem stelt admins in staat om berichten te sturen naar alle gebruikers (broadcast) of naar individuele gebruikers. Gebruikers ontvangen realtime notificaties en kunnen hun berichten bekijken in hun inbox.

## Functionaliteiten

### Voor Admins

#### Berichten Versturen
1. Ga naar de **Admin Dashboard** (`/admin`)
2. Klik op de **Messaging** tab
3. Kies het type bericht:
   - **Broadcast to All Users**: Stuurt het bericht naar alle geregistreerde gebruikers
   - **Individual User**: Stuurt het bericht naar één specifieke gebruiker
4. Vul het formulier in:
   - **Onderwerp**: Een korte titel voor het bericht
   - **Bericht**: De volledige inhoud van het bericht
   - **Ontvanger** (alleen voor individuele berichten): Selecteer de gebruiker uit de dropdown
5. Klik op **Send Message**

#### Broadcast Berichten
- Worden automatisch naar alle gebruikers gestuurd (behalve de verzender zelf)
- Ideaal voor aankondigingen, updates, of belangrijke mededelingen
- Het systeem toont hoeveel gebruikers het bericht hebben ontvangen

#### Individuele Berichten
- Worden naar één specifieke gebruiker gestuurd
- Handig voor persoonlijke communicatie of support
- Selecteer de ontvanger uit de lijst van alle gebruikers

### Voor Gebruikers

#### Inbox Toegang
Er zijn twee manieren om je inbox te openen:
1. Klik op je **profielnaam** in de header en selecteer **Inbox**
2. Navigeer direct naar `/inbox`

#### Ongelezen Berichten Badge
- In het profielmenu zie je een rode badge met het aantal ongelezen berichten
- De badge toont "9+" als je meer dan 9 ongelezen berichten hebt
- De badge verdwijnt automatisch wanneer alle berichten zijn gelezen

#### Realtime Notificaties
- Wanneer je een nieuw bericht ontvangt, verschijnt er een notificatie rechtsboven in het scherm
- De notificatie toont:
  - Het onderwerp van het bericht
  - De naam van de verzender
  - Een mail icoon
- Klik op de notificatie om direct naar je inbox te gaan
- De notificatie verdwijnt automatisch na 5 seconden

#### Berichten Lezen
1. Open je inbox via het profielmenu
2. Aan de linkerkant zie je een lijst van al je berichten:
   - **Ongelezen berichten** hebben een blauwe achtergrond en een gesloten mail icoon
   - **Gelezen berichten** hebben een witte achtergrond en een open mail icoon
3. Klik op een bericht om het te lezen
4. Het bericht wordt automatisch als gelezen gemarkeerd
5. Broadcast berichten hebben een paarse "Broadcast" badge

#### Inbox Interface
- **Linker kolom**: Lijst van alle berichten, gesorteerd op datum (nieuwste eerst)
- **Rechter kolom**: Volledige inhoud van het geselecteerde bericht
- Berichten tonen:
  - Onderwerp
  - Verzender naam
  - Volledige bericht tekst
  - Datum en tijd van verzending
  - Type (Broadcast of Individual)

## Technische Details

### Firestore Collectie
Berichten worden opgeslagen in de `messages` collectie met de volgende structuur:
```typescript
{
  type: 'broadcast' | 'individual',
  senderId: string,           // Admin UID
  senderName: string,         // Admin display name
  recipientId: string,        // User UID
  recipientName: string,      // User display name
  subject: string,
  message: string,
  sentAt: Timestamp,
  read: boolean,
  readAt?: Timestamp
}
```

### API Endpoints

#### POST `/api/messages/send`
Verstuur een nieuw bericht (alleen voor admins)
```json
{
  "senderId": "admin-uid",
  "senderName": "Admin Name",
  "type": "broadcast" | "individual",
  "recipientId": "user-uid",  // alleen voor individual
  "recipientName": "User Name", // alleen voor individual
  "subject": "Onderwerp",
  "message": "Bericht tekst"
}
```

#### GET `/api/messages?userId={userId}`
Haal alle berichten op voor een gebruiker

#### PATCH `/api/messages/{messageId}/read`
Markeer een bericht als gelezen
```json
{
  "userId": "user-uid"
}
```

#### GET `/api/messages/unread-count?userId={userId}`
Haal het aantal ongelezen berichten op

### Security Rules
- Gebruikers kunnen alleen hun eigen berichten lezen
- Alleen admins kunnen berichten versturen (via API)
- Gebruikers kunnen alleen de `read` en `readAt` velden updaten van hun eigen berichten
- Alleen admins kunnen berichten verwijderen

### Realtime Updates
Het systeem gebruikt Firestore realtime listeners voor:
- Automatisch updaten van de inbox wanneer nieuwe berichten binnenkomen
- Realtime bijwerken van het aantal ongelezen berichten
- Tonen van notificaties voor nieuwe berichten

## Gebruik in Development

### Firestore Rules Deployen
Als je de Firestore rules wilt deployen:
```bash
firebase deploy --only firestore:rules
```

### Testen
1. Log in als admin
2. Ga naar Admin Dashboard > Messaging
3. Verstuur een test bericht (broadcast of individual)
4. Log in als normale gebruiker (of open in incognito)
5. Controleer of:
   - De notificatie verschijnt
   - De badge in het menu wordt getoond
   - Het bericht in de inbox staat
   - Het bericht als gelezen wordt gemarkeerd na het openen

## Toekomstige Uitbreidingen

Mogelijke verbeteringen voor de toekomst:
- Berichten kunnen verwijderen (voor gebruikers)
- Berichten kunnen beantwoorden
- Bijlagen toevoegen aan berichten
- Berichten filteren (gelezen/ongelezen, broadcast/individual)
- Zoeken in berichten
- Archiveren van berichten
- Email notificaties voor nieuwe berichten
- Push notificaties (met Firebase Cloud Messaging)
