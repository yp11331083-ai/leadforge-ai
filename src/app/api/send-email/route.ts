import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const { leadId } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'leadId is required' }, { status: 400 })

    const lead = await db.lead.findFirst({ where: { id: leadId, ...leadFilter(user) } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: '此名單缺少收件者 email' }, { status: 400 })
    if (!lead.emailSubject || !lead.emailBody) return NextResponse.json({ error: '尚未生成郵件內容' }, { status: 400 })

    const config = await db.emailConfig.findUnique({ where: { tenantId: user.tenantId } })
    if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass || !config?.smtpFromEmail) {
      return NextResponse.json({ error: 'SMTP 尚未設定完整' }, { status: 400 })
    }

    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    })

    const fromName = config.smtpFromName || config.smtpUser
    const info = await transporter.sendMail({
      from: `"${fromName}" <${config.smtpFromEmail}>`,
      to: lead.email,
      subject: lead.emailSubject,
      text: lead.emailBody,
      html: lead.emailBody.replace(/\n/g, '<br>'),
    })

    // 標記為已發送 + 記錄事件 + 記錄用量（給 Stripe）
    await db.lead.update({ where: { id: leadId }, data: { status: 'sent' } })
    await db.emailEvent.create({
      data: {
        tenantId: user.tenantId,
        leadId,
        eventType: 'sent',
        rawPayload: JSON.stringify({ messageId: info.messageId, to: lead.email }),
      },
    })
    await db.usageEvent.create({
      data: { tenantId: user.tenantId, type: 'email_sent', leadId },
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to: lead.email,
      subject: lead.emailSubject,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    console.error('POST /api/send-email error:', error)
    return NextResponse.json({ error: error.message ?? 'Send failed' }, { status: 500 })
  }
}
