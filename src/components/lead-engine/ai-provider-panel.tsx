'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ChevronDown,
  Zap,
  Shield,
  Cpu,
  Sparkles,
} from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

export function AiProviderPanel() {
  const emailConfig = useLeadStore((s) => s.emailConfig)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const saveEmailConfig = useLeadStore((s) => s.saveEmailConfig)

  const [form, setForm] = useState({
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-5-sonnet-20241022',
  })
  const [saving, setSaving] = useState(false)
  const [byokOpen, setByokOpen] = useState(false)
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
    })
  }

  const handleSave = async () => {
    setSaving(true)
    await saveEmailConfig(form)
    setSaving(false)
    toast.success('BYOK keys saved — AI will use your keys instead of platform credits')
  }

  const openaiConfigured = !!emailConfig?.openaiApiKey
  const anthropicConfigured = !!emailConfig?.anthropicApiKey

  return (
    <div className="space-y-5">
      {/* Platform AI Status */}
      <Card className="p-5 space-y-4 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
            <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              AI Engine Status
              <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Active
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">Powered by Outrovo's high-availability cluster</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-white/60 dark:bg-emerald-950/20 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Chat AI</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Z.ai → Gemini fallback</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Uses your AI Credits</p>
          </div>
          <div className="rounded-md bg-white/60 dark:bg-emerald-950/20 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Search</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Z.ai → Tavily</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Platform-managed</p>
          </div>
          <div className="rounded-md bg-white/60 dark:bg-emerald-950/20 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium">Page Reader</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Z.ai → Jina</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Platform-managed</p>
          </div>
        </div>

        <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-start gap-1.5">
          <Shield className="h-3 w-3 mt-0.5 shrink-0" />
          <span>All AI operations (research, email generation, auto-prospecting) use your AI Credits. No API keys needed — it just works.</span>
        </div>
      </Card>

      {/* BYOK — Advanced (Collapsible) */}
      <Collapsible open={byokOpen} onOpenChange={setByokOpen}>
        <Card className="p-5">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800/60 p-2">
                  <KeyRound className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Advanced: Bring Your Own Key (BYOK)
                    {(openaiConfigured || anthropicConfigured) && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Active
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">Use your own OpenAI/Claude keys — won't consume platform AI Credits</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${byokOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="space-y-4 pt-4">
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>If you provide your own API keys, AI operations will use YOUR keys (billed to your account) instead of consuming platform AI Credits. Search and Page Reader remain platform-managed.</span>
              </div>

              {/* OpenAI */}
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Label className="flex items-center gap-1.5 font-medium">
                  OpenAI
                  {openaiConfigured ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-500">Not set — using platform</Badge>
                  )}
                </Label>
                <Input
                  type="password"
                  value={form.openaiApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, openaiApiKey: e.target.value }))}
                  placeholder={openaiConfigured ? '•••••••• (leave empty to keep)' : 'sk-...'}
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
              </div>

              {/* Anthropic */}
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Label className="flex items-center gap-1.5 font-medium">
                  Anthropic Claude
                  {anthropicConfigured ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 text-slate-500">Not set — using platform</Badge>
                  )}
                </Label>
                <Input
                  type="password"
                  value={form.anthropicApiKey}
                  onChange={(e) => setForm((f) => ({ ...f, anthropicApiKey: e.target.value }))}
                  placeholder={anthropicConfigured ? '•••••••• (leave empty to keep)' : 'sk-ant-...'}
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
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><KeyRound className="mr-2 h-4 w-4" /> Save BYOK Keys</>
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
