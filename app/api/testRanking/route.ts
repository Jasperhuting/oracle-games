import { getRidersRankedPuppeteer } from '@/lib/scraper/getRidersRankedPuppeteer';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        console.log('Testing getRidersRankedPuppeteer with offset 800');

        const result = await getRidersRankedPuppeteer({ offset: 800, year: 2025 });

        console.log('Result:', JSON.stringify(result, null, 2));

        return Response.json({
            success: true,
            result
        });

    } catch (error) {
        console.error('Error testing getRidersRanked:', error);
        return Response.json({
            success: false,
            error: 'Failed to test getRidersRanked',
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
