# Stap 2: Punten Systeem Implementatie ✅

## Overzicht
Volledige implementatie van het complexe puntensysteem voor Auctioneer games met:
- Top 20 punten voor etappe uitslagen en classificaties
- Berg- en sprintpunten tijdens etappes
- Ploegenklassement punten
- Strijdlust bonus
- Multipliers voor rustdagen en eindstand

## Puntensysteem

### 1. Top 20 Punten (Etappe Uitslagen & Classificaties)
**50 – 44 – 40 – 36 – 32 – 30 – 28 – 26 – 24 – 22 – 20 – 18 – 16 – 14 – 12 – 10 – 8 – 6 – 4 – 2**

Wordt toegekend voor:
- ✅ **Etappe uitslag** (elke etappe)
- ✅ **Algemeen klassement** (rustdagen + eindstand met multipliers)
- ✅ **Puntenklassement** (eindstand)
- ✅ **Bergklassement** (eindstand)
- ✅ **Jongerenklassement** (eindstand)

### 2. Bergpunten Tijdens Etappe
- **Tour de France**: 4x de behaalde bergpunten
- **Giro d'Italia**: 2x de behaalde bergpunten
- **Vuelta**: Nog te bepalen

⚠️ **Status**: Functie geïmplementeerd, maar vereist extra data van scraper

### 3. Sprintpunten Tijdens Etappe
- **Tour & Giro**: 2x de behaalde sprintpunten
- **Vuelta**: Nog te bepalen

⚠️ **Status**: Functie geïmplementeerd, maar vereist extra data van scraper

### 4. Ploegenklassement
**5 – 4 – 3 – 2 – 1 punten**

Voor elke nog actieve renner in de ploeg volgens de etappe uitslag.

⚠️ **Status**: Functie geïmplementeerd, maar vereist team tracking

### 5. Strijdlust Bonus
**25 punten** bij aanwezigheid in de vlucht voor langer dan 50% van de etappe.

⚠️ **Status**: Functie geïmplementeerd, maar vereist breakaway data van scraper

## Multipliers voor Algemeen Klassement

### Rustdagen
- **Eerste rustdag**: 1x punten
- **Tweede rustdag**: 2x punten

### Eindstand
- **Laatste etappe**: 3x punten

### Reguliere Etappes
- **Geen GC punten** (alleen etappe uitslag telt)

## Classificatie Eindstanden

### Puntenklassement
- **1x punten** na afloop van de Tour

### Bergklassement
- **1x punten** na afloop van de Tour

### Jongerenklassement
- **2x punten** tijdens de Tour (nog te bepalen wanneer precies)
- Voor nu: alleen bij eindstand

## Geïmplementeerde Bestanden

### 1. Types: `/lib/types/games.ts`
```typescript
export interface CountingRace {
  raceId: string;
  raceSlug: string;
  raceName: string;
  restDays?: number[];              // [9, 16] voor Tour de France
  mountainPointsMultiplier?: number; // 4 voor Tour, 2 voor Giro
  sprintPointsMultiplier?: number;  // 2 (default)
}
```

### 2. Helper Functies: `/lib/utils/pointsCalculation.ts`

**Constanten:**
```typescript
TOP_20_POINTS = {1: 50, 2: 44, 3: 40, ..., 20: 2}
TEAM_CLASSIFICATION_POINTS = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
COMBATIVITY_BONUS = 25
```

**Functies:**
- `calculateStagePoints(rank)` - Top 20 punten
- `calculateMountainPoints(points, multiplier)` - Berg punten
- `calculateSprintPoints(points, multiplier)` - Sprint punten
- `calculateTeamPoints(rank, activeRiders)` - Ploeg punten
- `calculateCombativityBonus(wasInBreakaway)` - Strijdlust
- `getGCMultiplier(stage, total, restDays)` - GC multiplier
- `getClassificationMultiplier(type, stage, total)` - Classificatie multiplier

### 3. API Endpoint: `/app/api/games/calculate-points/route.ts`

**Punten Berekening Flow:**

1. **Etappe Uitslag** (altijd)
   - Top 20 krijgt punten

2. **Algemeen Klassement** (rustdagen + eindstand)
   - Check `getGCMultiplier()` voor multiplier
   - Als > 0: top 20 krijgt punten × multiplier

