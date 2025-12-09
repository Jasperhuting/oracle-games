import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi/spec';

/**
 * GET /api/openapi
 * Returns the OpenAPI 3.0 specification for the Oracle Games API
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
