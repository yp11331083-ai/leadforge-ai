import { NextRequest, NextResponse } from 'next/server'
import { searchCompanies } from '@/lib/ai/agent'

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
