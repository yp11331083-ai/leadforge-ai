'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CreditCard,
  Zap,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Building2,
} from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

interface UsageData {
  stats: {
    sent: number
    delivered: number
    opened: number
    replied: number
    bounced: number
    clicked: number
    uniqueOpenedLeads: number
    meetings: number
    upcomingMeetings: number
    openRate: number
    replyRate: number
    meetingRate: number
  }
}

const PLANS = [
  {
    id: 'freemium',
    name: 'Freemium',
    price: 0,
    credits: 30,
    seats: 1,
    description: 'Get started free, no credit card required',
    features: [
      '30 AI credits (~3 auto-prospect runs)',
      '1 seat',
      'Basic AI research',
      'Email sending (SMTP)',
      '1 mailbox',
    ],
    color: 'from-slate-400 to-slate-500',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    credits: 500,
    seats: 1,
    description: 'For solo founders',
    features: [
      '500 AI credits (~50 auto-prospect runs)',
      '1 seat',
      'Deep research',
      'SMTP + Smartlead integration',
      'Find verified decision-maker emails',
      '3 mailboxes',
    ],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    credits: 2000,
    seats: 5,
    description: 'For small teams',
    features: [
      '2,000 AI credits (~200 auto-prospect runs)',
      '5 seats',
      'Manager dashboard',
      'Analytics + team leaderboard',
      'Spam-proof mailbox rotation',
      'Smart meeting tracking (auto-stop on booking)',
      'Priority support',
    ],
    color: 'from-violet-500 to-fuchsia-600',
    popular: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 399,
    credits: 8000,
    seats: 3,
    description: 'For agencies & sales teams',
    features: [
      '8,000 AI credits (~800 auto-prospect runs)',
      'Includes 3 SDR seats (add team members for $30/mo each)',
      'Role-based access control',
      'Dedicated success manager',
    ],
    color: 'from-amber-500 to-orange-600',
  },
]

