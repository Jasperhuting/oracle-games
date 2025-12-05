# Stap 1: Counting Races Implementatie - Voltooid ✅

## Overzicht
Deze implementatie voegt de mogelijkheid toe om te configureren welke races meetellen voor punten in Auctioneer games. Je kunt specifieke races selecteren OF race classifications kiezen (bijv. alle 1.1, 1.2 en WC races). Alle stages van geselecteerde races tellen mee.

## Wat is geïmplementeerd

### 1. Type Definities (`lib/types/games.ts`)
✅ **CountingRace interface** (regels 55-59)
```typescript
export interface CountingRace {
  raceId: string;                   // e.g., "tour-de-france_2025"
  raceSlug: string;                 // e.g., "tour-de-france"
  raceName: string;                 // e.g., "Tour de France"
}
```

✅ **AuctioneerConfig uitbreiding** (regels 69-70)
```typescript
export interface AuctioneerConfig {
  budget: number;
  maxRiders: number;
  auctionPeriods: AuctionPeriod[];
  auctionStatus: AuctionStatus;
  maxMinimumBid?: number;
  allowSharedRiders?: boolean;
  maxOwnersPerRider?: number;
  countingRaces?: CountingRace[];           // ✅ NIEUW - Specifieke races
  countingClassifications?: string[];       // ✅ NIEUW - Race classifications
}
```

### 2. UI Implementatie (`components/EditGameModal.tsx`)

✅ **State management** (regels 63-65)
- `countingRaces` state voor geselecteerde races
- `availableRaces` state voor beschikbare races uit database
- `loadingRaces` state voor loading indicator

✅ **Race laden** (regels 121-140)
- Automatisch races laden wanneer jaar verandert
- Gebruikt `/api/scraper/races?year={year}` endpoint
- Alleen voor auctioneer games

✅ **Race management functies** (regels 160-191)
- `addCountingRace(raceId)` - Voegt race toe aan lijst
- `removeCountingRace(index)` - Verwijdert race uit lijst
- `updateCountingRace(index, field, value)` - Update race configuratie
- Validatie: voorkomt duplicaten

✅ **UI Componenten** (regels 498-631)
- **Counting Races sectie:**
  - Dropdown om specifieke races toe te voegen
  - Lijst van geselecteerde races met race naam en remove knop
  - Duidelijke feedback wanneer geen races beschikbaar zijn
- **Race Classifications sectie:**
  - Dropdown met standaard classifications (wc, cc, nc, 1.UWT, 2.UWT, 1.Pro, 2.Pro, 1.1, 1.2, 2.1, 2.2)
  - Tag display van geselecteerde classifications
  - Remove knop per classification
- Alle stages van geselecteerde races tellen automatisch mee

✅ **Form submission** (regels 224-237)
- CountingRaces worden meegestuurd in config
- Alleen als er races zijn geselecteerd

### 3. API Endpoints

✅ **GET `/api/scraper/races?year={year}`** (`app/api/scraper/races/route.ts`)
- Haalt alle races op voor een specifiek jaar uit database
- Gesorteerd op startDate
- Gebruikt door EditGameModal om races te tonen

✅ **PATCH `/api/games/[gameId]`** (`app/api/games/[gameId]/route.ts`)
- Accepteert updates aan game config inclusief countingRaces
- Logt wijzigingen in activityLogs
- Verwijdert undefined fields automatisch

✅ **POST `/api/games/create`** (`app/api/games/create/route.ts`)
- Slaat config op zoals meegegeven
- CountingRaces worden automatisch meegenomen in config

## Hoe te gebruiken

### Als Admin:
1. **Scrape races eerst** (als nog niet gedaan voor het jaar)
   - Ga naar admin panel
   - Scrape races voor het gewenste jaar

2. **Maak of edit een Auctioneer game**
   - Open EditGameModal
   - Scroll naar "Counting Races (optional)" sectie
   - **Optie A**: Selecteer specifieke races uit dropdown
   - **Optie B**: Selecteer race classifications (bijv. 1.1, 1.2, wc)
   - **Optie C**: Combineer beide (specifieke races + classifications)
   - Alle stages van de geselecteerde races tellen automatisch mee
   - Sla op