3. **Puntenklassement** (alleen eindstand)
   - Check `getClassificationMultiplier('points')`
   - Als > 0: top 20 krijgt punten

4. **Bergklassement** (alleen eindstand)
   - Check `getClassificationMultiplier('mountains')`
   - Als > 0: top 20 krijgt punten

5. **Jongerenklassement** (alleen eindstand)
   - Check `getClassificationMultiplier('youth')`
   - Als > 0: top 20 krijgt punten

6. **Berg/Sprint/Strijdlust** (TODO)
   - Vereist extra data van scraper

## Configuratie Voorbeeld

### Tour de France 2025
```typescript
{
  gameType: 'auctioneer',
  config: {
    budget: 100,
    maxRiders: 8,
    countingRaces: [{
      raceId: 'tour-de-france_2025',
      raceSlug: 'tour-de-france',
      raceName: 'Tour de France',
      restDays: [9, 16],              // Etappe 9 en 16 zijn rustdagen
      mountainPointsMultiplier: 4,     // 4x bergpunten
      sprintPointsMultiplier: 2        // 2x sprintpunten
    }]
  }
}
```

### Giro d'Italia 2025
```typescript
{
  countingRaces: [{
    raceId: 'giro-d-italia_2025',
    raceSlug: 'giro-d-italia',
    raceName: "Giro d'Italia",
    restDays: [8, 15],
    mountainPointsMultiplier: 2,      // 2x bergpunten (anders dan Tour!)
    sprintPointsMultiplier: 2
  }]
}
```

## Voorbeeld Punten Berekening

### Scenario: Etappe 10 (Eerste Rustdag)

**Renner A:**
- Etappe uitslag: 3e plaats → **40 punten**
- GC stand: 5e plaats → **32 punten × 1** (rustdag multiplier) = **32 punten**
- **Totaal: 72 punten**

**Renner B:**
- Etappe uitslag: 15e plaats → **12 punten**
- GC stand: 25e plaats → **0 punten** (buiten top 20)
- **Totaal: 12 punten**

### Scenario: Laatste Etappe (Stage 21)

**Renner A:**
- Etappe uitslag: 1e plaats → **50 punten**
- GC stand: 2e plaats → **44 punten × 3** (eindstand multiplier) = **132 punten**
- Puntenklassement: 10e plaats → **22 punten**
- **Totaal: 204 punten**

**Renner B:**
- Etappe uitslag: 8e plaats → **26 punten**
- GC stand: 15e plaats → **12 punten × 3** = **36 punten**
- Bergklassement: 3e plaats → **40 punten**
- **Totaal: 102 punten**

## Database Updates

### PlayerTeam Collection
```typescript
{
  pointsScored: number,        // Totaal punten van deze renner (alle races)
  stagesParticipated: number,  // Aantal etappes meegedaan (alle races)
  
  // ✅ NIEUW: Race-specifieke tracking
  racePoints: {
    "tour-de-france_2025": {
      totalPoints: number,     // Totaal voor deze race
      stagePoints: {
        "1": {                 // Per etappe
          stageResult: number,
          gcPoints: number,
          pointsClass: number,
          mountainsClass: number,
          youthClass: number,
          mountainPoints: number,
          sprintPoints: number,
          combativityBonus: number,
          teamPoints: number,
          total: number
        }
      }
    }
  }
}
```

### GameParticipant Collection
```typescript
{
  totalPoints: number,  // Som van alle renners
  ranking: number,      // Positie in game
}
```

## Wat Werkt ✅

1. **Etappe uitslagen** - Top 20 krijgt punten
2. **Algemeen klassement** - Met rustdag/eindstand multipliers
3. **Puntenklassement** - Bij eindstand
4. **Bergklassement** - Bij eindstand
5. **Jongerenklassement** - Bij eindstand
6. **Automatische ranking updates**
7. **Configureerbare multipliers per race**
8. **✅ NIEUW: Race-specifieke punten tracking** - Per race en per etappe breakdown
9. **✅ NIEUW: Debug endpoint** - Voor troubleshooting
10. **✅ NIEUW: UI component** - RacePointsBreakdown voor visualisatie

## Wat Nog Moet Worden Geïmplementeerd ⚠️

### 1. Berg/Sprint Punten Tijdens Etappe
**Vereist**: Scraper moet berg- en sprintpunten per etappe bijhouden

