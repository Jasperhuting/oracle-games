import Link from "next/link";
import { IconArrowLeft, IconFlag, IconTrophy } from "@tabler/icons-react";
import { drivers, races2026 } from "@/app/f1/data";
import { Flag } from "@/components/Flag";

const raceTabs = races2026.slice(1, 7);

const driverCodes = [
  "COL",
  "GAS",
  "ALO",
  "STR",
  "BOR",
  "HUL",
  "BOT",
  "PER",
  "HAM",
  "LEC",
  "BEA",
  "OCO",
  "LAW",
  "LIN",
  "HAD",
  "VER",
  "ALB",
  "SAI",
];

const gridOrder = ["RUS", "ANT", "VER", "LEC", "HAM", "NOR", "PIA", "HAD", "LIN", "BEA"];

const extraPickCodes = {
  pole: "RUS",
  fastest: "VER",
  dnf1: "BOT",
  dnf2: "STR",
} as const;

const standings = [
  { pos: 1, alias: "Grid Atlas", points: "1.120" },
  { pos: 2, alias: "Turbo Echo", points: "1.088" },
  { pos: 3, alias: "Pitlane Nova", points: "1.042" },
  { pos: 4, alias: "Apex Mode", points: "997" },
  { pos: 5, alias: "Race Vector", points: "952" },
];

const race = races2026.find((item) => item.round === 2)!;

function getDriver(code: string) {
  return drivers.find((driver) => driver.shortName === code)!;
}