3. **Voorbeelden:**
   - **Alleen Tour de France**: Voeg alleen Tour de France toe bij Counting Races
   - **Alle 1.1 en 1.2 races**: Selecteer "1.1" en "1.2" bij Race Classifications
   - **WC + belangrijke classics**: Selecteer "wc" classification + voeg handmatig Paris-Roubaix, Ronde van Vlaanderen toe
   - **Alle Grand Tours**: Voeg Tour de France, Giro d'Italia en Vuelta a España toe
   - **Alle races**: Laat beide lijsten leeg, dan tellen alle races mee

## Data Structuur in Firestore

```javascript
// Voorbeeld 1: Specifieke races
{
  "name": "Auctioneer - Grand Tours 2025",
  "gameType": "auctioneer",
  "config": {
    "budget": 100,
    "maxRiders": 8,
    "auctionPeriods": [...],
    "countingRaces": [
      {
        "raceId": "tour-de-france_2025",
        "raceSlug": "tour-de-france",
        "raceName": "Tour de France"
      },
      {
        "raceId": "giro-d-italia_2025",
        "raceSlug": "giro-d-italia",
        "raceName": "Giro d'Italia"
      }
    ]
  }
}

// Voorbeeld 2: Classifications
{
  "name": "Auctioneer - One Day Races 2025",
  "gameType": "auctioneer",
  "config": {
    "budget": 100,
    "maxRiders": 8,
    "auctionPeriods": [...],
    "countingClassifications": ["1.1", "1.2", "wc"]
  }
}

// Voorbeeld 3: Combinatie
{
  "name": "Auctioneer - Mixed 2025",
  "gameType": "auctioneer",
  "config": {
    "budget": 100,
    "maxRiders": 8,
    "auctionPeriods": [...],
    "countingRaces": [
      {
        "raceId": "tour-de-france_2025",
        "raceSlug": "tour-de-france",
        "raceName": "Tour de France"
      }
    ],
    "countingClassifications": ["1.1", "wc"]
  }
}
```

## Volgende Stappen (Stap 2)

De configuratie is nu volledig werkend. Voor Stap 2 moet er logica worden toegevoegd om:

1. **Bij het opslaan van stage results** (`/api/saveStageResult`):
   - Check welke games deze race/stage gebruiken in hun countingRaces
   - Bereken en ken punten toe aan spelers

2. **Punten berekening**:
   - Check of race in countingRaces staat OF race classification in countingClassifications staat
   - Als beide leeg zijn, tellen alle races mee
   - Alle stages van de race tellen mee
   - Update PlayerTeam.pointsScored
   - Update GameParticipant.totalPoints

## Testing Checklist

- [ ] Maak een test Auctioneer game aan
- [ ] Voeg specifieke races toe via EditGameModal
- [ ] Voeg classifications toe (bijv. 1.1, 1.2)
- [ ] Sla op en verifieer in Firestore
- [ ] Edit de game en verifieer dat beide correct worden geladen
- [ ] Verwijder een race en een classification
- [ ] Test met alleen races
- [ ] Test met alleen classifications
- [ ] Test met combinatie van beide
- [ ] Test met lege lijsten (alle races tellen mee)

## Opmerkingen

- Als `countingRaces` EN `countingClassifications` beide leeg/undefined zijn, tellen ALLE races mee (backward compatible)
- Een race telt mee als:
  - De race in `countingRaces` staat, OF
  - De race classification in `countingClassifications` staat
- Alle stages van een geselecteerde race tellen automatisch mee
- Race data wordt opgehaald uit de `races` collectie in Firestore
- Races moeten eerst gescraped zijn voordat ze geselecteerd kunnen worden
- Classifications zijn standaard waarden uit ProCyclingStats (wc, cc, nc, 1.UWT, 2.UWT, 1.Pro, 2.Pro, 1.1, 1.2, 2.1, 2.2)
- Flexibel systeem: gebruik specifieke races voor precisie, classifications voor gemak
