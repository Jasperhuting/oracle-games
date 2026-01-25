// update-rider-points.mjs
const riders = [
  { name: "tobias-lund-andresen", pointsScored: 110 },
  { name: "ethan-vernon", pointsScored: 90 },
  { name: "jay-vine", pointsScored: 78 },
  { name: "christian-scaroni", pointsScored: 75 },
  { name: "michael-matthews", pointsScored: 75 },
  { name: "sam-welsford", pointsScored: 68 },
  { name: "diego-pescador", pointsScored: 55 },
  { name: "pau-miquel-delgado", pointsScored: 55 },
  { name: "samuel-watson", pointsScored: 54 },
  { name: "andrea-vendrame", pointsScored: 52 },
  { name: "antonio-tiberi", pointsScored: 40 },
  { name: "lukas-kubis", pointsScored: 40 },
  { name: "laurence-pithie", pointsScored: 36 },
  { name: "antonio-morgado", pointsScored: 36 },
  { name: "luke-mudgway", pointsScored: 35 },
  { name: "jorge-abreu-soler", pointsScored: 34 },
  { name: "ivan-romeo", pointsScored: 32 },
  { name: "jon-barrenetxea-golzarri", pointsScored: 32 },
  { name: "athit-poulard", pointsScored: 30 },
  { name: "matthew-brennan", pointsScored: 30 },
  { name: "jhonatan-narvaez", pointsScored: 30 },
  { name: "xabier-berasategi-garmendia", pointsScored: 28 },
  { name: "mauro-schmid", pointsScored: 25 },
  { name: "diego-ulissi", pointsScored: 24 },
  { name: "diego-alejandro-mendez", pointsScored: 23 },
  { name: "brandon-alejandro-rojas-vega", pointsScored: 20 },
  { name: "carter-bettles", pointsScored: 20 },
  { name: "aaron-gate", pointsScored: 20 },
  { name: "axel-mariault", pointsScored: 20 },
  { name: "daniel-cavia-sanz", pointsScored: 20 },
  { name: "lewis-bower", pointsScored: 18 },
  { name: "louis-vervaeke", pointsScored: 16 },
  { name: "hector-alvarez-martinez", pointsScored: 16 },
  { name: "patrick-eddy", pointsScored: 15 },
  { name: "yorben-lauryssen", pointsScored: 15 },
  { name: "brady-gilmore", pointsScored: 14 },
  { name: "urko-berrade-fernandez", pointsScored: 14 },
  { name: "gotzon-martin", pointsScored: 14 },
  { name: "carlos-galviz", pointsScored: 13 },
  { name: "angel-alexander-gil", pointsScored: 13 },
  { name: "danny-van-poppel", pointsScored: 13 },
  { name: "andreas-kron", pointsScored: 13 },
  { name: "jake-stewart", pointsScored: 13 },
  { name: "jon-agirre", pointsScored: 12 },
  { name: "pierre-gautherat", pointsScored: 11 },
  { name: "nils-sinschek", pointsScored: 11 },
  { name: "luke-plapp", pointsScored: 10 },
  { name: "filippo-zana", pointsScored: 10 },
  { name: "nicolas-breuillard", pointsScored: 10 },
  { name: "oliver-bleddyn", pointsScored: 9 },
  { name: "enmanuel-viloria", pointsScored: 8 },
  { name: "clement-alleno", pointsScored: 8 },
  { name: "ibon-ruiz", pointsScored: 8 },
  { name: "oscar-chamberlain", pointsScored: 7 },
  { name: "anderson-timoteo-paredes", pointsScored: 7 },
  { name: "jesus-miguel-goyo", pointsScored: 7 },
  { name: "peerapong-ladngern", pointsScored: 7 },
  { name: "sarawut-sirironnachai", pointsScored: 7 },
  { name: "liam-walsh", pointsScored: 7 },
  { name: "natnael-tesfatsion", pointsScored: 7 },
  { name: "zak-erzen", pointsScored: 7 },
  { name: "eric-antonio-fagundez", pointsScored: 7 },
  { name: "edoardo-zambanini", pointsScored: 7 },
  { name: "gusneiver-gil", pointsScored: 6 },
  { name: "winston-maestre", pointsScored: 6 },
  { name: "jambaljamts-sainbayar", pointsScored: 6 },
  { name: "wout-poels", pointsScored: 6 },
  { name: "arlex-jose-rueda", pointsScored: 5 },
  { name: "jad-colmenares-bautista", pointsScored: 5 },
  { name: "fergus-browning", pointsScored: 5 },
  { name: "tim-torn-teutenberg", pointsScored: 5 },
  { name: "anthon-charmig", pointsScored: 5 },
  { name: "alexei-shnyrko", pointsScored: 5 },
  { name: "nairo-quintana", pointsScored: 5 },
  { name: "jens-reynders", pointsScored: 5 },
  { name: "rein-taaramae", pointsScored: 5 },
  { name: "leighton-cook", pointsScored: 4 },
  { name: "peerapol-chawchiangkwang", pointsScored: 4 },
  { name: "antoni-quintero-duarte", pointsScored: 4 },
  { name: "nattapol-jumchat", pointsScored: 4 },
  { name: "maikel-zijlaard", pointsScored: 4 },
  { name: "lionel-taminiaux", pointsScored: 4 },
  { name: "adam-yates", pointsScored: 4 },
  { name: "finn-fisher-black", pointsScored: 4 },
  { name: "merhawi-kudus", pointsScored: 4 },
  { name: "pablo-castrillo-zapater", pointsScored: 4 },
  { name: "camilo-andres-gomez-gomez", pointsScored: 3 },
  { name: "dylan-hopkins", pointsScored: 3 },
  { name: "georgios-bouglas", pointsScored: 3 },
  { name: "casper-van-uden", pointsScored: 3 },
  { name: "matteo-sobrero", pointsScored: 3 },
  { name: "matthew-fox2", pointsScored: 3 },
  { name: "cristian-raileanu", pointsScored: 3 },
  { name: "henrique-bravo1", pointsScored: 3 },
  { name: "kelland-brien", pointsScored: 2 },
  { name: "edwin-torres", pointsScored: 2 },
  { name: "bryan-raul-obando-rosas", pointsScored: 2 },
  { name: "german-rincon", pointsScored: 2 },
  { name: "matthew-dinham", pointsScored: 2 },
];

const endpoint = "http://localhost:3210/api/admin/update-rider-points";

// klein beetje “vriendelijk” voor je API (max 5 tegelijk)
const CONCURRENCY = 5;

async function updateOne(r) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riderNameId: r.name, pointsScored: r.pointsScored }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${r.name}: HTTP ${res.status} ${text}`);
  }

  // als je endpoint JSON terugstuurt:
  // return res.json();
  return true;
}

async function run() {
  let i = 0;
  let ok = 0;
  const errors = [];

  async function worker() {
    while (i < riders.length) {
      const idx = i++;
      const r = riders[idx];
      try {
        await updateOne(r);
        ok++;
        console.log(`✅ ${r.name} -> ${r.pointsScored}`);
      } catch (e) {
        errors.push({ rider: r.name, error: String(e) });
        console.error(`❌ ${r.name}`, e);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\nDone. Success: ${ok}/${riders.length}`);
  if (errors.length) {
    console.log("Errors:", errors);
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});