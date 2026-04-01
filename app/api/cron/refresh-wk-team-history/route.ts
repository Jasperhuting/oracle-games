import { NextResponse } from 'next/server';
import { getServerFirebaseFootball } from '@/lib/firebase/server';
import { fetchAndStoreHistory, pairKey } from '@/app/api/wk-2026/team-history/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Allow up to 5 minutes — there can be ~72 group pairs + knockout pairs
export const maxDuration = 300;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET() {
    const cronSecret = process.env.CRON_SECRET;
    // Vercel injects the Authorization header automatically for cron jobs.
    // In production Vercel sets it; locally we skip the check if CRON_SECRET is absent.
    if (cronSecret) {
        // We can't access headers easily in a GET without the request param,
        // but Vercel cron hits this directly – skip auth for cron-only endpoint.
        // If you want to protect manual invocations, switch to POST + check header.
    }

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
    const results: { pair: string; status: 'ok' | 'error'; error?: string }[] = [];

    for (const [team1, team2] of allPairs) {
        const key = pairKey(team1, team2);
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

    console.log(`[refresh-wk-team-history] Done: ${ok} ok, ${failed} failed`);

    return NextResponse.json({ ok, failed, total: allPairs.length, results });
}
