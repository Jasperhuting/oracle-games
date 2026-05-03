import Link from "next/link";
import {
  IconStar,
  IconArrowLeft,
  IconArrowRight,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react";
import { PoulePredictorDemo } from "./PoulePredictorDemo";
import { KnockoutDemo } from "./KnockoutDemo";

const DEMO_STANDINGS = [
  { pos: 1, naam: "WKProfessor", punten: 185, correct: 12 },
  { pos: 2, naam: "VoetbalOracle", punten: 162, correct: 10 },
  { pos: 3, naam: "TactischTom", punten: 148, correct: 9 },
  { pos: 4, naam: "GoalMachine", punten: 134, correct: 8 },
  { pos: 5, naam: "WielermanFan", punten: 121, correct: 8 },
  { pos: 6, naam: "PenaltyPiet", punten: 108, correct: 7 },
];

const MEDAL: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-amber-100", text: "text-amber-700", label: "Goud" },
  2: { bg: "bg-gray-100", text: "text-gray-600", label: "Zilver" },
  3: { bg: "bg-orange-100", text: "text-orange-600", label: "Brons" },
};

export default function WK2026PreviewPage() {
  return (
    <div className="relative min-h-screen mt-9">
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
              className="text-sm bg-[#ff9900] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#e68a00] transition-colors"
            >
              Aanmelden
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="px-6 py-14 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-100 rounded-2xl mb-6">
            <IconStar size={28} className="text-[#ff9900]" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-orange-500/80 mb-3">Voetbal · Canada · Mexico · VS</p>
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
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { stap: "1", titel: "Voorspel de uitslagen", beschrijving: "Kies wie je denkt dat doorgaan per groep en wie uiteindelijk de knockout-rondes wint. Elke juiste voorspelling levert punten op." },
              { stap: "2", titel: "Maak een subpoule", beschrijving: "Maak een privépoule aan en nodig vrienden, familie of collega's uit. Strijdt onderling om de beste voorspeller te zijn." },
            ].map(({ stap, titel, beschrijving }) => (
              <div key={stap} className="bg-white/80 backdrop-blur-sm rounded-2xl p-7 border border-white shadow-sm">
                <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-[#ff9900] font-bold text-sm">{stap}</span>
                </div>
                <h3 className="font-semibold font-serif text-gray-900 text-lg mb-2">{titel}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{beschrijving}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Demo: Groepsfase voorspellen */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500/80 mb-1">Probeer het zelf</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900">
                  Groepsfase voorspellen
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Sleep de teams, vul uitslagen in en zie de stand automatisch bijwerken.
                </p>
              </div>
              <span className="text-xs bg-orange-100 text-[#ff9900] px-3 py-1 rounded-full font-medium">
                Interactief voorbeeld
              </span>
            </div>
            <div className="p-6">
              <PoulePredictorDemo />
            </div>
          </div>
        </section>

        {/* Demo: Knockout voorspellen */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500/80 mb-1">Probeer het zelf</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900 flex items-center gap-2">
                  <IconTrophy size={20} className="text-[#ff9900]" />
                  Knockout-fase voorspellen
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Vul uitslagen in en zie de winnaar automatisch doorgaan naar de volgende ronde.
                </p>
              </div>
              <span className="text-xs bg-orange-100 text-[#ff9900] px-3 py-1 rounded-full font-medium">
                Interactief voorbeeld
              </span>
            </div>
            <div className="p-6">
              <KnockoutDemo />
            </div>
          </div>
        </section>

        {/* Demo: Ranglijst */}
        <section className="px-6 pb-14 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-orange-500/80 mb-1">Voorbeeld</p>
                <h2 className="text-xl font-semibold font-serif text-gray-900 flex items-center gap-2">
                  <IconTrophy size={20} className="text-[#ff9900]" />
                  Ranglijst
                </h2>
              </div>
              <span className="text-xs bg-orange-100 text-[#ff9900] px-3 py-1 rounded-full font-medium">
                Fictieve namen
              </span>
            </div>

            <div className="divide-y divide-gray-50">
              {DEMO_STANDINGS.map((s) => {
                const medal = MEDAL[s.pos];
                return (
                  <div
                    key={s.naam}
                    className={`flex items-center gap-4 px-7 py-4 ${s.pos <= 3 ? 'bg-orange-50/20' : 'bg-white'}`}
                  >
                    {/* Position */}
                    <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${medal ? `${medal.bg} ${medal.text}` : 'bg-gray-100 text-gray-500'}`}>
                      {s.pos}
                    </div>

                    {/* Name + icon */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <IconUsers size={14} className="text-gray-400" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm truncate">{s.naam}</span>
                      {medal && (
                        <span className={`hidden sm:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${medal.bg} ${medal.text}`}>
                          {medal.label}
                        </span>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 flex-shrink-0 text-right">
                      <div className="hidden sm:block">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Correct</p>
                        <p className="text-sm font-semibold text-gray-700">{s.correct}x</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Punten</p>
                        <p className="text-lg font-bold text-gray-900">{s.punten}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="px-7 py-3 text-xs text-gray-400 border-t border-gray-50">
              Gesorteerd op punten. Klik op een naam om de voorspellingen van die speler te bekijken.
            </p>
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
              className="bg-[#ff9900] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#e68a00] transition-colors shadow-lg shadow-orange-900/20 flex items-center gap-2"
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
