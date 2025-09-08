import { NextRequest } from 'next/server';

// This would access the same in-memory storage as the bulk route
// In production, you'd use a shared data store like Redis

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  // Redirect to main bulk endpoint with jobId query param
  const url = new URL('/api/scraper/bulk', request.url);
  url.searchParams.set('jobId', jobId);
  
  return fetch(url.toString());
}