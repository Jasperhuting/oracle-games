# Oracle Games - Cycling Data Scraper

A Next.js application for scraping and managing professional cycling race data with Firebase integration.

## Overview

This application scrapes cycling race data from ProCyclingStats.com and stores it in Firebase Firestore. It supports both startlist data (riders and teams) and stage results for various professional cycling races.

## Features

- **Web-based Scraper Interface**: User-friendly form to select and scrape cycling data
- **Firebase Integration**: Automatic storage and retrieval from Firestore
- **Real-time Updates**: Live feedback during scraping operations
- **Data Overwriting**: New scrapes automatically overwrite existing data
- **Multiple Race Support**: Supports 17 major cycling races
- **TypeScript**: Fully typed for better development experience

## Supported Races

- Tour de France
- Giro d'Italia
- Vuelta a España
- World Championship
- Milano-Sanremo
- Amstel Gold Race
- Tirreno-Adriatico
- Liège–Bastogne–Liège
- Il Lombardia
- La Flèche Wallonne
- Paris-Nice
- Paris-Roubaix
- Volta a Catalunya
- Critérium du Dauphiné
- Ronde van Vlaanderen
- Gent-Wevelgem
- San Sebastián

## Routes

### Web Pages

#### `/` - Home Page
- **Purpose**: Main landing page
- **Features**: Overview of the application
- **Components**: Basic navigation and information

#### `/scraper` - Scraper Interface
- **Purpose**: Interactive form for scraping cycling data
- **Features**:
  - Race selection dropdown
  - Year input (2000-current)
  - Data type selection (Startlist or Stage Result)
  - Stage number input (for stage results)
  - Real-time scraping feedback
  - Success/error messaging
- **Usage**: 
  1. Select a race from the dropdown
  2. Choose the year
  3. Pick data type (Startlist or Stage Result)
  4. For stages, specify the stage number
  5. Click "Start Scraping"

## API Routes

### `/api/scraper` - Main Scraper API

#### POST `/api/scraper`
**Purpose**: Scrape cycling data and save to Firebase

