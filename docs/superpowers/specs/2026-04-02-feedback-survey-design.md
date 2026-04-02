# Feedback Survey Design

**Datum:** 2026-04-02

## Samenvatting

Een feedbackenquete die als modal popup verschijnt nadat een gebruiker inlogt. Gebruikers kunnen deelnemen of overslaan. Antwoorden worden opgeslagen in Firestore en zijn te bekijken via een admin-overzicht.

---

## Beslissingen

| Onderwerp | Keuze |
|---|---|
| Presentatie | Modal popup, 2 seconden na inloggen |
| Opt-out | Ja, "Overslaan, doe niet mee" knop |
| Vragen | Hardcoded in de code |
| Rondes | Meerdere rondes via een `SURVEY_ROUND_ID` constante |
| Database | Firebase Firestore, collectie `survey_responses` |
| Antwoorden zichtbaar | Admin-pagina `/admin/survey` |
| Koppeling | Antwoorden gekoppeld aan gebruikersaccount (userId) |

---

## Vragen (hardcoded, eerste ronde)

1. Wat mis je nog op de website?
2. Gebruik je het forum? Wat zou het beter maken?
3. Mis je nog spellen die je graag zou spelen?
4. Heb je nog andere feedback of suggesties?

---

## Datamodel (Firestore)

Collectie: `survey_responses`

```
{
  userId: string,
  userName: string,
  roundId: string,          // bijv. "2026-Q2"
  skipped: boolean,         // true als gebruiker heeft geweigerd
  answers: {
    q1: string,
    q2: string,
    q3: string,
    q4: string
  },
  submittedAt: Timestamp
}
```

Document ID: `{userId}_{roundId}` zodat duplicaten onmogelijk zijn.

---

## Componenten

### `components/SurveyModal.tsx`
React modal component. Toont de vragen stap voor stap (2 per pagina). Heeft vorige/volgende navigatie en een voortgangsbalk. Slaat op via de API route.

### `hooks/useSurveyStatus.ts`
Client-side hook die controleert of de huidige gebruiker al heeft deelgenomen aan de actieve ronde. Returnt `{ shouldShow: boolean, loading: boolean }`.

### `app/api/survey/route.ts`
POST endpoint. Ontvangt userId, roundId, answers/skipped. Schrijft naar Firestore. Controleert op duplicaten.

### `app/admin/survey/page.tsx`
Admin-pagina. Toont een tabel met alle ingevulde surveys: gebruikersnaam, ronde, datum, antwoorden per vraag. Geblokkeerd achter admin-check.

---

## Integratie in bestaande code

`AppShellProviders` krijgt een `<SurveyModal />` component toegevoegd. Die component gebruikt `useSurveyStatus` om te bepalen of de popup getoond moet worden.

De `SURVEY_ROUND_ID` constante staat in `lib/constants/survey.ts`. Om een nieuwe ronde te starten: pas deze waarde aan en update de vragen in `SurveyModal.tsx`.

---

## Ronde-beheer

Nieuwe ronde starten:
1. Pas `SURVEY_ROUND_ID` aan in `lib/constants/survey.ts`
2. Update de vragen in `SurveyModal.tsx`
3. Deploy

Alle gebruikers krijgen de popup opnieuw te zien bij hun volgende inlog.

---

## Wat NIET in scope is

- Admin kan vragen niet via de UI beheren (hardcoded)
- Geen anonieme deelname
- Geen e-mailnotificaties bij nieuwe antwoorden
- Geen statistieken/grafieken in de admin (alleen ruwe antwoorden)