**Data structuur nodig**:
```typescript
interface StageResult {
  // ... bestaande velden
  mountainPointsEarned?: Array<{
    riderNameId: string;
    points: number;  // Punten behaald op deze etappe
  }>;
  sprintPointsEarned?: Array<{
    riderNameId: string;
    points: number;
  }>;
}
```

### 2. Ploegenklassement
**Vereist**: 
- Tracking van welke renners nog actief zijn
- Team affiliatie van renners
- Ploegenklassement in stage results

### 3. Strijdlust Bonus
**Vereist**: Scraper moet breakaway informatie bijhouden

**Data structuur nodig**:
```typescript
interface StageResult {
  // ... bestaande velden
  breakawayRiders?: Array<{
    riderNameId: string;
    percentageInBreakaway: number;  // 0-100
  }>;
}
```

### 4. Jongerenklassement Timing
**TODO**: Bepaal wanneer jongerenklassement 2x wordt toegekend
- Optie 1: Bij beide rustdagen
- Optie 2: Bij tweede rustdag + eindstand
- Optie 3: Configureerbaar per race

### 5. Totaal Aantal Etappes
**TODO**: Haal totaal aantal etappes op uit race data
- Nu hardcoded op 21 (Grand Tours)
- Moet dynamisch worden voor andere races

## Testing

### Test Scenario 1: Reguliere Etappe
```bash
# Etappe 5 (geen rustdag, geen eindstand)
POST /api/saveStageResult
{
  "raceSlug": "tour-de-france_2025",
  "stage": "5",
  "year": "2025"
}

# Verwacht:
# - Alleen etappe uitslag punten
# - Geen GC punten
# - Geen classificatie punten
```

### Test Scenario 2: Eerste Rustdag
```bash
# Etappe 9 (eerste rustdag)
POST /api/saveStageResult
{
  "raceSlug": "tour-de-france_2025",
  "stage": "9",
  "year": "2025"
}

# Verwacht:
# - Etappe uitslag punten
# - GC punten × 1
# - Geen classificatie punten
```

### Test Scenario 3: Laatste Etappe
```bash
# Etappe 21 (eindstand)
POST /api/saveStageResult
{
  "raceSlug": "tour-de-france_2025",
  "stage": "21",
  "year": "2025"
}

# Verwacht:
# - Etappe uitslag punten
# - GC punten × 3
# - Puntenklassement punten
# - Bergklassement punten
# - Jongerenklassement punten
```

## Logging

Alle punten toekenning wordt gelogd:

```
[CALCULATE_POINTS] Remco Evenepoel - Stage result: 50 pts (rank 1)
[CALCULATE_POINTS] Remco Evenepoel - GC: 132 pts (rank 2 x 3)
[CALCULATE_POINTS] Remco Evenepoel - Points class: 22 pts (rank 10)
[CALCULATE_POINTS] Remco Evenepoel - Updated race points for tour-de-france_2025 stage 21: +204 (race total: 1547)
[CALCULATE_POINTS] Updated Jasper's Team: +204 points (total: 1547)
```

## Debug Endpoint

Voor troubleshooting is er een debug endpoint:

```bash
GET /api/games/debug-points?gameId=xxx&userId=yyy

# Response:
{
  "game": {
    "name": "Auctioneer - Tour de France 2025",
    "gameType": "auctioneer",
    "status": "active",
    "config": {...}
  },
  "participants": [{
    "playername": "Jasper",
    "totalPoints": 1547,
    "ranking": 1,
    "riders": [{
      "riderName": "Remco Evenepoel",
      "pointsScored": 204,
      "stagesParticipated": 21,
      "racePoints": {
        "tour-de-france_2025": {
          "totalPoints": 204,
          "stagePoints": {
            "1": { "stageResult": 50, "total": 50 },
            "21": { "stageResult": 50, "gcPoints": 132, "pointsClass": 22, "total": 204 }
          }
        }
      }
    }]
  }]
}
```

## Volgende Stappen

1. **Scraper Updates** - Voeg berg/sprint/breakaway data toe
2. **Team Tracking** - Implementeer ploegenklassement
3. **Jongerenklassement** - Bepaal timing voor 2x toekenning
4. **Dynamic Total Stages** - Haal uit race data
5. **Admin UI** - Maak interface voor handmatige correcties
6. **Stap 4: Geblesseerde Renners** - Injury/refund systeem
