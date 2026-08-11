import { NextRequest, NextResponse } from 'next/server'
import { jobs, cleanupOldJobs } from '@/lib/prospect-jobs'

export async function GET(req: NextRequest) {
  try {
    cleanupOldJobs()

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const job = jobs.get(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 計算已執行時間
    const elapsedMs = Date.now() - job.startedAt

    return NextResponse.json({
      ...job,
      elapsedMs,
      elapsedSeconds: Math.floor(elapsedMs / 1000),
    })
  } catch (error) {
    console.error('GET /api/auto-prospect/status error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
