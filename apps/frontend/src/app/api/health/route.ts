import { NextResponse } from 'next/server';

/**
 * Health check endpoint for container monitoring
 * Returns 200 OK without making any external API calls
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'frontend'
    },
    { status: 200 }
  );
}
