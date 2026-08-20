'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, X, Rocket, Mail, Database, Wrench } from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'outrovo_onboarding_dismissed_v1'

type StepId = 'service' | 'leads' | 'email'

export function OnboardingChecklist() {
  const leads = useLeadStore((s) => s.leads)
  const emailConfig = useLeadStore((s) => s.emailConfig)
  const serviceOffering = useLeadStore((s) => s.serviceOffering)
  const setViewMode = useLeadStore((s) => s.setViewMode)
  const fetchServiceOffering = useLeadStore((s) => s.fetchServiceOffering)

  const [dismissed, setDismissed] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY))
    fetchServiceOffering()
  }, [fetchServiceOffering])

  const steps = useMemo(() => {
    return [
      {
        id: 'service' as StepId,
        title: 'Tell us what you sell',
        desc: 'Describe your service so AI knows who to target.',
        done: !!serviceOffering?.serviceName,
        tab: 'prospect' as const,
        mode: 'admin' as const,
        icon: Wrench,
      },
      {
        id: 'leads' as StepId,
        title: 'Add your first leads',
        desc: 'Import a CSV, add manually, or run auto-prospecting.',
        done: leads.length > 0,
        tab: 'leads' as const,
        mode: 'admin' as const,
        icon: Database,
      },
      {
        id: 'email' as StepId,
        title: 'Connect your inbox',
        desc: 'Add SMTP or Smartlead so AI can send campaigns.',
        done: !!(emailConfig?.smtpHost || emailConfig?.smartleadApiKey),
        tab: 'email' as const,
        mode: 'admin' as const,
        icon: Mail,
      },
    ]
  }, [leads.length, emailConfig?.smtpHost, emailConfig?.smartleadApiKey, serviceOffering?.serviceName])

  const completedCount = steps.filter((s) => s.done).length
  const allDone = completedCount === steps.length

  useEffect(() => {
    if (dismissed === null) return
    if (allDone && open) {
      setOpen(false)
      localStorage.setItem(STORAGE_KEY, 'done')
    }
  }, [allDone, dismissed, open])

  if (dismissed !== null || allDone) return null
  if (!open) return null

  const go = (s: (typeof steps)[number]) => {
    setViewMode(s.mode)
    setOpen(false)
    setTimeout(() => {
      document.querySelector(`[data-value="${s.tab}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, 50)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-2 p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <Rocket className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Welcome to Outrovo</p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{steps.length} setup steps
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, 'done')
            setDismissed('done')
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-1 p-2">
        {steps.map((s) => (
          <button
            key={s.id}
            onClick={() => go(s)}
            className={`flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/50 ${
              s.done ? 'opacity-70' : ''
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                s.done
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-stone-300 dark:border-stone-700'
              }`}
            >
              {s.done ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3 text-muted-foreground" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[13px] font-medium ${s.done ? 'line-through' : ''}`}>{s.title}</span>
              <span className="block text-xs text-muted-foreground">{s.desc}</span>
            </span>
            {!s.done && <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </button>
        ))}
      </div>

      <div className="border-t border-stone-100 p-3 dark:border-stone-800">
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            const first = steps.find((s) => !s.done)
            if (first) go(first)
          }}
        >
          {completedCount > 0 ? 'Continue setup' : 'Get started'}
        </Button>
      </div>
    </div>
  )
}