# Cypress Quick Start Guide

## 🚀 Snel starten

### Stap 1: Zorg dat je `.env.emulator` bestand klaar is

Kopieer het voorbeeld bestand:
```bash
cp .env.emulator.example .env.emulator
```

Vul de Firebase configuratie in (kan dezelfde zijn als je productie config):
```env
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=oracle-games-b6af6
# etc...
```

### Stap 2: Run de tests

**Optie A - Alles automatisch (AANBEVOLEN):**
```bash
npm run test:e2e:open
```

Dit start automatisch:
1. Firebase emulators
2. Next.js dev server in emulator mode
3. Cypress UI

**Optie B - Handmatig (meer controle):**

Terminal 1 - Start emulators:
```bash
npm run emulators
```

Terminal 2 - Start Next.js:
```bash
npm run dev:emulator
```

Terminal 3 - Open Cypress:
```bash
npm run cypress
```

### Stap 3: Run een test

In de Cypress UI:
1. Klik op `basic.cy.ts` of `login.cy.ts` in de lijst
2. De tests zouden moeten draaien en slagen

## 🧪 Beschikbare Tests

### `basic.cy.ts` ✅ (Werkt)
Basis tests om te checken of de app draait:
- Homepage laden
- Login pagina laden
- Firebase emulator connectie
- Form elementen checken

### `login.cy.ts` ✅ (Werkt)
Complete login flow tests:
- Login pagina elementen tonen
- Error bij foute credentials
- Succesvol inloggen met `user@test.com` / `user123`
- Admin login met `admin@test.com` / `admin123`
- Custom `cy.loginOrSignup()` command testen
- "Stay logged in" checkbox

### `games.cy.ts` ✅ (Werkt)
Tests voor games pagina na login:
- Navigatie naar home page
- Ingelogd blijven

### `auction.cy.ts` 🔒 (Skipped - voor later)
Tests voor auction functionaliteit (kan je later enablen)

### `inbox.cy.ts` 🔒 (Skipped - voor later)
Tests voor inbox functionaliteit (kan je later enablen)

## 🔑 Test Users in Emulator

Je emulator heeft al test users:
- **Regular user**: `user@test.com` / `user123`
- **Regular user 2**: `user2@test.com` / `user123`
- **Admin**: `admin@test.com` / `admin123`

## 🔧 Troubleshooting

### Cypress opent niet
- Check of de emulators draaien: ga naar http://127.0.0.1:4000
- Check of Next.js draait: ga naar http://localhost:3210
- Stop alles en probeer opnieuw

### "Port already in use" error
Stop bestaande processen:
```bash
# Check welke processen draaien op de poorten
lsof -i :3210  # Next.js
lsof -i :8080  # Firestore emulator
lsof -i :9099  # Auth emulator
lsof -i :4000  # Emulator UI

# Kill ze indien nodig
kill -9 <PID>
```

### Tests falen
- Alle tests in `basic.cy.ts` zouden moeten slagen
- Tests in `auction.cy.ts` en `inbox.cy.ts` zijn skipped (`.skip`)
- Als basic tests falen, check console errors in Cypress

## 📝 Een eigen test schrijven

1. Maak een nieuw bestand: `cypress/e2e/my-test.cy.ts`

```typescript
describe('My Test', () => {
  it('should do something', () => {
    cy.visit('/')
    cy.contains('Welcome').should('be.visible')
  })
})
```

2. Run in Cypress UI
3. Verfijn je test

## 🎯 Volgende Stappen

Zodra de basis werkt:

1. **Login werkend maken**: Pas de custom commands aan in `cypress/support/commands.ts`
2. **Data-testid toevoegen**: Voeg `data-testid` attributes toe aan je components
3. **Tests enablen**: Verwijder `.skip` van auction en inbox tests
4. **Eigen tests schrijven**: Voeg tests toe voor je specifieke functionaliteit

## 💡 Tips

- Gebruik `data-testid` in plaats van CSS classes voor selectors
- Gebruik `cy.log()` om debug info te zien
- Video's en screenshots worden automatisch opgeslagen bij failures
- Run `npm run cypress:headless` voor snelle headless tests

## 🐛 Hulp nodig?

1. Check de Cypress console voor errors
2. Check de browser console in Cypress
3. Kijk in `cypress/videos` en `cypress/screenshots` voor debug info
4. Lees de volledige docs: `cypress/README.md`
