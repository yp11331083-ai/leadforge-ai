import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Public health endpoint for uptime monitors.
 * GET /api/health
 *   - 200 { ok: true, db: true } when the app + database are reachable
 *   - 503 when the database is unreachable (so uptime monitors can alert)
 * Never returns secrets or stack traces.
 */
export async function GET() {
  let dbOk = false
  try {
    await db.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  const ok = dbOk
  return NextResponse.json(
    { ok, db: dbOk, time: new Date().toISOString() },
    { status: ok ? 200 : 503 }
  )
}