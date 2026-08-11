import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { autoProspect } from '@/lib/ai/agent'
import { jobs, updateJob, cleanupOldJobs, type ProspectJob } from '@/lib/prospect-jobs'

export const maxDuration = 600 // 10 分鐘

export async function POST(req: NextRequest) {
  try {
    cleanupOldJobs()

    const body = await req.json()
    const {
      serviceName,
      description,
      targetIndustries,
      targetCompanySize,
      targetLocation,
      keyBenefits,
      idealCustomerSignals,
      targetCount = 10,
      saveToDb = false,
    } = body

    if (!serviceName?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'serviceName 和 description 為必填' },
        { status: 400 }
      )
    }

    // 建立 jobId
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const job: ProspectJob = {
      id: jobId,
      status: 'running',
      stage: '初始化中',
      detail: '準備啟動 AI 自動開發...',
      step: 0,
      totalSteps: 6,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    }
    jobs.set(jobId, job)

    // 背景執行（不 await）
    ;(async () => {
      try {
        // 步驟 1: 生成搜尋策略
        updateJob(jobId, {
          step: 1,
          stage: '生成搜尋策略',
          detail: 'AI 正在根據你的服務描述設計 8 組精準搜尋查詢...',
        })

        const result = await autoProspect({
          serviceName,
          description,
          targetIndustries,
          targetCompanySize,
          targetLocation,
          keyBenefits,
          idealCustomerSignals,
          targetCount,
          onProgress: (stage, detail) => {
            // 根據 stage 字串推導 step
            let step = job.step
            if (stage.includes('搜尋策略') || stage.includes('搜尋查詢')) step = 1
            else if (stage.includes('搜尋候選')) step = 2
            else if (stage.includes('篩選')) step = 3
            else if (stage.includes('分析契合') || stage.includes('評估')) step = 5
            else if (stage.includes('完成')) step = 6
            updateJob(jobId, { stage, detail: detail ?? '', step })
          },
        })

        if (!result.success || !result.result) {
          updateJob(jobId, {
            status: 'failed',
            error: result.error ?? '自動開發失敗',
            stage: '失敗',
            detail: result.error ?? '自動開發失敗',
            step: 6,
            finishedAt: Date.now(),
          })
          return
        }

        // 若要求「全部加入名單」
        let addedToLeads = 0
        if (saveToDb && result.result.candidates.length > 0) {
          updateJob(jobId, {
            step: 6,
            stage: '加入名單',
            detail: `正在將 ${result.result.candidates.length} 家公司加入資料庫...`,
          })
          const leadsData = result.result.candidates.map((c) => ({
            company: c.company,
            website: c.website,
            industry: c.industry ?? null,
            status: 'new' as const,
            tags: `AI自動開發,fit:${c.fit_score}`,
            researchRaw: JSON.stringify({
              ai_prospect_evaluation: {
                fit_score: c.fit_score,
                why_they_need_it: c.why_they_need_it,
                suggested_angle: c.suggested_angle,
                key_signals: c.key_signals,
                confidence: c.confidence,
              },
            }),
          }))
          const created = await db.lead.createMany({ data: leadsData })
          addedToLeads = created.count
        }

        updateJob(jobId, {
          status: 'completed',
          step: 6,
          stage: '完成',
          detail: `找到 ${result.result.candidates.length} 家潛在客戶${addedToLeads ? `，已加入 ${addedToLeads} 家到名單` : ''}`,
          result: {
            candidates: result.result.candidates,
            ai_search_queries: result.result.ai_search_queries,
            total_discovered: result.result.total_discovered,
            evaluated: result.result.evaluated,
          },
          finishedAt: Date.now(),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        updateJob(jobId, {
          status: 'failed',
          error: msg,
          stage: '失敗',
          detail: msg,
          step: 6,
          finishedAt: Date.now(),
        })
      }
    })()

    // 立即返回 jobId，不等待背景任務完成
    return NextResponse.json({ jobId, status: 'running' })
  } catch (error) {
    console.error('POST /api/auto-prospect error:', error)
    const msg = error instanceof Error ? error.message : 'Auto-prospect failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
