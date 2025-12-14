# Games API Routes

Deze API routes beheren alle game-gerelateerde functionaliteit voor Oracle Games.

## Overzicht

### Game Management
- `POST /api/games/create` - Maak een nieuw spel aan (admin only)
- `GET /api/games/list` - Haal alle spellen op (met filters)
- `GET /api/games/[gameId]` - Haal een specifiek spel op
- `PATCH /api/games/[gameId]` - Update een spel (admin only)
- `DELETE /api/games/[gameId]` - Verwijder een spel (admin only)

### Participation
- `POST /api/games/[gameId]/join` - Meld je aan voor een spel
- `GET /api/games/[gameId]/participants` - Haal alle deelnemers op

### Team Management
- `POST /api/games/[gameId]/team/add-rider` - Voeg een renner toe aan je team
- `GET /api/games/[gameId]/team/list` - Haal je team op

### Bidding (Auctioneer)
- `POST /api/games/[gameId]/bids/place` - Plaats een bod
- `GET /api/games/[gameId]/bids/list` - Haal alle biedingen op

### Race Lineups
- `GET /api/raceLineups/[raceSlug]` - Haal race lineup op
- `PUT /api/raceLineups/[raceSlug]` - Update race lineup (admin only)

---

## Gedetailleerde Documentatie

### 1. Create Game

**Endpoint:** `POST /api/games/create`

**Access:** Admin only

**Body:**
```json
{
  "adminUserId": "admin-uid",
  "name": "Auctioneer - Tour de France 2025 - Division 1",
  "gameType": "auctioneer",
  "raceSlug": "tour-de-france_2025",
  "raceType": "grand-tour",
  "year": 2025,
  "status": "draft",
  "division": "Division 1",
  "divisionLevel": 1,
  "maxPlayers": 50,
  "eligibleTeams": ["team-visma-lease-a-bike", "soudal-quick-step"],
  "eligibleRiders": ["jonas-vingegaard", "remco-evenepoel"],
  "config": {
    "budget": 100,
    "maxRiders": 8,
    "auctionStartDate": "2025-06-20T00:00:00Z",
    "auctionEndDate": "2025-06-27T00:00:00Z",
    "auctionStatus": "pending"
  }
}
```

**Response:**
```json
{
  "success": true,
  "gameId": "game-id",
  "game": { /* game object */ }
}
```

---

### 2. List Games

**Endpoint:** `GET /api/games/list`

**Query Parameters:**
- `year` - Filter op jaar (optioneel)
- `status` - Filter op status: draft, registration, bidding, active, finished (optioneel)
- `gameType` - Filter op game type (optioneel)
- `limit` - Max aantal resultaten (default: 50)

**Example:**
```
GET /api/games/list?year=2025&status=registration&limit=20
```

**Response:**
```json
{
  "success": true,
  "games": [
    {
      "id": "game-id",
      "name": "Auctioneer - Tour de France 2025",
      "gameType": "auctioneer",
      "year": 2025,
      "status": "registration",
      "playerCount": 15,
      "maxPlayers": 50,
      /* ... */
    }
  ],
  "count": 5
}
```

---

### 3. Get Game

**Endpoint:** `GET /api/games/[gameId]`

**Response:**
```json
{
  "success": true,
  "game": {
    "id": "game-id",
    "name": "Auctioneer - Tour de France 2025",
    "gameType": "auctioneer",
    /* ... */
  }
}
```

---

### 4. Update Game

**Endpoint:** `PATCH /api/games/[gameId]`

**Access:** Admin only

**Body:**
```json
{
  "adminUserId": "admin-uid",
  "status": "registration",
  "playerCount": 20
}
```

**Response:**
```json
{
  "success": true,
  "game": { /* updated game object */ }
}
```

---

### 5. Delete Game

**Endpoint:** `DELETE /api/games/[gameId]?adminUserId=admin-uid`

**Access:** Admin only

**Response:**
```json
{
  "success": true,
  "message": "Game deleted successfully"
}
```

---

### 6. Join Game

**Endpoint:** `POST /api/games/[gameId]/join`

**Body:**
```json
{
  "userId": "user-uid"
}
```

**Response:**
```json
{
  "success": true,
  "participantId": "participant-id",
  "participant": {
    "id": "participant-id",
    "gameId": "game-id",
    "userId": "user-uid",
    "playername": "JohnDoe",
    "status": "active",
    "budget": 100,
    "spentBudget": 0,
    "rosterSize": 0,
    "rosterComplete": false,
    "totalPoints": 0,
    "ranking": 0
  }
}
```

---

### 7. Get Participants

**Endpoint:** `GET /api/games/[gameId]/participants`

**Query Parameters:**
- `orderBy` - Sorteer op: ranking, points, joinedAt (default: ranking)
- `limit` - Max aantal resultaten (default: 100)

**Example:**
```
GET /api/games/[gameId]/participants?orderBy=points&limit=50
```

**Response:**
```json
{
  "success": true,
  "participants": [
    {
      "id": "participant-id",
      "gameId": "game-id",
      "userId": "user-uid",
      "playername": "JohnDoe",
      "totalPoints": 250,
      "ranking": 1,
      /* ... */
    }
  ],
  "count": 15
}
```

---

### 8. Add Rider to Team

**Endpoint:** `POST /api/games/[gameId]/team/add-rider`

