export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">Privacybeleid</h1>
        <p className="mt-2 text-sm text-gray-600">Laatst bijgewerkt: 3 maart 2026</p>

        <div className="mt-8 space-y-8 text-gray-800">
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Wie wij zijn</h2>
            <p className="mt-3">
              Oracle Games is een fantasy wielerplatform. Dit privacybeleid legt uit welke gegevens we verwerken
              binnen onze website en onze Chrome-extensie.
            </p>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Welke gegevens we verwerken</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Accountgegevens die je zelf invult (zoals e-mail en gebruikersnaam).</li>
              <li>Spelgegevens (zoals teams, biedingen, picks en resultaten).</li>
              <li>Technische gegevens die nodig zijn om de dienst veilig en stabiel te laten werken.</li>
            </ul>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Chrome-extensie: Oracle Rider Stats</h2>
            <p className="mt-3">
              De extensie toont ProCyclingStats-profielinformatie bij renners op Oracle Games.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Doel: sneller renners vergelijken tijdens teamselectie.</li>
              <li>Gebruikte data: rennernaam of renner-slug die je aanklikt in Oracle Games.</li>
              <li>Externe bron: de extensie haalt data op van <code>https://www.procyclingstats.com</code>.</li>
              <li>Opslag: de extensie slaat geen gevoelige persoonsgegevens lokaal op.</li>
              <li>Delen/verkoop: gegevens worden niet verkocht aan derden.</li>
            </ul>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Waarom we gegevens gebruiken</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Om de functionaliteit van Oracle Games en de extensie te leveren.</li>
              <li>Om prestaties, beveiliging en betrouwbaarheid van de dienst te verbeteren.</li>
              <li>Om noodzakelijke communicatie te sturen (bijvoorbeeld accountgerelateerde berichten).</li>
            </ul>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Bewaartermijn en beveiliging</h2>
            <p className="mt-3">
              We bewaren gegevens niet langer dan nodig is voor de doelen hierboven en nemen redelijke technische en
              organisatorische maatregelen om gegevens te beschermen.
            </p>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Jouw rechten</h2>
            <p className="mt-3">
              Je kunt vragen om inzage, correctie of verwijdering van persoonsgegevens waar dat wettelijk mogelijk is.
              Neem hiervoor contact op via het feedbackkanaal in de applicatie.
            </p>
          </section>

          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Wijzigingen</h2>
            <p className="mt-3">
              We kunnen dit privacybeleid aanpassen als de dienst of wetgeving verandert. Op deze pagina staat altijd
              de meest recente versie.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
