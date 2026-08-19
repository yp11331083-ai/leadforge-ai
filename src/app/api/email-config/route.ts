import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, tenantFilter } from '@/lib/auth/session'

export async function GET() {
  try {
    const user = await requireUser()
    let config = await db.emailConfig.findUnique({
      where: { tenantId: user.tenantId },
    })
    if (!config) {
      config = await db.emailConfig.create({
        data: { tenantId: user.tenantId },
      })
    }
    return NextResponse.json(maskSecrets(config))
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

    const data: Record<string, unknown> = {
      smtpHost: body.smtpHost ?? null,
      smtpPort: body.smtpPort ? Number(body.smtpPort) : null,
      smtpUser: body.smtpUser ?? null,
      smtpFromName: body.smtpFromName ?? null,
      smtpFromEmail: body.smtpFromEmail ?? null,
      smtpSecure: body.smtpSecure ?? true,
      smartleadApiKey: body.smartleadApiKey ?? null,
      smartleadDefaultCampaignId: body.smartleadDefaultCampaignId ?? null,
      hunterApiKey: body.hunterApiKey ?? null,
      calComApiKey: body.calComApiKey ?? null,
      stripeSecretKey: body.stripeSecretKey ?? null,
      stripeMeteredPriceId: body.stripeMeteredPriceId ?? null,
      // AI 提供者
      openaiApiKey: body.openaiApiKey ?? null,
      openaiModel: body.openaiModel ?? 'gpt-4o-mini',
      anthropicApiKey: body.anthropicApiKey ?? null,
      anthropicModel: body.anthropicModel ?? 'claude-3-5-sonnet-20241022',
      geminiApiKey: body.geminiApiKey ?? null,
      geminiModel: body.geminiModel ?? 'gemini-1.5-flash',
      tavilyApiKey: body.tavilyApiKey ?? null,
      jinaApiKey: body.jinaApiKey ?? null,
      firecrawlApiKey: body.firecrawlApiKey ?? null,
      chatProviderOrder: body.chatProviderOrder ?? 'groq,deepseek,opencode,openrouter,gemini,openai,anthropic',
      searchProviderOrder: body.searchProviderOrder ?? 'jina,tavily',
      pageReaderProviderOrder: body.pageReaderProviderOrder ?? 'jina,firecrawl',
    }
    if (body.smtpPass && body.smtpPass.trim() !== '') {
      data.smtpPass = body.smtpPass
    }

    const config = await db.emailConfig.upsert({
      where: { tenantId: user.tenantId },
      create: { tenantId: user.tenantId, ...data },
      update: data,
    })

    return NextResponse.json(maskSecrets(config))
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const body = await req.json()
    const { action } = body

    const config = await db.emailConfig.findUnique({
      where: { tenantId: user.tenantId },
    })

    if (action === 'test-smtp') {
      if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass) {
        return NextResponse.json({ error: 'SMTP 尚未設定完整' }, { status: 400 })
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
      if (!config?.smartleadApiKey) {
        return NextResponse.json({ error: 'Smartlead API Key 尚未設定' }, { status: 400 })
      }
      const res = await fetch('https://server.smartlead.ai/api/v1/campaigns?api_key=' + config.smartleadApiKey)
      if (!res.ok) {
        return NextResponse.json({ error: `Smartlead API 失敗: ${res.status}` }, { status: 502 })
      }
      const data = await res.json()
      return NextResponse.json({
        success: true,
        message: `Smartlead 連線成功，共 ${Array.isArray(data) ? data.length : 0} 個行銷活動`,
      })
    }

    if (action === 'test-hunter') {
      if (!config?.hunterApiKey) {
        return NextResponse.json({ error: 'Hunter.io API Key 尚未設定' }, { status: 400 })
      }
      const res = await fetch('https://api.apollo.io/v1/auth/health', {
        headers: { 'X-Api-Key': config.hunterApiKey },
      })
      if (!res.ok) {
        return NextResponse.json({ error: `Apollo API 失敗: ${res.status}` }, { status: 502 })
      }
      return NextResponse.json({ success: true, message: 'Hunter.io API Key 有效！' })
    }

    if (action === 'test-calcom') {
      if (!config?.calComApiKey) {
        return NextResponse.json({ error: 'Cal.com API Key 尚未設定' }, { status: 400 })
      }
      const res = await fetch('https://api.cal.com/v1/me', {
        headers: { Authorization: `Bearer ${config.calComApiKey}` },
      })
      if (!res.ok) {
        return NextResponse.json({ error: `Cal.com API 失敗: ${res.status}` }, { status: 502 })
      }
      return NextResponse.json({ success: true, message: 'Cal.com API Key 有效！' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function maskSecrets(config: any) {
  return {
    ...config,
    smtpPass: config.smtpPass ? '••••••••' : null,
    smartleadApiKey: config.smartleadApiKey
      ? config.smartleadApiKey.slice(0, 4) + '••••' + config.smartleadApiKey.slice(-4)
      : null,
    hunterApiKey: config.hunterApiKey
      ? config.hunterApiKey.slice(0, 4) + '••••' + config.hunterApiKey.slice(-4)
      : null,
    calComApiKey: config.calComApiKey
      ? config.calComApiKey.slice(0, 4) + '••••' + config.calComApiKey.slice(-4)
      : null,
    stripeSecretKey: config.stripeSecretKey
      ? config.stripeSecretKey.slice(0, 7) + '••••' + config.stripeSecretKey.slice(-4)
      : null,
    openaiApiKey: config.openaiApiKey
      ? config.openaiApiKey.slice(0, 4) + '••••' + config.openaiApiKey.slice(-4)
      : null,
    anthropicApiKey: config.anthropicApiKey
      ? config.anthropicApiKey.slice(0, 4) + '••••' + config.anthropicApiKey.slice(-4)
      : null,
    geminiApiKey: config.geminiApiKey
      ? config.geminiApiKey.slice(0, 4) + '••••' + config.geminiApiKey.slice(-4)
      : null,
    tavilyApiKey: config.tavilyApiKey
      ? config.tavilyApiKey.slice(0, 4) + '••••' + config.tavilyApiKey.slice(-4)
      : null,
    jinaApiKey: config.jinaApiKey
      ? config.jinaApiKey.slice(0, 4) + '••••' + config.jinaApiKey.slice(-4)
      : null,
    firecrawlApiKey: config.firecrawlApiKey
      ? config.firecrawlApiKey.slice(0, 4) + '••••' + config.firecrawlApiKey.slice(-4)
      : null,
  }
}