**Request Body**:
```json
{
  "race": "tour-de-france",
  "year": 2025,
  "type": "startlist", // or "stage"
  "stage": 1 // required only for type: "stage"
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Data scraped and saved to Firebase",
  "key": {
    "race": "tour-de-france",
    "year": 2025,
    "type": "startlist"
  },
  "dataCount": 22,
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

**Response Error**:
```json
{
  "success": false,
  "error": "Stage number required for stage type"
}
```

#### GET `/api/scraper`
**Purpose**: List all available scraped data or retrieve specific data

**Query Parameters** (all optional):
- `race`: Race slug (e.g., "tour-de-france")
- `year`: Year (e.g., "2025")
- `type`: Data type ("startlist" or "stage")
- `stage`: Stage number (required if type is "stage")

**Response (List all data)**:
```json
{
  "success": true,
  "availableData": [
    {
      "id": "tour-de-france-2025-startlist",
      "key": {
        "race": "tour-de-france",
        "year": 2025,
        "type": "startlist"
      },
      "updatedAt": "2025-01-20T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

**Response (Specific data)**:
```json
{
  "success": true,
  "data": {
    "race": "tour-de-france",
    "year": 2025,
    "source": "https://www.procyclingstats.com/race/tour-de-france/2025/startlist",
    "count": 22,
    "riders": [...],
    "scrapedAt": "2025-01-20T10:30:00.000Z"
  },
  "key": {
    "race": "tour-de-france",
    "year": 2025,
    "type": "startlist"
  }
}
```

### `/api/scrape` - Legacy Scraper API

#### POST `/api/scrape`
**Purpose**: Legacy scraper endpoint (returns data without saving to Firebase)

**Request Body**:
```json
{
  "command": "getRiders-Tour", // or other predefined commands
  "stage": 1, // optional
  "year": 2025 // optional
}
```

**Available Commands**:
- `getRiders-Tour`: Tour de France startlist
- `getRiders-Giro`: Giro d'Italia startlist
- `getRiders-Vuelta`: Vuelta a España startlist
- `getRiders-World`: World Championship startlist
- `stage-tour`: Tour de France stage result
- `stage-vuelta`: Vuelta a España stage result

#### GET `/api/scrape`
**Purpose**: List available legacy commands

### `/api/run-scraper` - Job-based Scraper API

#### POST `/api/run-scraper`
**Purpose**: Create background scraping jobs

**Request Body**:
```json
{
  "type": "startlist", // or "stage-result"
  "race": "tour-de-france",
  "stage": 1, // required for stage-result
  "year": 2025 // optional, defaults to current year
}
```

**Response**:
```json
{
  "jobId": "startlist-tour-de-france-startlist-1642680000000",
  "message": "Scraper job started",
  "status": "running",
  "checkStatusUrl": "/api/run-scraper/job123"
}
```

#### GET `/api/run-scraper`
**Purpose**: List all jobs or get specific job status

**Query Parameters**:
- `jobId`: Specific job ID to check

### `/api/run-scraper/[jobId]` - Job Status API

#### GET `/api/run-scraper/[jobId]`
**Purpose**: Check status of specific scraping job

### `/api/stage` - Stage Data API

#### GET `/api/stage`
**Purpose**: Fetch stage data from external source

**Query Parameters**:
- `race`: Race slug
- `year`: Year
- `stage`: Stage number

### `/api/metadata` - Metadata API

#### GET `/api/metadata`
**Purpose**: Get metadata about available race data

**Query Parameters**:
- `race`: Specific race to check (optional)

### `/api/stage-metadata` - Stage Metadata API

#### GET `/api/stage-metadata`
**Purpose**: Get metadata about stage data availability

## Data Structures

### Startlist Data Structure
```json
{
  "race": "tour-de-france",
  "year": 2025,
  "source": "https://www.procyclingstats.com/race/tour-de-france/2025/startlist",
  "count": 22,
  "riders": [
    {
      "image": "team_logo_url",
      "name": "Team Sky",
      "shortName": "sky",
      "riders": [
        {
          "name": "Chris Froome",
          "country": "gb",
          "startNumber": "1",
          "dropout": false
        }
      ]
    }
  ],
  "scrapedAt": "2025-01-20T10:30:00.000Z"
}
```

### Stage Result Data Structure
```json
{
  "race": "tour-de-france",
  "year": 2025,
  "source": "https://www.procyclingstats.com/race/tour-de-france/2025/stage-1",
  "count": 176,
  "stageResults": [
    {
      "country": "gb",
      "lastName": "FROOME",
      "firstName": "Chris",
      "startNumber": "1",
      "gc": "1",
      "place": 1,
      "timeDifference": "0:00",
      "team": "Team Sky",
      "shortName": "sky",
      "uciPoints": "25",
      "points": "25",
      "qualificationTime": "4:30:00"
    }
  ],
  "generalClassification": [...],
  "pointsClassification": [...],
  "mountainsClassification": [...],
  "youthClassification": [...],
  "teamClassification": [...],
  "scrapedAt": "2025-01-20T10:30:00.000Z"
}
```

## Firebase Integration

### Collection: `scraper-data`

**Document Structure**:
- **Document ID**: `{race}-{year}-{type}` or `{race}-{year}-stage-{stage}`
- **Fields**:
  - All scraped data fields
  - `updatedAt`: ISO timestamp
  - `key`: Metadata object with race, year, type, stage

**Example Document IDs**:
- `tour-de-france-2025-startlist`
- `tour-de-france-2025-stage-1`
- `giro-d-italia-2025-stage-15`

## Setup and Configuration

### Environment Variables

Create a `.env.local` file with your Firebase credentials:

```env
# Firebase Configuration (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin Configuration (Server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### Installation

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

## Usage Examples

### Scraping Tour de France Startlist
```bash
curl -X POST http://localhost:3210/api/scraper \
  -H "Content-Type: application/json" \
  -d '{
    "race": "tour-de-france",
    "year": 2025,
    "type": "startlist"
  }'
```

### Scraping Stage 1 Results
```bash
curl -X POST http://localhost:3210/api/scraper \
  -H "Content-Type: application/json" \
  -d '{
    "race": "tour-de-france",
    "year": 2025,
    "type": "stage",
    "stage": 1
  }'
```

### Retrieving Saved Data
```bash
curl "http://localhost:3210/api/scraper?race=tour-de-france&year=2025&type=startlist"
```

## Error Handling

The application includes comprehensive error handling:

- **Validation Errors**: Missing or invalid parameters
- **Scraping Errors**: Network issues or page structure changes
- **Firebase Errors**: Database connection or permission issues
- **Type Errors**: Invalid data formats or undefined values

All errors are logged and returned with appropriate HTTP status codes.

## Contributing

1. Follow TypeScript best practices
2. Maintain existing code structure
3. Update this README when adding new routes or features
4. Test all API endpoints before committing

## License

This project is for educational and personal use only. Please respect ProCyclingStats.com's terms of service when scraping data.