import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    let config = await db.serviceOffering.findUnique({ where: { id: 'singleton' } })
    if (!config) {
      config = await db.serviceOffering.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('GET /api/service-offering error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const data = {
      serviceName: body.serviceName ?? null,
      description: body.description ?? null,
      targetIndustries: body.targetIndustries ?? null,
      targetCompanySize: body.targetCompanySize ?? null,
      targetLocation: body.targetLocation ?? null,
      keyBenefits: body.keyBenefits ?? null,
      idealCustomerSignals: body.idealCustomerSignals ?? null,
    }

    const config = await db.serviceOffering.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('PUT /api/service-offering error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
