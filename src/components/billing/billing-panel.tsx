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
    credits: 100,
    seats: 1,
    description: 'Get started free, no credit card required',
    features: ['100 AI credits', '1 seat', 'Basic AI research', 'SMTP sending', '1 mailbox'],
    color: 'from-slate-400 to-slate-500',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    credits: 1500,
    seats: 1,
    description: 'For solo founders',
    features: ['1,500 AI credits', '1 seat', 'Deep research', 'SMTP + Smartlead', 'Email enrichment', 'Follow-up sequence', '3 mailboxes'],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    credits: 5000,
    seats: 5,
    description: 'For small teams',
    features: ['5,000 AI credits', '5 seats', 'Manager dashboard', 'Analytics + team leaderboard', 'Multi-mailbox rotation', 'Cal.com meeting tracking', 'Priority support'],
    color: 'from-violet-500 to-fuchsia-600',
    popular: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 399,
    credits: 20000,
    seats: 3,
    description: 'For agencies & sales teams',
    features: ['20,000 AI credits', '3 SDR seats included', 'Role-based access control', 'White-label option', 'API access', 'Dedicated success manager', 'Extra seats: $30/mo each'],
    color: 'from-amber-500 to-orange-600',
  },
]

export function BillingPanel() {
  const currentUser = useLeadStore((s) => s.currentUser)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recordingUsage, setRecordingUsage] = useState(false)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
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

  const currentPlan = PLANS.find((p) => p.id === currentUser?.tenantPlan) ?? PLANS[0]
  const creditsUsed = usage?.stats?.sent ?? 0
  const planLimit: Record<string, number> = {
    freemium: 100,
    trial: 100,
    starter: 1500,
    growth: 5000,
    pro: 5000,
    agency: 20000,
    enterprise: 20000,
  }
  const limit = planLimit[currentPlan.id] ?? 100
  const usagePercent = Math.min(100, (creditsUsed / limit) * 100)

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
        <Button onClick={handleReportUsage} disabled={recordingUsage} variant="outline" size="sm">
          {recordingUsage ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Reporting...</>
          ) : (
            <><Zap className="mr-1.5 h-3.5 w-3.5" />Report Usage to Stripe</>
          )}
        </Button>
      </div>

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
                disabled={plan.id === currentPlan.id}
                onClick={() => toast.info(`Upgrade to ${plan.name} plan (requires Stripe Checkout)`)}
              >
                {plan.id === currentPlan.id ? 'Current Plan' : `Upgrade to ${plan.name}`}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Stripe Settings提示 */}
      <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1.5">
            <p className="font-medium text-amber-800 dark:text-amber-300">Stripe Setup Steps</p>
            <ol className="list-decimal ml-5 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
              <li>Go to Stripe Dashboard, create Product and Metered Price</li>
              <li>Go to Email settings, enter Stripe Secret Key, Webhook Secret, Price ID</li>
              <li>Create Customer and subscribe to Price (with metered item)</li>
              <li>Set Stripe Webhook URL to <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60">/api/webhooks/stripe</code></li>
              <li>Each email sent creates a UsageEvent automatically</li>
              <li>Click "Report Usage" button, or set up cron job</li>
              <li>Stripe auto-charges at month end based on total usage</li>
            </ol>
          </div>
        </div>
      </Card>
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
