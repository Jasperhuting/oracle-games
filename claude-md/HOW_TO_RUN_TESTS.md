# Hoe Tests Draaien? 🧪

## ⚠️ BELANGRIJK

Tests hebben **emulators** en **Next.js server** nodig om te werken!

Als je alleen `npm run test:e2e:headed` draait zonder emulators, krijg je errors.

---

## 🚀 Methode 1: Automatisch (SIMPELST)

Gebruik de "full" scripts die alles automatisch starten:

```bash
# Start alles en run tests headless
npm run test:e2e:full

# Of: Start alles en open Playwright UI
npm run test:e2e:full:ui
```

Dit script:
1. ✅ Start Firebase emulators
2. ✅ Start Next.js server
3. ✅ Wacht tot alles ready is
4. ✅ Draait de tests

**Nadeel**: Je moet elke keer wachten tot emulators opstarten (~10-20 sec)

---

## 🎯 Methode 2: Manueel (SNELST voor development)

Start emulators en Next.js één keer, run tests vaak:

### Eerste keer setup:

```bash
# Terminal 1: Start Firebase Emulators (laat draaien!)
npm run emulators

# Terminal 2: Start Next.js (laat draaien!)
npm run dev:emulator

# Terminal 3: Seed test data (1x)
npm run seed:test-data
```

### Nu kun je tests draaien zo vaak je wilt:

```bash
# Terminal 4: Run tests
npm run test:e2e              # Headless (snel)
npm run test:e2e:ui           # Interactive UI (BESTE voor development!)
npm run test:e2e:headed       # Zie browser in actie
npm run test:e2e:debug        # Debug mode met breakpoints
```

**Voordeel**: Tests starten instant omdat emulators al draaien!

---

## 📊 Welke Methode Kiezen?

### Voor **Quick Check** (1x tests draaien):
```bash
npm run test:e2e:full
```

### Voor **Development** (tests vaak draaien):
```bash
# Setup (1x):
Terminal 1: npm run emulators
Terminal 2: npm run dev:emulator
Terminal 3: npm run seed:test-data

# Run tests (vaak):
Terminal 4: npm run test:e2e:ui
```

### Voor **CI/CD** (GitHub Actions):
```bash
# Gebeurt automatisch via .github/workflows/playwright-tests.yml
```

---

## 🐛 Troubleshooting

### "Error: connect ECONNREFUSED"
➡️ Emulators draaien niet! Start `npm run emulators`

### "Error: page.goto: net::ERR_CONNECTION_REFUSED"
➡️ Next.js draait niet! Start `npm run dev:emulator`

### "500 errors" in console
➡️ Test data niet geseeded! Run `npm run seed:test-data`

### Tests falen random
➡️ Re-seed test data: `npm run seed:test-data`

---

## ✅ Checklist Voordat Je Test

Zorg dat deze 3 dingen draaien:

1. ✅ **Emulators**: Check http://127.0.0.1:4000 (UI laadt)
2. ✅ **Next.js**: Check http://localhost:3210 (app laadt)
3. ✅ **Test data**: Run `npm run seed:test-data` als je twijfelt

Dan:
```bash
npm run test:e2e:ui
```

---

## 📚 Meer Info

Zie [TESTING_README.md](TESTING_README.md) voor complete documentatie.
