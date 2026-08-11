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
  Check,
  Loader2,
  Globe,
  Building2,
  User,
  AlertCircle,
  Target,
  TrendingUp,
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

  const handleResearch = async () => {
    setResearching(true)
    const ok = await researchLead(lead.id, extraContext)
    setResearching(false)
    if (ok) toast.success('AI 研究完成！')
    else toast.error('研究失敗，請確認網站可存取')
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI 公司研究
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResearch}
                disabled={researching || !lead.website}
              >
                {researching ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    研究中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3 w-3" />
                    {parsedResearch ? '重新研究' : '啟動研究'}
                  </>
                )}
              </Button>
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
                點擊「啟動研究」讓 AI 瀏覽他們的官網並整理出痛點與切入點
              </div>
            )}
          </section>

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
