# Impersonation Feature

## Overzicht

De impersonation feature stelt admins in staat om in te loggen als een andere gebruiker om de applicatie te zien en te gebruiken vanuit het perspectief van die gebruiker. Dit is handig voor debugging, support en het testen van gebruikerservaringen.

## Functionaliteit

### Voor Admins

1. **Impersonation starten**
   - Ga naar de Admin Dashboard (`/admin`)
   - Navigeer naar de "Users" tab
   - Klik op de paarse "Impersonate" knop naast de gebruiker die je wilt impersoneren
   - Je wordt automatisch ingelogd als die gebruiker en doorgestuurd naar de home pagina

2. **Tijdens Impersonation**
   - Een paarse banner verschijnt bovenaan de pagina met:
     - De naam van de geïmpersoneerde gebruiker
     - De naam van de admin die aan het impersoneren is
     - Een "Stop Impersonation" knop
   - Alle acties worden uitgevoerd als de geïmpersoneerde gebruiker
   - De admin ziet exact wat de gebruiker zou zien

3. **Impersonation stoppen**
   - Klik op de "Stop Impersonation" knop in de paarse banner
   - Je wordt automatisch teruggestuurd naar het Admin Dashboard
   - Je bent weer ingelogd als jezelf (admin)

## Beveiliging

- **Alleen voor admins**: Alleen gebruikers met `userType: 'admin'` kunnen impersoneren
- **Activity logging**: Alle impersonation acties worden gelogd in de `activityLogs` collectie met:
  - Wanneer impersonation start en stopt
  - Welke admin welke gebruiker impersoneert
  - Hoe lang de impersonation duurde
- **Session management**: Impersonation gebruikt Firebase Custom Tokens voor veilige authenticatie
- **Cookie-based tracking**: Server-side cookies houden bij wanneer een admin aan het impersoneren is

## Technische Implementatie

### API Endpoints

1. **POST `/api/impersonate/start`**
   - Start impersonation voor een specifieke gebruiker
   - Maakt een Firebase Custom Token aan
   - Slaat impersonation data op in cookies
   - Logt de actie

2. **POST `/api/impersonate/stop`**
   - Stopt de huidige impersonation sessie
   - Verwijdert impersonation cookies
   - Logt de actie met duur

3. **GET `/api/impersonate/status`**
   - Controleert of er momenteel geïmpersoneerd wordt
   - Retourneert info over admin en geïmpersoneerde gebruiker

### Components

- **ImpersonationContext**: React context voor impersonation state management
- **useAuth hook**: Uitgebreid met impersonation status
- **Header component**: Toont impersonation banner
- **UserList component**: Bevat impersonation knoppen

### Data Flow

1. Admin klikt op "Impersonate" knop
2. API maakt Custom Token aan voor target gebruiker
3. Token wordt opgeslagen in localStorage
4. Pagina wordt herladen
5. useAuth hook detecteert token en logt in met Custom Token
6. Gebruiker is nu ingelogd als de geïmpersoneerde gebruiker
7. Impersonation banner wordt getoond
8. Bij "Stop Impersonation" wordt de sessie beëindigd en admin wordt teruggestuurd

## Beperkingen

- Je kunt niet impersoneren als je al aan het impersoneren bent (geen nested impersonation)
- Verwijderde gebruikers kunnen niet geïmpersoneerd worden
- Impersonation sessies verlopen na 24 uur

## Gebruik Cases

1. **Debugging**: Zie exact wat een gebruiker ziet bij een probleem
2. **Support**: Help gebruikers door hun perspectief te zien
3. **Testing**: Test nieuwe features vanuit verschillende gebruikersrollen
4. **Training**: Demonstreer features vanuit gebruikersperspectief
