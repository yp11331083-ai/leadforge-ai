import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'

/**
 * Debug endpoint — shows which platform AI env vars are actually reaching
 * the Vercel runtime. Only returns whether each var is set (not the value).
 *
 * Usage: GET /api/debug/env
 */
export async function GET() {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    vercelRegion: process.env.VERCEL_REGION || 'not on vercel',
    vercelEnv: process.env.VERCEL_ENV || 'not on vercel',
    platformEnvVars: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY
        ? `set (len=${process.env.GEMINI_API_KEY.length}, prefix=${process.env.GEMINI_API_KEY.slice(0, 6)}...)`
        : 'NOT SET',
      TAVILY_API_KEY: process.env.TAVILY_API_KEY
        ? `set (len=${process.env.TAVILY_API_KEY.length}, prefix=${process.env.TAVILY_API_KEY.slice(0, 6)}...)`
        : 'NOT SET',
      JINA_API_KEY: process.env.JINA_API_KEY
        ? `set (len=${process.env.JINA_API_KEY.length}, prefix=${process.env.JINA_API_KEY.slice(0, 6)}...)`
        : 'NOT SET',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET
        ? `set (len=${process.env.NEXTAUTH_SECRET.length})`
        : 'NOT SET',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      DATABASE_URL: process.env.DATABASE_URL
        ? `set (prefix=${process.env.DATABASE_URL.slice(0, 15)}...)`
        : 'NOT SET',
    },
  })
}
