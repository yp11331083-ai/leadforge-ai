import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 列出 Smartlead 行銷活動
export async function GET() {
  try {
    const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
    if (!config?.smartleadApiKey) {
      return NextResponse.json(
        { error: 'Smartlead API Key 尚未設定' },
        { status: 400 }
      )
    }

    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns?api_key=${config.smartleadApiKey}`,
      { method: 'GET' }
    )

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `Smartlead API 失敗: ${res.status} ${text.slice(0, 200)}` },
        { status: 502 }
      )
    }

    const data = (await res.json()) as Array<{
      id: number
      name: string
      status?: string
      created_at?: string
      sequence_step_count?: number
      leads_count?: number
    }>

    const campaigns = data.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      leadsCount: c.leads_count,
      sequenceSteps: c.sequence_step_count,
      createdAt: c.created_at,
    }))

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('GET /api/smartlead/campaigns error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
