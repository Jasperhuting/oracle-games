import { NextRequest, NextResponse } from 'next/server';
export const runtime = "nodejs";

export async function POST(request: NextRequest) {

const body = await request.json();

const backendUrl = process.env.MOTIA_HTTP_URL;

if (!backendUrl) {
    return NextResponse.json({
        success: false,
        error: 'MOTIA_HTTP_URL environment variable is not set'
    }, { status: 500 });
}

console.log('Calling backend:', backendUrl);

try {
    const res = await fetch(`${backendUrl}/update-team-api`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: "no-store"
    });

    if (!res.ok) {
        const errorData = await res.text();
        return NextResponse.json({
            success: false,
            error: errorData
        }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
        success: true,
        data: data,
        traceId: data.traceId, // Pass through the traceId
    });
} catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
}

}