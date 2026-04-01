import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseFootball } from '@/lib/firebase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface MatchResult {
    date: string;
    opponent: string;
    teamScore: number;
    opponentScore: number;
    result: 'W' | 'D' | 'L';
    competition: string;
}

export interface HeadToHeadMatch {
    date: string;
    team1Score: number;
    team2Score: number;
    competition: string;
}

export interface TeamHistoryResponse {
    team1: string;
    team2: string;
    team1Form: MatchResult[];
    team2Form: MatchResult[];
    headToHead: HeadToHeadMatch[];
    updatedAt: string;
    /** true after an explicit recheck confirmed the empty headToHead result */
    h2hVerified?: boolean;
}

const COLLECTION = 'wk2026TeamHistory';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const SYSTEM_PROMPT = `You are a football statistics expert with deep knowledge of international football history going back decades.
You have access to results from FIFA World Cup, continental championships (UEFA Euro, Copa América, AFCON, Gold Cup, AFC Asian Cup, etc.), qualifying campaigns, Nations League editions, and international friendlies.
Always respond with valid JSON only — no markdown, no explanation, no prose.`;

function buildPrompt(team1: string, team2: string): string {
    return `Return historical international football data for "${team1}" and "${team2}".

IMPORTANT — head-to-head research instructions:
- Think carefully before concluding teams have never met. National teams frequently play friendlies against teams from other confederations.
- Search your knowledge across ALL competition types: FIFA World Cup (group stage, knockouts), World Cup qualifiers, continental cups and their qualifiers, Gold Cup, Copa América, AFCON, Nations League, and ALL international friendlies.
- Major footballing nations like Brazil, Argentina, France, Germany, Spain, England, etc. have played hundreds of internationals and have almost certainly met most other WK 2026 participants at least once.
- Only return an empty headToHead array if you are truly certain — after exhaustive recall — that the two nations have NEVER played a senior international match in any competition or friendly.

Return a JSON object with exactly this structure:
{
  "team1Form": [
    { "date": "YYYY-MM-DD", "opponent": "Country Name", "teamScore": 2, "opponentScore": 1, "result": "W", "competition": "Competition Name" }
  ],
  "team2Form": [
    { "date": "YYYY-MM-DD", "opponent": "Country Name", "teamScore": 0, "opponentScore": 0, "result": "D", "competition": "Competition Name" }
  ],
  "headToHead": [
    { "date": "YYYY-MM-DD", "team1Score": 2, "team2Score": 1, "competition": "Competition Name" }
  ]
}

Rules:
- team1Form: last 5 senior international matches for "${team1}" (oldest first, most recent last)
- team2Form: last 5 senior international matches for "${team2}" (oldest first, most recent last)
- headToHead: up to last 5 matches between "${team1}" and "${team2}" (oldest first, most recent last)
- result field: "W" = teamScore > opponentScore, "D" = equal, "L" = teamScore < opponentScore
- All dates must be real calendar dates of actual matches
- Only return the JSON object, nothing else`;
}

export function pairKey(a: string, b: string): string {
    return [a, b].sort().join('__');
}

function buildRecheckPrompt(team1: string, team2: string): string {
    return `A previous lookup found NO head-to-head matches between "${team1}" and "${team2}".
Please verify this carefully. Think about:
- FIFA World Cup group stage or knockout rounds
- World Cup qualifying matches (even intercontinental play-offs)
- International friendlies (these happen very frequently, even between teams from different confederations)
- Tournament group stages like Copa América, Gold Cup, AFCON, AFC Asian Cup
- Any Olympic football matches (senior or U23)

If you can recall ANY match between these two nations — even a single friendly — include it.
Only confirm an empty headToHead if you are absolutely certain they have never met in any official or friendly international.

Return the same JSON structure as before, with headToHead either populated or empty if truly confirmed:
{
  "team1Form": [...],
  "team2Form": [...],
  "headToHead": [...]
}
Only return the JSON object, nothing else.`;
}

export async function fetchAndStoreHistory(team1: string, team2: string, recheck = false): Promise<TeamHistoryResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://oracle-games.vercel.app',
            'X-Title': 'Oracle Games WK 2026',
        },
        body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: recheck ? buildRecheckPrompt(team1, team2) : buildPrompt(team1, team2) },
            ],
            temperature: 0.1,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${err}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from AI');

    const parsed = JSON.parse(content);

    const sanitized: TeamHistoryResponse = {
        team1,
        team2,
        updatedAt: new Date().toISOString(),
        h2hVerified: recheck ? true : undefined,
        team1Form: (parsed.team1Form || []).slice(0, 5).map((m: MatchResult) => ({
            date: String(m.date || ''),
            opponent: String(m.opponent || ''),
            teamScore: Number(m.teamScore ?? 0),
            opponentScore: Number(m.opponentScore ?? 0),
            result: (['W', 'D', 'L'] as const).includes(m.result) ? m.result : 'D',
            competition: String(m.competition || ''),
        })),
        team2Form: (parsed.team2Form || []).slice(0, 5).map((m: MatchResult) => ({
            date: String(m.date || ''),
            opponent: String(m.opponent || ''),
            teamScore: Number(m.teamScore ?? 0),
            opponentScore: Number(m.opponentScore ?? 0),
            result: (['W', 'D', 'L'] as const).includes(m.result) ? m.result : 'D',
            competition: String(m.competition || ''),
        })),
        headToHead: (parsed.headToHead || []).slice(0, 5).map((m: HeadToHeadMatch) => ({
            date: String(m.date || ''),
            team1Score: Number(m.team1Score ?? 0),
            team2Score: Number(m.team2Score ?? 0),
            competition: String(m.competition || ''),
        })),
    };

    // Persist to Firestore
    const db = getServerFirebaseFootball();
    const key = pairKey(team1, team2);
    await db.collection(COLLECTION).doc(key).set(sanitized);

    return sanitized;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const team1 = searchParams.get('team1');
    const team2 = searchParams.get('team2');
    const recheck = searchParams.get('recheck') === 'true';

    if (!team1 || !team2) {
        return NextResponse.json({ error: 'team1 and team2 are required' }, { status: 400 });
    }

    try {
        const db = getServerFirebaseFootball();
        const key = pairKey(team1, team2);
        const doc = await db.collection(COLLECTION).doc(key).get();

        if (!recheck && doc.exists) {
            const data = doc.data() as TeamHistoryResponse;
            const age = Date.now() - new Date(data.updatedAt).getTime();
            if (age < CACHE_TTL_MS) {
                return NextResponse.json(data);
            }
        }

        // recheck=true, not cached, or stale → fetch from OpenRouter
        const data = await fetchAndStoreHistory(team1, team2, recheck);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in team-history GET:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
