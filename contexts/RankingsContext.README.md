# RankingsContext

Een React Context voor het centraal beheren van rankings_2026 data met automatische IndexedDB caching.

## Waarom deze context?

Voorheen werd op veel plekken in de app de `/api/getRankings` endpoint aangeroepen, wat leidde tot:
- Meerdere "dure" API calls voor dezelfde data
- Duplicatie van cache logica
- Inconsistente data tussen componenten

Met de RankingsContext:
- ✅ Rankings worden **1x** opgehaald en gecached in IndexedDB
- ✅ Alle componenten delen dezelfde data
- ✅ Automatische cache invalidatie via versioning
- ✅ Eenvoudige API via `useRankings()` hook

## Setup

De `RankingsProvider` is al toegevoegd aan de root layout in [`app/layout.tsx`](../app/layout.tsx) met `autoLoad={false}`. Dit betekent dat de context beschikbaar is in de hele app, maar data wordt pas geladen wanneer een component dit nodig heeft.

## Gebruik

### Basis gebruik

```tsx
'use client'

import { useRankings } from '@/contexts/RankingsContext';

export default function MyComponent() {
  const { riders, loading, error, refetch } = useRankings();

  useEffect(() => {
    // Laad rankings wanneer component mount
    if (riders.length === 0) {
      refetch();
    }
  }, [riders, refetch]);

  if (loading) return <div>Laden...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Alle renners ({riders.length})</h1>
      {riders.map(rider => (
        <div key={rider.id}>
          {rider.rank}. {rider.name} - {rider.points} pts
        </div>
      ))}
    </div>
  );
}
```

### Specifieke renner ophalen

```tsx
const { getRiderById } = useRankings();

const rider = getRiderById('tadej-pogacar');
if (rider) {
  console.log(`${rider.name} heeft ${rider.points} punten`);
}
```

### Meerdere renners ophalen

```tsx
const { getRidersByIds } = useRankings();

const selectedRiderIds = ['tadej-pogacar', 'jonas-vingegaard', 'remco-evenepoel'];
const selectedRiders = getRidersByIds(selectedRiderIds);

console.log(`Geselecteerd: ${selectedRiders.length} renners`);
```

### Data filteren

```tsx
const { riders } = useRankings();

// Top 100 renners
const top100 = riders
  .filter(r => r.rank && r.rank <= 100)
  .sort((a, b) => (a.rank || 0) - (b.rank || 0));

// Belgische renners
const belgianRiders = riders.filter(r => r.country === 'BEL');

// Niet-gepensioneerde renners
const activeRiders = riders.filter(r => !r.retired);
```

### Custom year

Standaard wordt het jaar uit `NEXT_PUBLIC_PLAYING_YEAR` gebruikt (2026). Je kunt een custom year gebruiken met een nested provider:

```tsx
import { RankingsProvider } from '@/contexts/RankingsContext';

export default function HistoricalPage() {
  return (
    <RankingsProvider year={2025} autoLoad={true}>
      <MyComponent />
    </RankingsProvider>
  );
}
```

## API Reference

### `useRankings()`

Hook die toegang geeft tot de rankings context.

**Returns:**
```typescript
{
  riders: Rider[];              // Alle geladen renners
  loading: boolean;             // True tijdens het laden
  error: string | null;         // Error message indien gefaald
  refetch: () => Promise<void>; // Functie om data opnieuw op te halen
  getRiderById: (id: string) => Rider | undefined;  // Haal 1 renner op
  getRidersByIds: (ids: string[]) => Rider[];       // Haal meerdere renners op
  year: number;                 // Het jaar van de rankings
}
```

### `Rider` Type

```typescript
interface Rider {
  id: string;              // Document ID (meestal nameID)
  nameID?: string;         // URL-safe versie van naam
  name: string;            // Volledige naam
  country: string;         // Landcode
  rank?: number;           // UCI ranking positie
  points?: number;         // UCI punten
  team?: string;           // Teamnaam
  teamId?: string;         // Team document ID
  jerseyImage?: string;    // URL naar foto
  retired?: boolean;       // Of renner gestopt is
  age?: string | number;   // Leeftijd
  firstName?: string;
  lastName?: string;
}
```

## Cache Beheer

### Cache Version

In [`contexts/RankingsContext.tsx`](./RankingsContext.tsx) wordt de `CACHE_VERSION` gebruikt:

```typescript
const CACHE_VERSION = 2;
```

Verhoog dit nummer wanneer de structuur van de rider data verandert, om oude cache te invalideren.

### IndexedDB

Data wordt opgeslagen in IndexedDB onder de key `rankings_{year}`. De cache:
- Heeft ~50MB+ capaciteit (veel meer dan sessionStorage)
- Blijft bestaan tussen sessies
- Wordt automatisch opgeschoond bij versie mismatch

## Migratie van bestaande code

### Oud patroon (vermijden):

```tsx
// ❌ OUDE MANIER - vermijd dit
const [riders, setRiders] = useState<Rider[]>([]);

useEffect(() => {
  const fetchRiders = async () => {
    const response = await fetch(`/api/getRankings?year=2026&limit=500`);
    const data = await response.json();
    setRiders(data.riders);
  };
  fetchRiders();
}, []);
```

### Nieuw patroon (gebruik dit):

```tsx
// ✅ NIEUWE MANIER - gebruik de context
const { riders, loading, refetch } = useRankings();

useEffect(() => {
  if (riders.length === 0) {
    refetch();
  }
}, [riders, refetch]);
```

## Voorbeelden uit de codebase

### Auction Page

Zie [`app/games/[gameId]/auction/page.tsx`](../app/games/[gameId]/auction/page.tsx) voor een volledig voorbeeld:

```tsx
const { riders: rankingsRiders, refetch: refetchRankings } = useRankings();

// Later in de code...
if (rankingsRiders.length === 0) {
  await refetchRankings();
}

let riders: Rider[] = rankingsRiders;

// Filter op eligible riders
if (gameData.game.eligibleRiders?.length > 0) {
  const eligibleSet = new Set(gameData.game.eligibleRiders);
  riders = riders.filter(r => eligibleSet.has(r.nameID || r.id || ''));
}
```

## Performance Tips

1. **Lazy loading**: Gebruik `autoLoad={false}` en roep `refetch()` alleen aan wanneer nodig
2. **Memoization**: Gebruik `useMemo` voor gefilterde/gesorteerde lijsten:
   ```tsx
   const top100 = useMemo(() =>
     riders.filter(r => r.rank && r.rank <= 100),
     [riders]
   );
   ```
3. **Virtualization**: Voor lange lijsten, gebruik virtualisatie (b.v. react-window)

## Troubleshooting

**Q: Rankings laden niet**
- Check of `refetch()` wordt aangeroepen
- Check de browser console voor errors
- Verifieer dat `/api/getRankings` werkt

**Q: Oude data wordt getoond**
- Verhoog `CACHE_VERSION` in RankingsContext.tsx
- Of clear IndexedDB handmatig in DevTools

**Q: "useRankings must be used within a RankingsProvider"**
- Zorg dat je component binnen de `RankingsProvider` staat
- De provider staat in `app/layout.tsx`
