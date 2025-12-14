# Comprehensive E2E Test Plan voor Oracle Games

## 📋 Overzicht

Dit document bevat een complete test strategie voor alle belangrijke functionaliteiten van de Oracle Games applicatie. Tests draaien tegen Firebase emulators om de productie database schoon te houden.

## 🎯 Test Prioriteiten

### Priority 1: Core Functionaliteit (MOET WERKEN)
- ✅ Authentication (Login/Logout)
- 🔲 Games overzicht laden
- 🔲 Game joinen
- 🔲 Auction: Bid plaatsen
- 🔲 Auction: Budget tracking
- 🔲 Team/Lineup: Renners beheren
- 🔲 Inbox: Berichten lezen

### Priority 2: Belangrijke Features
- 🔲 Games filteren en zoeken
- 🔲 Auction: Renners zoeken/filteren
- 🔲 Auction: View modes (grid/list)
- 🔲 Lineup: Formatie wijzigen
- 🔲 Messages: Nieuwe berichten verzenden
- 🔲 User profiel bekijken/updaten

### Priority 3: Admin Functionaliteit
- 🔲 Admin toegang verificatie
- 🔲 Game aanmaken
- 🔲 Divisions beheren
- 🔲 Broadcast berichten versturen

## 📝 Test Suites

### 1. Authentication & User Management (`auth.cy.ts`)

**Scope**: Login, logout, sessie management

**Tests**:
- ✅ Login pagina tonen met alle elementen
- ✅ Error bij ongeldige credentials
- ✅ Succesvol inloggen met test user
- ✅ Succesvol inloggen als admin
- ✅ Custom login command werkt
- ✅ "Stay logged in" checkbox functionaliteit
- 🔲 Logout functionaliteit
- 🔲 Sessie persisteert na page reload (met stay logged in)
- 🔲 Sessie expired na browser close (zonder stay logged in)
- 🔲 Redirect naar login bij ongeauthoriseerde toegang

### 2. Games Overview (`games.cy.ts`)

**Scope**: Spellen overzicht, joinen, filteren

**Tests**:
- ✅ Navigatie naar games pagina
- 🔲 Lijst van beschikbare games tonen
- 🔲 Game details tonen (naam, type, status, spelers)
- 🔲 "Join Game" knop tonen voor joinbare games
- 🔲 Game joinen flow
- 🔲 Bevestiging na succesv

ol joinen
- 🔲 Budget/team info tonen na joinen
- 🔲 Al gejoinde games filteren
- 🔲 Games per type filteren (auctioneer, worldtour-manager, etc.)
- 🔲 Games per status filteren (registration, active, finished)

**Required Data**:
- Test game(s) in emulator data
- User moet kunnen joinen (registration open)

### 3. Auction Flow (`auction.cy.ts`)

**Scope**: Complete auction functionaliteit

#### 3.1 Pagina Load & UI
- 🔲 Auction pagina laden
- 🔲 User budget tonen
- 🔲 Beschikbare renners tonen
- 🔲 View toggle buttons (grid/list)
- 🔲 Filter controls tonen
- 🔲 Search bar tonen

#### 3.2 Bid Functionaliteit
- 🔲 Bid modal openen voor een renner
- 🔲 Minimaal bid bedrag tonen
- 🔲 Custom bid bedrag invoeren
- 🔲 Bid plaatsen (succesvol)
- 🔲 Budget update na bid
- 🔲 Bid tonen in "My Bids" sectie
- 🔲 Error bij te laag bid
- 🔲 Error bij onvoldoende budget
- 🔲 Bid annuleren (indien toegestaan)
- 🔲 Outbid notificatie testen
- 🔲 Won bid tonen in team

#### 3.3 Filtering & Search
- 🔲 Renners zoeken op naam
- 🔲 Filteren op team
- 🔲 Filteren op nationaliteit
- 🔲 Filteren op prijs range
- 🔲 Filteren op UCI points
- 🔲 "Show only fillers" toggle (worldtour-manager)
- 🔲 Combinatie van filters
- 🔲 Clear filters knop

#### 3.4 View Modes
- 🔲 Switch naar list view
- 🔲 Switch naar grid view
- 🔲 Data persisteert tussen views
- 🔲 Sortering in list view

#### 3.5 WorldTour Manager Specifiek
- 🔲 Neo-pro filter tonen
- 🔲 Neo-pro requirements checken
- 🔲 Minimum roster size requirements
- 🔲 Budget validatie

**Required Data**:
- Game met auction status "active"
- User participant in game met budget
- Eligible riders in game
- Test bids in emulator

### 4. Team/Lineup Management (`lineup.cy.ts`)

**Scope**: Team samenstelling en lineup wijzigingen

