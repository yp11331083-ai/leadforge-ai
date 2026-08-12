'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Rocket,
  Loader2,
  Search,
  Target,
  Sparkles,
  Plus,
  CheckCircle2,
  ExternalLink,
  TrendingUp,
  Lightbulb,
  ListChecks,
  Wand2,
  Clock,
  XCircle,
  Zap,
} from 'lucide-react'
import { useLeadStore, type ProspectCandidate } from '@/store/lead-store'
import { toast } from 'sonner'

const EMPTY_FORM = {
  serviceName: '',
  description: '',
  targetIndustries: '',
  targetCompanySize: '',
  targetLocation: '',
  keyBenefits: '',
  idealCustomerSignals: '',
  targetCount: '10',
}

export function AutoProspectPanel() {
  const serviceOffering = useLeadStore((s) => s.serviceOffering)
  const fetchServiceOffering = useLeadStore((s) => s.fetchServiceOffering)
  const saveServiceOffering = useLeadStore((s) => s.saveServiceOffering)
  const runAutoProspect = useLeadStore((s) => s.runAutoProspect)
  const prospectResult = useLeadStore((s) => s.prospectResult)
  const prospectLoading = useLeadStore((s) => s.prospectLoading)
  const prospectStage = useLeadStore((s) => s.prospectStage)
  const prospectDetail = useLeadStore((s) => s.prospectDetail)
  const prospectStep = useLeadStore((s) => s.prospectStep)
  const prospectElapsedSeconds = useLeadStore((s) => s.prospectElapsedSeconds)
  const prospectError = useLeadStore((s) => s.prospectError)
  const rateLimitedAt = useLeadStore((s) => s.rateLimitedAt)
  const createLead = useLeadStore((s) => s.createLead)
  const fetchLeads = useLeadStore((s) => s.fetchLeads)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    fetchServiceOffering()
  }, [fetchServiceOffering])

  // 同步 DB 設定到表單
  const configKey = serviceOffering?.updatedAt ?? ''
  if (serviceOffering && configKey !== lastSyncedAt) {
    setLastSyncedAt(configKey)
    setForm({
      serviceName: serviceOffering.serviceName ?? '',
      description: serviceOffering.description ?? '',
      targetIndustries: serviceOffering.targetIndustries ?? '',
      targetCompanySize: serviceOffering.targetCompanySize ?? '',
      targetLocation: serviceOffering.targetLocation ?? '',
      keyBenefits: serviceOffering.keyBenefits ?? '',
      idealCustomerSignals: serviceOffering.idealCustomerSignals ?? '',
      targetCount: '10',
    })
  }

  const handleSave = async () => {
    if (!form.serviceName.trim() || !form.description.trim()) {
      toast.error('服務名稱與描述為必填')
      return
    }
    setSaving(true)
    await saveServiceOffering(form)
    setSaving(false)
    toast.success('服務設定已儲存')
  }

  const handleRun = async () => {
    if (!form.serviceName.trim() || !form.description.trim()) {
      toast.error('請先填寫服務名稱與描述')
      return
    }
    // 先儲存再執行
    await saveServiceOffering(form)
    setAddedIds(new Set())
    toast.info('AI 自動開發啟動中，預計 2-4 分鐘...')
    const result = await runAutoProspect({
      serviceName: form.serviceName,
      description: form.description,
      targetIndustries: form.targetIndustries || undefined,
      targetCompanySize: form.targetCompanySize || undefined,
      targetLocation: form.targetLocation || undefined,
      keyBenefits: form.keyBenefits || undefined,
      idealCustomerSignals: form.idealCustomerSignals || undefined,
      targetCount: Number(form.targetCount) || 10,
      saveToDb: false,
    })
    if (result.success) {
      toast.success(`找到 ${prospectResult?.candidates.length ?? 0} 家潛在客戶！`)
    } else {
      toast.error(result.error ?? '自動開發失敗')
    }
  }

  const handleAddOne = async (c: ProspectCandidate) => {
    const lead = await createLead({
      company: c.company,
      website: c.website,
      industry: c.industry,
      status: 'new',
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
    })
    if (lead) {
      setAddedIds((s) => new Set([...s, c.website]))
      toast.success(`已加入：${c.company}`)
      await fetchLeads()
    }
  }

  const handleAddAll = async () => {
    if (!prospectResult) return
    const toAdd = prospectResult.candidates.filter((c) => !addedIds.has(c.website))
    if (toAdd.length === 0) {
      toast.info('已全部加入')
      return
    }
    toast.info(`正在加入 ${toAdd.length} 家公司...`)
    for (const c of toAdd) {
      await handleAddOne(c)
    }
    toast.success('全部加入完成！')
  }

  return (
    <div className="space-y-5">
      {/* 服務設定 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 p-2 shadow-md">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold">AI 自動開發引擎</h2>
            <p className="text-xs text-muted-foreground">
              輸入你的服務，AI 自動找出 10 家最需要你服務的企業
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="service-name">服務/產品名稱 *</Label>
            <Input
              id="service-name"
              value={form.serviceName}
              onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
              placeholder="例如：AI 銷售開發自動化平台"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-desc">服務描述 *</Label>
            <Textarea
              id="service-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="詳細說明你的服務做什麼、解決什麼問題、目標客戶是誰。AI 會根據這段描述設計搜尋策略。"
              rows={4}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              描述越具體，AI 找出的名單越精準。建議包含：核心功能、解決的痛點、與競品的差異。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target-industries">目標產業</Label>
              <Input
                id="target-industries"
                value={form.targetIndustries}
                onChange={(e) => setForm((f) => ({ ...f, targetIndustries: e.target.value }))}
                placeholder="SaaS, 電商, 製造"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-size">目標公司規模</Label>
              <Input
                id="target-size"
                value={form.targetCompanySize}
                onChange={(e) => setForm((f) => ({ ...f, targetCompanySize: e.target.value }))}
                placeholder="50-500 人"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-location">目標地區</Label>
              <Input
                id="target-location"
                value={form.targetLocation}
                onChange={(e) => setForm((f) => ({ ...f, targetLocation: e.target.value }))}
                placeholder="美國 / 台灣 / 全球"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key-benefits">核心價值主張</Label>
            <Input
              id="key-benefits"
              value={form.keyBenefits}
              onChange={(e) => setForm((f) => ({ ...f, keyBenefits: e.target.value }))}
              placeholder="幫客戶省 80% 業務研究時間、提升 3 倍回覆率"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ideal-signals">理想客戶訊號（可選）</Label>
            <Textarea
              id="ideal-signals"
              value={form.idealCustomerSignals}
              onChange={(e) => setForm((f) => ({ ...f, idealCustomerSignals: e.target.value }))}
              placeholder="舉例：正在招募 SDR、剛融資 Series A、使用 Salesforce、有國際拓展計畫..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-count">想找幾家</Label>
            <Input
              id="target-count"
              type="number"
              min="3"
              max="20"
              value={form.targetCount}
              onChange={(e) => setForm((f) => ({ ...f, targetCount: e.target.value }))}
              className="w-32"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} variant="outline" size="sm">
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              儲存設定
            </Button>
            <Button
              onClick={handleRun}
              disabled={prospectLoading || !form.serviceName.trim() || !form.description.trim()}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              {prospectLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI 開發中...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  啟動 AI 自動開發
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* 進度面板 */}
      {prospectLoading && (
        <Card className="p-5 border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20">
          <div className="space-y-4">
            {/* Header: 旋轉圖示 + 當前階段 + 計時 */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
                    {prospectStage}
                  </p>
                  <p className="text-xs text-violet-700 dark:text-violet-400/70">
                    {prospectDetail || '執行中...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-violet-700 dark:text-violet-400">
                <Clock className="h-3 w-3" />
                <span className="tabular-nums">
                  {Math.floor(prospectElapsedSeconds / 60)}:
                  {(prospectElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* 進度條 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-violet-700 dark:text-violet-400">
                <span>步驟 {prospectStep} / 6</span>
                <span>{Math.round((prospectStep / 6) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-950/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                  style={{ width: `${(prospectStep / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* 6 步驟清單 */}
            <div className="space-y-1.5">
              {[
                { n: 1, label: '生成搜尋策略', desc: 'AI 設計 8 組精準查詢', icon: Wand2 },
                { n: 2, label: '搜尋候選公司', desc: 'Google 搜尋 ~40 個結果', icon: Search },
                { n: 3, label: '篩選公司網址', desc: '過濾並萃取公司網站', icon: ListChecks },
                { n: 4, label: '抓取網站內容', desc: 'page_reader 抓取每家官網', icon: Zap },
                { n: 5, label: 'AI 評估契合度', desc: '5 維度評分，輸出 fit_score', icon: Target },
                { n: 6, label: '排序回傳', desc: '依分數排序，取 Top N', icon: Sparkles },
              ].map(({ n, label, desc, icon: Icon }) => {
                const done = prospectStep > n
                const current = prospectStep === n
                return (
                  <div
                    key={n}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-all ${
                      current
                        ? 'bg-violet-100 dark:bg-violet-950/60 border border-violet-300 dark:border-violet-700'
                        : done
                        ? 'opacity-50'
                        : 'opacity-30'
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : current
                          ? 'bg-violet-500 text-white animate-pulse'
                          : 'bg-slate-200 dark:bg-slate-800 text-muted-foreground'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : current ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-medium ${current ? 'text-violet-800 dark:text-violet-300' : ''}`}>
                        {n}. {label}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-[10px] text-violet-700/70 dark:text-violet-400/60 text-center">
              預計 2-4 分鐘完成 · 視目標數量與網路速度而定 · 可以切到其他分頁做別的事
            </p>
          </div>
        </Card>
      )}

      {/* 失敗顯示 */}
      {!prospectLoading && prospectError && (
        <Card className={`p-5 ${
          rateLimitedAt
            ? 'border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30'
            : 'border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
        }`}>
          <div className="flex items-start gap-3">
            {rateLimitedAt ? (
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <p className={`text-sm font-semibold ${
                rateLimitedAt
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-rose-800 dark:text-rose-300'
              }`}>
                {prospectStage}
              </p>
              <p className={`text-xs ${
                rateLimitedAt
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}>
                {prospectDetail}
              </p>

              {rateLimitedAt && (
                <div className="space-y-2 mt-3">
                  <div className="rounded-md bg-amber-100 dark:bg-amber-950/60 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-medium">⏳ 預估恢復時間</p>
                    <ul className="ml-3 list-disc space-y-0.5 text-amber-700 dark:text-amber-400">
                      <li>短期限流：等 5-30 分鐘</li>
                      <li>每日配額：等到明天 UTC 0:00（台灣時間早上 8:00）</li>
                      <li>目前無法精確預測，建議 1-2 小時後再試一次</li>
                    </ul>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <p className="font-medium">✅ 不受影響的功能</p>
                    <p className="mt-0.5">已儲存的名單、研究結果、AI 生成的郵件、發信設定都不受影響。你可以繼續編輯、複製郵件、發信。</p>
                  </div>
                </div>
              )}

              {!rateLimitedAt && (
                <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-2">
                  建議：減少目標數量、簡化服務描述、或稍後再試。
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 結果 */}
      {prospectResult && !prospectLoading && (
        <>
          {/* 統計與動作 */}
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    找到 {prospectResult.candidates.length} 家潛在客戶
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    從 {prospectResult.total_discovered} 家候選中評估 {prospectResult.evaluated} 家篩出
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAddAll}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                全部加入名單
              </Button>
            </div>
          </Card>

          {/* 候選名單卡片 */}
          <div className="space-y-3">
            {prospectResult.candidates.map((c, i) => (
              <ProspectCard
                key={`${c.website}-${i}`}
                candidate={c}
                rank={i + 1}
                added={addedIds.has(c.website)}
                onAdd={() => handleAddOne(c)}
              />
            ))}
          </div>

          {/* AI 搜尋策略透明化 */}
          <Card className="p-4">
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                AI 生成的搜尋策略（{prospectResult.ai_search_queries.length} 組查詢）
              </summary>
              <ul className="mt-3 space-y-1">
                {prospectResult.ai_search_queries.map((q, i) => (
                  <li key={i} className="text-[11px] font-mono text-muted-foreground">
                    <span className="text-violet-500">▸</span> {q}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        </>
      )}

      {/* 空狀態 */}
      {!prospectResult && !prospectLoading && (
        <Card className="p-8 border-dashed border-violet-200 dark:border-violet-800">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
              <Search className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium">輸入你的服務，讓 AI 幫你找客戶</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI 會自動搜尋、瀏覽、評估數十家公司，回傳最契合的前 10 名
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl mx-auto text-xs">
              <div className="rounded-md bg-muted/40 p-3">
                <Target className="h-4 w-4 mx-auto mb-1 text-violet-500" />
                <p className="font-medium">精準契合</p>
                <p className="text-muted-foreground mt-0.5">AI 評分 0-100，只回傳高分</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <Sparkles className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <p className="font-medium">建議切入點</p>
                <p className="text-muted-foreground mt-0.5">每家附上為什麼需要你服務</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <Plus className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                <p className="font-medium">一鍵加入</p>
                <p className="text-muted-foreground mt-0.5">直接匯入名單試算表</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function ProspectCard({
  candidate,
  rank,
  added,
  onAdd,
}: {
  candidate: ProspectCandidate
  rank: number
  added: boolean
  onAdd: () => void
}) {
  const scoreColor =
    candidate.fit_score >= 80
      ? 'bg-emerald-500'
      : candidate.fit_score >= 60
      ? 'bg-amber-500'
      : candidate.fit_score >= 40
      ? 'bg-orange-500'
      : 'bg-slate-400'

  const confidenceColor =
    candidate.confidence === 'high'
      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
      : candidate.confidence === 'medium'
      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header: 排名 + 公司名 + 分數 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white text-xs font-bold">
              {rank}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold truncate">{candidate.company}</h3>
                {candidate.industry && (
                  <Badge variant="outline" className="text-[10px]">
                    {candidate.industry}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] ${confidenceColor}`}
                >
                  {candidate.confidence === 'high' ? '高信心' : candidate.confidence === 'medium' ? '中信心' : '低信心'}
                </Badge>
              </div>
              <a
                href={candidate.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline truncate block max-w-full"
              >
                {candidate.website}
                <ExternalLink className="inline-block ml-0.5 h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* Fit score */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">契合度</p>
              <p className="text-lg font-bold tabular-nums">{candidate.fit_score}</p>
            </div>
            <div className="h-12 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex flex-col-reverse">
              <div
                className={`w-full ${scoreColor}`}
                style={{ height: `${candidate.fit_score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Why they need it */}
        <div className="rounded-md bg-muted/30 p-2.5">
          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="h-3 w-3" /> 為什麼他們需要你
          </p>
          <p className="text-sm">{candidate.why_they_need_it}</p>
        </div>

        {/* Suggested angle */}
        {candidate.suggested_angle && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2.5 border border-emerald-200 dark:border-emerald-900">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> 建議切入點
            </p>
            <p className="text-sm italic">{candidate.suggested_angle}</p>
          </div>
        )}

        {/* Key signals */}
        {candidate.key_signals && candidate.key_signals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> 關鍵訊號
            </p>
            <div className="flex flex-wrap gap-1.5">
              {candidate.key_signals.map((s, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            onClick={onAdd}
            disabled={added}
            variant={added ? 'outline' : 'default'}
            className={added ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
          >
            {added ? (
              <>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                已加入
              </>
            ) : (
              <>
                <Plus className="mr-1 h-3.5 w-3.5" />
                加入名單
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
