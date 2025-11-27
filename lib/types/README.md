# Oracle Games Type Definitions

This directory contains all TypeScript type definitions for the Oracle Games platform.

## Files

- **games.ts** - All game-related types (games, participants, teams, bids, leagues, etc.)
- **index.ts** - Main export file for convenient imports

## Usage

### Importing Types

```typescript
// Import all types
import { Game, GameParticipant, PlayerTeam, Bid } from '@/lib/types';

// Or import specific types from games
import { AuctioneerConfig, GameType } from '@/lib/types/games';
```

### Type Categories

#### 1. Game Types
- `Game` - Main game document
- `GameType` - Union type of all game types ('auctioneer', 'carry-me-home', etc.)
- `GameStatus` - Game lifecycle status
- `RaceType` - Type of race (season, grand-tour, classics, single-race)

#### 2. Game Configs
Each game type has its own configuration interface:
- `AuctioneerConfig`
- `CarryMeHomeConfig`
- `LastManStandingConfig`
- `PoisonedCupConfig`
- `NationsCupConfig`
- `RisingStarsConfig`
- `CountryRoadsConfig`
- `WorldTourManagerConfig`
- `FanFlandrienConfig`
- `GiorgioArmadaConfig`

#### 3. Participants & Teams
- `GameParticipant` - Player participation in a game
- `PlayerTeam` - Riders owned by a player in a game
- `ParticipantStatus` - Status of participation (active, eliminated, withdrawn)

#### 4. Auctions & Bidding
- `Bid` - Bid on a rider (for Auctioneer games)
- `BidStatus` - Status of a bid (active, outbid, won, lost)

#### 5. Stage & Race Picks
- `StagePick` - Pick for a specific stage (Carry Me Home, Fan Flandrien)
- `Prediction` - Individual prediction within a stage pick

#### 6. Leagues
- `League` - Friend league within a game
- `LeagueStanding` - Standings within a league
- `LeagueVisibility` - Access control for leagues

#### 7. Race Lineups
- `RaceLineup` - Which teams and riders participate in a race
- `RaceTeam` - Team information in a race
- `RaceRider` - Rider information in a race

#### 8. Divisions
- `Division` - Division/tier system for games

#### 9. Draft System
- `DraftPick` - Pick in a draft (Poisoned Cup, Rising Stars)

#### 10. Rider Pools
- `RiderPool` - Pool of riders (for Country Roads)
- `PoolRider` - Rider in a pool
- `PoolSelection` - Selection from a pool

### Client-Side Types

For use in React components and API responses, we provide client-safe versions with string dates instead of Firestore Timestamps:

- `ClientGame`
- `ClientGameParticipant`
- `ClientPlayerTeam`
- `ClientBid`
- `ClientStagePick`
- `ClientLeague`
- `ClientRaceLineup`
- `ClientDraftPick`

### Type Guards

Helper functions to narrow game types:

```typescript
if (isAuctioneer(game)) {
  // game.config is typed as AuctioneerConfig
  console.log(game.config.auctionStartDate);
}

if (isCarryMeHome(game)) {
  // game.config is typed as CarryMeHomeConfig
  console.log(game.config.pointsSystem);
}
```

## Database Collections

These types map to the following Firestore collections:

| Type | Collection | Document ID |
|------|-----------|-------------|
| `Game` | `games` | Auto-generated |
| `GameParticipant` | `gameParticipants` | Auto-generated |
| `PlayerTeam` | `playerTeams` | Auto-generated |
| `Bid` | `bids` | Auto-generated |
| `StagePick` | `stagePicks` | Auto-generated |
| `League` | `leagues` | Auto-generated |
| `RaceLineup` | `raceLineups` | `{race-slug}` |
| `Division` | `divisions` | Auto-generated |
| `DraftPick` | `draftPicks` | Auto-generated |
| `RiderPool` | `riderPools` | Auto-generated |

## Examples

### Creating a New Game

```typescript
import { Game, AuctioneerConfig } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

const config: AuctioneerConfig = {
  budget: 100,
  maxRiders: 8,
  auctionStartDate: Timestamp.fromDate(new Date('2025-06-20')),
  auctionEndDate: Timestamp.fromDate(new Date('2025-06-27')),
  auctionStatus: 'pending',
};

const game: Game = {
  name: 'Auctioneer - Tour de France 2025 - Division 1',
  gameType: 'auctioneer',
  raceRef: doc(db, 'races', 'tour-de-france_2025'),
  raceType: 'grand-tour',
  year: 2025,
  createdBy: 'admin-uid',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  status: 'draft',
  division: 'Division 1',
  divisionLevel: 1,
  playerCount: 0,
  maxPlayers: 50,
  eligibleTeams: ['team-visma-lease-a-bike', 'soudal-quick-step'],
  eligibleRiders: ['jonas-vingegaard', 'remco-evenepoel'],
  config,
};
```

### Placing a Bid

```typescript
import { Bid } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

const bid: Bid = {
  gameId: 'game-123',
  userId: 'user-456',
  playername: 'JohnDoe',
  riderNameId: 'remco-evenepoel',
  amount: 25,
  bidAt: Timestamp.now(),
  status: 'active',
  riderName: 'Remco Evenepoel',
  riderTeam: 'Soudal Quick-Step',
  jerseyImage: 'https://...',
};
```

### Joining a Game

```typescript
import { GameParticipant } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

const participant: GameParticipant = {
  gameId: 'game-123',
  userId: 'user-456',
  playername: 'JohnDoe',
  joinedAt: Timestamp.now(),
  status: 'active',
  budget: 100,
  spentBudget: 0,
  rosterSize: 0,
  rosterComplete: false,
  totalPoints: 0,
  ranking: 0,
  leagueIds: [],
};
```

## Notes

- All Firestore `Timestamp` types can also be `Date` for easier construction
- Client-side types use string dates for JSON serialization
- Use type guards (`isAuctioneer`, `isCarryMeHome`, etc.) to narrow game config types
- Optional fields are marked with `?`
- Arrays default to empty arrays `[]` when not provided
