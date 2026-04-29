/**
 * Seed Giro d'Italia 2026 startlijst als eligible players
 *
 * Zet de raceLineups voor giro-d-italia_2026 en update alle games
 * die verwijzen naar die race met eligibleRiders en eligibleTeams.
 *
 * Run with: npx ts-node scripts/seed-giro-2026-lineup.ts
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

const RACE_SLUG = 'giro-d-italia_2026';

interface TeamEntry {
  teamSlug: string;
  teamName: string;
  riders: string[];
}

const TEAMS: TeamEntry[] = [
  {
    teamSlug: 'alpecin-premier-tech-2026',
    teamName: 'Alpecin-Premier Tech',
    riders: [
      'kaden-groves',
      'tobias-bayer',
      'francesco-busatto',
      'jonas-geens',
      'edward-planckaert',
      'jensen-plowright',
      'johan-price-pejtersen',
      'luca-vergallito',
    ],
  },
  {
    teamSlug: 'bahrain-victorious-2026',
    teamName: 'Bahrain - Victorious',
    riders: [
      'santiago-buitrago-sanchez',
      'damiano-caruso',
      'matevz-govekar',
      'fran-miholjevic',
      'afonso-eulalio',
      'mathijs-paasschens',
      'alec-segaert',
      'edoardo-zambanini',
    ],
  },
  {
    teamSlug: 'bardiani-csf-7-saber-2026',
    teamName: 'Bardiani CSF 7 Saber',
    riders: [
      'luca-covili',
      'filippo-magli2',
      'martin-marcellusi',
      'alessio-martinelli',
      'luca-paletti',
      'manuele-tarozzi',
      'filippo-turconi',
      'enrico-zanoncello',
    ],
  },
  {
    teamSlug: 'decathlon-cma-cgm-team-2026',
    teamName: 'Decathlon CMA CGM Team',
    riders: [
      'felix-gall',
      'tobias-lund-andresen',
      'tord-gudmestad',
      'gregor-muhlberger',
      'oliver-naesen',
      'rasmus-sojbergpedersen',
      'callum-scotson',
      'johannes-staune-mittet',
    ],
  },
  {
    teamSlug: 'ef-education-easypost-2026',
    teamName: 'EF Education - EasyPost',
    riders: [
      'samuele-battistella',
      'jefferson-alexander-cepeda',
      'sean-quinn',
      'darren-rafferty',
      'james-shaw',
      'michael-valgren-andersen',
      'jardi-christiaan-van-der-lee',
    ],
  },
  {
    teamSlug: 'groupama-fdj-united-2026',
    teamName: 'Groupama - FDJ United',
    riders: [
      'lorenzo-germani',
      'remi-cavagna',
      'cyril-barthe',
      'axel-huens',
      'johan-jacobs',
      'josh-kench',
      'paul-penhoet',
      'remy-rochas',
      'brieuc-rolland',
    ],
  },
  {
    teamSlug: 'netcompany-ineos-cycling-team-2026',
    teamName: 'Netcompany INEOS Cycling Team',
    riders: [
      'egan-bernal',
      'thymen-arensman',
      'filippo-ganna',
      'jack-haig',
      'magnus-sheffield',
      'embret-svestad-bardseng',
      'connor-swift',
      'ben-turner',
    ],
  },
  {
    teamSlug: 'lidl-trek-2026',
    teamName: 'Lidl - Trek',
    riders: [
      'giulio-ciccone',
      'simone-consonni',
      'derek-gee',
      'amanuel-ghebreigzabhier',
      'jonathan-milan',
      'matteo-sobrero',
      'tim-torn-teutenberg',
      'max-walscheid',
    ],
  },
  {
    teamSlug: 'lotto-intermarche-2026',
    teamName: 'Lotto Intermarché',
    riders: [
      'lennert-van-eetvelt',
      'liam-slock',
      'arnaud-de-lie',
      'toon-aerts',
      'jasper-de-buyst',
      'simone-gualdi',
      'mathieu-kockelmann',
      'milan-menten',
      'lorenzo-rota',
      'jonas-rutsch',
    ],
  },
  {
    teamSlug: 'movistar-team-2026',
    teamName: 'Movistar Team',
    riders: [
      'ivan-garcia-cortina',
      'orluis-aular',
      'juan-pedro-lopez',
      'enric-mas',
      'lorenzo-milesi',
      'nelson-oliveira',
      'javier-romo',
      'einer-rubio',
    ],
  },
  {
    teamSlug: 'nsn-cycling-team-2026',
    teamName: 'NSN Cycling Team',
    riders: [
      'alessandro-pinarello',
      'jan-hirt',
      'ryan-mullen',
      'nick-schultz',
      'dion-smith',
      'jake-stewart',
      'corbin-strong',
      'ethan-vernon',
    ],
  },
  {
    teamSlug: 'pinarello-q365-pro-cycling-team-2026',
    teamName: 'Pinarello Q36.5 Pro Cycling Team',
    riders: [
      'sjoerd-bax',
      'fabio-christen',
      'david-de-la-cruz',
      'mark-donovan',
      'david-gonzalez-lopez',
      'chris-harper',
      'matteo-moschetti',
      'nickolas-zukowsky',
    ],
  },
  {
    teamSlug: 'red-bull-bora-hansgrohe-2026',
    teamName: 'Red Bull - BORA - hansgrohe',
    riders: [
      'danny-van-poppel',
      'jai-hindley',
      'giovanni-aleotti',
      'gianni-moscon',
      'giulio-pellizzari',
      'luke-tuckwell',
      'mick-van-dijke',
      'aleksandr-vlasov',
      'ben-zwiehoff',
    ],
  },
  {
    teamSlug: 'soudal-quick-step-2026',
    teamName: 'Soudal Quick-Step',
    riders: [
      'ayco-bastiaens',
      'gianmarco-garofoli',
      'paul-magnier',
      'andrea-raccagni-noviero',
      'jasper-stuyven',
      'dries-van-gestel',
      'filippo-zana',
    ],
  },
  {
    teamSlug: 'team-jayco-alula-2026',
    teamName: 'Team Jayco AlUla',
    riders: [
      'filippo-conca',
      'luka-mezgec',
      'ben-o-connor',
      'pascal-ackermann',
      'koen-bouwman',
      'robert-donaldson',
      'felix-engelhardt',
      'alan-hatherly',
      'christopher-juul-jensen',
      'andrea-vendrame',
    ],
  },
  {
    teamSlug: 'team-picnic-postnl-2026',
    teamName: 'Team Picnic PostNL',
    riders: [
      'timo-de-jong',
      'sean-flynn',
      'chris-hamilton',
      'james-knox',
      'gijs-leemreize',
      'tim-naberman',
      'frank-van-den-broek',
      'casper-van-uden',
    ],
  },
  {
    teamSlug: 'team-polti-visitmalta-2026',
    teamName: 'Team Polti VisitMalta',
    riders: [
      'mattia-bais',
      'ludovico-crescioli',
      'giovanni-lonardi',
      'mirco-maestri',
      'andrea-mifsud',
      'thomas-pesenti',
      'andrea-pietrobon',
      'diego-pablo-sevilla',
    ],
  },
  {
    teamSlug: 'team-visma-lease-a-bike-2026',
    teamName: 'Team Visma | Lease a Bike',
    riders: [
      'jonas-vingegaard',
      'victor-campenaerts',
      'wilco-kelderman',
      'timo-kielich',
      'sepp-kuss',
      'bart-lemmen',
      'davide-piganzoli',
      'tim-rex',
    ],
  },
  {
    teamSlug: 'tudor-pro-cycling-team-2026',
    teamName: 'Tudor Pro Cycling Team',
    riders: [
      'william-barta',
      'robin-froidevaux',
      'luca-mozzato',
      'mathys-rondel',
      'michael-storer',
      'florian-stork',
      'lawrence-warbasse',
    ],
  },
  {
    teamSlug: 'uae-team-emirates-xrg-2026',
    teamName: 'UAE Team Emirates - XRG',
    riders: [
      'igor-arrieta-lizarraga',
      'jan-christen',
      'jhonatan-narvaez',
      'marc-soler',
      'antonio-morgado',
      'jay-vine',
      'adam-yates',
    ],
  },
  {
    teamSlug: 'unibet-rose-rockets-2026',
    teamName: 'Unibet Rose Rockets',
    riders: [
      'dylan-groenewegen',
      'hartthijs-de-vries',
      'karsten-larsen-feldmann',
      'tomas-kopecky',
      'lukas-kubis',
      'niklas-larsen',
      'wout-poels',
      'elmar-reinders',
    ],
  },
  {
    teamSlug: 'uno-x-mobility-2026',
    teamName: 'Uno-X Mobility',
    riders: [
      'markus-hoelgaard',
      'adne-holter',
      'johannes-kulset',
      'fredrik-dversnes',
      'andreas-leknessund',
      'erlend-blikra',
      'sakarias-koller-loland',
      'martin-tjotta',
    ],
  },
  {
    teamSlug: 'xds-astana-team-2026',
    teamName: 'XDS Astana Team',
    riders: [
      'lorenzo-fortunato',
      'davide-ballerini',
      'alberto-bettiol',
      'arjen-livyns',
      'harold-martin-lopez',
      'matteo-malucelli',
      'christian-scaroni',
      'guillermo-thomas-silva-coussan',
      'diego-ulissi',
    ],
  },
];

async function seedGiroLineup() {
  console.log('=== GIRO D\'ITALIA 2026 LINEUP SEED ===\n');

  const eligibleTeams = TEAMS.map((t) => t.teamSlug);
  const eligibleRiders = TEAMS.flatMap((t) => t.riders);

  console.log(`Teams: ${eligibleTeams.length}`);
  console.log(`Riders: ${eligibleRiders.length}\n`);

  // 1. Set raceLineups document
  const lineupData = {
    year: 2026,
    updatedAt: new Date(),
    teams: TEAMS.map((t) => ({
      teamSlug: t.teamSlug,
      teamName: t.teamName,
      riders: t.riders.map((r) => ({ nameId: r })),
    })),
  };

  await db.collection('raceLineups').doc(RACE_SLUG).set(lineupData, { merge: true });
  console.log(`✅ raceLineups/${RACE_SLUG} bijgewerkt`);

  // 2. Update all games with raceRef pointing to this race
  const raceRef = db.collection('races').doc(RACE_SLUG);
  const raceDoc = await raceRef.get();

  if (!raceDoc.exists) {
    console.warn(`⚠️  Race document 'races/${RACE_SLUG}' bestaat niet. Games worden niet bijgewerkt.`);
    console.log('\nMaak eerst de race aan via /api/initializeRaces of voeg het document handmatig toe.');
  } else {
    const gamesSnapshot = await db.collection('games').where('raceRef', '==', raceRef).get();

    if (gamesSnapshot.empty) {
      console.log('ℹ️  Geen games gevonden met raceRef naar giro-d-italia_2026.');
    } else {
      const batch = db.batch();
      gamesSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          eligibleTeams,
          eligibleRiders,
          updatedAt: new Date(),
        });
      });
      await batch.commit();
      console.log(`✅ ${gamesSnapshot.size} game(s) bijgewerkt met eligibleRiders en eligibleTeams`);
      gamesSnapshot.forEach((doc) => {
        console.log(`   - ${doc.id}: ${doc.data().name}`);
      });
    }
  }

  console.log('\n=== KLAAR ===');
  console.log(`Eligible riders (${eligibleRiders.length}):`);
  eligibleRiders.forEach((r) => console.log(`  - ${r}`));
}

seedGiroLineup().catch(console.error);
