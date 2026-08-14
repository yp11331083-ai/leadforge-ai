import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { autoProspect } from '@/lib/ai/agent'
import { deductCredits, hasCredits } from '@/lib/credits'
import { autoProspectCost } from '@/lib/credit-pricing'

// Vercel: 300s on Pro, 60s on Hobby (auto-clamped)
export const maxDuration = 300
// Force dynamic, never statically optimize this route
export const dynamic = 'force-dynamic'

// Credit cost for auto-prospect is computed dynamically via autoProspectCost(targetCount)
// defined in @/lib/credit-pricing.

/**
 * AI Auto-Prospect — Server-Sent Events (SSE) streaming endpoint.
 *
 * Why SSE? Because Vercel serverless kills the function the moment the
 * response is returned. SSE keeps a single HTTP connection open and lets
 * us stream real-time progress events as the pipeline runs. The client
 * updates the progress bar live, then receives the final result event.
 *
 * Event format:
 *   data: {"type":"progress","step":1,"stage":"...","detail":"..."}
 *   data: {"type":"progress","step":2,"stage":"...","detail":"..."}
 *   ...
 *   data: {"type":"complete","result":{...},"addedToLeads":N,"creditsUsed":N,"creditsRemaining":N}
 *   data: {"type":"error","error":"...","creditsRefunded":N}
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const body = await req.json()
    const { targetCount = 10, saveToDb = false } = body

    const serviceOffering = await db.serviceOffering.findUnique({
      where: { tenantId: user.tenantId },
    })

    const serviceName = body.serviceName || serviceOffering?.serviceName || ''
    const description = body.description || serviceOffering?.description || ''

    if (!serviceName.trim() || !description.trim()) {
      return new Response(
        JSON.stringify({ error: 'serviceName 和 description 為必填（請至「寄件人」分頁設定服務介紹）' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // === Credit check ===
    // Cost is dynamic: base 5 + 2 per target company (e.g. target=10 → 25 credits)
    const creditCost = autoProspectCost(targetCount)
    const hasBalance = await hasCredits(user.tenantId, creditCost)
    if (!hasBalance) {
      return new Response(
        JSON.stringify({
          error: `AI 點數不足。自動開發需要 ${creditCost} 點（5 + ${targetCount}×2）。請至計費頁面加購或升級方案。`,
          creditsRequired: creditCost,
        }),
        { status: 402 }
      )
    }

    // === Deduct credits upfront (atomic) ===
    const creditResult = await deductCredits(
      user.tenantId,
      creditCost,
      `AI Auto-Prospect: ${serviceName} (target ${targetCount})`
    )
    if (!creditResult.success) {
      return new Response(
        JSON.stringify({ error: 'AI 點數扣除失敗，請稍後再試' }),
        { status: 500 }
      )
    }
    const creditsBefore = creditResult.balanceAfter + creditCost

    // === Stream SSE ===
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
        }

        try {
          const result = await autoProspect({
            serviceName,
            description,
            targetIndustries: body.targetIndustries || serviceOffering?.targetIndustries || undefined,
            targetCompanySize: body.targetCompanySize || serviceOffering?.targetCompanySize || undefined,
            targetLocation: body.targetLocation || serviceOffering?.targetLocation || undefined,
            keyBenefits: body.keyBenefits || serviceOffering?.keyBenefits || undefined,
            idealCustomerSignals: body.idealCustomerSignals || serviceOffering?.idealCustomerSignals || undefined,
            targetCount,
            onProgress: (stage, detail) => {
              let step = 1
              if (stage.includes('搜尋候選') || stage.includes('搜尋公司')) step = 2
              else if (stage.includes('篩選') || stage.includes('萃取')) step = 3
              else if (stage.includes('抓取') || stage.includes('抓網站')) step = 4
              else if (stage.includes('分析契合') || stage.includes('評估') || stage.includes('AI 分析')) step = 5
              else if (stage.includes('完成') || stage.includes('Sort') || stage.includes('加入名單')) step = 6
              send({ type: 'progress', step, stage, detail: detail ?? '' })
            },
          })

          if (!result.success || !result.result) {
            // Refund credits on failure
            await refundCredits(user.tenantId, creditCost, 'AI Auto-Prospect 失敗退還')
            send({
              type: 'error',
              error: result.error ?? '自動開發失敗',
              creditsRefunded: creditCost,
              creditsRemaining: creditsBefore,
            })
            controller.close()
            return
          }

          let addedToLeads = 0
          if (saveToDb && result.result.candidates.length > 0) {
            const leadsData = result.result.candidates.map((c: any) => ({
              tenantId: user.tenantId,
              assigneeId: user.role === 'sdr' ? user.id : null,
              company: c.company,
              website: c.website,
              industry: c.industry ?? null,
              status: 'new' as const,
              tags: `AI自動開發,fit:${c.fit_score}`,
              researchRaw: JSON.stringify({ ai_prospect_evaluation: c }),
            }))
            const created = await db.lead.createMany({ data: leadsData })
            addedToLeads = created.count
          }

          send({
            type: 'complete',
            result: result.result,
            addedToLeads,
            creditsUsed: creditCost,
            creditsRemaining: creditResult.balanceAfter,
            detail: `找到 ${result.result.candidates.length} 家潛在客戶${addedToLeads ? `，已加入 ${addedToLeads} 家` : ''}`,
          })
          controller.close()
        } catch (e: any) {
          // Refund on unexpected error
          await refundCredits(user.tenantId, creditCost, 'AI Auto-Prospect 例外錯誤退還')
          send({
            type: 'error',
            error: e?.message ?? 'Unknown error',
            creditsRefunded: creditCost,
            creditsRemaining: creditsBefore,
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return new Response(
        JSON.stringify({ error: '請先登入' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * Refund credits (used when auto-prospect fails after upfront deduction).
 * Implemented inline to avoid adding a new exported function to credits.ts.
 */
async function refundCredits(tenantId: string, amount: number, description: string): Promise<void> {
  try {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return
    const newBalance = tenant.creditBalance + amount
    await db.tenant.update({
      where: { id: tenantId },
      data: { creditBalance: newBalance },
    })
    await db.creditLog.create({
      data: {
        tenantId,
        type: 'CREDIT_RESET',
        amount,
        balanceAfter: newBalance,
        description: `[REFUND] ${description}`,
      },
    })
  } catch (e) {
    console.error('refundCredits failed:', e)
  }
}
