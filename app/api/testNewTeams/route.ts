import { getNewTeams } from '@/lib/scraper/getNewTeams';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        console.log('Testing getNewTeams...');

        const result = await getNewTeams();

        console.log('✅ Successfully fetched new teams');
        return Response.json({
            success: true,
            message: 'Successfully fetched new teams',
            result
        });

    } catch (error) {
        console.error('❌ Error testing new teams:', error);
        return Response.json({
            success: false,
            error: 'Failed to fetch new teams',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