**Tests**:
- 🔲 Team pagina laden
- 🔲 Alle gekochte renners tonen
- 🔲 Team statistieken tonen (totaal spent, roster size)
- 🔲 Lineup pagina laden
- 🔲 Active lineup tonen
- 🔲 Benched renners tonen
- 🔲 Renner naar bench verplaatsen
- 🔲 Renner van bench activeren
- 🔲 Formatie wijzigen (indien toegestaan)
- 🔲 Lineup opslaan
- 🔲 Succes bericht na opslaan
- 🔲 Lineup validatie (max renners per stage)

**Required Data**:
- Game met active status
- User met complete team
- PlayerTeam docs in emulator

### 5. Inbox/Messages (`inbox.cy.ts`)

**Scope**: Berichten systeem

**Tests**:
- 🔲 Inbox pagina laden
- 🔲 Berichten lijst tonen
- 🔲 Ongelezen berichten markering
- 🔲 Bericht openen
- 🔲 Bericht als gelezen markeren
- 🔲 Bericht content tonen (subject, message, sender)
- 🔲 Timestamp correct tonen
- 🔲 Compose nieuwe message (indien admin)
- 🔲 Recipient selecteren
- 🔲 Subject en message invoeren
- 🔲 Bericht versturen
- 🔲 Bevestiging na versturen
- 🔲 Bericht verwijderen
- 🔲 Unread count badge

**Required Data**:
- Test berichten in emulator
- Zowel gelezen als ongelezen berichten
- Broadcast en individual messages

### 6. User Profile (`profile.cy.ts`)

**Scope**: User profiel en settings

**Tests**:
- 🔲 Profiel pagina laden
- 🔲 User info tonen (naam, email)
- 🔲 Player name wijzigen
- 🔲 Wijzigingen opslaan
- 🔲 Succes bericht
- 🔲 Account statistics tonen
- 🔲 Joined games tonen

### 7. Admin Functionaliteit (`admin.cy.ts`)

**Scope**: Admin-only features

**Tests**:
- 🔲 Admin toegang verificatie
- 🔲 Non-admin krijgt geen toegang
- 🔲 Admin dashboard laden
- 🔲 Users lijst tonen
- 🔲 User type wijzigen
- 🔲 Game aanmaken form
- 🔲 Game configuratie instellen
- 🔲 Game opslaan
- 🔲 Division assignment tool
- 🔲 Broadcast message versturen
- 🔲 Translations tab (indien programmer)

## 🔧 Test Data Requirements

### Emulator Data Structuur

```
emulator-data/
├── auth_export/
│   └── accounts.json          # Test users
├── firestore_export/
    ├── users/                 # User documents
    ├── games/                 # Test games
    ├── gameParticipants/      # User game joins
    ├── playerTeams/           # Owned riders
    ├── bids/                  # Auction bids
    └── messages/              # Test messages
```

### Benodigde Test Data

1. **Users** (✅ Aanwezig)
   - `user@test.com` / `user123` - Regular user
   - `user2@test.com` / `user123` - Regular user 2
   - `admin@test.com` / `admin123` - Admin user

2. **Games** (🔲 Aanmaken)
   - Auctioneer game (registration status)
   - Auctioneer game (active auction)
   - WorldTour Manager game (active)
   - Finished game voor standings

3. **Game Participants** (🔲 Aanmaken)
   - Users joined to games
   - Met budget en team data

4. **Riders** (🔲 Aanmaken)
   - Eligible riders voor games
   - Verschillende teams, nationaliteiten, points

5. **Bids** (🔲 Aanmaken)
   - Active bids
   - Won bids
   - Outbid bids

6. **Messages** (🔲 Aanmaken)
   - Broadcast messages
   - Individual messages
   - Read/unread mix

## 🚀 Implementatie Strategie

### Fase 1: Foundation (Week 1)
1. ✅ Basic tests werkend krijgen
2. 🔲 Test data seeding script maken
3. 🔲 Games overview tests
4. 🔲 Auction basis tests

### Fase 2: Core Features (Week 2)
5. 🔲 Complete auction flow
6. 🔲 Team/lineup management
7. 🔲 Inbox functionaliteit

### Fase 3: Advanced Features (Week 3)
8. 🔲 Admin functionaliteit
9. 🔲 Edge cases en error handling
10. 🔲 Performance tests

### Fase 4: CI/CD Integration
11. 🔲 GitHub Actions workflow optimaliseren
12. 🔲 Test reporting toevoegen
13. 🔲 Screenshot/video artifacts

## 📊 Success Criteria

- Alle Priority 1 tests: 100% pass rate
- Alle Priority 2 tests: 90% pass rate
- CI/CD pipeline: < 10 minuten run time
- Test coverage: Minimaal 70% van critical paths
- Zero false positives in production-like scenarios

## 🔄 Onderhoud

- Weekly: Review test results
- Monthly: Update test data
- Per release: Review en update tests
- Quarterly: Test performance optimization
