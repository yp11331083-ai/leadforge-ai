import { NextResponse } from 'next/server'

/**
 * DEPRECATED — auto-prospect is now synchronous.
 *
 * The previous implementation used an in-memory Map to track job state
 * across requests, which fundamentally breaks on Vercel serverless
 * (each request hits a different instance, so polling can never find
 * the job). The new /api/auto-prospect POST runs the full pipeline
 * synchronously and returns the result directly — no polling needed.
 *
 * This endpoint is kept only to avoid breaking deep-linked bookmarks.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Job polling is no longer supported. Use POST /api/auto-prospect which returns the result synchronously.',
      status: 'deprecated',
    },
    { status: 410 }
  )
}
