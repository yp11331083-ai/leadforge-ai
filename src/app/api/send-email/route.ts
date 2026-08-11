import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { leadId } = await req.json()
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 })
    }

    const lead = await db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    if (!lead.email) {
      return NextResponse.json(
        { error: '此名單缺少收件者 email' },
        { status: 400 }
      )
    }
    if (!lead.emailSubject || !lead.emailBody) {
      return NextResponse.json(
        { error: '尚未生成郵件內容，請先點擊「AI 生成郵件」' },
        { status: 400 }
      )
    }

    const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
    if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass || !config?.smtpFromEmail) {
      return NextResponse.json(
        { error: 'SMTP 尚未設定完整，請至「發信設定」分頁設定' },
        { status: 400 }
      )
    }

    const nodemailer = (await import('nodemailer')).default
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    })

    const fromName = config.smtpFromName || config.smtpUser
    const toName = lead.contactName || lead.company

    const info = await transporter.sendMail({
      from: `"${fromName}" <${config.smtpFromEmail}>`,
      to: lead.email,
      subject: lead.emailSubject,
      text: lead.emailBody,
      html: lead.emailBody.replace(/\n/g, '<br>'),
    })

    // 標記為已發送
    await db.lead.update({
      where: { id: leadId },
      data: { status: 'sent' },
    })

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      to: lead.email,
      subject: lead.emailSubject,
    })
  } catch (error) {
    console.error('POST /api/send-email error:', error)
    const msg = error instanceof Error ? error.message : 'Send failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
