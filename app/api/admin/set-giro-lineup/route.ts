import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

const RACE_SLUG = 'giro-d-italia_2026';

const GAME_IDS = [
  'j5WTqXbqpasKYhn5rScO',
  'UsVDT2ucg3EOLvwSAPOh',
  'kvsCyviw01CaUvmvpXEp',
  'vzBNUh6nzUaLyy6rKQos',
  'wyFw2Pl5SzI0kPNtMw7J',
];

const TEAMS = [
  {
    teamSlug: 'alpecin-premier-tech-2026',
    teamName: 'Alpecin-Premier Tech',
    riders: ['kaden-groves', 'tobias-bayer', 'francesco-busatto', 'jonas-geens', 'edward-planckaert', 'jensen-plowright', 'johan-price-pejtersen', 'luca-vergallito'],
  },
  {
    teamSlug: 'bahrain-victorious-2026',
    teamName: 'Bahrain - Victorious',
    riders: ['santiago-buitrago-sanchez', 'damiano-caruso', 'matevz-govekar', 'fran-miholjevic', 'afonso-eulalio', 'mathijs-paasschens', 'alec-segaert', 'edoardo-zambanini'],
  },
  {
    teamSlug: 'bardiani-csf-7-saber-2026',
    teamName: 'Bardiani CSF 7 Saber',
    riders: ['luca-covili', 'filippo-magli2', 'martin-marcellusi', 'alessio-martinelli', 'luca-paletti', 'manuele-tarozzi', 'filippo-turconi', 'enrico-zanoncello'],
  },
  {
    teamSlug: 'decathlon-cma-cgm-team-2026',
    teamName: 'Decathlon CMA CGM Team',
    riders: ['felix-gall', 'tobias-lund-andresen', 'tord-gudmestad', 'gregor-muhlberger', 'oliver-naesen', 'rasmus-sojbergpedersen', 'callum-scotson', 'johannes-staune-mittet'],
  },
  {
    teamSlug: 'ef-education-easypost-2026',
    teamName: 'EF Education - EasyPost',
    riders: ['samuele-battistella', 'jefferson-alexander-cepeda', 'sean-quinn', 'darren-rafferty', 'james-shaw', 'michael-valgren-andersen', 'jardi-christiaan-van-der-lee'],
  },
  {
    teamSlug: 'groupama-fdj-united-2026',
    teamName: 'Groupama - FDJ United',
    riders: ['lorenzo-germani', 'remi-cavagna', 'cyril-barthe', 'axel-huens', 'johan-jacobs', 'josh-kench', 'paul-penhoet', 'remy-rochas', 'brieuc-rolland'],
  },
  {
    teamSlug: 'netcompany-ineos-cycling-team-2026',
    teamName: 'Netcompany INEOS Cycling Team',
    riders: ['egan-bernal', 'thymen-arensman', 'filippo-ganna', 'jack-haig', 'magnus-sheffield', 'embret-svestad-bardseng', 'connor-swift', 'ben-turner'],
  },
  {
    teamSlug: 'lidl-trek-2026',
    teamName: 'Lidl - Trek',
    riders: ['giulio-ciccone', 'simone-consonni', 'derek-gee', 'amanuel-ghebreigzabhier', 'jonathan-milan', 'matteo-sobrero', 'tim-torn-teutenberg', 'max-walscheid'],
  },
  {
    teamSlug: 'lotto-intermarche-2026',
    teamName: 'Lotto Intermarché',
    riders: ['lennert-van-eetvelt', 'liam-slock', 'arnaud-de-lie', 'toon-aerts', 'jasper-de-buyst', 'simone-gualdi', 'mathieu-kockelmann', 'milan-menten', 'lorenzo-rota', 'jonas-rutsch'],
  },
  {
    teamSlug: 'movistar-team-2026',
    teamName: 'Movistar Team',
    riders: ['ivan-garcia-cortina', 'orluis-aular', 'juan-pedro-lopez', 'enric-mas', 'lorenzo-milesi', 'nelson-oliveira', 'javier-romo', 'einer-rubio'],
  },
  {
    teamSlug: 'nsn-cycling-team-2026',
    teamName: 'NSN Cycling Team',
    riders: ['alessandro-pinarello', 'jan-hirt', 'ryan-mullen', 'nick-schultz', 'dion-smith', 'jake-stewart', 'corbin-strong', 'ethan-vernon'],
  },
  {
    teamSlug: 'pinarello-q365-pro-cycling-team-2026',
    teamName: 'Pinarello Q36.5 Pro Cycling Team',
    riders: ['sjoerd-bax', 'fabio-christen', 'david-de-la-cruz', 'mark-donovan', 'david-gonzalez-lopez', 'chris-harper', 'matteo-moschetti', 'nickolas-zukowsky'],
  },
  {
    teamSlug: 'red-bull-bora-hansgrohe-2026',
    teamName: 'Red Bull - BORA - hansgrohe',
    riders: ['danny-van-poppel', 'jai-hindley', 'giovanni-aleotti', 'gianni-moscon', 'giulio-pellizzari', 'luke-tuckwell', 'mick-van-dijke', 'aleksandr-vlasov', 'ben-zwiehoff'],
  },
  {
    teamSlug: 'soudal-quick-step-2026',
    teamName: 'Soudal Quick-Step',
    riders: ['ayco-bastiaens', 'gianmarco-garofoli', 'paul-magnier', 'andrea-raccagni-noviero', 'jasper-stuyven', 'dries-van-gestel', 'filippo-zana'],
  },
  {
    teamSlug: 'team-jayco-alula-2026',
    teamName: 'Team Jayco AlUla',
    riders: ['filippo-conca', 'luka-mezgec', 'ben-o-connor', 'pascal-ackermann', 'koen-bouwman', 'robert-donaldson', 'felix-engelhardt', 'alan-hatherly', 'christopher-juul-jensen', 'andrea-vendrame'],
  },
  {
    teamSlug: 'team-picnic-postnl-2026',
    teamName: 'Team Picnic PostNL',
    riders: ['timo-de-jong', 'sean-flynn', 'chris-hamilton', 'james-knox', 'gijs-leemreize', 'tim-naberman', 'frank-van-den-broek', 'casper-van-uden'],
  },
  {
    teamSlug: 'team-polti-visitmalta-2026',
    teamName: 'Team Polti VisitMalta',
    riders: ['mattia-bais', 'ludovico-crescioli', 'giovanni-lonardi', 'mirco-maestri', 'andrea-mifsud', 'thomas-pesenti', 'andrea-pietrobon', 'diego-pablo-sevilla'],
  },
  {
    teamSlug: 'team-visma-lease-a-bike-2026',
    teamName: 'Team Visma | Lease a Bike',
    riders: ['jonas-vingegaard', 'victor-campenaerts', 'wilco-kelderman', 'timo-kielich', 'sepp-kuss', 'bart-lemmen', 'davide-piganzoli', 'tim-rex'],
  },
  {
    teamSlug: 'tudor-pro-cycling-team-2026',
    teamName: 'Tudor Pro Cycling Team',
    riders: ['william-barta', 'robin-froidevaux', 'luca-mozzato', 'mathys-rondel', 'michael-storer', 'florian-stork', 'lawrence-warbasse'],
  },
  {
    teamSlug: 'uae-team-emirates-xrg-2026',
    teamName: 'UAE Team Emirates - XRG',
    riders: ['igor-arrieta-lizarraga', 'jan-christen', 'jhonatan-narvaez', 'marc-soler', 'antonio-morgado', 'jay-vine', 'adam-yates'],
  },
  {
    teamSlug: 'unibet-rose-rockets-2026',
    teamName: 'Unibet Rose Rockets',
    riders: ['dylan-groenewegen', 'hartthijs-de-vries', 'karsten-larsen-feldmann', 'tomas-kopecky', 'lukas-kubis', 'niklas-larsen', 'wout-poels', 'elmar-reinders'],
  },
  {
    teamSlug: 'uno-x-mobility-2026',
    teamName: 'Uno-X Mobility',
    riders: ['markus-hoelgaard', 'adne-holter', 'johannes-kulset', 'fredrik-dversnes', 'andreas-leknessund', 'erlend-blikra', 'sakarias-koller-loland', 'martin-tjotta'],
  },
  {
    teamSlug: 'xds-astana-team-2026',
    teamName: 'XDS Astana Team',
    riders: ['lorenzo-fortunato', 'davide-ballerini', 'alberto-bettiol', 'arjen-livyns', 'harold-martin-lopez', 'matteo-malucelli', 'christian-scaroni', 'guillermo-thomas-silva-coussan', 'diego-ulissi'],
  },
];

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const eligibleTeams = TEAMS.map((t) => t.teamSlug);
    const eligibleRiders = TEAMS.flatMap((t) => t.riders);

    // Update raceLineups document
    await db.collection('raceLineups').doc(RACE_SLUG).set({
      year: 2026,
      updatedAt: new Date(),
      teams: TEAMS.map((t) => ({
        teamSlug: t.teamSlug,
        teamName: t.teamName,
        riders: t.riders.map((r) => ({ nameId: r })),
      })),
    }, { merge: true });

    // Update the specified games
    const batch = db.batch();
    const results: Array<{ gameId: string; name: string; status: string }> = [];

    for (const gameId of GAME_IDS) {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        results.push({ gameId, name: '(niet gevonden)', status: 'skipped' });
        continue;
      }

      batch.update(gameRef, {
        eligibleTeams,
        eligibleRiders,
        updatedAt: new Date(),
      });

      results.push({ gameId, name: gameDoc.data()?.name || '', status: 'updated' });
    }

    await batch.commit();

    const updated = results.filter((r) => r.status === 'updated').length;

    return NextResponse.json({
      success: true,
      message: `${updated} games bijgewerkt met ${eligibleRiders.length} renners en ${eligibleTeams.length} teams`,
      results,
      totalRiders: eligibleRiders.length,
      totalTeams: eligibleTeams.length,
    });
  } catch (error) {
    console.error('[SET_GIRO_LINEUP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set Giro lineup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
