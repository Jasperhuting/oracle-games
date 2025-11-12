# Stage Results Scraper Modules

This directory contains modular scraping functions for different classifications from ProCyclingStats stage results pages.

## Structure

```
getStageResultsItems/
├── index.ts                      # Main export file
├── shared-helpers.ts             # Shared helper functions for all scrapers
├── getStageResults-stage.ts      # Stage results (regular & TTT)
├── getStageResults-gc.ts         # General classification
├── getStageResults-points.ts     # Points classification
├── getStageResults-mountains.ts  # Mountains classification
├── getStageResults-youth.ts      # Youth classification
└── getStageResults-team.ts       # Team classification
```

## Modules

### `shared-helpers.ts`
Contains common helper functions used across all scrapers:
- `getPlace()` - Extract rider position
- `getCountry()` - Extract rider country
- `getFirstName()` / `getLastName()` - Extract rider names
- `getTeam()` - Extract team name
- `getTimeDifference()` - Extract time difference for stage results
- And more...

### `getStageResults-stage.ts`
Scrapes stage results including:
- Regular stage results with all rider data
- Team Time Trial (TTT) results with team and rider information
- Filters by rider start numbers if provided

### `getStageResults-gc.ts`
Scrapes general classification (GC) including:
- Rider positions and time differences
- Handles ",," notation for same time as leader
- Extracts UCI points and qualification times

### `getStageResults-points.ts`
Scrapes points classification including:
- Total points (`pointsTotal`)
- Points gained on stage (`points`)
- Handles complex table structure to find correct columns

### `getStageResults-mountains.ts`
Scrapes mountains classification including:
- Total mountain points (`pointsTotal`)
- Points gained on stage (`points`)
- Similar structure to points classification

### `getStageResults-youth.ts`
Scrapes youth/young rider classification including:
- Basic rider information
- Position in youth classification

### `getStageResults-team.ts`
Scrapes team classification including:
- Team positions
- Time differences converted to seconds
- Team class/category

## Usage

```typescript
import {
  scrapeStageResults,
  scrapeGeneralClassification,
  scrapePointsClassification,
  scrapeMountainsClassification,
  scrapeYouthClassification,
  scrapeTeamClassification,
} from './getStageResultsItems';

// In your main scraper function:
const $ = cheerio.load(html);
const stageTitle = $('.page-title > .imob').eq(0).text().trim();

const stageResults = scrapeStageResults($, stageTitle, riders);
const generalClassification = scrapeGeneralClassification($);
const pointsClassification = scrapePointsClassification($);
// ... etc
```

## Benefits of Modular Structure

1. **Maintainability**: Each classification has its own file, making it easier to update
2. **Testability**: Individual scrapers can be tested in isolation
3. **Reusability**: Helper functions are shared across all scrapers
4. **Clarity**: Main `getStageResult.ts` is now much shorter and clearer
5. **Debugging**: Easier to identify and fix issues in specific classifications

## Adding New Classifications

To add a new classification:

1. Create a new file: `getStageResults-[name].ts`
2. Import shared helpers: `import { createHelpers } from './shared-helpers'`
3. Export a scraping function that takes `$: CheerioAPI` and returns the appropriate type
4. Add the export to `index.ts`
5. Call the function in `getStageResult.ts`
