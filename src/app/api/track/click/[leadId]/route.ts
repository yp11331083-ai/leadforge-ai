import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/track/click/{leadId}?dest=https://cal.com/alex/15min
 * Click tracking — records the click, then 302 redirects to destination
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params
    const dest = new URL(req.url).searchParams.get('dest')

    if (!dest) {
      return NextResponse.json({ error: 'Missing dest parameter' }, { status: 400 })
    }

    // Record the click
    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (lead) {
      await db.lead.update({
        where: { id: leadId },
        data: { clickedAt: new Date() },
      })

      await db.emailEvent.create({
        data: {
          tenantId: lead.tenantId,
          leadId,
          eventType: 'clicked',
          eventTime: new Date(),
          rawPayload: JSON.stringify({
            destination: dest,
            userAgent: req.headers.get('user-agent') ?? '',
          }),
        },
      })
    }

    // 302 redirect to actual destination
    return NextResponse.redirect(dest, 302)
  } catch (error) {
    console.error('Click tracking error:', error)
    // Still redirect if possible
    const dest = new URL(req.url).searchParams.get('dest')
    if (dest) return NextResponse.redirect(dest, 302)
    return NextResponse.json({ error: 'Redirect failed' }, { status: 500 })
  }
}
