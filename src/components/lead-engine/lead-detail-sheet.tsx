'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Mail,
  Copy,
  Loader2,
  Globe,
  Building2,
  User,
  AlertCircle,
  Target,
  TrendingUp,
  Layers,
  Swords,
  Newspaper,
  Users,
  Rocket,
  Briefcase,
  DollarSign,
  Link2,
  Database,
  Zap,
  Send,
  Server,
  CheckCircle2,
  Crown,
  Search,
} from 'lucide-react'
import { useLeadStore, type Lead } from '@/store/lead-store'
import { StatusBadge, ScoreBadge } from './status-badge'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LeadDetailSheetProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const researchLead = useLeadStore((s) => s.researchLead)
  const generateEmail = useLeadStore((s) => s.generateEmail)
  const updateLead = useLeadStore((s) => s.updateLead)

  const [researching, setResearching] = useState(false)
  const [deepResearching, setDeepResearching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [extraContext, setExtraContext] = useState('')
  const [editingSubject, setEditingSubject] = useState(false)
  const [editingBody, setEditingBody] = useState(false)
  const [tempSubject, setTempSubject] = useState('')
  const [tempBody, setTempBody] = useState('')

  const sendEmail = useLeadStore((s) => s.sendEmail)
  const pushToSmartlead = useLeadStore((s) => s.pushToSmartlead)
  const emailConfig = useLeadStore((s) => s.emailConfig)
  const smartleadCampaigns = useLeadStore((s) => s.smartleadCampaigns)
  const fetchSmartleadCampaigns = useLeadStore((s) => s.fetchSmartleadCampaigns)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const enrichEmail = useLeadStore((s) => s.enrichEmail)

  const [sendingEmail, setSendingEmail] = useState(false)
  const [pushingSmartlead, setPushingSmartlead] = useState(false)
  const [smartleadDialogOpen, setSmartleadDialogOpen] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [enrichingEmail, setEnrichingEmail] = useState(false)

  if (!lead) return null

  const parsedResearch = (() => {
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
  })()

  const parsedHiring = (() => {
    if (!lead.hiringSignals) return []
    try {
      return JSON.parse(lead.hiringSignals) as string[]
    } catch {
      return []
    }
  })()

  const parsedDeepResearch = (() => {
    if (!lead.deepResearch) return null
    try {
      return JSON.parse(lead.deepResearch) as {
        funding?: {
          last_round?: string
          total_raised?: string
          valuation?: string
          lead_investors?: string[]
          last_funding_date?: string
        }
        tech_stack?: string[]
        competitors?: Array<{ name: string; differentiation?: string }>
        recent_news?: Array<{ title: string; source?: string; date?: string; summary?: string }>
        open_roles?: {
          sales?: string[]
          engineering?: string[]
          product?: string[]
          marketing?: string[]
          other?: string[]
        }
        key_people?: Array<{ name: string; title: string; linkedin?: string }>
        growth_signals?: string[]
        strategic_initiatives?: string[]
      }
    } catch {
      return null
    }
  })()

  const parsedSources = (() => {
    if (!lead.researchSources) return []
    try {
      return JSON.parse(lead.researchSources) as Array<{
        url: string
        title: string
        type: string
        fetched: boolean
        content_length: number
      }>
    } catch {
      return []
    }
  })()

  const parsedEnrichedEmails = (() => {
    if (!lead.enrichedEmails) return null
    try {
      return JSON.parse(lead.enrichedEmails) as {
        decisionMakers: Array<{
          name: string
          title: string
          seniority: string
          email?: string
          emailAlternates?: string[]
          linkedin?: string
          confidence: string
          email_source: string
          priority: number
          reason?: string
        }>
        companyEmailPattern?: string
        totalFound: number
        hasEmailCount: number
      }
    } catch {
      return null
    }
  })()

  const handleResearch = async () => {
    setResearching(true)
    const ok = await researchLead(lead.id, extraContext, 'basic')
    setResearching(false)
    if (ok) toast.success('AI ResearchComplete！')
    else toast.error('研究Failed，請Confirm網站可存取')
  }

  const handleDeepResearch = async () => {
    setDeepResearching(true)
    toast.info('深度研究Start中，AI 將同時抓取 LinkedIn / Crunchbase / 徵才頁 / 新聞，約需 30-60 秒...')
    const ok = await researchLead(lead.id, extraContext, 'deep')
    setDeepResearching(false)
    if (ok) toast.success('深度研究Complete！')
    else toast.error('深度研究Failed，請稍後再試')
  }

  const handleGenerateEmail = async () => {
    setGenerating(true)
    const ok = await generateEmail(lead.id)
    setGenerating(false)
    if (ok) toast.success('冷EmailGenerated！')
    else toast.error('Email生成Failed')
  }

  const handleSendEmail = async () => {
    if (!lead.email) {
      toast.error('此Leads缺少收件者 email')
      return
    }
    if (!confirm(`Confirm要透過 SMTP 直接Email到 ${lead.email}？\n\nSubject：${lead.emailSubject}`)) {
      return
    }
    setSendingEmail(true)
    const result = await sendEmail(lead.id)
    setSendingEmail(false)
    if (result.success) toast.success(`SentEmail到 ${lead.email}`)
    else toast.error(result.error ?? 'Send failed')
  }

  const handleOpenSmartleadDialog = async () => {
    await fetchEmailConfig()
    await fetchSmartleadCampaigns()
    setSmartleadDialogOpen(true)
  }

  const handlePushToSmartlead = async () => {
    if (!selectedCampaignId) {
      toast.error('請先選擇一個 Smartlead 行銷活動')
      return
    }
    setPushingSmartlead(true)
    const result = await pushToSmartlead(lead.id, selectedCampaignId)
    setPushingSmartlead(false)
    if (result.success) {
      toast.success(`已Push到 Smartlead Campaign #${selectedCampaignId}`)
      setSmartleadDialogOpen(false)
    } else {
      toast.error(result.error ?? 'PushFailed')
    }
  }

  const handleEnrichEmail = async () => {
    if (!lead.website) {
      toast.error('此Leads缺少網址，無法萃取網域')
      return
    }
    setEnrichingEmail(true)
    toast.info('正在SearchDecision Maker email，約 30-60 秒...')
    const result = await enrichEmail(lead.id)
    setEnrichingEmail(false)
    if (result.success) {
      const count = result.result?.hasEmailCount ?? 0
      toast.success(`找到 ${result.result?.totalFound ?? 0} 位Decision Maker，其中 ${count} 位有 email`)
    } else {
      toast.error(result.error ?? 'Email enrichment Failed')
    }
  }

  const handleUseDecisionMakerEmail = async (dm: {
    name: string
    title: string
    email?: string
  }) => {
    if (!dm.email) {
      toast.error('此人沒有 email')
      return
    }
    await updateLead(lead.id, {
      email: dm.email,
      contactName: dm.name,
      title: dm.title,
    })
    toast.success(`已設為收件者：${dm.name} <${dm.email}>`)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已Copy${label}`)
  }

  const saveSubject = async () => {
    await updateLead(lead.id, { emailSubject: tempSubject })
    setEditingSubject(false)
    toast.success('Subject已更新')
  }

  const saveBody = async () => {
    await updateLead(lead.id, { emailBody: tempBody })
    setEditingBody(false)
    toast.success('Email內容已更新')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <SheetTitle className="text-xl">{lead.company}</SheetTitle>
              <SheetDescription className="mt-1">
                {lead.contactName ? `${lead.contactName}` : 'ContactUnknown'}
                {lead.title ? ` · ${lead.title}` : ''}
              </SheetDescription>
            </div>
            <StatusBadge status={lead.status} />
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* 基本資訊 */}
          <section className="grid grid-cols-2 gap-3 text-sm">
            {lead.website && (
              <div className="flex items-center gap-2 col-span-2">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline truncate"
                >
                  {lead.website}
                </a>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.industry && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{lead.industry}</span>
              </div>
            )}
            {lead.companySize && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{lead.companySize} 人</span>
              </div>
            )}
            {lead.score != null && (
              <div className="flex items-center gap-2 col-span-2">
                <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">潛在客戶Score</span>
                <ScoreBadge score={lead.score} />
              </div>
            )}
          </section>

          <Separator />

          {/* AI Research */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Company研究
                {lead.researchMode === 'deep' && (
                  <Badge variant="outline" className="ml-1 text-[10px] bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300">
                    <Database className="mr-0.5 h-2.5 w-2.5" />
                    深度研究
                  </Badge>
                )}
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResearch}
                  disabled={researching || deepResearching || !lead.website}
                >
                  {researching ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Researching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1 h-3 w-3" />
                      基本研究
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeepResearch}
                  disabled={researching || deepResearching || !lead.website}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                >
                  {deepResearching ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      深度Researching...
                    </>
                  ) : (
                    <>
                      <Database className="mr-1 h-3 w-3" />
                      深度研究
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2 flex items-start gap-1.5">
              <Zap className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <b>基本研究</b>：只抓官網，10-15 秒。 <b>深度研究</b>：同時抓 LinkedIn / Crunchbase / 徵才頁 / 新聞，30-60 秒，輸出融資、Tech Stack、Competitors、Open Roles等 8 大維度。
              </span>
            </div>

            {!lead.website && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                需要先填寫Company網站才能Start AI Research
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                額外研究指示（可選）
              </Label>
              <Input
                value={extraContext}
                onChange={(e) => setExtraContext(e.target.value)}
                placeholder="例如：他們最近在招募 AE，重點關注銷售流程痛點"
                className="text-xs"
              />
            </div>

            {parsedResearch ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                {parsedResearch.business_summary && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Business Summary
                    </p>
                    <p className="text-sm">{parsedResearch.business_summary}</p>
                  </div>
                )}
                {parsedHiring.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Hiring Signals
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedHiring.map((s, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {parsedResearch.pain_points &&
                  parsedResearch.pain_points.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Pain Points
                      </p>
                      <ul className="space-y-1.5">
                        {parsedResearch.pain_points.map((p, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {parsedResearch.buying_signals &&
                  parsedResearch.buying_signals.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Buying Signals
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedResearch.buying_signals.map((s, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                {parsedResearch.outreach_angle && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Suggested Angle
                    </p>
                    <p className="text-sm italic text-emerald-700 dark:text-emerald-400">
                      {parsedResearch.outreach_angle}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Click「基本研究」或「深度研究」Start AI 分析
              </div>
            )}
          </section>

          {/* 深度研究結果 */}
          {parsedDeepResearch && (
            <>
              <Separator />
              <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Database className="h-4 w-4 text-violet-500" />
                  深度研究情報
                  <span className="text-[10px] font-normal text-muted-foreground">
                    （多源整合：{parsedSources.length} 個Source）
                  </span>
                </h3>

                {/* 融資Status */}
                {parsedDeepResearch.funding && (
                  <div className="rounded-lg border border-border/60 bg-violet-50/40 dark:bg-violet-950/20 p-3">
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> 融資Status
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {parsedDeepResearch.funding.last_round && (
                        <div>
                          <span className="text-muted-foreground">最近一輪：</span>
                          <span className="font-medium">{parsedDeepResearch.funding.last_round}</span>
                        </div>
                      )}
                      {parsedDeepResearch.funding.total_raised && (
                        <div>
                          <span className="text-muted-foreground">總募集：</span>
                          <span className="font-medium">{parsedDeepResearch.funding.total_raised}</span>
                        </div>
                      )}
                      {parsedDeepResearch.funding.valuation && (
                        <div>
                          <span className="text-muted-foreground">估值：</span>
                          <span className="font-medium">{parsedDeepResearch.funding.valuation}</span>
                        </div>
                      )}
                      {parsedDeepResearch.funding.last_funding_date && (
                        <div>
                          <span className="text-muted-foreground">融資Time：</span>
                          <span className="font-medium">{parsedDeepResearch.funding.last_funding_date}</span>
                        </div>
                      )}
                      {parsedDeepResearch.funding.lead_investors &&
                        parsedDeepResearch.funding.lead_investors.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">主要投資人：</span>
                            <span className="font-medium">
                              {parsedDeepResearch.funding.lead_investors.join('、')}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Tech Stack */}
                {parsedDeepResearch.tech_stack && parsedDeepResearch.tech_stack.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Tech Stack
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedDeepResearch.tech_stack.map((tech, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono"
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Roles */}
                {parsedDeepResearch.open_roles && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> Open Roles（By Department）
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { label: '業務 Sales', roles: parsedDeepResearch.open_roles.sales, color: 'emerald' },
                        { label: '工程 Engineering', roles: parsedDeepResearch.open_roles.engineering, color: 'blue' },
                        { label: '產品 Product', roles: parsedDeepResearch.open_roles.product, color: 'purple' },
                        { label: '行銷 Marketing', roles: parsedDeepResearch.open_roles.marketing, color: 'pink' },
                      ].map(({ label, roles }) =>
                        roles && roles.length > 0 ? (
                          <div key={label} className="rounded-md bg-muted/40 p-2">
                            <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
                            <div className="flex flex-wrap gap-1">
                              {roles.map((r, i) => (
                                <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border/60">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {/* Competitors */}
                {parsedDeepResearch.competitors && parsedDeepResearch.competitors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Swords className="h-3 w-3" /> Competitors
                    </p>
                    <ul className="space-y-1.5">
                      {parsedDeepResearch.competitors.map((c, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-orange-500 font-bold">▸</span>
                          <div>
                            <span className="font-medium">{c.name}</span>
                            {c.differentiation && (
                              <span className="text-muted-foreground"> — {c.differentiation}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recent News */}
                {parsedDeepResearch.recent_news && parsedDeepResearch.recent_news.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Newspaper className="h-3 w-3" /> Recent News
                    </p>
                    <ul className="space-y-2">
                      {parsedDeepResearch.recent_news.map((n, i) => (
                        <li key={i} className="text-sm border-l-2 border-cyan-400 pl-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{n.title}</span>
                            {n.date && (
                              <span className="text-[10px] text-muted-foreground">{n.date}</span>
                            )}
                            {n.source && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300">
                                {n.source}
                              </span>
                            )}
                          </div>
                          {n.summary && (
                            <p className="text-xs text-muted-foreground mt-0.5">{n.summary}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key People */}
                {parsedDeepResearch.key_people && parsedDeepResearch.key_people.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" /> Key People
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {parsedDeepResearch.key_people.map((p, i) => (
                        <div key={i} className="text-xs flex items-center gap-2 rounded-md bg-muted/40 p-2">
                          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                            {p.name?.charAt(0) ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-muted-foreground truncate">{p.title}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Growth Signals */}
                {parsedDeepResearch.growth_signals && parsedDeepResearch.growth_signals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Rocket className="h-3 w-3" /> Growth Signals
                    </p>
                    <ul className="space-y-1.5">
                      {parsedDeepResearch.growth_signals.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-emerald-500 font-bold">↑</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strategic Initiatives */}
                {parsedDeepResearch.strategic_initiatives && parsedDeepResearch.strategic_initiatives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Target className="h-3 w-3" /> Strategic Initiatives
                    </p>
                    <ul className="space-y-1.5">
                      {parsedDeepResearch.strategic_initiatives.map((s, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-violet-500 font-bold">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 研究Source */}
                {parsedSources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> 研究Source（{parsedSources.length} 個）
                    </p>
                    <ul className="space-y-1">
                      {parsedSources.map((s, i) => (
                        <li key={i} className="text-[11px] flex items-center gap-1.5">
                          <span
                            className={`inline-block h-1.5 w-1.5 rounded-full ${
                              s.fetched ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                          />
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[400px]"
                          >
                            {s.url}
                          </a>
                          <span className="text-muted-foreground text-[10px]">{s.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </>
          )}

          <Separator />

          {/* Email Enrichment */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Crown className="h-4 w-4 text-amber-500" />
                Decision Maker Email
                {parsedEnrichedEmails && (
                  <Badge variant="outline" className="ml-1 text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                    {parsedEnrichedEmails.hasEmailCount} / {parsedEnrichedEmails.totalFound} 有 email
                  </Badge>
                )}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrichEmail}
                disabled={enrichingEmail || !lead.website}
              >
                {enrichingEmail ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    找 Email 中...
                  </>
                ) : (
                  <>
                    <Search className="mr-1 h-3 w-3" />
                    {parsedEnrichedEmails ? '重新找 Email' : '找出Decision Maker Email'}
                  </>
                )}
              </Button>
            </div>

            {!lead.website && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                需要有Company網址才能找Decision Maker email
              </div>
            )}

            {parsedEnrichedEmails && parsedEnrichedEmails.decisionMakers.length > 0 ? (
              <div className="space-y-2">
                {parsedEnrichedEmails.decisionMakers.map((dm, i) => {
                  const isTop = i === 0
                  const confidenceColor =
                    dm.confidence === 'high'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                      : dm.confidence === 'medium'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'

                  const sourceLabel =
                    dm.email_source === 'hunter' ? 'Apollo 驗證' :
                    dm.email_source === 'ai_predicted' ? 'AI 預測' :
                    dm.email_source === 'web_search' ? '網路Search' :
                    dm.email_source === 'website' ? '官網/來源驗證' : 'Unknown'

                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 ${
                        isTop
                          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'border-border/60 bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isTop && (
                              <Badge variant="outline" className="text-[10px] bg-amber-100 dark:bg-amber-950/60 border-amber-400 dark:border-amber-700 text-amber-800 dark:text-amber-300">
                                <Crown className="mr-1 h-2.5 w-2.5" />
                                第一優先
                              </Badge>
                            )}
                            <span className="text-sm font-semibold truncate">{dm.name}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {dm.title}
                            </Badge>
                          </div>
                          {dm.reason && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{dm.reason}</p>
                          )}
                          {dm.email && (
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <a
                                href={`mailto:${dm.email}`}
                                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-mono"
                              >
                                {dm.email}
                              </a>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${confidenceColor}`}
                              >
                                {sourceLabel} · {dm.confidence}
                              </Badge>
                            </div>
                          )}
                          {dm.emailAlternates && dm.emailAlternates.length > 0 && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">其他格式：</span>
                              {dm.emailAlternates.map((alt) => (
                                <button
                                  key={alt}
                                  onClick={() => handleUseDecisionMakerEmail({ ...dm, email: alt })}
                                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline font-mono border border-border/60 rounded px-1.5 py-0.5 bg-background/60"
                                  title="設為收件者"
                                >
                                  {alt}
                                </button>
                              ))}
                            </div>
                          )}
                          {dm.linkedin && (
                            <a
                              href={dm.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline block mt-1 truncate max-w-[400px]"
                            >
                              LinkedIn: {dm.linkedin.replace(/^[^/]+\/\/[^/]+\//, '')}
                            </a>
                          )}
                        </div>
                        {dm.email && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => copyToClipboard(dm.email!, 'email')}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            {lead.email !== dm.email && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleUseDecisionMakerEmail(dm)}
                              >
                                設為收件者
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {parsedEnrichedEmails.companyEmailPattern && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Company email 網域：{parsedEnrichedEmails.companyEmailPattern}
                  </p>
                )}

                {!emailConfig?.hunterApiKey && (
                  <div className="rounded-md bg-cyan-50 dark:bg-cyan-950/30 p-2 text-[11px] text-cyan-700 dark:text-cyan-300 flex items-start gap-1.5">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      目前用 <b>AI 預測模式</b>（信心度 medium）。Settings Apollo API Key 後，可取得已驗證的真實 email。
                    </span>
                  </div>
                )}
              </div>
            ) : parsedEnrichedEmails ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                未找到Decision Maker。可能是Company太小或 LinkedIn 上沒有公開資訊。建議手動到 LinkedIn Search。
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Click「找出Decision Maker Email」讓 AI 找出 VP Sales / Director / CEO / Founder 的 email
              </div>
            )}
          </section>

          <Separator />

          {/* 冷Email */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-emerald-500" />
                個人化冷Email
              </h3>
              <Button
                size="sm"
                onClick={handleGenerateEmail}
                disabled={generating || !parsedResearch}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3 w-3" />
                    {lead.emailBody ? 'Regenerate' : 'AI 生成Email'}
                  </>
                )}
              </Button>
            </div>

            {!parsedResearch && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                需要先Complete AI Research才能生成個人化Email
              </div>
            )}

            {lead.emailBody ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          if (editingSubject) {
                            saveSubject()
                          } else {
                            setTempSubject(lead.emailSubject ?? '')
                            setEditingSubject(true)
                          }
                        }}
                      >
                        {editingSubject ? 'Save' : 'Edit'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          copyToClipboard(lead.emailSubject ?? '', 'Subject')
                        }
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {editingSubject ? (
                    <Input
                      value={tempSubject}
                      onChange={(e) => setTempSubject(e.target.value)}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium">{lead.emailSubject}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">Email內容</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          if (editingBody) {
                            saveBody()
                          } else {
                            setTempBody(lead.emailBody ?? '')
                            setEditingBody(true)
                          }
                        }}
                      >
                        {editingBody ? 'Save' : 'Edit'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(lead.emailBody ?? '', 'Email')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {editingBody ? (
                    <Textarea
                      value={tempBody}
                      onChange={(e) => setTempBody(e.target.value)}
                      rows={10}
                      className="text-sm"
                    />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {lead.emailBody}
                    </div>
                  )}
                </div>

                {lead.icebreaker && (
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-1">Icebreaker（Icebreaker）</p>
                    <p className="text-xs italic text-emerald-700 dark:text-emerald-400">
                      &ldquo;{lead.icebreaker}&rdquo;
                    </p>
                  </div>
                )}

                {/* EmailActions區 */}
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">SendEmail</p>

                  {/* SMTP Email */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSendEmail}
                      disabled={
                        sendingEmail ||
                        pushingSmartlead ||
                        !lead.email ||
                        !lead.emailBody ||
                        !emailConfig?.smtpHost
                      }
                      className="flex-1 justify-start"
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Server className="mr-2 h-3.5 w-3.5" />
                          SMTP 直接Email
                        </>
                      )}
                    </Button>
                    {emailConfig?.smtpHost ? (
                      <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        SMTP Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                        Not configured
                      </Badge>
                    )}
                  </div>

                  {/* Smartlead Push */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleOpenSmartleadDialog}
                      disabled={
                        sendingEmail ||
                        pushingSmartlead ||
                        !lead.email ||
                        !lead.emailBody ||
                        !emailConfig?.smartleadApiKey
                      }
                      className="flex-1 justify-start bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                    >
                      <Rocket className="mr-2 h-3.5 w-3.5" />
                      Push到 Smartlead
                    </Button>
                    {emailConfig?.smartleadApiKey ? (
                      <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        已連接
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                        未連接
                      </Badge>
                    )}
                  </div>

                  {!lead.email && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle className="h-3 w-3" />
                      此Leads缺少收件者 email，無法Email
                    </div>
                  )}

                  {!emailConfig?.smtpHost && !emailConfig?.smartleadApiKey && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle className="h-3 w-3" />
                      尚Not configuredEmail方式，請至「EmailSettings」分頁Settings SMTP 或 Smartlead
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Click「AI 生成Email」根據研究結果產出高Reply Rate的個人化Email
              </div>
            )}
          </section>
        </div>
      </SheetContent>

      {/* Smartlead Push對話框 */}
      <Dialog open={smartleadDialogOpen} onOpenChange={setSmartleadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-violet-600" />
              Push到 Smartlead
            </DialogTitle>
            <DialogDescription>
              選擇要Push到的 Smartlead 行銷活動。AI 生成的EmailSubject與內容會作為序章首emailsEmail。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">收件者</span>
                <span className="font-medium">{lead.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subject</span>
                <span className="font-medium truncate max-w-[300px]">{lead.emailSubject}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium mb-2 block">選擇 Smartlead 行銷活動</Label>
              {smartleadCampaigns.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  你的 Smartlead Username中沒有任何行銷活動。請先至 Smartlead 後台建立。
                </div>
              ) : (
                <ScrollArea className="h-64 rounded-md border border-border/60">
                  <div className="p-2 space-y-1">
                    {smartleadCampaigns.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCampaignId(c.id)}
                        className={`w-full text-left p-2 rounded-md transition-colors ${
                          selectedCampaignId === c.id
                            ? 'bg-violet-100 dark:bg-violet-950/40 border border-violet-400'
                            : 'bg-background hover:bg-muted/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              ID: {c.id}
                              {c.status && ` · ${c.status}`}
                              {c.leadsCount != null && ` · ${c.leadsCount} Leads`}
                              {c.sequenceSteps != null && ` · ${c.sequenceSteps} 步驟`}
                            </p>
                          </div>
                          {selectedCampaignId === c.id && (
                            <CheckCircle2 className="h-4 w-4 text-violet-600 shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSmartleadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePushToSmartlead}
              disabled={pushingSmartlead || !selectedCampaignId || smartleadCampaigns.length === 0}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              {pushingSmartlead ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Push中...
                </>
              ) : (
                <>
                  <Send className="mr-1 h-3.5 w-3.5" />
                  ConfirmPush
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
