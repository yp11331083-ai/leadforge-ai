import type { AutoProspectResult } from '@/lib/ai/agent'

export interface ProspectJob {
  id: string
  status: 'running' | 'completed' | 'failed'
  stage: string
  detail: string
  step: number  // 1-6
  totalSteps: number  // 6
  result?: AutoProspectResult
  error?: string
  startedAt: number
  updatedAt: number
  finishedAt?: number
}

// 用 globalThis 持久化（跨熱重載）
const globalForJobs = globalThis as unknown as {
  prospectJobs?: Map<string, ProspectJob>
}
export const jobs = globalForJobs.prospectJobs ?? new Map<string, ProspectJob>()
if (process.env.NODE_ENV !== 'production') globalForJobs.prospectJobs = jobs

// 清理超過 1 小時的已完成任務
export function cleanupOldJobs() {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  for (const [id, job] of jobs.entries()) {
    if (job.finishedAt && now - job.finishedAt > oneHour) {
      jobs.delete(id)
    }
  }
}

export function updateJob(id: string, patch: Partial<ProspectJob>) {
  const job = jobs.get(id)
  if (!job) return
  Object.assign(job, patch, { updatedAt: Date.now() })
  jobs.set(id, job)
}
