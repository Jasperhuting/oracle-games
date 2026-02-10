import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// Classifications to exclude (youth, U23, women categories)
const UNWANTED_CLASSIFICATIONS = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'];

const WOMEN_NAME_KEYWORDS = [
  'WOMEN',
  'WOMAN',
  'FEMINA',
  'FEMINAS',
  'FEMENINA',
  'FEMENINO',
  'FEMME',
  'FEMMES',
  'DAMES',
  'LADIES',
  'FEMALE',
];

// Race slugs to explicitly exclude (women's races with incorrect classification, etc.)
const EXCLUDED_RACE_SLUGS: Set<string> = new Set([
  'vuelta-el-salvador',
  'trofeo-felanitx-femina',
  'grand-prix-el-salvador',
  'grand-prix-san-salvador',
  'trofeo-palma-femina',
  'trofeo-binissalem-andratx',
  'race-torquay',
  'grand-prix-de-oriente',
  'pionera-race-we',
]);

function shouldExcludeRace(name: string, classification: string | null, slug?: string): boolean {
  if (slug && EXCLUDED_RACE_SLUGS.has(slug)) {
    return true;
  }

  const cls = (classification || '').trim();
  const nameUpper = name.toUpperCase();
  const clsUpper = cls.toUpperCase();
  const slugUpper = (slug || '').toUpperCase();

  const hasUnwantedInName = UNWANTED_CLASSIFICATIONS.some(
    unwanted => nameUpper.includes(unwanted) || nameUpper.includes(`${unwanted} -`)
  );

  const hasUnwantedInClassification = UNWANTED_CLASSIFICATIONS.some(
    unwanted => clsUpper.includes(unwanted)
  );

  const hasWomenInName = WOMEN_NAME_KEYWORDS.some(keyword => nameUpper.includes(keyword));
  const hasWomenInSlug = WOMEN_NAME_KEYWORDS.some(keyword => slugUpper.includes(keyword));
  const hasWWTInClassification = clsUpper.includes('WWT');

  return (
    hasUnwantedInName ||
    hasUnwantedInClassification ||
    hasWomenInName ||
    hasWomenInSlug ||
    hasWWTInClassification
  );
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const jobsSnapshot = await db
      .collection('jobs')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const batchesSnapshot = await db
      .collection('scrapeJobBatches')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const jobs = jobsSnapshot.docs.map((doc) => doc.data());
    const batches = batchesSnapshot.docs.map((doc) => doc.data());

    return NextResponse.json({ success: true, jobs, batches });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body.userId as string | undefined;
    const action = body.action as string | undefined;
    const dryRun = body.dryRun === true;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (action !== 'cleanupExcluded') {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Build race lookup (slug -> { name, classification })
    const racesSnapshot = await db.collection('races').get();
    const raceMap = new Map<string, { name: string; classification: string | null }>();
    racesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      const name = data.name || slug;
      const classification = data.classification || null;
      raceMap.set(slug, { name, classification });
    });

    // Find pending scraper jobs
    const jobsSnapshot = await db
      .collection('jobs')
      .where('status', '==', 'pending')
      .where('type', '==', 'scraper')
      .get();

    const toDelete: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const excludedJobs: { id: string; race: string; raceName: string }[] = [];

    jobsSnapshot.docs.forEach(doc => {
      const data = doc.data() as { data?: Record<string, unknown> };
      const jobData = data.data || {};
      const raceSlug = (jobData.race as string) || '';
      if (!raceSlug) return;

      const raceInfo = raceMap.get(raceSlug);
      const raceName = (jobData.raceName as string) || raceInfo?.name || raceSlug;
      const classification = raceInfo?.classification || null;

      if (shouldExcludeRace(raceName, classification, raceSlug)) {
        excludedJobs.push({ id: doc.id, race: raceSlug, raceName });
        toDelete.push(doc);
      }
    });

    if (!dryRun && toDelete.length > 0) {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
        const batch = db.batch();
        const chunk = toDelete.slice(i, i + CHUNK_SIZE);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalPendingScraperJobs: jobsSnapshot.size,
      excludedCount: excludedJobs.length,
      deletedCount: dryRun ? 0 : excludedJobs.length,
      excludedJobs: excludedJobs.slice(0, 200),
    });
  } catch (error) {
    console.error('Error cleaning up excluded jobs:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
