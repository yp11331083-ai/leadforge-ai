'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  Loader2,
  Globe,
  TrendingUp,
  Target,
  Lightbulb,
  Plus,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLeadStore } from '@/store/lead-store'

interface ResearchResult {
  company: string
  website: string
  websiteTitle: string
  research: {
    business_summary: string
    hiring_signals: string[]
    pain_points: string[]
    buying_signals: string[]
    outreach_angle: string
  }
  score: number
}

export function ResearchPanel() {
  const [company, setCompany] = useState('')
  const [website, setWebsite] = useState('')
  const [extraContext, setExtraContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [adding, setAdding] = useState(false)

  const createLead = useLeadStore((s) => s.createLead)
  const researchLead = useLeadStore((s) => s.researchLead)
  const fetchLeads = useLeadStore((s) => s.fetchLeads)

  const handleResearch = async () => {
    if (!website.trim()) {
      toast.error('請輸入公司網站')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      // 先建立一個暫存名單，再觸發研究，最後可選擇保留或刪除
      const lead = await createLead({
        company: company || website.replace(/^https?:\/\//, '').split('/')[0],
        website: website.startsWith('http') ? website : `https://${website}`,
      })
      if (!lead) {
        toast.error('建立名單失敗')
        setLoading(false)
        return
      }
      const ok = await researchLead(lead.id, extraContext)
      setLoading(false)
      if (ok) {
        // 拉取最新研究結果
        const res = await fetch(`/api/leads/${lead.id}`)
        const data = await res.json()
        const parsed = data.painPoints ? JSON.parse(data.painPoints) : null
        const hiring = data.hiringSignals ? JSON.parse(data.hiringSignals) : []
        setResult({
          company: data.company,
          website: data.website,
          websiteTitle: data.company,
          research: {
            business_summary: parsed?.business_summary ?? '',
            hiring_signals: hiring,
            pain_points: parsed?.pain_points ?? [],
            buying_signals: parsed?.buying_signals ?? [],
            outreach_angle: parsed?.outreach_angle ?? '',
          },
          score: data.score ?? 0,
        })
        toast.success('研究完成！結果已存入資料庫')
        await fetchLeads()
      } else {
        toast.error('研究失敗，可能是網站無法存取')
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
      toast.error('研究過程發生錯誤')
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-amber-100 dark:bg-amber-950/50 p-2">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Claygent AI 研究引擎</h2>
          <p className="text-xs text-muted-foreground">
            輸入公司網站，AI 會自動瀏覽官網並整理出痛點、徵才訊號、採購意圖
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="research-company">公司名稱（可選）</Label>
          <Input
            id="research-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="例如：Notion"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="research-website">公司網站 *</Label>
          <Input
            id="research-website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://notion.so"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) handleResearch()
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="research-context">研究指示（可選）</Label>
          <Textarea
            id="research-context"
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="例如：他們最近完成 C 輪融資，重點關注擴編痛點"
            rows={2}
            className="text-sm"
          />
        </div>
        <Button
          onClick={handleResearch}
          disabled={loading || !website.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI 正在瀏覽網站並分析...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              啟動 AI 研究
            </>
          )}
        </Button>
      </div>

      {result && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-medium truncate">{result.company}</span>
              </div>
              <Badge
                variant="outline"
                className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              >
                分數 {result.score}
              </Badge>
            </div>

            {result.research.business_summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">核心業務</p>
                <p className="text-sm">{result.research.business_summary}</p>
              </div>
            )}

            {result.research.hiring_signals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> 徵才訊號
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.research.hiring_signals.map((s, i) => (
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

            {result.research.pain_points.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> 核心痛點
                </p>
                <ul className="space-y-1.5">
                  {result.research.pain_points.map((p, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.research.buying_signals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Target className="h-3 w-3" /> 採購訊號
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.research.buying_signals.map((s, i) => (
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

            {result.research.outreach_angle && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3 border border-emerald-200 dark:border-emerald-900">
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> 建議切入點
                </p>
                <p className="text-sm italic">{result.research.outreach_angle}</p>
              </div>
            )}

            <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Plus className="h-3 w-3" />
              此名單已自動加入資料庫，可在「名單試算表」分頁查看與生成郵件
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
