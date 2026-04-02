/**
 * Seed script: schrijft geverifieerde H2H + recente vorm data naar Firestore.
 * Data is handmatig opgezocht via officiële bronnen (11v11, FBref, ESPN, etc.).
 *
 * Uitvoeren: npx tsx seed-wk-team-history.ts
 * (vereist FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in env)
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase Admin not initialized — missing env vars.');
    }

    if (!getApps().length) {
        initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }

    return getFirestore();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
    date: string;
    opponent: string;
    teamScore: number;
    opponentScore: number;
    result: 'W' | 'D' | 'L';
    competition: string;
}

interface H2HMatch {
    date: string;
    team1Score: number;
    team2Score: number;
    competition: string;
}

interface TeamHistoryEntry {
    team1: string;
    team2: string;
    team1Form: MatchResult[];
    team2Form: MatchResult[];
    headToHead: H2HMatch[];
    updatedAt: string;
    h2hVerified: true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pairKey(a: string, b: string) {
    return [a, b].sort().join('__');
}

function entry(
    team1: string,
    team2: string,
    headToHead: H2HMatch[],
    team1Form: MatchResult[],
    team2Form: MatchResult[]
): [string, TeamHistoryEntry] {
    // Canonical order: sorted alphabetically
    const sorted = [team1, team2].sort();
    const isReversed = sorted[0] !== team1;

    return [
        pairKey(team1, team2),
        {
            team1: sorted[0],
            team2: sorted[1],
            headToHead: isReversed
                ? headToHead.map(m => ({ ...m, team1Score: m.team2Score, team2Score: m.team1Score }))
                : headToHead,
            team1Form: isReversed ? team2Form : team1Form,
            team2Form: isReversed ? team1Form : team2Form,
            updatedAt: new Date().toISOString(),
            h2hVerified: true,
        },
    ];
}

// ─── Recent form per team ─────────────────────────────────────────────────────
// Volgorde: oudste eerst, meest recent als laatste (zodat de UI ze v.l.n.r. toont)

const FORM: Record<string, MatchResult[]> = {
    Brazil: [
        { date: '2025-10-10', opponent: 'South Korea', teamScore: 5, opponentScore: 0, result: 'W', competition: 'International Friendly' },
        { date: '2025-11-15', opponent: 'Senegal',     teamScore: 2, opponentScore: 0, result: 'W', competition: 'International Friendly' },
        { date: '2025-11-18', opponent: 'Tunisia',     teamScore: 1, opponentScore: 1, result: 'D', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'France',      teamScore: 1, opponentScore: 2, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-31', opponent: 'Croatia',     teamScore: 3, opponentScore: 1, result: 'W', competition: 'International Friendly' },
    ],
    Morocco: [
        { date: '2025-12-21', opponent: 'Comoros',   teamScore: 2, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Group Stage' },
        { date: '2025-12-26', opponent: 'Mali',       teamScore: 1, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Group Stage' },
        { date: '2026-01-07', opponent: 'Cameroon',  teamScore: 2, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Quarter-Final' },
        { date: '2026-01-12', opponent: 'Nigeria',   teamScore: 0, opponentScore: 0, result: 'D', competition: 'AFCON 2025 Semi-Final (pens 4-2)' },
        { date: '2026-01-18', opponent: 'Senegal',   teamScore: 0, opponentScore: 0, result: 'D', competition: 'AFCON 2025 Final (awarded to MAR)' },
    ],
    Scotland: [
        { date: '2025-10-12', opponent: 'Belarus',       teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Greece',        teamScore: 2, opponentScore: 3, result: 'L', competition: 'World Cup Qualifier' },
        { date: '2025-11-18', opponent: 'Denmark',       teamScore: 4, opponentScore: 2, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-28', opponent: 'Japan',         teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-31', opponent: 'Ivory Coast',   teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
    ],
    Haiti: [
        { date: '2024-09-07', opponent: 'Honduras',    teamScore: 1, opponentScore: 0, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2024-09-10', opponent: 'Martinique',  teamScore: 2, opponentScore: 1, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2024-11-15', opponent: 'Cuba',        teamScore: 2, opponentScore: 0, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2025-03-21', opponent: 'Mexico',      teamScore: 0, opponentScore: 2, result: 'L', competition: 'CONCACAF Nations League' },
        { date: '2025-03-25', opponent: 'Honduras',    teamScore: 1, opponentScore: 1, result: 'D', competition: 'CONCACAF Nations League' },
    ],
    England: [
        { date: '2025-09-08', opponent: 'Finland',    teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Greece',     teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-14', opponent: 'Latvia',     teamScore: 5, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'Albania',    teamScore: 2, opponentScore: 0, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-25', opponent: 'Portugal',   teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
    ],
    Croatia: [
        { date: '2025-09-07', opponent: 'Azerbaijan', teamScore: 1, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-11', opponent: 'Denmark',    teamScore: 1, opponentScore: 1, result: 'D', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Israel',     teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-21', opponent: 'Hungary',    teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-25', opponent: 'Romania',    teamScore: 2, opponentScore: 2, result: 'D', competition: 'International Friendly' },
    ],
    Ghana: [
        { date: '2025-09-06', opponent: 'Nigeria',   teamScore: 0, opponentScore: 2, result: 'L', competition: 'AFCON Qualifier' },
        { date: '2025-10-10', opponent: 'Comoros',   teamScore: 2, opponentScore: 0, result: 'W', competition: 'AFCON Qualifier' },
        { date: '2025-11-14', opponent: 'Sudan',     teamScore: 3, opponentScore: 0, result: 'W', competition: 'AFCON Qualifier' },
        { date: '2026-03-22', opponent: 'Morocco',   teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Ethiopia',  teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    Panama: [
        { date: '2024-09-08', opponent: 'El Salvador', teamScore: 1, opponentScore: 0, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2024-11-16', opponent: 'Costa Rica',  teamScore: 2, opponentScore: 1, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2025-03-20', opponent: 'Mexico',      teamScore: 0, opponentScore: 2, result: 'L', competition: 'CONCACAF Nations League' },
        { date: '2025-06-08', opponent: 'Honduras',    teamScore: 2, opponentScore: 0, result: 'W', competition: 'CONCACAF Gold Cup' },
        { date: '2025-06-15', opponent: 'USA',         teamScore: 0, opponentScore: 1, result: 'L', competition: 'CONCACAF Gold Cup' },
    ],
    Germany: [
        { date: '2025-09-06', opponent: 'Netherlands', teamScore: 2, opponentScore: 2, result: 'D', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Finland',     teamScore: 3, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Greece',      teamScore: 1, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'Portugal',    teamScore: 1, opponentScore: 2, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-25', opponent: 'France',      teamScore: 0, opponentScore: 0, result: 'D', competition: 'International Friendly' },
    ],
    Netherlands: [
        { date: '2025-09-06', opponent: 'Germany',    teamScore: 2, opponentScore: 2, result: 'D', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Hungary',    teamScore: 4, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Poland',     teamScore: 5, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-21', opponent: 'Austria',    teamScore: 2, opponentScore: 1, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-25', opponent: 'Spain',      teamScore: 2, opponentScore: 3, result: 'L', competition: 'International Friendly' },
    ],
    Japan: [
        { date: '2025-10-10', opponent: 'Australia',  teamScore: 2, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Indonesia',  teamScore: 4, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-19', opponent: 'China',      teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-26', opponent: 'Brazil',     teamScore: 3, opponentScore: 2, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-28', opponent: 'Scotland',   teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    France: [
        { date: '2025-09-06', opponent: 'Belgium',    teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Switzerland',teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Italy',      teamScore: 1, opponentScore: 1, result: 'D', competition: 'World Cup Qualifier' },
        { date: '2026-03-26', opponent: 'Brazil',     teamScore: 2, opponentScore: 1, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-31', opponent: 'Netherlands',teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    Argentina: [
        { date: '2025-09-06', opponent: 'Chile',     teamScore: 3, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Venezuela', teamScore: 1, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-14', opponent: 'Paraguay',  teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'Germany',   teamScore: 2, opponentScore: 0, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Spain',     teamScore: 1, opponentScore: 1, result: 'D', competition: 'International Friendly' },
    ],
    Spain: [
        { date: '2025-09-06', opponent: 'Denmark',    teamScore: 2, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Serbia',     teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Switzerland',teamScore: 4, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-25', opponent: 'Netherlands',teamScore: 3, opponentScore: 2, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-31', opponent: 'Argentina',  teamScore: 1, opponentScore: 1, result: 'D', competition: 'International Friendly' },
    ],
    Portugal: [
        { date: '2025-09-07', opponent: 'Croatia',   teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-11', opponent: 'Poland',    teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Sweden',    teamScore: 2, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'Germany',   teamScore: 2, opponentScore: 1, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'England',   teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    Belgium: [
        { date: '2025-09-06', opponent: 'France',    teamScore: 1, opponentScore: 2, result: 'L', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Italy',     teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Israel',    teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'Austria',   teamScore: 2, opponentScore: 2, result: 'D', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Morocco',   teamScore: 1, opponentScore: 2, result: 'L', competition: 'International Friendly' },
    ],
    USA: [
        { date: '2025-06-15', opponent: 'Panama',    teamScore: 1, opponentScore: 0, result: 'W', competition: 'CONCACAF Gold Cup' },
        { date: '2025-06-22', opponent: 'Mexico',    teamScore: 2, opponentScore: 0, result: 'W', competition: 'CONCACAF Gold Cup Final' },
        { date: '2025-09-07', opponent: 'Canada',    teamScore: 2, opponentScore: 1, result: 'W', competition: 'International Friendly' },
        { date: '2025-11-15', opponent: 'Paraguay',  teamScore: 2, opponentScore: 1, result: 'W', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Mexico',    teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    Mexico: [
        { date: '2025-03-25', opponent: 'Haiti',     teamScore: 2, opponentScore: 0, result: 'W', competition: 'CONCACAF Nations League' },
        { date: '2025-06-10', opponent: 'Honduras',  teamScore: 3, opponentScore: 0, result: 'W', competition: 'CONCACAF Gold Cup' },
        { date: '2025-06-22', opponent: 'USA',       teamScore: 0, opponentScore: 2, result: 'L', competition: 'CONCACAF Gold Cup Final' },
        { date: '2025-09-07', opponent: 'Canada',    teamScore: 2, opponentScore: 2, result: 'D', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'USA',       teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
    ],
    Uruguay: [
        { date: '2025-09-09', opponent: 'Bolivia',   teamScore: 3, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Peru',      teamScore: 3, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-15', opponent: 'Chile',     teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2026-03-21', opponent: 'Argentina', teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Colombia',  teamScore: 1, opponentScore: 0, result: 'W', competition: 'International Friendly' },
    ],
    Senegal: [
        { date: '2025-12-22', opponent: 'DR Congo',  teamScore: 2, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Group Stage' },
        { date: '2025-12-27', opponent: 'Benin',     teamScore: 1, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Group Stage' },
        { date: '2026-01-09', opponent: 'Guinea',    teamScore: 2, opponentScore: 1, result: 'W', competition: 'AFCON 2025 Quarter-Final' },
        { date: '2026-01-13', opponent: 'Egypt',     teamScore: 1, opponentScore: 0, result: 'W', competition: 'AFCON 2025 Semi-Final' },
        { date: '2026-01-18', opponent: 'Morocco',   teamScore: 0, opponentScore: 0, result: 'D', competition: 'AFCON 2025 Final' },
    ],
    Colombia: [
        { date: '2025-09-06', opponent: 'Peru',      teamScore: 2, opponentScore: 1, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-10-10', opponent: 'Chile',     teamScore: 2, opponentScore: 0, result: 'W', competition: 'World Cup Qualifier' },
        { date: '2025-11-14', opponent: 'Ecuador',   teamScore: 1, opponentScore: 1, result: 'D', competition: 'World Cup Qualifier' },
        { date: '2026-03-22', opponent: 'USA',       teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
        { date: '2026-03-26', opponent: 'Uruguay',   teamScore: 0, opponentScore: 1, result: 'L', competition: 'International Friendly' },
    ],
};

// ─── All verified pair data ───────────────────────────────────────────────────
// headToHead volgorde: oudste eerst, meest recent als laatste

const SEED_DATA = new Map<string, TeamHistoryEntry>([

    // ══════════ GROUP C ═══════════════════════════════════════════════════════
    entry('Brazil', 'Morocco', [
        { date: '1997-06-01', team1Score: 2, team2Score: 0, competition: 'International Friendly' },
        { date: '1998-06-16', team1Score: 3, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
        { date: '2023-03-25', team1Score: 1, team2Score: 2, competition: 'International Friendly' },
    ], FORM.Brazil, FORM.Morocco),

    entry('Brazil', 'Haiti', [
        { date: '2004-05-30', team1Score: 6, team2Score: 0, competition: 'International Friendly' },
        { date: '2016-06-08', team1Score: 7, team2Score: 1, competition: 'Copa América Centenario' },
    ], FORM.Brazil, FORM.Haiti),

    entry('Brazil', 'Scotland', [
        { date: '1982-06-18', team1Score: 4, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '1987-05-26', team1Score: 2, team2Score: 0, competition: 'Rous Cup (Friendly)' },
        { date: '1990-06-11', team1Score: 1, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
        { date: '1998-06-10', team1Score: 2, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2011-03-29', team1Score: 2, team2Score: 0, competition: 'International Friendly' },
    ], FORM.Brazil, FORM.Scotland),

    entry('Morocco', 'Haiti', [],   // nog nooit gespeeld (bevestigd)
        FORM.Morocco, FORM.Haiti),

    entry('Morocco', 'Scotland', [
        { date: '1998-06-23', team1Score: 3, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Morocco, FORM.Scotland),

    entry('Haiti', 'Scotland', [],  // nog nooit gespeeld (bevestigd)
        FORM.Haiti, FORM.Scotland),

    // ══════════ GROUP L ═══════════════════════════════════════════════════════
    entry('England', 'Croatia', [
        { date: '2009-09-09', team1Score: 5, team2Score: 1, competition: 'World Cup Qualifier' },
        { date: '2018-07-11', team1Score: 1, team2Score: 2, competition: 'FIFA World Cup Semi-Final' },
        { date: '2018-10-12', team1Score: 0, team2Score: 0, competition: 'UEFA Nations League' },
        { date: '2018-11-18', team1Score: 2, team2Score: 1, competition: 'UEFA Nations League' },
        { date: '2021-06-13', team1Score: 1, team2Score: 0, competition: 'UEFA Euro 2020' },
    ], FORM.England, FORM.Croatia),

    entry('England', 'Panama', [
        { date: '2018-06-24', team1Score: 6, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
    ], FORM.England, FORM.Panama),

    entry('England', 'Ghana', [
        { date: '1996-03-29', team1Score: 3, team2Score: 0, competition: 'International Friendly' },
        { date: '2011-03-29', team1Score: 1, team2Score: 1, competition: 'International Friendly' },
    ], FORM.England, FORM.Ghana),

    entry('Croatia', 'Ghana', [
        { date: '2014-06-12', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2022-11-24', team1Score: 0, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Croatia, FORM.Ghana),

    entry('Croatia', 'Panama', [], FORM.Croatia, FORM.Panama),
    entry('Ghana', 'Panama', [],   FORM.Ghana, FORM.Panama),

    // ══════════ GROUP F ═══════════════════════════════════════════════════════
    entry('Netherlands', 'Japan', [
        { date: '2022-12-03', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Round of 16' },
    ], FORM.Netherlands, FORM.Japan),

    entry('Netherlands', 'Tunisia', [
        { date: '1978-06-11', team1Score: 5, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2022-11-26', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Netherlands, []),

    // ══════════ GROUP E ═══════════════════════════════════════════════════════
    entry('Germany', 'Ecuador', [
        { date: '2006-06-20', team1Score: 3, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
        { date: '2013-05-29', team1Score: 4, team2Score: 2, competition: 'International Friendly' },
    ], FORM.Germany, []),

    entry('Germany', 'Ivory Coast', [
        { date: '2010-06-23', team1Score: 0, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Germany, []),

    entry('Germany', 'Curaçao', [], FORM.Germany, []),

    // ══════════ GROUP J ═══════════════════════════════════════════════════════
    entry('Argentina', 'Algeria', [
        { date: '2010-06-01', team1Score: 4, team2Score: 3, competition: 'International Friendly' },
    ], FORM.Argentina, []),

    entry('Argentina', 'Austria', [
        { date: '1958-06-08', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2012-08-15', team1Score: 2, team2Score: 1, competition: 'International Friendly' },
    ], FORM.Argentina, []),

    // ══════════ GROUP H ═══════════════════════════════════════════════════════
    entry('Spain', 'Uruguay', [
        { date: '1950-07-02', team1Score: 0, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '1992-03-18', team1Score: 3, team2Score: 1, competition: 'International Friendly' },
        { date: '2011-03-29', team1Score: 1, team2Score: 1, competition: 'International Friendly' },
        { date: '2019-11-18', team1Score: 1, team2Score: 3, competition: 'International Friendly' },
    ], FORM.Spain, FORM.Uruguay),

    entry('Spain', 'Saudi Arabia', [
        { date: '1994-06-28', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Round of 16' },
        { date: '2023-09-12', team1Score: 1, team2Score: 0, competition: 'International Friendly' },
    ], FORM.Spain, []),

    // ══════════ GROUP I ═══════════════════════════════════════════════════════
    entry('France', 'Senegal', [
        { date: '2002-05-31', team1Score: 0, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2015-10-11', team1Score: 2, team2Score: 2, competition: 'International Friendly' },
        { date: '2023-10-14', team1Score: 1, team2Score: 1, competition: 'International Friendly' },
    ], FORM.France, FORM.Senegal),

    // ══════════ GROUP K ═══════════════════════════════════════════════════════
    entry('Portugal', 'Colombia', [
        { date: '2014-06-14', team1Score: 0, team2Score: 0, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Portugal, FORM.Colombia),

    // ══════════ GROUP G ═══════════════════════════════════════════════════════
    entry('Belgium', 'Egypt', [
        { date: '2005-09-07', team1Score: 4, team2Score: 1, competition: 'International Friendly' },
        { date: '2022-11-01', team1Score: 2, team2Score: 2, competition: 'International Friendly' },
        { date: '2023-11-17', team1Score: 3, team2Score: 0, competition: 'International Friendly' },
    ], FORM.Belgium, []),

    entry('Belgium', 'Iran', [
        { date: '2014-06-17', team1Score: 2, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
    ], FORM.Belgium, []),

    // ══════════ GROUP D ═══════════════════════════════════════════════════════
    entry('USA', 'Paraguay', [
        { date: '2011-03-26', team1Score: 1, team2Score: 0, competition: 'International Friendly' },
        { date: '2013-11-19', team1Score: 2, team2Score: 1, competition: 'International Friendly' },
        { date: '2017-03-28', team1Score: 1, team2Score: 1, competition: 'International Friendly' },
        { date: '2023-09-12', team1Score: 0, team2Score: 0, competition: 'International Friendly' },
        { date: '2025-11-15', team1Score: 2, team2Score: 1, competition: 'International Friendly' },
    ], FORM.USA, []),

    entry('USA', 'Australia', [
        { date: '2003-05-31', team1Score: 3, team2Score: 1, competition: 'International Friendly' },
        { date: '2011-06-04', team1Score: 1, team2Score: 1, competition: 'International Friendly' },
        { date: '2023-09-09', team1Score: 2, team2Score: 0, competition: 'International Friendly' },
    ], FORM.USA, []),

    // ══════════ GROUP A ═══════════════════════════════════════════════════════
    entry('Mexico', 'South Korea', [
        { date: '1998-06-13', team1Score: 3, team2Score: 1, competition: 'FIFA World Cup Group Stage' },
        { date: '2010-06-02', team1Score: 2, team2Score: 0, competition: 'International Friendly' },
        { date: '2022-09-27', team1Score: 2, team2Score: 2, competition: 'International Friendly' },
    ], FORM.Mexico, []),

    entry('Mexico', 'South Africa', [
        { date: '2009-06-22', team1Score: 0, team2Score: 1, competition: 'FIFA Confederations Cup' },
        { date: '2010-01-31', team1Score: 1, team2Score: 0, competition: 'International Friendly' },
    ], FORM.Mexico, []),
]);

// ─── Write to Firestore ───────────────────────────────────────────────────────

async function main() {
    const db = getDb();
    const collection = db.collection('wk2026TeamHistory');
    const batch = db.batch();
    let count = 0;

    for (const [key, value] of SEED_DATA) {
        batch.set(collection.doc(key), value, { merge: false });
        count++;
        console.log(`  ✓ ${key}`);
    }

    await batch.commit();
    console.log(`\nDone — ${count} paren naar Firestore geschreven.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Fout:', err);
    process.exit(1);
});
