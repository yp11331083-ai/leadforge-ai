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
} from 'lucide-react'
import { useLeadStore, type Lead } from '@/store/lead-store'
import { StatusBadge, ScoreBadge } from './status-badge'
import { toast } from 'sonner'

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

  const handleResearch = async () => {
    setResearching(true)
    const ok = await researchLead(lead.id, extraContext, 'basic')
    setResearching(false)
    if (ok) toast.success('AI 研究完成！')
    else toast.error('研究失敗，請確認網站可存取')
  }

  const handleDeepResearch = async () => {
    setDeepResearching(true)
    toast.info('深度研究啟動中，AI 將同時抓取 LinkedIn / Crunchbase / 徵才頁 / 新聞，約需 30-60 秒...')
    const ok = await researchLead(lead.id, extraContext, 'deep')
    setDeepResearching(false)
    if (ok) toast.success('深度研究完成！')
    else toast.error('深度研究失敗，請稍後再試')
  }

  const handleGenerateEmail = async () => {
    setGenerating(true)
    const ok = await generateEmail(lead.id)
    setGenerating(false)
    if (ok) toast.success('冷郵件已生成！')
    else toast.error('郵件生成失敗')
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已複製${label}`)
  }

  const saveSubject = async () => {
    await updateLead(lead.id, { emailSubject: tempSubject })
    setEditingSubject(false)
    toast.success('主旨已更新')
  }

  const saveBody = async () => {
    await updateLead(lead.id, { emailBody: tempBody })
    setEditingBody(false)
    toast.success('郵件內容已更新')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <SheetTitle className="text-xl">{lead.company}</SheetTitle>
              <SheetDescription className="mt-1">
                {lead.contactName ? `${lead.contactName}` : '聯絡人未知'}
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
                <span className="text-muted-foreground">潛在客戶分數</span>
                <ScoreBadge score={lead.score} />
              </div>
            )}
          </section>

          <Separator />

          {/* AI 研究 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI 公司研究
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
                      研究中...
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
                      深度研究中...
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
                <b>基本研究</b>：只抓官網，10-15 秒。 <b>深度研究</b>：同時抓 LinkedIn / Crunchbase / 徵才頁 / 新聞，30-60 秒，輸出融資、技術堆疊、競爭對手、開放職位等 8 大維度。
              </span>
            </div>

            {!lead.website && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                需要先填寫公司網站才能啟動 AI 研究
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
                      核心業務
                    </p>
                    <p className="text-sm">{parsedResearch.business_summary}</p>
                  </div>
                )}
                {parsedHiring.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> 徵才訊號
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
                        核心痛點
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
                        採購訊號
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
                      建議切入點
                    </p>
                    <p className="text-sm italic text-emerald-700 dark:text-emerald-400">
                      {parsedResearch.outreach_angle}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                點擊「基本研究」或「深度研究」啟動 AI 分析
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
                    （多源整合：{parsedSources.length} 個來源）
                  </span>
                </h3>

                {/* 融資狀態 */}
                {parsedDeepResearch.funding && (
                  <div className="rounded-lg border border-border/60 bg-violet-50/40 dark:bg-violet-950/20 p-3">
                    <p className="text-xs font-medium text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> 融資狀態
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
                          <span className="text-muted-foreground">融資時間：</span>
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

                {/* 技術堆疊 */}
                {parsedDeepResearch.tech_stack && parsedDeepResearch.tech_stack.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Layers className="h-3 w-3" /> 技術堆疊
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

                {/* 開放職位 */}
                {parsedDeepResearch.open_roles && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" /> 開放職位（按部門）
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

                {/* 競爭對手 */}
                {parsedDeepResearch.competitors && parsedDeepResearch.competitors.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Swords className="h-3 w-3" /> 競爭對手
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

                {/* 近期新聞 */}
                {parsedDeepResearch.recent_news && parsedDeepResearch.recent_news.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Newspaper className="h-3 w-3" /> 近期新聞
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

                {/* 關鍵人物 */}
                {parsedDeepResearch.key_people && parsedDeepResearch.key_people.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Users className="h-3 w-3" /> 關鍵人物
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

                {/* 成長訊號 */}
                {parsedDeepResearch.growth_signals && parsedDeepResearch.growth_signals.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Rocket className="h-3 w-3" /> 成長訊號
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

                {/* 戰略倡議 */}
                {parsedDeepResearch.strategic_initiatives && parsedDeepResearch.strategic_initiatives.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Target className="h-3 w-3" /> 戰略倡議
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

                {/* 研究來源 */}
                {parsedSources.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                      <Link2 className="h-3 w-3" /> 研究來源（{parsedSources.length} 個）
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

          {/* 冷郵件 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-emerald-500" />
                個人化冷郵件
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
                    {lead.emailBody ? '重新生成' : 'AI 生成郵件'}
                  </>
                )}
              </Button>
            </div>

            {!parsedResearch && (
              <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                需要先完成 AI 研究才能生成個人化郵件
              </div>
            )}

            {lead.emailBody ? (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-muted-foreground">主旨</Label>
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
                        {editingSubject ? '儲存' : '編輯'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          copyToClipboard(lead.emailSubject ?? '', '主旨')
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
                    <Label className="text-xs text-muted-foreground">郵件內容</Label>
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
                        {editingBody ? '儲存' : '編輯'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(lead.emailBody ?? '', '郵件')}
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
                    <p className="text-xs text-muted-foreground mb-1">開場白（Icebreaker）</p>
                    <p className="text-xs italic text-emerald-700 dark:text-emerald-400">
                      &ldquo;{lead.icebreaker}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                點擊「AI 生成郵件」根據研究結果產出高回覆率的個人化郵件
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
