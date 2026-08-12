import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, leadFilter, tenantFilter, requireUser } from '@/lib/auth/session'

// 取得所有 Lead，依 role 過濾
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {
      ...leadFilter(user),  // SDR 只看自己的，Admin/Manager 看全部
    }
    if (status && status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { company: { contains: search } },
        { contactName: { contains: search } },
        { email: { contains: search } },
        { industry: { contains: search } },
      ]
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { assignee: { select: { id: true, name: true, email: true } } },
    })

    // 統計指標（用 role 過濾後的範圍）
    const allWhere = leadFilter(user)
    const total = await db.lead.count({ where: allWhere })
    const byStatus = await db.lead.groupBy({ by: ['status'], where: allWhere, _count: true })

    const stats = {
      total,
      new: byStatus.find((s) => s.status === 'new')?._count ?? 0,
      researched: byStatus.find((s) => s.status === 'researched')?._count ?? 0,
      ready: byStatus.find((s) => s.status === 'ready')?._count ?? 0,
      sent: byStatus.find((s) => s.status === 'sent')?._count ?? 0,
      replied: byStatus.find((s) => s.status === 'replied')?._count ?? 0,
    }

    return NextResponse.json({ leads, stats })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('GET /api/leads error:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }
}

// 新增 Lead
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()

    if (Array.isArray(body)) {
      const created = await db.lead.createMany({
        data: body.map((item) => ({
          ...item,
          tenantId: user.tenantId,
          assigneeId: item.assigneeId ?? (user.role === 'sdr' ? user.id : null),
          status: item.status ?? 'new',
        })),
      })
      return NextResponse.json({ count: created.count })
    }

    const lead = await db.lead.create({
      data: {
        ...body,
        tenantId: user.tenantId,
        assigneeId: body.assigneeId ?? (user.role === 'sdr' ? user.id : null),
        status: body.status ?? 'new',
      },
    })
    return NextResponse.json(lead)
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/leads error:', error)
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
  }
}