function ExtraPickCard({
  label,
  accent,
  code,
}: {
  label: string;
  accent: string;
  code: string;
}) {
  const driver = getDriver(code);

  return (
    <div className="overflow-hidden rounded-2xl bg-black/40 shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
      <div className="grid grid-cols-[64px_1fr]">
        <div className={`flex min-h-[78px] items-center justify-center text-[1.8rem] font-black ${accent}`}>
          {label === "POLE POSITION" ? "P1" : label === "FASTEST LAP" ? "◔" : "DNF"}
        </div>
        <div className="px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-7 overflow-hidden rounded-full bg-white/15">
                <img src={driver.image} alt={driver.lastName} className="h-full w-full object-cover object-top" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{driver.shortName}</span>
                <span className="text-sm text-slate-400">{driver.lastName}</span>
              </div>
            </div>
            <span className="text-slate-500">x</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GridDriver({ code, position }: { code: string; position: number }) {
  const driver = getDriver(code);
  const badgeClass =
    position <= 3
      ? "bg-[#f1c40f] text-slate-950"
      : position % 2 === 0
      ? "bg-slate-300 text-slate-900"
      : "bg-[#f39c12] text-slate-950";

  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${badgeClass}`}>
        {position}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5">
        <div className="relative h-6 w-6 overflow-hidden rounded-full bg-white/15">
          <img src={driver.image} alt={driver.lastName} className="h-full w-full object-cover object-top" />
        </div>
        <span className="text-sm font-semibold">{driver.shortName}</span>
        <span className="truncate text-xs text-slate-500">{driver.lastName}</span>
        <span className="ml-auto text-slate-500">x</span>
      </div>
    </div>
  );
}

function DriverPreviewCard({ code }: { code: string }) {
  const driver = getDriver(code);

  return (
    <div
      className="group relative h-[138px] overflow-hidden rounded-[16px] p-2 pl-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
      style={{ background: `linear-gradient(to left, ${driver.teamColor ?? "#1f3a5f"}, ${driver.teamColorAlt ?? "#0f172a"})` }}
    >
      <div className="relative z-10 flex h-full flex-col">
        <span className="text-[1.1rem] font-black leading-none text-white">{driver.firstName}</span>
        <span className="mt-1 text-[0.95rem] leading-none text-white">{driver.lastName}</span>
        <span className="mt-2 text-sm text-white/90">{driver.team}</span>
        <span className="absolute right-2 top-2 text-[1.95rem] font-black leading-none text-white/75">
          {driver.numberImage ? (
            <img className="h-6 w-6" src={driver.numberImage} alt={driver.lastName} />
          ) : (
            driver.number
          )}
        </span>
        <span className="mt-auto">
          <Flag countryCode={driver.country} width={16} />
        </span>
      </div>

      <div className="pointer-events-none absolute right-0 top-0 z-[5] w-[46%] transition-transform duration-500 ease-out group-hover:translate-y-2 group-hover:scale-105">
        <img className="h-auto w-full" src={driver.image} alt={driver.firstName} />
      </div>
    </div>
  );
}

export default function F1PreviewPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f2241_0%,#071225_45%,#020611_100%)] text-white">
      <main className="mx-auto max-w-[1560px] px-5 pb-16 pt-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/preview" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white">
            <IconArrowLeft size={16} />
            Terug naar preview-overzicht
          </Link>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Geanonimiseerde gebruikersnamen</div>
        </div>

        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-2xl bg-[#ff1020] px-5 py-3 text-base font-semibold text-white">
            <IconFlag size={18} />
            Races
          </button>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-[#162742] px-5 py-3 text-base font-semibold text-slate-300">
            <IconTrophy size={18} />
            Tussenstand
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[#aa6a11] bg-[rgba(84,38,22,0.58)] px-5 py-4 text-sm text-[#ffd39b]">
          Let op: door een systeemfout tellen de punten van ronde 1 helaas niet mee.
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {raceTabs.map((item) => (
            <div
              key={item.round}
              className={`min-w-[235px] rounded-2xl border px-4 py-3 ${
                item.round === 2
                  ? "border-white bg-[linear-gradient(90deg,rgba(26,53,97,0.92),rgba(16,29,56,0.98))]"
                  : item.round === 1
                  ? "border-[#17d266] bg-[rgba(22,37,65,0.9)]"
                  : "border-white/10 bg-[rgba(22,37,65,0.86)]"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${item.round <= 2 ? "bg-[#10b64c]" : "bg-white/15 text-slate-300"}`}>
                  {item.round}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[1rem] font-semibold">{item.name}</div>
                    {item.round <= 2 ? <span className="text-[#17d266]">✓</span> : null}
                  </div>
                  <div className="mt-1 truncate text-[11px] uppercase text-slate-400">{item.subName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.startDate.replaceAll("-", "-")}-{item.endDate.replaceAll("-", "-")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-6 overflow-hidden rounded-[20px] border border-white/15 bg-[linear-gradient(90deg,rgba(18,35,63,0.92),rgba(10,20,38,0.96))] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
          <div className="h-2 bg-[repeating-linear-gradient(90deg,#fff_0_10px,#0b1220_10px_20px)]" />
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ff0d1f] text-2xl font-black">
                2
              </div>
              <div>
                <div className="text-[2.1rem] font-semibold leading-none">{race.name}</div>
                <div className="mt-1 text-sm uppercase text-slate-400">{race.subName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Datum</div>
              <div className="mt-1 text-[1.05rem]">13 mrt - 15 mrt 2026</div>
              <span className="mt-2 inline-flex rounded-full bg-[#ff0d1f] px-4 py-1.5 text-sm font-semibold">AANKOMEND</span>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[1.9rem] font-semibold">Extra voorspellingen</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <ExtraPickCard label="POLE POSITION" accent="bg-[#f1c40f] text-black" code={extraPickCodes.pole} />
            <ExtraPickCard label="FASTEST LAP" accent="bg-[#8b2cff] text-white" code={extraPickCodes.fastest} />
            <ExtraPickCard label="DID NOT FINISH #1" accent="bg-[#f60012] text-white" code={extraPickCodes.dnf1} />
            <ExtraPickCard label="DID NOT FINISH #2" accent="bg-[#b00010] text-white" code={extraPickCodes.dnf2} />
          </div>
        </section>

        <section className="mt-5 rounded-[18px] border border-white/10 bg-white/5 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="border-l-4 border-[#ff0d1f] pl-4 text-[1rem] text-slate-200">
              <span className="font-semibold">Tip:</span> Sleep de coureurs naar de startgrid om je voorspelling te maken.
            </div>
            <div className="flex gap-3">
              <button className="rounded-2xl bg-white/15 px-5 py-2.5 text-base font-medium text-white">Reset</button>
              <button className="rounded-2xl bg-[#ff0d1f] px-5 py-2.5 text-base font-semibold text-white">Opslaan</button>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-[16px] bg-[linear-gradient(180deg,rgba(61,73,102,0.95),rgba(29,41,67,0.95))] p-4">
              <img src={race.raceImage} alt={race.name} className="pointer-events-none absolute bottom-3 right-3 h-24 w-24 opacity-12" />
              <div className="relative z-10">
                <div className="text-[1rem] font-semibold">China</div>
                <div className="mt-2 text-[2rem] font-semibold leading-none">Circuit</div>
                <div className="mt-2 text-[0.95rem] text-slate-300">FORMULA 1 HEIN...</div>
              </div>
            </div>

            <div className="rounded-[16px] bg-[linear-gradient(180deg,rgba(23,55,140,0.95),rgba(13,28,82,0.98))] p-4">
              <div className="text-[2rem] font-semibold leading-none">Ronde 2</div>
              <div className="mt-2 text-[1.2rem]">Start over 3 d</div>
              <div className="mt-4 text-[1rem] text-slate-200">13 mrt - 15 mrt</div>
            </div>

            {driverCodes.map((code) => (
              <DriverPreviewCard key={code} code={code} />
            ))}
          </div>

          <aside className="overflow-hidden rounded-[20px] border border-white/15 bg-[linear-gradient(180deg,rgba(17,30,55,0.96),rgba(10,19,37,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
            <div className="h-2 bg-[repeating-linear-gradient(90deg,#fff_0_10px,#0b1220_10px_20px)]" />
            <div className="px-5 py-4">
              <div className="flex items-center justify-center gap-3 text-[1.6rem] font-semibold">
                <span className="h-8 w-1 rounded-full bg-[#ff0d1f]" />
                GRID
                <span className="h-8 w-1 rounded-full bg-[#ff0d1f]" />
              </div>

              <div className="mt-5 grid gap-3">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-2 gap-4">
                    <GridDriver code={gridOrder[rowIndex * 2]} position={rowIndex * 2 + 1} />
                    <GridDriver code={gridOrder[rowIndex * 2 + 1]} position={rowIndex * 2 + 2} />
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-white/10 pt-5 text-center">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Finish line</div>
                <div className="mt-3 h-3 bg-[repeating-linear-gradient(90deg,#fff_0_10px,#0b1220_10px_20px)]" />
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-6 overflow-hidden rounded-[18px] border border-white/10 bg-white/5">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Demo</div>
              <div className="mt-1 text-[1.5rem] font-semibold">Tussenstand</div>
            </div>
            <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-slate-300">Fictieve spelers</div>
          </div>
          <div className="grid gap-3 px-5 py-4">
            {standings.map((entry) => (
              <div key={entry.alias} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                    {entry.pos}
                  </div>
                  <div className="font-semibold">{entry.alias}</div>
                </div>
                <div className="text-lg font-semibold">{entry.points}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
