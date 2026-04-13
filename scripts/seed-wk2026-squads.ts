import { getServerFirebaseFootball } from "../lib/firebase/server";
import { load } from "cheerio";

const VOETBALFANSHOP_URL =
  "https://www.voetbalfanshop.nl/blog/dit-zijn-de-selecties-van-het-wk-2026/";

const FOURFOURTWO_FALLBACKS: Record<string, string> = {
  bosnia_and_herzegovina:
    "https://www.fourfourtwo.com/team/bosnia-world-cup-2026-squad",
  dr_congo: "https://www.fourfourtwo.com/team/dr-congo-world-cup-2026-squad",
  iraq: "https://www.fourfourtwo.com/team/iraq-world-cup-2026-squad",
  saudi_arabia:
    "https://www.fourfourtwo.com/team/saudi-arabia-world-cup-2026-squad",
  switzerland:
    "https://www.fourfourtwo.com/team/switzerland-world-cup-2026-squad",
  turkey: "https://www.fourfourtwo.com/team/turkiye-world-cup-2026-squad",
};

type PlayerPosition = "keeper" | "verdediger" | "middenvelder" | "spits";

interface SquadPlayer {
  name: string;
  position: PlayerPosition;
}

interface ParsedSquad {
  sourceCountryName: string;
  sourceUrl: string;
  squad: SquadPlayer[];
}

const DOC_ID_BY_SOURCE_NAME: Record<string, string> = {
  Algeria: "algeria",
  Algerije: "algeria",
  Argentina: "argentina",
  Argentinië: "argentina",
  Australia: "australia",
  Australië: "australia",
  Austria: "austria",
  Oostenrijk: "austria",
  Belgium: "belgium",
  België: "belgium",
  "Bosnia and Herzegovina": "bosnia_and_herzegovina",
  Brazil: "brazil",
  Brazilië: "brazil",
  Canada: "canada",
  "Cape Verde": "cape_verde",
  Kaapverdië: "cape_verde",
  Colombia: "colombia",
  Croatia: "croatia",
  Kroatië: "croatia",
  Curacao: "curacao",
  Curaçao: "curacao",
  "Czech Republic": "czechia",
  Tsjechië: "czechia",
  "DR Congo": "dr_congo",
  Ecuador: "ecuador",
  Egypt: "egypt",
  Egypte: "egypt",
  England: "england",
  Engeland: "england",
  France: "france",
  Frankrijk: "france",
  Germany: "germany",
  Duitsland: "germany",
  Ghana: "ghana",
  Haiti: "haiti",
  Haïti: "haiti",
  Iran: "iran",
  Iraq: "iraq",
  "Ivory Coast": "cote_divoire",
  Ivoorkust: "cote_divoire",
  Japan: "japan",
  Jordan: "jordan",
  Jordanië: "jordan",
  Mexico: "mexico",
  Morocco: "morocco",
  Marokko: "morocco",
  Netherlands: "netherlands",
  Nederland: "netherlands",
  "New Zealand": "new_zealand",
  "Nieuw-Zeeland": "new_zealand",
  Norway: "norway",
  Noorwegen: "norway",
  Panama: "panama",
  Paraguay: "paraguay",
  Portugal: "portugal",
  Qatar: "qatar",
  "Saoedi-Arabië": "saudi_arabia",
  "Saudi Arabia": "saudi_arabia",
  Scotland: "scotland",
  Schotland: "scotland",
  Senegal: "senegal",
  "South Africa": "south_africa",
  "Zuid-Afrika": "south_africa",
  "South Korea": "south_korea",
  "Zuid-Korea": "south_korea",
  Spain: "spain",
  Spanje: "spain",
  Sweden: "sweden",
  Zweden: "sweden",
  Switzerland: "switzerland",
  Tunisia: "tunisia",
  Tunesië: "tunisia",
  Türkiye: "turkey",
  "United States": "united_states",
  "Verenigde Staten": "united_states",
  Uruguay: "uruguay",
  Uzbekistan: "uzbekistan",
  Oezbekistan: "uzbekistan",
};

