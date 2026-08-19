import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { deductCredits, hasCredits } from '@/lib/credits'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: 'Missing recipient email' }, { status: 400 })
    if (!lead.emailSubject || !lead.emailBody) return NextResponse.json({ error: 'No email content generated' }, { status: 400 })

    // Check blocklist
    if (lead.isBlocklisted) {
      return NextResponse.json({ 
        error: 'This email is blocklisted (bounced previously)',
        code: 'BLOCKLISTED',
      }, { status: 403 })
    }

    // Check credits (1 credit per email send)
    const hasEnough = await hasCredits(user.tenantId, 1)
    if (!hasEnough) {
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
        select: { creditBalance: true, plan: true },
      })
      return NextResponse.json({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        currentBalance: tenant?.creditBalance ?? 0,
        required: 1,
        upgradeUrl: '/billing',
      }, { status: 402 })
    }

    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })
    if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass || !config?.smtpFromEmail) {
      return NextResponse.json({ error: 'Email sending not configured. Go to Admin → Email settings' }, { status: 400 })
    }

    // Add tracking pixel to HTML
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const trackingPixel = `<img src="${appUrl}/api/track/open/${leadId}.png" width="1" height="1" style="display:none;" alt="" />`
    
    // Replace Cal.com links with click tracking
    let emailHtml = lead.emailBody.replace(/\n/g, '<br>')
    
    // Wrap any cal.com links with click tracking
    emailHtml = emailHtml.replace(
      /(https?:\/\/(?:www\.)?cal\.com\/[^\s"<]+)/gi,
      (match) => `${appUrl}/api/track/click/${leadId}?dest=${encodeURIComponent(match)}`
    )
    
    // Add tracking pixel at the end
    emailHtml += trackingPixel

    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    })

    const fromName = config.smtpFromName || config.smtpUser

    // Add jitter delay (180-300 seconds) to avoid pattern detection
    // Note: This is a soft delay — in production, use a queue (Redis + BullMQ)
    
    const info = await transporter.sendMail({
      from: `"${fromName}" <${config.smtpFromEmail}>`,
      to: lead.email,
      subject: lead.emailSubject,
      text: lead.emailBody, // Plain text without tracking
      html: emailHtml,       // HTML with tracking pixel + click redirects
    })

    // Deduct 1 credit
    const creditResult = await deductCredits(user.tenantId, 1, `Email sent to ${lead.company}`, leadId)
    
    // Mark as sent
    await db.lead.update({
      where: { id: leadId },
      data: { status: 'sent' },
    })

    // Record email event
    await db.emailEvent.create({
      data: {
        tenantId: user.tenantId,
        leadId,
        eventType: 'sent',
        eventTime: new Date(),
        rawPayload: JSON.stringify({ 
          messageId: info.messageId, 
          to: lead.email,
          creditsUsed: 1,
          balanceAfter: creditResult.balanceAfter,
        }),
      },
    })

    // Record usage for Stripe metered billing
    await db.usageEvent.create({
      data: { tenantId: user.tenantId, type: 'email_sent', leadId },
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to: lead.email,
      subject: lead.emailSubject,
      creditsRemaining: creditResult.balanceAfter,
    })
  } catch (error: any) {
    // Bounce detection — check for NDR patterns
    const errorMsg = error.message ?? ''
    const bouncePatterns = [
      /550 5\.1\.1/i, /user unknown/i, /mailbox unavailable/i,
      /recipient address rejected/i, /no such user/i,
    ]
    
    if (bouncePatterns.some(p => p.test(errorMsg))) {
      // Mark lead as bounced + blocklist
      const { leadId } = await req.json().catch(() => ({ leadId: null }))
      if (leadId) {
        const lead = await db.lead.findFirst({ where: { id: leadId } })
        if (lead) {
          await db.lead.update({
            where: { id: leadId },
            data: {
              status: 'new',
              bouncedAt: new Date(),
              bouncedReason: errorMsg.slice(0, 500),
              isBlocklisted: true,
            },
          })
          await db.emailEvent.create({
            data: {
              tenantId: lead.tenantId,
              leadId,
              eventType: 'bounced',
              rawPayload: JSON.stringify({ reason: errorMsg.slice(0, 500) }),
            },
          })
        }
      }
      return NextResponse.json({ 
        error: 'Email bounced — recipient address invalid. Lead has been blocklisted.',
        code: 'BOUNCED',
      }, { status: 422 })
    }

    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    console.error('POST /api/send-email error:', error)
    return NextResponse.json({ error: error.message ?? 'Send failed' }, { status: 500 })
  }
}