export function BillingPanel() {
  const currentUser = useLeadStore((s) => s.currentUser)
  const creditBalance = useLeadStore((s) => s.creditBalance)
  const creditAllowance = useLeadStore((s) => s.creditAllowance)
  const fetchCredits = useLeadStore((s) => s.fetchCredits)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)  // background, non-blocking
  const [recordingUsage, setRecordingUsage] = useState(false)
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null)

  // Fetches usage stats from /api/usage (slow — calls Stripe API).
  // Runs in the BACKGROUND so the panel renders instantly with credit
  // balance, then usage stats fill in when ready.
  const fetchUsage = async () => {
    setUsageLoading(true)
    try {
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUsageLoading(false)
    }
  }

  // Fire both requests IN PARALLEL on mount.
  // Credit balance loads first (fast — just DB), usage stats load in
  // background (slow — calls Stripe API). User sees the panel instantly.
  useEffect(() => {
    void fetchCredits()  // fast — DB only, ~100ms
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    void fetchUsage()    // slow — Stripe API, ~3s, non-blocking
  }, [fetchCredits])

  const handleUpgrade = async (planId: string) => {
    setUpgradingPlan(planId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        // Redirect to Stripe Checkout (external URL, not a Next.js route)
        // eslint-disable-next-line react-hooks/immutability
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Failed to start checkout')
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Checkout failed')
    } finally {
      setUpgradingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setUpgradingPlan('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error ?? 'Failed to open customer portal')
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Portal failed')
    } finally {
      setUpgradingPlan(null)
    }
  }

  const handleReportUsage = async () => {
    setRecordingUsage(true)
    try {
      const res = await fetch('/api/usage', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message ?? `Reported ${data.recorded} usage to Stripe`)
        fetchUsage()
      } else {
        toast.error(data.error ?? 'Report failed')
      }
    } catch (e) {
      toast.error('Network error')
    } finally {
      setRecordingUsage(false)
    }
  }

  // Map legacy/aliases to canonical plan IDs so the UI shows the right plan card
  const planAliasMap: Record<string, string> = {
    pro: 'growth',      // "pro" is an alias for "growth"
    trial: 'freemium',  // "trial" maps to freemium
    enterprise: 'agency',
  }
  const canonicalPlanId = planAliasMap[currentUser?.tenantPlan ?? ''] ?? currentUser?.tenantPlan ?? 'freemium'
  const currentPlan = PLANS.find((p) => p.id === canonicalPlanId) ?? PLANS[0]

  // Fallback if /api/credits/balance hasn't loaded yet
  const planLimitFallback: Record<string, number> = {
    freemium: 30,
    trial: 30,
    starter: 500,
    growth: 2000,
    pro: 2000,
    agency: 8000,
    enterprise: 8000,
  }

  const creditsUsed = creditBalance !== null && creditAllowance !== null
    ? Math.max(0, creditAllowance - creditBalance)
    : 0
  const limit = creditAllowance ?? (planLimitFallback[currentPlan.id] ?? 30)
  const usagePercent = limit > 0 ? Math.min(100, (creditsUsed / limit) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-500" />
            Billing & Plans
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage subscription and usage
          </p>
        </div>
        <div className="flex gap-2">
          {currentPlan.id !== 'freemium' && (
            <Button onClick={handleManageSubscription} disabled={upgradingPlan === 'portal'} variant="outline" size="sm">
              {upgradingPlan === 'portal' ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Loading...</>
              ) : (
                <><CreditCard className="mr-1.5 h-3.5 w-3.5" />Manage Subscription</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Checkout success / cancel banner */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('checkout') === 'success' && (
        <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300">
          ✓ Subscription activated! Your credits have been added to your account.
        </div>
      )}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('checkout') === 'cancelled' && (
        <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
          Checkout cancelled. You can subscribe any time from this page.
        </div>
      )}

      {/* Current Plan */}
      <Card className={`p-5 bg-gradient-to-br ${currentPlan.color} text-white border-0 shadow-lg`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">Current Plan</p>
            <h3 className="text-3xl font-bold mt-1">{currentPlan.name}</h3>
            <p className="text-sm opacity-90 mt-1">{currentPlan.description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-80">/mo</p>
            <p className="text-3xl font-bold">${currentPlan.price}</p>
          </div>
        </div>

        {/* 用量進度 */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider opacity-80">Credits Used</span>
            <span className="text-sm font-medium">
              {creditsUsed} / {limit} credits
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full bg-white transition-all`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs opacity-80 mt-2">
            {usagePercent < 50 ? 'Plenty of credits remaining' : usagePercent < 80 ? 'Approaching limit' : '⚠️ Approaching limit — consider upgrading'}
          </p>
        </div>
      </Card>

      {/* 即時成效 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <UsageCard
          icon={Zap}
          label="Sent"
          value={usage?.stats?.sent ?? 0}
          color="from-teal-500 to-cyan-600"
        />
        <UsageCard
          icon={TrendingUp}
          label="Open Rate"
          value={`${usage?.stats?.openRate ?? 0}%`}
          color="from-emerald-500 to-teal-600"
        />
        <UsageCard
          icon={Sparkles}
          label="Reply Rate"
          value={`${usage?.stats?.replyRate ?? 0}%`}
          color="from-amber-500 to-orange-600"
        />
        <UsageCard
          icon={Calendar}
          label="Meetings Booked"
          value={usage?.stats?.meetings ?? 0}
          color="from-violet-500 to-fuchsia-600"
        />
      </div>

      {/* Upgrade Plans */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Upgrade Plans
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`p-4 relative overflow-hidden ${
                plan.id === currentPlan.id
                  ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : ''
              } ${plan.popular ? 'border-violet-300 dark:border-violet-800' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 px-2 py-0.5 text-[10px] font-medium bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-bl-md">
                  Popular
                </div>
              )}
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${plan.color} text-white shadow-sm`}>
                <Building2 className="h-4 w-4" />
              </div>
              <h4 className="text-base font-semibold mt-2">{plan.name}</h4>
              <p className="text-2xl font-bold mt-1">${plan.price}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
              <ul className="space-y-1 mt-3 text-xs">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-4"
                size="sm"
                variant={plan.id === currentPlan.id ? 'outline' : 'default'}
                disabled={plan.id === currentPlan.id || upgradingPlan !== null || plan.price === 0}
                onClick={() => handleUpgrade(plan.id)}
              >
                {upgradingPlan === plan.id ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Redirecting...</>
                ) : plan.id === currentPlan.id ? (
                  'Current Plan'
                ) : plan.price === 0 ? (
                  'Free Forever'
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Add-on credit packs (one-time purchase) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Top Up Credits
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Need more credits this month? Buy a one-time pack — credits never expire.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { id: 'pack_100', name: 'Starter Pack', credits: 100, price: 9 },
            { id: 'pack_500', name: 'Growth Pack', credits: 500, price: 39 },
            { id: 'pack_2000', name: 'Agency Pack', credits: 2000, price: 129 },
          ].map((pack) => (
            <Card key={pack.id} className="p-4 flex flex-col">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{pack.name}</p>
              <p className="text-2xl font-bold mt-1">{pack.credits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">credits</span></p>
              <p className="text-sm text-muted-foreground mt-0.5">${pack.price} one-time</p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                disabled={upgradingPlan === pack.id}
                onClick={() => handleUpgrade(pack.id)}
              >
                {upgradingPlan === pack.id ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Loading...</>
                ) : (
                  <>Buy {pack.credits} Credits</>
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function UsageCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
}) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className={`inline-flex rounded-lg bg-gradient-to-br ${color} p-2 shadow-sm`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</p>
    </Card>
  )
}
