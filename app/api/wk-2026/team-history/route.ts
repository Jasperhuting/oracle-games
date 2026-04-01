import { NextRequest, NextResponse } from 'next/server';

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
    team1Form: MatchResult[];
    team2Form: MatchResult[];
    headToHead: HeadToHeadMatch[];
}

const SYSTEM_PROMPT = `You are a football statistics expert with comprehensive knowledge of international football history.
When asked about two national teams, you provide accurate historical match data in JSON format.
Always respond with valid JSON only, no markdown, no explanation.`;

function buildPrompt(team1: string, team2: string): string {
    return `Return historical football data for national teams "${team1}" and "${team2}".

Return a JSON object with this exact structure:
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
- team1Form: last 5 international matches for "${team1}" (most recent last), use real historical results
- team2Form: last 5 international matches for "${team2}" (most recent last), use real historical results
- headToHead: last 5 matches between "${team1}" and "${team2}" (most recent last), or fewer if less exist
- result: "W" if teamScore > opponentScore, "D" if equal, "L" if teamScore < opponentScore
- Use real matches from FIFA World Cup, UEFA/CONMEBOL qualifiers, Nations League, friendlies, etc.
- If teams have never met, return an empty headToHead array
- Dates must be real match dates
- Only return the JSON object, nothing else`;
}

// Simple in-memory cache to avoid repeated API calls for the same team pair
const cache = new Map<string, { data: TeamHistoryResponse; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const team1 = searchParams.get('team1');
    const team2 = searchParams.get('team2');

    if (!team1 || !team2) {
        return NextResponse.json({ error: 'team1 and team2 are required' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    // Normalize cache key (alphabetical order so A vs B == B vs A)
    const cacheKey = [team1, team2].sort().join('__');
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
    }

    try {
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
                    { role: 'user', content: buildPrompt(team1, team2) },
                ],
                temperature: 0.1,
                max_tokens: 1500,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenRouter error:', response.status, errorText);
            return NextResponse.json({ error: 'Failed to fetch from OpenRouter' }, { status: 502 });
        }

        const aiResponse = await response.json();
        const content = aiResponse.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json({ error: 'Empty response from AI' }, { status: 502 });
        }

        let parsed: TeamHistoryResponse;
        try {
            parsed = JSON.parse(content);
        } catch {
            console.error('Failed to parse AI response:', content);
            return NextResponse.json({ error: 'Invalid JSON from AI' }, { status: 502 });
        }

        // Validate and sanitize the response
        const sanitized: TeamHistoryResponse = {
            team1Form: (parsed.team1Form || []).slice(0, 5).map(m => ({
                date: String(m.date || ''),
                opponent: String(m.opponent || ''),
                teamScore: Number(m.teamScore ?? 0),
                opponentScore: Number(m.opponentScore ?? 0),
                result: ['W', 'D', 'L'].includes(m.result) ? m.result : 'D',
                competition: String(m.competition || ''),
            })),
            team2Form: (parsed.team2Form || []).slice(0, 5).map(m => ({
                date: String(m.date || ''),
                opponent: String(m.opponent || ''),
                teamScore: Number(m.teamScore ?? 0),
                opponentScore: Number(m.opponentScore ?? 0),
                result: ['W', 'D', 'L'].includes(m.result) ? m.result : 'D',
                competition: String(m.competition || ''),
            })),
            headToHead: (parsed.headToHead || []).slice(0, 5).map(m => ({
                date: String(m.date || ''),
                team1Score: Number(m.team1Score ?? 0),
                team2Score: Number(m.team2Score ?? 0),
                competition: String(m.competition || ''),
            })),
        };

        cache.set(cacheKey, { data: sanitized, timestamp: Date.now() });

        return NextResponse.json(sanitized);
    } catch (error) {
        console.error('Error fetching team history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
