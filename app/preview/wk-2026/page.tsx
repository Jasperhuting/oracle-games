import Link from "next/link";
import {
  IconStar,
  IconArrowLeft,
  IconArrowRight,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";

const DEMO_GROUPS: { groep: string; landen: { naam: string; vlag: string; punten: number; gespeeld: number }[] }[] = [
  {
    groep: "Groep A",
    landen: [
      { naam: "Nederland", vlag: "🇳🇱", punten: 7, gespeeld: 3 },
      { naam: "Duitsland", vlag: "🇩🇪", punten: 6, gespeeld: 3 },
      { naam: "Mexico", vlag: "🇲🇽", punten: 3, gespeeld: 3 },
      { naam: "Senegal", vlag: "🇸🇳", punten: 1, gespeeld: 3 },
    ],
  },
  {
    groep: "Groep B",
    landen: [
      { naam: "Brazilië", vlag: "🇧🇷", punten: 9, gespeeld: 3 },
      { naam: "Portugal", vlag: "🇵🇹", punten: 6, gespeeld: 3 },
      { naam: "Japan", vlag: "🇯🇵", punten: 3, gespeeld: 3 },
      { naam: "Marokko", vlag: "🇲🇦", punten: 0, gespeeld: 3 },
    ],
  },
  {
    groep: "Groep C",
    landen: [
      { naam: "Argentinië", vlag: "🇦🇷", punten: 9, gespeeld: 3 },
      { naam: "Spanje", vlag: "🇪🇸", punten: 4, gespeeld: 3 },
      { naam: "VS", vlag: "🇺🇸", punten: 4, gespeeld: 3 },
      { naam: "Australië", vlag: "🇦🇺", punten: 2, gespeeld: 3 },
    ],
  },
  {
    groep: "Groep D",
    landen: [
      { naam: "England", vlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", punten: 7, gespeeld: 3 },
      { naam: "Frankrijk", vlag: "🇫🇷", punten: 7, gespeeld: 3 },
      { naam: "Uruguay", vlag: "🇺🇾", punten: 3, gespeeld: 3 },
      { naam: "Canada", vlag: "🇨🇦", punten: 0, gespeeld: 3 },
    ],
  },
];

const DEMO_PREDICTIONS = [
  { ronde: "1/8 finale", wedstrijd: "Nederland vs Argentinië", mijn_keuze: "Nederland", uitslag: "1-0", correct: true, punten: 20 },
  { ronde: "1/8 finale", wedstrijd: "Brazilië vs England", mijn_keuze: "Brazilië", uitslag: "1-2", correct: false, punten: 0 },
  { ronde: "Kwartfinale", wedstrijd: "Nederland vs Portugal", mijn_keuze: "Nederland", uitslag: null, correct: null, punten: null },
];

const DEMO_STANDINGS = [
  { pos: 1, naam: "WKProfessor", punten: 185, correct: 12 },
  { pos: 2, naam: "VoetbalOracle", punten: 162, correct: 10 },
  { pos: 3, naam: "TactischTom", punten: 148, correct: 9 },
  { pos: 4, naam: "GoalMachine", punten: 134, correct: 8 },
  { pos: 5, naam: "WielermanFan", punten: 121, correct: 8 },
  { pos: 6, naam: "PenaltyPiet", punten: 108, correct: 7 },
];

export default function WK2026PreviewPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-blue-50">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-60 -left-24 h-72 w-72 rounded-full bg-blue-200/25 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-56 w-56 rounded-full bg-teal-200/25 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <Link
            href="/preview"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            <IconArrowLeft size={16} /> Terug naar overzicht
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Inloggen
            </Link>
            <Link
              href="/register"
              className="text-sm bg-[#02554D] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#024d46] transition-colors"
            >
              Aanmelden
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 py-14 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-2xl mb-6">
            <IconStar size={28} className="text-[#02554D]" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-3">Voetbal · Canada · Mexico · VS</p>
          <h1 className="text-4xl sm:text-5xl font-semibold font-serif text-gray-900 mb-5">
            WK 2026
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Het grootste sportevenement ter wereld. Voorspel de groepsfase, de knockout-ronden en
            de wereldkampioen. Speel met vrienden in je eigen subpoule.
          </p>
        </section>

        {/* Hoe werkt het */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { stap: "1", titel: "Loot de groepen", beschrijving: "Sleep 48 landen naar de 16 groepen in de groepsfase. Wijs elk land toe aan een pot en maak jouw eigen groepsdraw." },
              { stap: "2", titel: "Voorspel de uitslagen", beschrijving: "Kies wie je denkt dat doorgaan per groep en wie uiteindelijk de knockout-rondes wint. Elke juiste voorspelling levert punten op." },
              { stap: "3", titel: "Maak een subpoule", beschrijving: "Maak een privépoule aan en nodig vrienden, familie of collega's uit. Strijdt onderling om de beste voorspeller te zijn." },
            ].map(({ stap, titel, beschrijving }) => (
              <div key={stap} className="bg-white/80 backdrop-blur-sm rounded-2xl p-7 border border-white shadow-sm">
                <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-[#02554D] font-bold text-sm">{stap}</span>
                </div>
                <h3 className="font-semibold font-serif text-gray-900 text-lg mb-2">{titel}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{beschrijving}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Demo: Groepsstand */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-1">Demo</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900">
                  Groepsstand – WK 2026
                </h2>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                Voorbeeld data
              </span>
            </div>
            <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DEMO_GROUPS.map((g) => (
                <div key={g.groep} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">{g.groep}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50/60">
                        <th className="px-3 py-1.5 text-left text-gray-400 font-medium">Land</th>
                        <th className="px-3 py-1.5 text-center text-gray-400 font-medium">Gsp</th>
                        <th className="px-3 py-1.5 text-center text-gray-400 font-medium">Ptn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {g.landen.map((land, i) => (
                        <tr
                          key={land.naam}
                          className={`${i < 2 ? "bg-emerald-50/30" : ""} hover:bg-gray-50/40 transition-colors`}
                        >
                          <td className="px-3 py-2 flex items-center gap-1.5 font-medium text-gray-700">
                            <span>{land.vlag}</span>
                            <span className="truncate">{land.naam}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500">{land.gespeeld}</td>
                          <td className="px-3 py-2 text-center font-bold text-gray-900">{land.punten}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <p className="px-7 pb-4 text-xs text-gray-400">De groen gemarkeerde landen gaan door naar de knockout-fase.</p>
          </div>
        </section>

        {/* Demo: Jouw voorspellingen */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-1">Demo</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900 flex items-center gap-2">
                  <IconTrophy size={20} className="text-[#02554D]" />
                  Mijn knockout-voorspellingen
                </h2>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                Voorbeeld data
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ronde</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Wedstrijd</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mijn keuze</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Uitslag</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Punten</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DEMO_PREDICTIONS.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-gray-500">{p.ronde}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900 text-sm">{p.wedstrijd}</td>
                      <td className="px-5 py-3.5 text-gray-700">{p.mijn_keuze}</td>
                      <td className="px-5 py-3.5 text-center">
                        {p.uitslag ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            p.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                          }`}>
                            {p.uitslag} {p.correct ? "✓" : "✗"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Nog niet gespeeld</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold">
                        {p.punten !== null ? (
                          <span className={p.correct ? "text-[#02554D]" : "text-gray-400"}>{p.punten}</span>
                        ) : (
                          <span className="text-gray-300">–</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Demo: Ranglijst */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-1">Demo</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900 flex items-center gap-2">
                  <IconTrophy size={20} className="text-[#02554D]" />
                  Ranglijst – WK Poule 2026
                </h2>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                Voorbeeld data
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pos</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deelnemer</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Punten</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right hidden sm:table-cell">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {DEMO_STANDINGS.map((s) => (
                    <tr
                      key={s.naam}
                      className={`hover:bg-gray-50/60 transition-colors ${s.pos <= 3 ? "bg-emerald-50/30" : ""}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          s.pos === 1 ? "bg-amber-100 text-amber-700" :
                          s.pos === 2 ? "bg-gray-100 text-gray-600" :
                          s.pos === 3 ? "bg-orange-100 text-orange-600" :
                          "text-gray-500"
                        }`}>
                          {s.pos}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900 flex items-center gap-2">
                        <IconUsers size={15} className="text-gray-400" /> {s.naam}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900">{s.punten}</td>
                      <td className="px-5 py-3.5 text-right text-gray-500 hidden sm:table-cell">{s.correct}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-20 max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-semibold font-serif text-gray-900 mb-3">
            Klaar voor het WK 2026?
          </h2>
          <p className="text-gray-600 mb-8">
            Maak een gratis account aan en start jouw eigen WK-poule met vrienden.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="bg-[#02554D] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#024d46] transition-colors shadow-lg shadow-emerald-900/20 flex items-center gap-2"
            >
              Gratis aanmelden <IconArrowRight size={18} />
            </Link>
            <Link
              href="/preview"
              className="text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center gap-1.5"
            >
              <IconArrowLeft size={16} /> Meer speltypen bekijken
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
