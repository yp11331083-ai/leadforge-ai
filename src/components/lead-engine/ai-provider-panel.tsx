'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Plug,
  Cpu,
  Search,
  FileText,
  Zap,
  Sparkles,
} from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

const EMPTY_FORM = {
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  tavilyApiKey: '',
  jinaApiKey: '',
  firecrawlApiKey: '',
  chatProviderOrder: 'zai,openai,anthropic,gemini',
  searchProviderOrder: 'zai,tavily',
  pageReaderProviderOrder: 'zai,jina,firecrawl',
}

export function AiProviderPanel() {
  const emailConfig = useLeadStore((s) => s.emailConfig)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const saveEmailConfig = useLeadStore((s) => s.saveEmailConfig)

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    fetchEmailConfig()
  }, [fetchEmailConfig])

  const configKey = emailConfig?.updatedAt ?? ''
  if (emailConfig && configKey !== lastSyncedAt) {
    setLastSyncedAt(configKey)
    setForm({
      openaiApiKey: '',
      openaiModel: emailConfig.openaiModel ?? 'gpt-4o-mini',
      anthropicApiKey: '',
      anthropicModel: emailConfig.anthropicModel ?? 'claude-3-5-sonnet-20241022',
      geminiApiKey: '',
      geminiModel: emailConfig.geminiModel ?? 'gemini-1.5-flash',
      tavilyApiKey: '',
      jinaApiKey: '',
      firecrawlApiKey: '',
      chatProviderOrder: emailConfig.chatProviderOrder ?? 'zai,openai,anthropic,gemini',
      searchProviderOrder: emailConfig.searchProviderOrder ?? 'zai,tavily',
      pageReaderProviderOrder: emailConfig.pageReaderProviderOrder ?? 'zai,jina,firecrawl',
    })
  }

  const handleSave = async () => {
    setSaving(true)
    await saveEmailConfig(form)
    setSaving(false)
    toast.success('AI 提供者設定已儲存')
  }

  const zaiConfigured = true  // Z.ai 永遠可用
  const openaiConfigured = !!emailConfig?.openaiApiKey
  const anthropicConfigured = !!emailConfig?.anthropicApiKey
  const geminiConfigured = !!emailConfig?.geminiApiKey
  const tavilyConfigured = !!emailConfig?.tavilyApiKey
  const jinaConfigured = !!emailConfig?.jinaApiKey
  const firecrawlConfigured = !!emailConfig?.firecrawlApiKey

  return (
    <div className="space-y-5">
      {/* 說明卡片 */}
      <Card className="p-5 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border-violet-200 dark:border-violet-900">
        <div className="flex items-start gap-3">
          <Cpu className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-2">
            <p className="font-medium text-violet-800 dark:text-violet-300">
              AI 提供者多備援機制
            </p>
            <p className="text-xs text-violet-700 dark:text-violet-400">
              當 Z.ai 配額用完（429）時，系統會自動依優先順序切換到其他 AI 服務。建議至少設定 1 個替代提供者，避免限流中斷。
            </p>
            <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
              <div className="rounded-md bg-white/60 dark:bg-violet-950/40 p-1.5">
                <p className="font-medium text-violet-800 dark:text-violet-300">💬 Chat</p>
                <p className="text-violet-700 dark:text-violet-400 mt-0.5">研究、郵件生成、自動開發</p>
              </div>
              <div className="rounded-md bg-white/60 dark:bg-violet-950/40 p-1.5">
                <p className="font-medium text-violet-800 dark:text-violet-300">🔍 Search</p>
                <p className="text-violet-700 dark:text-violet-400 mt-0.5">公司搜尋、找決策者</p>
              </div>
              <div className="rounded-md bg-white/60 dark:bg-violet-950/40 p-1.5">
                <p className="font-medium text-violet-800 dark:text-violet-300">📄 Page Reader</p>
                <p className="text-violet-700 dark:text-violet-400 mt-0.5">抓取公司官網內容</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Z.ai (預設) */}
      <Card className="p-5 space-y-3 border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Z.ai（預設）
                <Badge variant="outline" className="text-xs bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  內建 · 免設定
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">透過 z-ai-web-dev-sdk，免費但有每日配額限制</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3" />啟用
          </Badge>
        </div>
      </Card>

      {/* Chat 提供者 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-teal-100 dark:bg-teal-950/50 p-2">
            <Cpu className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Chat 提供者</h3>
            <p className="text-xs text-muted-foreground">用於 AI 研究、郵件生成、自動開發</p>
          </div>
        </div>

        {/* OpenAI */}
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              OpenAI
              {openaiConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  未設定
                </Badge>
              )}
            </Label>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key
            </a>
          </div>
          <Input
            type="password"
            value={form.openaiApiKey}
            onChange={(e) => setForm((f) => ({ ...f, openaiApiKey: e.target.value }))}
            placeholder={openaiConfigured ? `••••••••（目前：${emailConfig?.openaiApiKey}）` : 'sk-...'}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Model:</Label>
            <Input
              value={form.openaiModel}
              onChange={(e) => setForm((f) => ({ ...f, openaiModel: e.target.value }))}
              placeholder="gpt-4o-mini"
              className="text-xs font-mono h-8"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">推薦 gpt-4o-mini（便宜快速）或 gpt-4o（更聰明）</p>
        </div>

        {/* Anthropic */}
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              Anthropic Claude
              {anthropicConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  未設定
                </Badge>
              )}
            </Label>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key
            </a>
          </div>
          <Input
            type="password"
            value={form.anthropicApiKey}
            onChange={(e) => setForm((f) => ({ ...f, anthropicApiKey: e.target.value }))}
            placeholder={anthropicConfigured ? `••••••••（目前：${emailConfig?.anthropicApiKey}）` : 'sk-ant-...'}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Model:</Label>
            <Input
              value={form.anthropicModel}
              onChange={(e) => setForm((f) => ({ ...f, anthropicModel: e.target.value }))}
              placeholder="claude-3-5-sonnet-20241022"
              className="text-xs font-mono h-8"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Claude 3.5 Sonnet（寫作品質最佳）</p>
        </div>

        {/* Gemini */}
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              Google Gemini
              {geminiConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  未設定
                </Badge>
              )}
            </Label>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key
            </a>
          </div>
          <Input
            type="password"
            value={form.geminiApiKey}
            onChange={(e) => setForm((f) => ({ ...f, geminiApiKey: e.target.value }))}
            placeholder={geminiConfigured ? `••••••••（目前：${emailConfig?.geminiApiKey}）` : 'AIza...'}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Model:</Label>
            <Input
              value={form.geminiModel}
              onChange={(e) => setForm((f) => ({ ...f, geminiModel: e.target.value }))}
              placeholder="gemini-1.5-flash"
              className="text-xs font-mono h-8"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">Gemini 1.5 Flash（最便宜，有免費額度）</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Chat 提供者優先順序（逗號分隔，第一個失敗自動切換下一個）</Label>
          <Input
            value={form.chatProviderOrder}
            onChange={(e) => setForm((f) => ({ ...f, chatProviderOrder: e.target.value }))}
            placeholder="zai,openai,anthropic,gemini"
            className="text-xs font-mono"
          />
        </div>
      </Card>

      {/* Search 提供者 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-100 dark:bg-amber-950/50 p-2">
            <Search className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Search 提供者</h3>
            <p className="text-xs text-muted-foreground">用於公司搜尋、找決策者、自動開發</p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              Tavily
              {tavilyConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  未設定
                </Badge>
              )}
            </Label>
            <a href="https://tavily.com/#api" target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key
            </a>
          </div>
          <Input
            type="password"
            value={form.tavilyApiKey}
            onChange={(e) => setForm((f) => ({ ...f, tavilyApiKey: e.target.value }))}
            placeholder={tavilyConfigured ? `••••••••（目前：${emailConfig?.tavilyApiKey}）` : 'tvly-...'}
          />
          <p className="text-[10px] text-muted-foreground">專為 AI 設計的搜尋 API，免費 1000 次/月</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Search 提供者優先順序</Label>
          <Input
            value={form.searchProviderOrder}
            onChange={(e) => setForm((f) => ({ ...f, searchProviderOrder: e.target.value }))}
            placeholder="zai,tavily"
            className="text-xs font-mono"
          />
        </div>
      </Card>

      {/* Page Reader 提供者 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-rose-100 dark:bg-rose-950/50 p-2">
            <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Page Reader 提供者</h3>
            <p className="text-xs text-muted-foreground">用於抓取公司官網內容做研究</p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              Jina Reader
              {jinaConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  免費可用
                </Badge>
              )}
            </Label>
            <a href="https://jina.ai/reader/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key（可選）
            </a>
          </div>
          <Input
            type="password"
            value={form.jinaApiKey}
            onChange={(e) => setForm((f) => ({ ...f, jinaApiKey: e.target.value }))}
            placeholder={jinaConfigured ? `••••••••（目前：${emailConfig?.jinaApiKey}）` : 'jina_...（免費 tier 不需 key）'}
          />
          <p className="text-[10px] text-muted-foreground">免費 tier 不需 API key，但有 rate limit。有 key 額度較高</p>
        </div>

        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 font-medium">
              Firecrawl
              {firecrawlConfigured ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />已設定
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                  未設定
                </Badge>
              )}
            </Label>
            <a href="https://www.firecrawl.dev/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5">
              <ExternalLink className="h-2.5 w-2.5" />取得 Key
            </a>
          </div>
          <Input
            type="password"
            value={form.firecrawlApiKey}
            onChange={(e) => setForm((f) => ({ ...f, firecrawlApiKey: e.target.value }))}
            placeholder={firecrawlConfigured ? `••••••••（目前：${emailConfig?.firecrawlApiKey}）` : 'fc-...'}
          />
          <p className="text-[10px] text-muted-foreground">更強的爬蟲，能處理 JS 渲染頁面，免費 500 次/月</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Page Reader 提供者優先順序</Label>
          <Input
            value={form.pageReaderProviderOrder}
            onChange={(e) => setForm((f) => ({ ...f, pageReaderProviderOrder: e.target.value }))}
            placeholder="zai,jina,firecrawl"
            className="text-xs font-mono"
          />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
        {saving ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />儲存中...</>
        ) : (
          <><Zap className="mr-2 h-4 w-4" />儲存 AI 提供者設定</>
        )}
      </Button>
    </div>
  )
}
