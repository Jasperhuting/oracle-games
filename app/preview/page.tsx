import Link from "next/link";
import {
  IconTrophy,
  IconFlag,
  IconBike,
  IconUsers,
  IconChartBar,
  IconArrowRight,
  IconCalendar,
  IconStar,
} from "@tabler/icons-react";


export default function PreviewPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-emerald-50 via-slate-50 to-blue-50">
      {/* Decoratieve achtergrond cirkels */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute top-60 -left-24 h-80 w-80 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-64 w-64 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Navigatiebalk */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
          <span className="font-serif font-semibold text-gray-900 text-xl">Oracle Games</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
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

        {/* Hero-sectie */}
        <section className="px-6 py-20 text-center max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-4">
            Fantasy Sports Platform
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold font-serif text-gray-900 mb-6 leading-tight">
            Speel mee met de<br />
            <span className="text-[#02554D]">groten der aarde</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
            Oracle Games is hét fantasy sports platform voor wielerliefhebbers en sportfanaten. Bied op renners,
            voorspel races en strijd om de beste positie op de ranglijst.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="bg-[#02554D] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#024d46] transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            >
              Gratis aanmelden
              <IconArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="bg-white text-gray-700 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
            >
              Al een account? Inloggen
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className="px-6 pb-16 max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Actieve spelers", value: "~140", icon: IconUsers },
              { label: "Actieve games", value: "~6", icon: IconTrophy },
              { label: "Renners gevolgd", value: "2700+", icon: IconBike },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 text-center border border-white shadow-sm">
                <Icon size={22} className="text-[#02554D] mx-auto mb-2" />
                <div className="text-2xl font-bold font-serif text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature-kaartjes */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-3">Wat kun je doen?</p>
            <h2 className="text-3xl font-semibold font-serif text-gray-900">
              Kies je speltype
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Wielerspellen */}
            <Link
              href="/preview/wielerspellen"
              className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-200 transition-colors">
                <IconBike size={24} className="text-[#02554D]" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-semibold font-serif text-gray-900">Wielerspellen</h3>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">4 spellen</span>
              </div>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Kies uit vier verschillende spellen — van een veiling tot een pickgame per etappe.
                Elk spel heeft zijn eigen strategie en puntenstructuur.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Auctioneer", "Slipstream", "Marginal Gains", "WorldTour Manager"].map((tag) => (
                  <span key={tag} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-[#02554D] flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                Bekijk voorbeelden <IconArrowRight size={16} />
              </span>
            </Link>

            {/* F1 */}
            <Link
              href="/preview/f1"
              className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-200 transition-colors">
                <IconFlag size={24} className="text-[#02554D]" />
              </div>
              <h3 className="text-xl font-semibold font-serif text-gray-900 mb-3">F1 Voorspellingen</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Voorspel de uitslag van elke Formule 1-race. Kies jouw coureur per race en verzamel
                punten gedurende het hele seizoen.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Race voorspellingen", "Seizoensranglijst", "Subpoules", "2026 seizoen"].map((tag) => (
                  <span key={tag} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-[#02554D] flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                Bekijk voorbeelden <IconArrowRight size={16} />
              </span>
            </Link>

            {/* WK 2026 */}
            <Link
              href="/preview/wk-2026"
              className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-5 group-hover:bg-emerald-200 transition-colors">
                <IconStar size={24} className="text-[#02554D]" />
              </div>
              <h3 className="text-xl font-semibold font-serif text-gray-900 mb-3">WK 2026</h3>
              <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                Het Wereldkampioenschap voetbal 2026 in Canada, Mexico en de VS. Voorspel de groepen,
                de knockout-fase en de uiteindelijke winnaar.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Groepsvoorspellingen", "Knockout-fase", "Subpoules", "Poule-ranglijst"].map((tag) => (
                  <span key={tag} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                    {tag}
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-[#02554D] flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                Bekijk voorbeelden <IconArrowRight size={16} />
              </span>
            </Link>
          </div>
        </section>

        {/* Community-sectie */}
        <section className="px-6 pb-20 max-w-6xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-10 border border-white shadow-sm">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80 mb-3">Community</p>
                <h2 className="text-3xl font-semibold font-serif text-gray-900 mb-4">
                  Meer dan alleen punten
                </h2>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Oracle Games is een community van sportfanaten. Discussieer in het forum, chat met
                  andere spelers en volg de ranglijsten in real-time.
                </p>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 bg-[#02554D] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#024d46] transition-colors"
                >
                  Gratis meedoen <IconArrowRight size={16} />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: IconUsers, label: "Forum", desc: "Discussieer over races en strategie" },
                  { icon: IconChartBar, label: "Ranglijsten", desc: "Bekijk wie het beste scoort" },
                  { icon: IconTrophy, label: "Achievements", desc: "Verdien badges en titels" },
                  { icon: IconCalendar, label: "Kalender", desc: "Mis geen enkele race of deadline" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100/50">
                    <Icon size={20} className="text-[#02554D] mb-2" />
                    <div className="font-semibold text-gray-900 text-sm">{label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA onderaan */}
        <section className="px-6 pb-20 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-semibold font-serif text-gray-900 mb-4">
            Klaar om mee te spelen?
          </h2>
          <p className="text-gray-600 mb-8">
            Maak een gratis account aan en doe mee aan de volgende game.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/register"
              className="bg-[#02554D] text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-[#024d46] transition-colors shadow-lg shadow-emerald-900/20"
            >
              Gratis aanmelden
            </Link>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors underline underline-offset-4"
            >
              Inloggen
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200/60 px-6 py-8">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} Oracle Games</span>
            <Link href="/privacy" className="hover:text-gray-700 transition-colors">Privacybeleid</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
