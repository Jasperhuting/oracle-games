import { NextRequest, NextResponse } from 'next/server';
import { finalizeAuction } from '@/lib/auction/finalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;

    // Parse request body to get auction period name and resume option
    const body = await request.json().catch(() => ({}));
    const { auctionPeriodName, resumeFromUserId } = body;

    // Call the shared finalize function
    const result = await finalizeAuction({
      gameId,
      auctionPeriodName,
      resumeFromUserId,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      results: result.results,
    });

  } catch (error) {
    console.error('Error finalizing auction:', error);
    return NextResponse.json(
      { error: 'Failed to finalize auction', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
