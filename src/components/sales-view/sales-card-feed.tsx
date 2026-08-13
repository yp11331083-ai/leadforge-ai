'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Send,
  SkipForward,
  Edit3,
  Loader2,
  Mail,
  Globe,
  Building2,
  Target,
  TrendingUp,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Clock,
  Crown,
  AlertCircle,
} from 'lucide-react'
import { useLeadStore, type Lead } from '@/store/lead-store'
import { toast } from 'sonner'

interface SalesCardFeedProps {
  onEditLead: (id: string) => void
}

export function SalesCardFeed({ onEditLead }: SalesCardFeedProps) {
  const leads = useLeadStore((s) => s.leads)
  const stats = useLeadStore((s) => s.stats)
  const fetchLeads = useLeadStore((s) => s.fetchLeads)
  const sendEmail = useLeadStore((s) => s.sendEmail)
  const updateLead = useLeadStore((s) => s.updateLead)
  const emailConfig = useLeadStore((s) => s.emailConfig)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [sending, setSending] = useState<string | null>(null)
  const [sentQueue, setSentQueue] = useState<Array<{ lead: Lead; at: number }>>([])

  // 只顯示有 email 內容但還沒Send的Leads
  const queue = useMemo(() => {
    return leads.filter(
      (l) => l.emailBody && l.emailSubject && l.status !== 'sent' && l.status !== 'replied'
    )
  }, [leads])

  // 從現在起載入
  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // 自動夾回合法範圍（用 derived value 避免 setState in effect）
  const safeIdx = Math.min(currentIdx, Math.max(0, queue.length - 1))
  const current = queue[safeIdx]

  const handleSend = async () => {
    if (!current) return
    if (!current.email) {
      toast.error('此Leads缺少收件者 email')
      onEditLead(current.id)
      return
    }
    setSending(current.id)
    const result = await sendEmail(current.id)
    setSending(null)
    if (result.success) {
      setSentQueue((q) => [...q, { lead: current, at: Date.now() }])
      setCurrentIdx((i) => Math.min(i + 1, queue.length - 1))
      toast.success(`Sent：${current.company}`, {
        description: `寄到 ${current.email}`,
      })
    } else {
      toast.error(result.error ?? 'Send failed')
    }
  }

  const handleSkip = async () => {
    if (!current) return
    await updateLead(current.id, { status: 'new', tags: `${current.tags ?? ''},skipped`.replace(/^,/, '') })
    setCurrentIdx((i) => Math.min(i + 1, queue.length - 1))
    toast.info(`已跳過：${current.company}`)
  }
  if (queue.length === 0) {
    return <EmptyState />
  }

  const progress = (safeIdx / Math.max(1, queue.length)) * 100
  const sentToday = sentQueue.length

  return (
    <div className="space-y-4">
      {/* Top bar: queue progress + today's sent */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{queue.length - safeIdx}</span>
            <span className="text-sm text-muted-foreground">/ {queue.length} Queued</span>
          </div>
          <Progress value={progress} className="mt-1 h-1.5" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs text-muted-foreground">今日Sent</p>
            <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{sentToday}</p>
          </div>
        </div>
      </div>

      {/* Card stack */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <SalesCard
              lead={current}
              rank={safeIdx + 1}
              total={queue.length}
              sending={sending === current.id}
              smtpReady={!!emailConfig?.smtpHost || !!emailConfig?.smartleadApiKey}
              onSend={handleSend}
              onSkip={handleSkip}
              onEdit={() => onEditLead(current.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently sent */}
      {sentQueue.length > 0 && (
        <div className="pt-2">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" /> 本次Send紀錄
          </p>
          <div className="space-y-1.5">
            {sentQueue.slice(-3).reverse().map((s, i) => (
              <div
                key={`${s.lead.id}-${i}`}
                className="flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/40 px-2 py-1.5"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="font-medium text-foreground truncate">{s.lead.company}</span>
                <span className="text-muted-foreground truncate">→ {s.lead.email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SalesCard({
  lead,
  rank,
  total,
  sending,
  smtpReady,
  onSend,
  onSkip,
  onEdit,
}: {
  lead: Lead
  rank: number
  total: number
  sending: boolean
  smtpReady: boolean
  onSend: () => void
  onSkip: () => void
  onEdit: () => void
}) {
  const parsedResearch = useMemo(() => {
    if (!lead.painPoints) return null
    try {
      return JSON.parse(lead.painPoints) as {
        business_summary?: string
        pain_points?: string[]
        buying_signals?: string[]
        outreach_angle?: string
      }
    } catch {
      return null
    }
  }, [lead.painPoints])

  const parsedEnriched = useMemo(() => {
    if (!lead.enrichedEmails) return null
    try {
      const data = JSON.parse(lead.enrichedEmails) as {
        decisionMakers: Array<{
          name: string
          title: string
          email?: string
          priority: number
          reason?: string
        }>
      }
      return data.decisionMakers[0] ?? null
    } catch {
      return null
    }
  }, [lead.enrichedEmails])

  const score = lead.score ?? 0
  const scoreColor =
    score >= 80
      ? 'from-emerald-500 to-teal-600'
      : score >= 60
      ? 'from-amber-500 to-orange-600'
      : score >= 40
      ? 'from-orange-400 to-rose-500'
      : 'from-slate-400 to-slate-500'

  return (
    <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 dark:shadow-black/30">
      {/* Header: gradient band with company info */}
      <div className={`relative bg-gradient-to-br ${scoreColor} p-5 text-white`}>
        <div className="absolute top-3 right-3 text-[10px] font-mono opacity-80">
          {rank} / {total}
        </div>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-xl font-bold border border-white/30">
            {lead.company.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight truncate">{lead.company}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs opacity-90">
              {lead.industry && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {lead.industry}
                </span>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <Globe className="h-3 w-3" />{' '}
                  {lead.website.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider opacity-80">Fit Score</p>
            <p className="text-3xl font-bold tabular-nums leading-none">{score}</p>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-white/10 backdrop-blur-sm p-1.5 border border-white/20">
            <p className="opacity-70 text-[10px]">Contact</p>
            <p className="font-medium truncate">{lead.contactName ?? '—'}</p>
          </div>
          <div className="rounded-md bg-white/10 backdrop-blur-sm p-1.5 border border-white/20">
            <p className="opacity-70 text-[10px]">Title</p>
            <p className="font-medium truncate">{lead.title ?? '—'}</p>
          </div>
          <div className="rounded-md bg-white/10 backdrop-blur-sm p-1.5 border border-white/20">
            <p className="opacity-70 text-[10px]">收件</p>
            <p className="font-medium truncate">{lead.email ? '✓ 已Confirm' : '未填'}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Decision maker (if enriched) */}
        {parsedEnriched && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-900">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs font-bold shrink-0">
                {parsedEnriched.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold truncate">{parsedEnriched.name}</span>
                  {parsedEnriched.priority === 1 && (
                    <Badge variant="outline" className="text-[10px] bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                      <Crown className="mr-1 h-2.5 w-2.5" /> 第一Contact
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{parsedEnriched.title}</p>
              </div>
            </div>
            {parsedEnriched.reason && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">{parsedEnriched.reason}</p>
            )}
          </div>
        )}

        {/* Pain points */}
        {parsedResearch?.pain_points && parsedResearch.pain_points.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Target className="h-3 w-3" /> Pain Points
            </p>
            <ul className="space-y-1">
              {parsedResearch.pain_points.slice(0, 3).map((p, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Email preview */}
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI 個人化Email
            </p>
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-6 px-2 text-xs">
              <Edit3 className="mr-1 h-3 w-3" /> Edit
            </Button>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">{lead.emailSubject}</p>
            <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed whitespace-pre-wrap">
              {lead.emailBody}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="lg"
            onClick={onSkip}
            disabled={sending}
            className="flex-1"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Skip
          </Button>
          <Button
            size="lg"
            onClick={onSend}
            disabled={sending || !smtpReady || !lead.email}
            className="flex-[2] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Now
              </>
            )}
          </Button>
        </div>

        {!lead.email && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-3 w-3" />
            缺少收件者 email，點「Edit」先找 Email
          </div>
        )}
        {!smtpReady && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-3 w-3" />
            尚Not configured SMTP 或 Smartlead，請先到後台「Email」Settings
          </div>
        )}
      </div>
    </Card>
  )
}

function EmptyState() {
  return (
    <Card className="p-12 border-dashed">
      <div className="text-center space-y-3">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-lg font-semibold">Inbox Clear 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">
            所有Queued的開Email都已處理完畢。
          </p>
        </div>
        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Mail className="h-3 w-3" /> 提示：可以到「Auto-Prospect」分頁讓 AI 找更多潛在客戶
          </p>
          <p className="flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3" /> VP 可以切到「數據儀表板」看Open Rate與Reply Rate
          </p>
        </div>
      </div>
    </Card>
  )
}
