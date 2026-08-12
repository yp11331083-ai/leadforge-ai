import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, tenantFilter } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await requireUser()
    let config = await db.serviceOffering.findUnique({
      where: { tenantId: user.tenantId },
    })
    if (!config) {
      config = await db.serviceOffering.create({ data: { tenantId: user.tenantId } })
    }
    return NextResponse.json(config)
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()

    const config = await db.serviceOffering.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, ...body },
      update: body,
    })
    return NextResponse.json(config)
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
