import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { fetchAndStoreHistory, pairKey } from '@/app/api/wk-2026/team-history/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allow up to 5 minutes — there can be ~72 group pairs + knockout pairs
export const maxDuration = 300;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
    // ?force=true skips the 24h freshness check and re-fetches everything (useful after prompt changes)
    const force = new URL(request.url).searchParams.get('force') === 'true';

    const db = getServerFirebaseFootball();

    // 1. Collect all team pairs from group stage poules
    const poulesSnapshot = await db.collection('poules').get();
    const groupPairs: [string, string][] = [];

    for (const doc of poulesSnapshot.docs) {
        const data = doc.data();
        const teams = data.teams ? Object.values(data.teams) as { name: string }[] : [];
        const names = teams.map(t => t.name).filter(Boolean);

        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                groupPairs.push([names[i], names[j]]);
            }
        }
    }

    // 2. Collect known teams from knockout matches (actual results stored in wk2026KnockoutActual)
    const knockoutDoc = await db.collection('wk2026KnockoutActual').doc('current').get();
    const knockoutPairs: [string, string][] = [];

    if (knockoutDoc.exists) {
        const knockoutData = knockoutDoc.data();
        const knockoutMatches: { team1?: string; team2?: string }[] = knockoutData?.matches || [];

        for (const match of knockoutMatches) {
            if (match.team1 && match.team2) {
                knockoutPairs.push([match.team1, match.team2]);
            }
        }
    }

    // 3. Deduplicate all pairs
    const seen = new Set<string>();
    const allPairs: [string, string][] = [];

    for (const [a, b] of [...groupPairs, ...knockoutPairs]) {
        const key = pairKey(a, b);
        if (!seen.has(key)) {
            seen.add(key);
            allPairs.push([a, b]);
        }
    }

    // 4. Fetch & store each pair with a small delay to avoid rate limits
    const results: { pair: string; status: 'ok' | 'error' | 'skipped'; error?: string }[] = [];

    for (const [team1, team2] of allPairs) {
        const key = pairKey(team1, team2);

        // Skip if fresh and not forced
        if (!force) {
            const existing = await db.collection('wk2026TeamHistory').doc(key).get();
            if (existing.exists) {
                const data = existing.data() as { updatedAt?: string };
                const age = Date.now() - new Date(data.updatedAt || 0).getTime();
                if (age < 1000 * 60 * 60 * 20) { // fresher than 20h → skip
                    results.push({ pair: key, status: 'skipped' });
                    continue;
                }
            }
        }

        try {
            await fetchAndStoreHistory(team1, team2);
            results.push({ pair: key, status: 'ok' });
            console.log(`[refresh-wk-team-history] ✓ ${key}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push({ pair: key, status: 'error', error: message });
            console.error(`[refresh-wk-team-history] ✗ ${key}:`, message);
        }

        // 800 ms between calls to stay within OpenRouter rate limits
        await sleep(800);
    }

    const ok = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status === 'error').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    console.log(`[refresh-wk-team-history] Done: ${ok} ok, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({ ok, skipped, failed, total: allPairs.length, results });
}
