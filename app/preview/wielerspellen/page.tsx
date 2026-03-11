import Link from "next/link";
import {
  IconArrowLeft,
  IconChevronDown,
  IconFilter,
  IconLayoutGrid,
  IconList,
  IconSearch,
} from "@tabler/icons-react";

const SLIPSTREAM_PICKS = [
  { name: "Mathieu van der Poel", team: "Alpecin-Deceuninck", points: "120 pt" },
  { name: "Tadej Pogacar", team: "UAE Team Emirates", points: "114 pt" },
  { name: "Filippo Ganna", team: "Ineos Grenadiers", points: "95 pt" },
  { name: "Mads Pedersen", team: "Lidl-Trek", points: "91 pt" },
  { name: "Jasper Philipsen", team: "Alpecin-Deceuninck", points: "89 pt" },
  { name: "Wout van Aert", team: "Visma | Lease a Bike", points: "88 pt" },
  { name: "Tom Pidcock", team: "Q36.5 Pro Cycling", points: "83 pt" },
  { name: "Arnaud De Lie", team: "Lotto", points: "78 pt" },
];

const SLIPSTREAM_ROWS = [
  { alias: "Peloton Nova", picks: ["Mathieu vdP", "Tadej Pogacar", "Filippo Ganna", "-", "-"] },
  { alias: "Sprint Echo", picks: ["Jonathan Milan", "Mathieu vdP", "Tom Pidcock", "-", "-"] },
  { alias: "Kopgroep 07", picks: ["Mads Pedersen", "Tadej Pogacar", "Filippo Ganna", "-", "-"] },
  { alias: "Bergmodus", picks: ["Wout van Aert", "Mathieu vdP", "Arnaud De Lie", "-", "-"] },
  { alias: "Ritmeester", picks: ["Jasper Philipsen", "Mads Pedersen", "Tom Pidcock", "-", "-"] },
  { alias: "Tempo Flux", picks: ["Filippo Ganna", "Tadej Pogacar", "Mathieu vdP", "-", "-"] },
];

const SLIPSTREAM_STANDINGS = [
  { pos: 1, alias: "Peloton Nova", points: "614" },
  { pos: 2, alias: "Sprint Echo", points: "602" },
  { pos: 3, alias: "Kopgroep 07", points: "598" },
  { pos: 4, alias: "Bergmodus", points: "591" },
];

const AUCTION_RIDERS = [
  { name: "Tadej Pogacar", team: "UAE Team Emirates - XRG", rank: 1, age: 26, country: "SLO", price: "4.921", bid: "N/A", wonBy: null },
  { name: "Isaac del Toro", team: "UAE Team Emirates - XRG", rank: 2, age: 22, country: "MEX", price: "2.755", bid: "N/A", wonBy: null },
  { name: "Jonas Vingegaard", team: "Team Visma | Lease a Bike", rank: 3, age: 29, country: "DEN", price: "2.399", bid: "N/A", wonBy: null },
  { name: "Joao Almeida", team: "UAE Team Emirates - XRG", rank: 4, age: 27, country: "POR", price: "2.270", bid: "N/A", wonBy: null },
  { name: "Mads Pedersen", team: "Lidl - Trek", rank: 5, age: 30, country: "DEN", price: "2.233", bid: "N/A", wonBy: null },
  { name: "Remco Evenepoel", team: "Red Bull - BORA - hansgrohe", rank: 6, age: 26, country: "BEL", price: "1.924", bid: "N/A", wonBy: null },
];

const AUCTION_STANDINGS = [
  { pos: 1, alias: "Grid Atlas", score: "1.478" },
  { pos: 2, alias: "Peloton Nova", score: "1.202" },
  { pos: 3, alias: "Tempo Flux", score: "1.165" },
  { pos: 4, alias: "Sprint Echo", score: "1.161" },
];

