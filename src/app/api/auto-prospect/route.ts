import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, leadFilter } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { autoProspect } from '@/lib/ai/agent'
import { jobs, updateJob, cleanupOldJobs, type ProspectJob } from '@/lib/prospect-jobs'

export const maxDuration = 600

export async function POST(req: NextRequest) {
  try {
    cleanupOldJobs()
    const user = await requireUser()
    await loadProviderConfig()
    const body = await req.json()
    const { targetCount = 10, saveToDb = false } = body

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

    const serviceOffering = await db.serviceOffering.findUnique({
      where: { tenantId: user.tenantId },
    })

    const serviceName = body.serviceName || serviceOffering?.serviceName || ''
    const description = body.description || serviceOffering?.description || ''

    if (!serviceName.trim() || !description.trim()) {
      return NextResponse.json({ error: 'serviceName 和 description 為必填（請至「寄件人」分頁設定服務介紹）' }, { status: 400 })
    }

    ;(async () => {
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

        let addedToLeads = 0
        if (saveToDb && result.result.candidates.length > 0) {
          updateJob(jobId, { step: 6, stage: '加入名單', detail: `加入 ${result.result.candidates.length} 家...` })
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

        updateJob(jobId, {
          status: 'completed',
          step: 6,
          stage: '完成',
          detail: `找到 ${result.result.candidates.length} 家潛在客戶${addedToLeads ? `，已加入 ${addedToLeads} 家` : ''}`,
          result: result.result,
          finishedAt: Date.now(),
        })
      } catch (e: any) {
        updateJob(jobId, {
          status: 'failed',
          error: e.message,
          stage: '失敗',
          detail: e.message,
          step: 6,
          finishedAt: Date.now(),
        })
      }
    })()

    return NextResponse.json({ jobId, status: 'running' })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }
    return NextResponse.json({ error: error.message ?? 'Failed' }, { status: 500 })
  }
}
