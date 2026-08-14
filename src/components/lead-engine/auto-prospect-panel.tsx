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

  // Sync DB settings to form
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
      toast.error('Service Name and Description are required')
      return
    }
    setSaving(true)
    await saveServiceOffering(form)
    setSaving(false)
    toast.success('Service settings saved')
  }

  const handleRun = async () => {
    if (!form.serviceName.trim() || !form.description.trim()) {
      toast.error('Please fill in Service Name and Description first')
      return
    }
    // Save first, then run
    await saveServiceOffering(form)
    setAddedIds(new Set())
    toast.info('Starting AI Auto-Prospect — estimated 2-4 minutes...')
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
      toast.success(`Found ${prospectResult?.candidates.length ?? 0} potential leads!`)
    } else {
      toast.error(result.error ?? 'Auto-ProspectFailed')
    }
  }

  const handleAddOne = async (c: ProspectCandidate) => {
    const lead = await createLead({
      company: c.company,
      website: c.website,
      industry: c.industry,
      status: 'new',
      tags: `AIAuto-Prospect,fit:${c.fit_score}`,
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
      toast.success(`Added: ${c.company}`)
      await fetchLeads()
    }
  }

  const handleAddAll = async () => {
    if (!prospectResult) return
    const toAdd = prospectResult.candidates.filter((c) => !addedIds.has(c.website))
    if (toAdd.length === 0) {
      toast.info('All added')
      return
    }
    toast.info(`Adding ${toAdd.length} companies...`)
    for (const c of toAdd) {
      await handleAddOne(c)
    }
    toast.success('All added successfully!')
  }

  return (
    <div className="space-y-5">
      {/* Service Settings */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 p-2 shadow-md">
            <Wand2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold">AI Auto-Prospect Engine</h2>
            <p className="text-xs text-muted-foreground">
              Enter your service — AI will automatically find 10 companies that need it most
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="service-name">Service / Product Name *</Label>
            <Input
              id="service-name"
              value={form.serviceName}
              onChange={(e) => setForm((f) => ({ ...f, serviceName: e.target.value }))}
              placeholder="e.g. AI Sales Development Platform"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-desc">Service Description *</Label>
            <Textarea
              id="service-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe what your service does, what problem it solves, and who your target customer is. AI uses this to design the search strategy."
              rows={4}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              The more specific your description, the more accurate the leads AI finds. Include: core features, pain points solved, what makes you different.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target-industries">Target Industry</Label>
              <Input
                id="target-industries"
                value={form.targetIndustries}
                onChange={(e) => setForm((f) => ({ ...f, targetIndustries: e.target.value }))}
                placeholder="SaaS, e-commerce, manufacturing"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-size">Target Company Size</Label>
              <Input
                id="target-size"
                value={form.targetCompanySize}
                onChange={(e) => setForm((f) => ({ ...f, targetCompanySize: e.target.value }))}
                placeholder="50-500 employees"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-location">Target Location</Label>
              <Input
                id="target-location"
                value={form.targetLocation}
                onChange={(e) => setForm((f) => ({ ...f, targetLocation: e.target.value }))}
                placeholder="United States / Taiwan / Global"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key-benefits">Key Value Proposition</Label>
            <Input
              id="key-benefits"
              value={form.keyBenefits}
              onChange={(e) => setForm((f) => ({ ...f, keyBenefits: e.target.value }))}
              placeholder="Save 80% research time, 3x reply rate"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ideal-signals">Ideal Customer Signals (optional)</Label>
            <Textarea
              id="ideal-signals"
              value={form.idealCustomerSignals}
              onChange={(e) => setForm((f) => ({ ...f, idealCustomerSignals: e.target.value }))}
              placeholder="e.g. Hiring SDRs, just raised Series A, using Salesforce, expanding internationally..."
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-count">How many companies to find</Label>
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
              Save Settings
            </Button>
            <Button
              onClick={handleRun}
              disabled={prospectLoading || !form.serviceName.trim() || !form.description.trim()}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
            >
              {prospectLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI working...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Start AI Auto-Prospect
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Progress panel */}
      {prospectLoading && (
        <Card className="p-5 border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20">
          <div className="space-y-4">
            {/* Header: spinner + current stage + timer */}
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
                    {prospectDetail || 'Running...'}
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

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-violet-700 dark:text-violet-400">
                <span>Step {prospectStep} / 6</span>
                <span>{Math.round((prospectStep / 6) * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-violet-100 dark:bg-violet-950/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                  style={{ width: `${(prospectStep / 6) * 100}%` }}
                />
              </div>
            </div>

            {/* 6-step list */}
            <div className="space-y-1.5">
              {[
                { n: 1, label: 'Generate Search Strategy', desc: 'AI designs 8 precise queries', icon: Wand2 },
                { n: 2, label: 'Search Candidates', desc: 'Google Search ~40 results', icon: Search },
                { n: 3, label: 'Filter Company URLs', desc: 'Extract company websites from results', icon: ListChecks },
                { n: 4, label: 'Fetch Website Content', desc: 'Page reader fetches each company site', icon: Zap },
                { n: 5, label: 'AI Fit Evaluation', desc: '5-dimension scoring, output fit_score', icon: Target },
                { n: 6, label: 'Sort & Return', desc: 'Sort by score, return top N', icon: Sparkles },
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
              Estimated 2-4 minutes to complete · Depends on target count and network speed · You can switch tabs and do other things while it runs
            </p>
          </div>
        </Card>
      )}

      {/* Failed state */}
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
                    <p className="font-medium">⏳ Estimated recovery time</p>
                    <ul className="ml-3 list-disc space-y-0.5 text-amber-700 dark:text-amber-400">
                      <li>Short-term rate limit: wait 5-30 minutes</li>
                      <li>Daily quota: wait until UTC 0:00 (resets daily)</li>
                      <li>Cannot predict exact reset time — try again in 1-2 hours</li>
                    </ul>
                  </div>
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                    <p className="font-medium">✅ Not affected</p>
                    <p className="mt-0.5">Saved leads, research results, AI-generated emails, and email settings are not affected. You can still edit, copy email content, and send emails.</p>
                  </div>
                </div>
              )}

              {!rateLimitedAt && (
                <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-2">
                  Try: reduce the target count, simplify the service description, or try again later.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {prospectResult && !prospectLoading && (
        <>
          {/* Stats and actions */}
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-950/50 p-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    Found {prospectResult.candidates.length} potential leads
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Evaluated {prospectResult.evaluated} of {prospectResult.total_discovered} candidates, filtered to top matches
                  </p>
                </div>
              </div>
              <Button
                onClick={handleAddAll}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add All to Leads
              </Button>
            </div>
          </Card>

          {/* Candidate Leads Cards */}
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

          {/* AI Search strategy transparency */}
          <Card className="p-4">
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                AI-generated search strategy ({prospectResult.ai_search_queries.length} queries)
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

      {/* Empty state */}
      {!prospectResult && !prospectLoading && (
        <Card className="p-8 border-dashed border-violet-200 dark:border-violet-800">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
              <Search className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Enter your service — let AI find your customers</p>
              <p className="text-xs text-muted-foreground mt-1">
                AI will automatically search, browse, and evaluate dozens of companies — returning the top 10 most relevant matches
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl mx-auto text-xs">
              <div className="rounded-md bg-muted/40 p-3">
                <Target className="h-4 w-4 mx-auto mb-1 text-violet-500" />
                <p className="font-medium">Precise Match</p>
                <p className="text-muted-foreground mt-0.5">AI scores 0–100, returns only high-fit results</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <Sparkles className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <p className="font-medium">Suggested Angle</p>
                <p className="text-muted-foreground mt-0.5">Each lead includes why they need your service</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <Plus className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                <p className="font-medium">One-click add</p>
                <p className="text-muted-foreground mt-0.5">Import directly to your leads table</p>
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
        {/* Header: rank + company name + score */}
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
                  {candidate.confidence === 'high' ? 'High confidence' : candidate.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
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
              <p className="text-[10px] text-muted-foreground">Fit Score</p>
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
            <Target className="h-3 w-3" /> Why they need you
          </p>
          <p className="text-sm">{candidate.why_they_need_it}</p>
        </div>

        {/* Suggested angle */}
        {candidate.suggested_angle && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2.5 border border-emerald-200 dark:border-emerald-900">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Suggested Angle
            </p>
            <p className="text-sm italic">{candidate.suggested_angle}</p>
          </div>
        )}

        {/* Key signals */}
        {candidate.key_signals && candidate.key_signals.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Key Signals
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
                Added
              </>
            ) : (
              <>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add to Leads
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}