export default function WielerspellenPreviewPage() {
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-900">
      <main className="pb-16">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-5 py-6 lg:px-8">
          <Link href="/preview" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900">
            <IconArrowLeft size={16} />
            Terug naar preview-overzicht
          </Link>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Geanonimiseerde demo</div>
        </div>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-5 py-7 lg:px-8">
            <div>
              <div className="text-[2.2rem] font-semibold leading-tight">Veiling - Auction Master (Season)</div>
              <div className="mt-1 text-[1.05rem] text-slate-500">Division 1</div>
            </div>
            <div className="hidden flex-wrap gap-2 md:flex">
              {["Ververs", "Dashboard", "Tussenstand"].map((item) => (
                <button key={item} className="rounded-md border border-[#b7d0c9] bg-white px-5 py-3 text-base font-medium text-[#04584f]">
                  {item}
                </button>
              ))}
              <button className="rounded-md bg-[#065f56] px-5 py-3 text-base font-medium text-white">
                Back To Games
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-9 max-w-[1280px] px-5 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <div className="flex gap-2 border-b border-slate-200 px-5 pt-3">
                <div className="rounded-t-xl bg-slate-100 px-4 py-3 text-[1.05rem] font-medium text-[#065f56]">Bieden</div>
                <div className="px-4 py-3 text-[1.05rem] font-medium text-slate-400">Bidding history</div>
              </div>

              <div className="p-5">
                <div className="rounded-md bg-[#065f56] px-4 py-3 text-center text-[1.05rem] font-medium text-white">
                  De biedingen zijn gesloten
                </div>
                <div className="mt-3 text-sm text-slate-500">Einddatum: Onbekende datum</div>

                <div className="mt-2 rounded-2xl border border-slate-200 bg-[#fcfcfc]">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-[1.15rem] font-semibold">Renners</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="flex gap-2">
                      <button className="inline-flex items-center gap-2 rounded-md bg-[#065f56] px-4 py-3 text-base font-medium text-white">
                        <IconLayoutGrid size={18} />
                        Kaart
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-md border border-[#b7d0c9] bg-white px-4 py-3 text-base font-medium text-[#065f56]">
                        <IconList size={18} />
                        Lijst
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[1.05rem]">Sorteer op</span>
                      <div className="flex items-center gap-4 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[1.05rem] text-slate-700">
                        Rang
                        <IconChevronDown size={18} className="text-slate-400" />
                      </div>
                      <button className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600">
                        <IconFilter size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 bg-slate-50 p-4 md:grid-cols-2 2xl:grid-cols-3">
                    {AUCTION_RIDERS.map((rider) => (
                      <article key={rider.name} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                        <div className="flex items-start gap-3">
                          <div className="flex h-14 w-12 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            Kit
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[1.05rem] font-semibold">{rider.name}</div>
                            <div className="mt-1 truncate text-sm text-slate-500">{rider.team}</div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-[1.02rem]">
                          {[
                            ["Rank:", String(rider.rank)],
                            ["Age:", String(rider.age)],
                            ["Country:", rider.country],
                            ["Price:", `€ ${rider.price}`],
                            ["Bid:", rider.bid],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-slate-700">{label}</span>
                              <span className="text-slate-400">{value}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-3">
                          <div className="text-sm text-slate-400">Geen bod</div>
                          <span className="mt-2 inline-flex rounded-full border border-blue-500 px-2 py-1 text-[11px] font-semibold text-blue-600">
                            PCS stats
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-[20px] border border-[#f1b5b5] bg-[#fff0f0] px-5 py-5 text-[1.05rem] text-[#b11313]">
                The auction has ended. No more bids can be placed.
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-[1.9rem] font-semibold leading-none">Filters</div>
                  <IconChevronDown size={20} className="text-slate-400" />
                </div>

                <div className="text-lg font-semibold text-slate-700">Zoeken</div>
                <div className="relative mt-2">
                  <IconSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <div className="rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 text-[1.05rem] text-slate-400">
                    Zoek renners bij naam of team...
                  </div>
                </div>

                <div className="mt-6 text-lg font-semibold text-slate-700">Prijsklasse</div>
                <div className="mt-4 h-3 rounded-full bg-[#065f56]" />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="w-24 rounded-xl border border-slate-300 px-4 py-2 text-[1.05rem]">1</div>
                  <div className="w-24 rounded-xl border border-slate-300 px-4 py-2 text-right text-[1.05rem]">4921</div>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <button className="rounded-md bg-[#9fb9b2] px-4 py-3 text-[1.02rem] font-medium text-white">
                    Reset biedingen
                  </button>
                </div>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                <div className="mb-5 flex items-center justify-between">
                  <div className="text-[1.9rem] font-semibold leading-none">Budget Stats</div>
                  <IconChevronDown size={20} className="text-slate-400" />
                </div>

                <div className="space-y-2 text-[1.05rem]">
                  {[
                    ["Total Budget:", "€ 7.000", "text-slate-900"],
                    ["Total Spent:", "€ 0", "text-blue-600"],
                    ["Overgebleven budget:", "€ 7.000", "text-green-600"],
                    ["Riders Won:", "0", "text-[#065f56]"],
                    ["Max Renners:", "12", "text-slate-900"],
                  ].map(([label, value, color]) => (
                    <div key={label} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-b-0">
                      <span className="text-slate-600">{label}</span>
                      <span className={`font-semibold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="mb-4 text-[1.35rem] font-semibold">Tussenstand</div>
                  <div className="space-y-3 text-[1.02rem]">
                    {AUCTION_STANDINGS.map((entry) => (
                      <div key={entry.alias} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">#{entry.pos}</span>
                          <span>{entry.alias}</span>
                        </div>
                        <span className="font-semibold text-[#065f56]">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-[1280px] px-5 lg:px-8">
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#065f56]">Preview 2</div>
            <h2 className="mt-2 text-[2rem] font-semibold">Slipstream</h2>
            <p className="mt-2 max-w-3xl text-slate-500">
              Deze variant volgt de compacte wedstrijdopzet uit je screenshot: links racekeuze, in het midden de pick-flow en rechts de tussenstand. Gebruikersnamen zijn vervangen door fictieve aliassen.
            </p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-[2rem] font-semibold leading-none">Slipstream</div>
                <div className="mt-1 text-slate-500">Slipstream (Season)</div>
              </div>
              <button className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white">Back</button>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
              <div className="rounded-2xl border border-slate-200 bg-[#fbfbfb] p-4">
                <div className="text-sm font-semibold">Select Race</div>
                <div className="mt-3 flex gap-2 text-[11px] font-semibold">
                  <span className="rounded-md bg-orange-500 px-2 py-1 text-white">Picks nodig</span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-500">Aankomend</span>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ["E3 Savo Classic", "10 Apr 2026", "Picks nodig"],
                    ["In Flandres Fields", "13 Apr 2026", null],
                    ["Dwars door Vlaanderen", "14 Apr 2026", null],
                    ["Paris-Roubaix", "20 Apr 2026", null],
                    ["Brabantse Pijl", "22 Apr 2026", null],
                  ].map(([name, date, badge], index) => (
                    <div key={name} className={`rounded-xl border px-3 py-3 ${index === 0 ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold leading-tight">{name}</span>
                        {badge ? <span className="rounded-md bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">Pick in</span> : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">{date}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-[#fbfbfb] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">Select Rider</div>
                      <div className="mt-1 text-xs text-slate-500">Team 1 - fictieve demo-opstelling</div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-3 py-1.5">Uitslagen</span>
                      <span className="rounded-md bg-slate-100 px-3 py-1.5">Picks</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm">
                    <span className="font-medium text-orange-700">Jouw huidige pick:</span>{" "}
                    <span className="font-semibold">Mathieu van der Poel</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {SLIPSTREAM_PICKS.map((pick) => (
                      <div key={pick.name} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-semibold leading-tight">{pick.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{pick.team}</div>
                        <div className="mt-3 inline-flex rounded-full bg-green-100 px-2 py-1 text-[11px] font-bold text-green-700">
                          {pick.points}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-semibold">Pickmatrix</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400">
                            <th className="px-3 py-2">Deelnemer</th>
                            <th className="px-3 py-2">Milano-Sanremo</th>
                            <th className="px-3 py-2">Ronde van Vlaanderen</th>
                            <th className="px-3 py-2">E3 Savo Classic</th>
                            <th className="px-3 py-2">In Flandres Fields</th>
                            <th className="px-3 py-2">Dwars door Vlaanderen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SLIPSTREAM_ROWS.map((row) => (
                            <tr key={row.alias} className="border-b border-slate-100">
                              <td className="px-3 py-3 font-semibold">{row.alias}</td>
                              {row.picks.map((pick, index) => (
                                <td key={`${row.alias}-${index}`} className="px-3 py-3">
                                  {pick === "-" ? (
                                    <span className="text-slate-300">-</span>
                                  ) : (
                                    <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700">{pick}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-[#fbfbfb] p-4">
                <div className="text-sm font-semibold">Standings</div>
                <div className="mt-3 flex gap-2 text-xs font-semibold">
                  <span className="rounded-md bg-amber-400 px-3 py-1.5 text-white">Yellow Jersey</span>
                  <span className="rounded-md bg-green-500 px-3 py-1.5 text-white">Green Jersey</span>
                </div>
                <div className="mt-4 space-y-3">
                  {SLIPSTREAM_STANDINGS.map((entry) => (
                    <div key={entry.alias} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
                            {entry.pos}
                          </div>
                          <span className="text-sm font-semibold">{entry.alias}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-500">{entry.points}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
