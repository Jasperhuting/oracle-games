import { NextRequest } from 'next/server';

// This would normally be stored in a database or Redis
// For now, we'll use the same in-memory storage as the main route
// In production, you'd want to use a shared data store

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  
  // For now, redirect to main endpoint with jobId query param
  // In production, implement proper job status lookup
  const url = new URL('/api/run-scraper', request.url);
  url.searchParams.set('jobId', jobId);
  
  return fetch(url.toString());
}