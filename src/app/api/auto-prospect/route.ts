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
        let clientGone = false
        // enqueue throws once the client disconnects; a throwing send() used
        // to bounce into the catch block, re-throw inside it, and leave an
        // unhandled rejection. Mark-and-drop instead.
        const send = (obj: any) => {
          if (clientGone) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
          } catch {
            clientGone = true
          }
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
            selfWebsite: body.selfWebsite || undefined, // Pass user's own website for exclusion
            onProgress: (stage, detail) => {
              let step = 1
              const s = stage.toLowerCase()
              if (s.includes('search cand') || s.includes('searching')) step = 2
              else if (s.includes('filter') || s.includes('extract')) step = 3
              else if (s.includes('fetch') || s.includes('website')) step = 4
              else if (s.includes('fit') || s.includes('evaluat') || s.includes('analyz')) step = 5
              else if (s.includes('complete') || s.includes('sort') || s.includes('found')) step = 6
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
          let skippedDuplicates = 0
          if (saveToDb && result.result.candidates.length > 0) {
            // Dedup against existing leads — repeated runs used to create
            // the same companies over and over.
            const existingWebsites = new Set(
              (await db.lead.findMany({
                where: { tenantId: user.tenantId, website: { not: null } },
                select: { website: true },
              })).map((l) => normalizeWebsite(l.website!))
            )
            const existingCompanies = new Set(
              (await db.lead.findMany({
                where: { tenantId: user.tenantId },
                select: { company: true },
              })).map((l) => l.company.toLowerCase().trim())
            )

            const leadsData = result.result.candidates
              .filter((c: any) => {
                const siteKey = normalizeWebsite(c.website)
                const nameKey = String(c.company).toLowerCase().trim()
                if ((siteKey && existingWebsites.has(siteKey)) || existingCompanies.has(nameKey)) {
                  skippedDuplicates++
                  return false
                }
                if (siteKey) existingWebsites.add(siteKey)
                existingCompanies.add(nameKey)
                return true
              })
              .map((c: any) => ({
                tenantId: user.tenantId,
                assigneeId: user.role === 'sdr' ? user.id : null,
                company: c.company,
                website: c.website,
                industry: c.industry ?? null,
                status: 'new' as const,
                tags: `AI自動開發,fit:${c.fit_score}`,
                researchRaw: JSON.stringify({ ai_prospect_evaluation: c }),
              }))
            if (leadsData.length > 0) {
              const created = await db.lead.createMany({ data: leadsData })
              addedToLeads = created.count
            }
          }

          send({
            type: 'complete',
            result: result.result,
            addedToLeads,
            skippedDuplicates,
            creditsUsed: creditCost,
            creditsRemaining: creditResult.balanceAfter,
            detail: `找到 ${result.result.candidates.length} 家潛在客戶${addedToLeads ? `，已加入 ${addedToLeads} 家` : ''}${skippedDuplicates ? `，略過 ${skippedDuplicates} 家重複` : ''}`,
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
    // Atomic increment — the previous read-then-write version could lose a
    // refund when two runs for the same tenant finished at the same time.
    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: { creditBalance: { increment: amount } },
    })
    await db.creditLog.create({
      data: {
        tenantId,
        type: 'CREDIT_RESET',
        amount,
        balanceAfter: tenant.creditBalance,
        description: `[REFUND] ${description}`,
      },
    })
  } catch (e) {
    console.error('refundCredits failed:', e)
  }
}

function normalizeWebsite(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return url.toLowerCase().trim()
  }
}