**Body:**
```json
{
  "userId": "user-uid",
  "riderNameId": "remco-evenepoel",
  "acquisitionType": "auction",
  "pricePaid": 25,
  "riderName": "Remco Evenepoel",
  "riderTeam": "Soudal Quick-Step",
  "riderCountry": "be",
  "jerseyImage": "https://...",
  "riderValue": 8
}
```

**Response:**
```json
{
  "success": true,
  "teamId": "team-id",
  "playerTeam": {
    "id": "team-id",
    "gameId": "game-id",
    "userId": "user-uid",
    "riderNameId": "remco-evenepoel",
    "riderName": "Remco Evenepoel",
    "pricePaid": 25,
    "active": true,
    "pointsScored": 0
  },
  "participant": {
    "rosterSize": 1,
    "spentBudget": 25,
    "rosterComplete": false
  }
}
```

---

### 9. Get Team

**Endpoint:** `GET /api/games/[gameId]/team/list?userId=user-uid`

**Query Parameters:**
- `userId` - User ID (required)
- `activeOnly` - Only active riders (default: false)

**Response:**
```json
{
  "success": true,
  "riders": [
    {
      "id": "team-id",
      "gameId": "game-id",
      "userId": "user-uid",
      "riderNameId": "remco-evenepoel",
      "riderName": "Remco Evenepoel",
      "riderTeam": "Soudal Quick-Step",
      "pricePaid": 25,
      "active": true,
      "pointsScored": 45,
      /* ... */
    }
  ],
  "count": 8
}
```

---

### 10. Place Bid

**Endpoint:** `POST /api/games/[gameId]/bids/place`

**Body:**
```json
{
  "userId": "user-uid",
  "riderNameId": "jonas-vingegaard",
  "amount": 30,
  "riderName": "Jonas Vingegaard",
  "riderTeam": "Team Visma | Lease a Bike",
  "jerseyImage": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "bidId": "bid-id",
  "bid": {
    "id": "bid-id",
    "gameId": "game-id",
    "userId": "user-uid",
    "playername": "JohnDoe",
    "riderNameId": "jonas-vingegaard",
    "amount": 30,
    "status": "active",
    "riderName": "Jonas Vingegaard"
  }
}
```

---

### 11. List Bids

**Endpoint:** `GET /api/games/[gameId]/bids/list`

**Query Parameters:**
- `userId` - Filter op user (optioneel)
- `riderNameId` - Filter op renner (optioneel)
- `status` - Filter op status: active, outbid, won, lost (optioneel)
- `limit` - Max aantal resultaten (default: 100)

**Example:**
```
GET /api/games/[gameId]/bids/list?riderNameId=jonas-vingegaard&status=active
```

**Response:**
```json
{
  "success": true,
  "bids": [
    {
      "id": "bid-id",
      "gameId": "game-id",
      "userId": "user-uid",
      "playername": "JohnDoe",
      "riderNameId": "jonas-vingegaard",
      "amount": 30,
      "status": "active",
      "bidAt": "2025-06-25T14:30:00Z"
    }
  ],
  "count": 5
}
```

---

### 12. Get Race Lineup

**Endpoint:** `GET /api/raceLineups/[raceSlug]`

**Example:**
```
GET /api/raceLineups/tour-de-france_2025
```

**Response:**
```json
{
  "success": true,
  "lineup": {
    "id": "tour-de-france_2025",
    "year": 2025,
    "raceRef": "races/tour-de-france_2025",
    "updatedAt": "2025-06-01T00:00:00Z",
    "updatedBy": "admin-uid",
    "teams": [
      {
        "teamSlug": "team-visma-lease-a-bike",
        "teamName": "Team Visma | Lease a Bike",
        "teamClass": "WorldTeam",
        "riders": [
          {
            "nameId": "jonas-vingegaard",
            "name": "Jonas Vingegaard",
            "startNumber": "1",
            "jerseyImage": "https://..."
          }
        ]
      }
    ]
  }
}
```

---

### 13. Update Race Lineup

**Endpoint:** `PUT /api/raceLineups/[raceSlug]`

**Access:** Admin only

**Body:**
```json
{
  "adminUserId": "admin-uid",
  "year": 2025,
  "teams": [
    {
      "teamSlug": "team-visma-lease-a-bike",
      "teamName": "Team Visma | Lease a Bike",
      "teamClass": "WorldTeam",
      "riders": [
        {
          "nameId": "jonas-vingegaard",
          "name": "Jonas Vingegaard",
          "startNumber": "1",
          "jerseyImage": "https://..."
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "lineup": { /* updated lineup */ },
  "eligibleTeams": ["team-visma-lease-a-bike", "soudal-quick-step"],
  "eligibleRiders": ["jonas-vingegaard", "remco-evenepoel", "..."]
}
```

---

## Error Responses

Alle endpoints kunnen de volgende error responses teruggeven:

**400 Bad Request:**
```json
{
  "error": "Missing required field"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Unauthorized - Admin access required"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**409 Conflict:**
```json
{
  "error": "Resource already exists"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to process request",
  "details": "Error message"
}
```

---

## Authentication

Alle endpoints vereisen authenticatie via Firebase Auth, behalve waar anders aangegeven.

Admin-only endpoints vereisen dat de authenticated user een `userType` van `'admin'` heeft in de `users` collectie.

---

## Activity Logging

Alle belangrijke acties worden automatisch gelogd in de `activityLogs` collectie voor audit purposes.

Gelogde acties:
- GAME_CREATED
- GAME_UPDATED
- GAME_DELETED
- GAME_JOINED
- BID_PLACED
- RIDER_ADDED_TO_TEAM
- RACE_LINEUP_UPDATED
