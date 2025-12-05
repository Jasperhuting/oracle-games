# Test Plan: Points Calculation

## Wat is geïmplementeerd ✅

1. **Race-specifieke punten tracking**
   - Elk renner heeft nu `racePoints` object met breakdown per race en per etappe
   - Je kunt nu zien hoeveel punten elke renner per race heeft gescoord
   - Punten worden niet overschreven maar opgeteld per race

2. **Gedetailleerde breakdown per etappe**
   - Per etappe zie je exact waar de punten vandaan komen:
     - `stageResult`: Punten van etappe uitslag
     - `gcPoints`: Punten van algemeen klassement (met multiplier)
     - `pointsClass`: Punten van puntenklassement
     - `mountainsClass`: Punten van bergklassement
     - `youthClass`: Punten van jongerenklassement
     - `total`: Totaal voor deze etappe

3. **Debug endpoint**
   - `/api/games/debug-points?gameId=xxx&userId=yyy`
   - Laat alle punten details zien per deelnemer en per renner

## Test Scenario

### Stap 1: Controleer bestaande game
```bash
# Haal gameId op uit Firestore console of via de app
# Bijvoorbeeld: gameId = "abc123"
```

### Stap 2: Voeg een etappe toe
Via de admin interface:
1. Ga naar Admin panel (`/admin`)
2. Klik op de tab **"Races"**
3. Selecteer een race (bijv. "Tour de France 2025")
4. Klik op de knop **"Etappes"** (bovenaan)
5. Vul bij "Add Stage" het etappe nummer in (bijv. "1")
6. Klik op **"Save"**

Dit zal:
- Stage results scrapen van ProCyclingStats
- Opslaan in Firestore
- **Automatisch punten berekenen** voor alle actieve Auctioneer games
- Rankings updaten

### Stap 3: Check de logs
In de console zou je moeten zien:
```
[saveStageResult] Fetching stage 1 for tour-de-france 2025
[saveStageResult] Scraped X riders for stage 1
[saveStageResult] Triggering points calculation...
[CALCULATE_POINTS] Starting points calculation for tour-de-france_2025 stage 1
[CALCULATE_POINTS] Found X riders in stage results
[CALCULATE_POINTS] Found Y active auctioneer games
[CALCULATE_POINTS] Processing game: [Game Name]
[CALCULATE_POINTS] [Rider Name] - Stage result: 50 pts (rank 1)
[CALCULATE_POINTS] [Rider Name] - Updated race points for tour-de-france_2025 stage 1: +50 (race total: 50)
```

### Stap 4: Gebruik debug endpoint
```bash
GET /api/games/debug-points?gameId=YOUR_GAME_ID

# Of voor specifieke user:
GET /api/games/debug-points?gameId=YOUR_GAME_ID&userId=YOUR_USER_ID
```

### Stap 5: Check in Firestore
Ga naar Firestore console en check:
1. Collection: `playerTeams`
2. Filter op `gameId == YOUR_GAME_ID`
3. Check of renners nu hebben:
   - `pointsScored`: > 0
   - `stagesParticipated`: > 0
   - `racePoints`: object met race data

## Verwachte Output

### PlayerTeam document na etappe 1:
```json
{
  "gameId": "abc123",
  "userId": "user123",
  "riderName": "Remco Evenepoel",
  "riderNameId": "remco-evenepoel",
  "pointsScored": 50,
  "stagesParticipated": 1,
  "racePoints": {
    "tour-de-france_2025": {
      "totalPoints": 50,
      "stagePoints": {
        "1": {
          "stageResult": 50,
          "total": 50
        }
      }
    }
  }
}
```

### Na rustdag (etappe 9):
```json
{
  "pointsScored": 122,
  "stagesParticipated": 9,
  "racePoints": {
    "tour-de-france_2025": {
      "totalPoints": 122,
      "stagePoints": {
        "1": { "stageResult": 50, "total": 50 },
        "2": { "stageResult": 44, "total": 44 },
        "9": { 
          "stageResult": 40, 
          "gcPoints": 32,
          "total": 72 
        }
      }
    }
  }
}
```

## Troubleshooting

### Probleem: Geen punten zichtbaar
1. Check console logs - wordt calculate-points aangeroepen?
2. Check of game status = 'active' of 'bidding'
3. Check of race in `countingRaces` staat (in game config)
4. Check of renner nameID match met stage result nameID

### Probleem: Calculate-points wordt niet aangeroepen
1. Check of `NEXT_PUBLIC_BASE_URL` environment variable is ingesteld
2. Check saveStageResult logs voor errors
3. Probeer handmatig calculate-points aan te roepen:
```bash
POST /api/games/calculate-points
{
  "raceSlug": "tour-de-france_2025",
  "stage": "1",
  "year": "2025"
}
```

### Probleem: Renner niet gevonden
- Check of `riderNameId` in playerTeams exact match met `nameID` in stage results
- Of check of `shortName` (lowercase, spaces replaced with -) match

## Volgende Stappen

Na succesvolle test:
1. ✅ Race-specifieke tracking werkt
2. 🔄 Implementeer dynamic total stages
3. 🔄 Voeg UI toe om race points te tonen
4. 🔄 Voeg berg/sprint punten toe (vereist scraper update)
