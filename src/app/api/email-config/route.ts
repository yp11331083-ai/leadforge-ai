import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// 取得 EmailConfig（永遠遮罩密碼與 API key）
export async function GET() {
  try {
    let config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
    if (!config) {
      config = await db.emailConfig.create({ data: { id: 'singleton' } })
    }
    return NextResponse.json(maskSecrets(config))
  } catch (error) {
    console.error('GET /api/email-config error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// 更新 EmailConfig
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()

    // 處理密碼欄位：空字串代表「不變更」
    const data: Record<string, unknown> = {
      smtpHost: body.smtpHost ?? null,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : null,
      smtpUser: body.smtpUser ?? null,
      smtpFromName: body.smtpFromName ?? null,
      smtpFromEmail: body.smtpFromEmail ?? null,
      smtpSecure: body.smtpSecure ?? true,
      smartleadApiKey: body.smartleadApiKey ?? null,
      smartleadDefaultCampaignId: body.smartleadDefaultCampaignId ?? null,
      apolloApiKey: body.apolloApiKey ?? null,
    }
    if (body.smtpPass && body.smtpPass.trim() !== '') {
      data.smtpPass = body.smtpPass
    }

    const config = await db.emailConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })

    return NextResponse.json(maskSecrets(config))
  } catch (error) {
    console.error('PUT /api/email-config error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

// 測試 SMTP 連線
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'test-smtp') {
      const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
      if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass) {
        return NextResponse.json(
          { error: 'SMTP 尚未設定完整（需要 host、user、password）' },
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

      await transporter.verify()
      return NextResponse.json({ success: true, message: 'SMTP 連線成功！' })
    }

    if (action === 'test-smartlead') {
      const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
      if (!config?.smartleadApiKey) {
        return NextResponse.json(
          { error: 'Smartlead API Key 尚未設定' },
          { status: 400 }
        )
      }
      const res = await fetch('https://server.smartlead.ai/api/v1/campaigns?api_key=' + config.smartleadApiKey, {
        method: 'GET',
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `Smartlead API 失敗: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }
      const data = await res.json()
      return NextResponse.json({
        success: true,
        message: `Smartlead 連線成功，目前共 ${Array.isArray(data) ? data.length : 0} 個行銷活動`,
      })
    }

    if (action === 'test-apollo') {
      const config = await db.emailConfig.findUnique({ where: { id: 'singleton' } })
      if (!config?.apolloApiKey) {
        return NextResponse.json(
          { error: 'Apollo API Key 尚未設定' },
          { status: 400 }
        )
      }
      // Apollo Account API（測試連線）
      const res = await fetch('https://api.apollo.io/v1/auth/health', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'X-Api-Key': config.apolloApiKey,
        },
      })
      if (!res.ok) {
        const text = await res.text()
        return NextResponse.json(
          { error: `Apollo API 失敗: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 }
        )
      }
      return NextResponse.json({
        success: true,
        message: 'Apollo API Key 有效！',
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/email-config error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function maskSecrets(config: {
  smtpPass: string | null
  smartleadApiKey: string | null
  apolloApiKey: string | null
  [k: string]: unknown
}) {
  return {
    ...config,
    smtpPass: config.smtpPass ? '••••••••' : null,
    smartleadApiKey: config.smartleadApiKey
      ? config.smartleadApiKey.slice(0, 4) + '••••' + config.smartleadApiKey.slice(-4)
      : null,
    apolloApiKey: config.apolloApiKey
      ? config.apolloApiKey.slice(0, 4) + '••••' + config.apolloApiKey.slice(-4)
      : null,
  }
}
