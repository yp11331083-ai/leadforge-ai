import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { searchCompanies } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
    await requireUser()
    await loadProviderConfig()
    const body = await req.json()
    const { query, num = 10 } = body

    if (!query) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const results = await searchCompanies(query, num)

    return NextResponse.json({
      success: true,
      query,
      results,
    })
  } catch (error) {
    console.error('POST /api/web-search error:', error)
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
