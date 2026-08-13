import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/track/open/{leadId}
 * Open tracking pixel — returns 1x1 transparent PNG
 * Updates lead.openedAt and creates EmailEvent
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return transparentPng()

    const now = new Date()
    
    if (!lead.openedAt) {
      await db.lead.update({
        where: { id: leadId },
        data: { openedAt: now },
      })
    }

    await db.emailEvent.create({
      data: {
        tenantId: lead.tenantId,
        leadId,
        eventType: 'opened',
        eventTime: now,
        rawPayload: JSON.stringify({ 
          source: 'pixel',
          userAgent: _req.headers.get('user-agent') ?? '',
        }),
      },
    })

    return transparentPng()
  } catch {
    return transparentPng()
  }
}

function transparentPng(): NextResponse {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  const pngBuffer = Buffer.from(pngBase64, 'base64')
  
  return new NextResponse(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': pngBuffer.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