const DUTCH_POSITION_BY_LABEL: Record<string, PlayerPosition> = {
  keepers: "keeper",
  verdedigers: "verdediger",
  middenvelders: "middenvelder",
  aanvallers: "spits",
};

const FFT_POSITION_BY_LABEL: Record<string, PlayerPosition> = {
  GK: "keeper",
  DF: "verdediger",
  MF: "middenvelder",
  FW: "spits",
};

function cleanCountryHeading(rawText: string): string {
  return rawText.replace(/^\*/, "").trim();
}

function normalizePlayerName(rawName: string): string {
  return rawName
    .replace(/\([^)]*\)/g, "")
    .replace(/©/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\.\s*$/g, "")
    .trim();
}

function splitPlayerList(rawList: string): string[] {
  return rawList
    .replace(/[.!?]\s+/g, ", ")
    .replace(/\.$/g, "")
    .split(",")
    .map(normalizePlayerName)
    .filter(Boolean);
}

function uniqueSquad(players: SquadPlayer[]): SquadPlayer[] {
  const seen = new Set<string>();
  const result: SquadPlayer[] = [];

  for (const player of players) {
    const key = `${player.position}::${player.name.toLocaleLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(player);
  }

  return result;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "accept-language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function parseVoetbalfanshopSquads(): Promise<Map<string, ParsedSquad>> {
  const html = await fetchText(VOETBALFANSHOP_URL);
  const $ = load(html);
  const main = $("main").first();
  const nodes = main.find("h2, h3, h4, p").toArray();

  const squads = new Map<string, ParsedSquad>();
  let currentCountryName: string | null = null;
  let currentDocId: string | null = null;
  let pendingPosition: PlayerPosition | null = null;

  for (const node of nodes) {
    const text = $(node).text().replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    const isCountryHeading =
      (node.tagName === "h3" || node.tagName === "p") && text.startsWith("*");

    if (isCountryHeading) {
      const countryName = cleanCountryHeading(text);
      const docId = DOC_ID_BY_SOURCE_NAME[countryName];

      if (!docId) {
        currentCountryName = null;
        currentDocId = null;
        pendingPosition = null;
        continue;
      }

      currentCountryName = countryName;
      currentDocId = docId;
      pendingPosition = null;

      if (!squads.has(docId)) {
        squads.set(docId, {
          sourceCountryName: countryName,
          sourceUrl: VOETBALFANSHOP_URL,
          squad: [],
        });
      }

      continue;
    }

    if (!currentCountryName || !currentDocId) {
      continue;
    }

    if (node.tagName === "h4") {
      const label = text.replace(/:$/, "").toLocaleLowerCase();
      pendingPosition = DUTCH_POSITION_BY_LABEL[label] ?? null;
      continue;
    }

    const inlineMatch = text.match(
      /^(Keepers|Verdedigers|Middenvelders|Aanvallers):\s*(.+)$/i,
    );

    const position = inlineMatch
      ? DUTCH_POSITION_BY_LABEL[inlineMatch[1].toLocaleLowerCase()]
      : pendingPosition;

    if (!position) {
      continue;
    }

    const playerListText = inlineMatch ? inlineMatch[2] : text;
    const parsedPlayers = splitPlayerList(playerListText).map((name) => ({
      name,
      position,
    }));

    squads.get(currentDocId)?.squad.push(...parsedPlayers);

    if (!inlineMatch) {
      pendingPosition = null;
    }
  }

  for (const [docId, squad] of squads) {
    squads.set(docId, {
      ...squad,
      squad: uniqueSquad(squad.squad),
    });
  }

  return squads;
}

async function parseFourFourTwoSquad(
  docId: string,
  url: string,
): Promise<ParsedSquad> {
  const html = await fetchText(url);
  const $ = load(html);
  const main = $("main, article").first();
  const titleText = main.find("h1").first().text().replace(/\s+/g, " ").trim();
  const sourceCountryName = titleText.split(" World Cup 2026 squad")[0].trim();

  const nodes = main.find("h2, h3, li").toArray();
  const squad: SquadPlayer[] = [];
  let inSquadBlock = false;

  for (const node of nodes) {
    const text = $(node).text().replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    if (/^h[23]$/i.test(node.tagName)) {
      if (/World Cup 2026 squad: The/i.test(text)) {
        inSquadBlock = true;
        continue;
      }

      if (inSquadBlock) {
        break;
      }

      continue;
    }

    if (!inSquadBlock) {
      continue;
    }

    const match = text.match(/^(GK|DF|MF|FW):\s*(.+)$/);
    if (!match) {
      continue;
    }

    const position = FFT_POSITION_BY_LABEL[match[1]];
    const name = normalizePlayerName(match[2]);

    if (!position || !name) {
      continue;
    }

    squad.push({ name, position });
  }

  const unique = uniqueSquad(squad);
  if (unique.length === 0) {
    throw new Error(`No squad parsed for ${docId} from ${url}`);
  }

  return {
    sourceCountryName,
    sourceUrl: url,
    squad: unique,
  };
}

function buildPlayersByPosition(squad: SquadPlayer[]) {
  return {
    keeper: squad.filter((player) => player.position === "keeper").map((player) => player.name),
    verdediger: squad
      .filter((player) => player.position === "verdediger")
      .map((player) => player.name),
    middenvelder: squad
      .filter((player) => player.position === "middenvelder")
      .map((player) => player.name),
    spits: squad.filter((player) => player.position === "spits").map((player) => player.name),
  };
}

async function main() {
  const shouldWrite = process.argv.includes("--write");

  const db = getServerFirebaseFootball();
  const contendersSnapshot = await db.collection("contenders").get();

  if (contendersSnapshot.empty) {
    throw new Error("No contenders found in oracle-games-football.");
  }

  const voetbalfanshopSquads = await parseVoetbalfanshopSquads();
  const combinedSquads = new Map<string, ParsedSquad>(voetbalfanshopSquads);

  for (const [docId, url] of Object.entries(FOURFOURTWO_FALLBACKS)) {
    if (combinedSquads.has(docId)) {
      continue;
    }

    combinedSquads.set(docId, await parseFourFourTwoSquad(docId, url));
  }

  const missingDocIds = contendersSnapshot.docs
    .map((doc) => doc.id)
    .filter((docId) => !combinedSquads.has(docId));

  if (missingDocIds.length > 0) {
    throw new Error(
      `Still missing squad data for: ${missingDocIds.join(", ")}`,
    );
  }

  const summary = contendersSnapshot.docs.map((doc) => {
    const parsed = combinedSquads.get(doc.id);
    if (!parsed) {
      throw new Error(`Missing parsed squad for ${doc.id}`);
    }

    const playersByPosition = buildPlayersByPosition(parsed.squad);
    return {
      docId: doc.id,
      teamName: String(doc.data().name ?? doc.id),
      squadSize: parsed.squad.length,
      sourceUrl: parsed.sourceUrl,
      keepers: playersByPosition.keeper.length,
      defenders: playersByPosition.verdediger.length,
      midfielders: playersByPosition.middenvelder.length,
      forwards: playersByPosition.spits.length,
      payload: {
        players: parsed.squad.map((player) => player.name),
        squad: parsed.squad,
        playersByPosition,
        squadImportedAt: new Date().toISOString(),
        squadImportedFrom: {
          countryName: parsed.sourceCountryName,
          url: parsed.sourceUrl,
        },
      },
    };
  });

  console.table(
    summary.map(({ docId, teamName, squadSize, keepers, defenders, midfielders, forwards }) => ({
      docId,
      teamName,
      squadSize,
      keepers,
      defenders,
      midfielders,
      forwards,
    })),
  );

  if (!shouldWrite) {
    console.log("\nDry run completed. Re-run with --write to update Firestore.");
    return;
  }

  let batch = db.batch();
  let opCount = 0;

  for (const item of summary) {
    batch.set(db.collection("contenders").doc(item.docId), item.payload, {
      merge: true,
    });
    opCount++;

    if (opCount === 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`\nUpdated ${summary.length} contender documents in oracle-games-football.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
