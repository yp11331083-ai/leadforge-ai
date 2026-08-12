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
    id: 'trial',
    name: 'Trial',
    price: 0,
    description: '免費試用，每個租戶 14 天',
    features: ['100 封 email / 月', '1 個使用者', '基礎 AI 研究', 'SMTP 發信'],
    color: 'from-slate-400 to-slate-500',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    description: '小團隊入門方案',
    features: ['2,000 封 email / 月', '3 個使用者', '基本 + 深度研究', 'SMTP + Smartlead', 'Email enrichment', '開信追蹤 webhook'],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    description: '成長型團隊最愛',
    features: ['10,000 封 email / 月', '10 個使用者', '全部研究功能', 'Apollo + Cal.com 整合', '會議追蹤', '團隊排行榜', 'API 存取'],
    color: 'from-violet-500 to-fuchsia-600',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    description: '大型業務團隊',
    features: ['無限 email', '無限使用者', '專屬客戶成功經理', 'SSO/SAML', '客製化整合', '優先支援', 'SLA 保證'],
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
        toast.success(data.message ?? `已上報 ${data.recorded} 筆用量到 Stripe`)
        fetchUsage()
      } else {
        toast.error(data.error ?? '上報失敗')
      }
    } catch (e) {
      toast.error('網路錯誤')
    } finally {
      setRecordingUsage(false)
    }
  }

  const currentPlan = PLANS.find((p) => p.id === currentUser?.tenantPlan) ?? PLANS[0]
  const emailsUsed = usage?.stats?.sent ?? 0
  const planLimit: Record<string, number> = {
    trial: 100,
    starter: 2000,
    pro: 10000,
    enterprise: 100000,
  }
  const limit = planLimit[currentPlan.id] ?? 100
  const usagePercent = Math.min(100, (emailsUsed / limit) * 100)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-500" />
            計費與方案
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            管理 {currentUser?.tenantName} 的訂閱方案與用量
          </p>
        </div>
        <Button onClick={handleReportUsage} disabled={recordingUsage} variant="outline" size="sm">
          {recordingUsage ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />上報中...</>
          ) : (
            <><Zap className="mr-1.5 h-3.5 w-3.5" />手動上報用量到 Stripe</>
          )}
        </Button>
      </div>

      {/* 當前方案 */}
      <Card className={`p-5 bg-gradient-to-br ${currentPlan.color} text-white border-0 shadow-lg`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">當前方案</p>
            <h3 className="text-3xl font-bold mt-1">{currentPlan.name}</h3>
            <p className="text-sm opacity-90 mt-1">{currentPlan.description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-80">月費</p>
            <p className="text-3xl font-bold">${currentPlan.price}</p>
          </div>
        </div>

        {/* 用量進度 */}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider opacity-80">本月已發送</span>
            <span className="text-sm font-medium">
              {emailsUsed} / {limit} 封
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full bg-white transition-all`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs opacity-80 mt-2">
            {usagePercent < 50 ? '用量充裕' : usagePercent < 80 ? '即將達上限' : '⚠️ 接近上限，考慮升級方案'}
          </p>
        </div>
      </Card>

      {/* 即時成效 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <UsageCard
          icon={Zap}
          label="已發送"
          value={usage?.stats?.sent ?? 0}
          color="from-teal-500 to-cyan-600"
        />
        <UsageCard
          icon={TrendingUp}
          label="開信率"
          value={`${usage?.stats?.openRate ?? 0}%`}
          color="from-emerald-500 to-teal-600"
        />
        <UsageCard
          icon={Sparkles}
          label="回覆率"
          value={`${usage?.stats?.replyRate ?? 0}%`}
          color="from-amber-500 to-orange-600"
        />
        <UsageCard
          icon={Calendar}
          label="約到會議"
          value={usage?.stats?.meetings ?? 0}
          color="from-violet-500 to-fuchsia-600"
        />
      </div>

      {/* 升級方案 */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          升級方案
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
                  熱門
                </div>
              )}
              <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${plan.color} text-white shadow-sm`}>
                <Building2 className="h-4 w-4" />
              </div>
              <h4 className="text-base font-semibold mt-2">{plan.name}</h4>
              <p className="text-2xl font-bold mt-1">${plan.price}<span className="text-xs font-normal text-muted-foreground">/月</span></p>
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
                onClick={() => toast.info(`升級到 ${plan.name} 方案（需串接 Stripe Checkout）`)}
              >
                {plan.id === currentPlan.id ? '當前方案' : `升級到 ${plan.name}`}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Stripe 設定提示 */}
      <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1.5">
            <p className="font-medium text-amber-800 dark:text-amber-300">Stripe 設定步驟</p>
            <ol className="list-decimal ml-5 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
              <li>至 Stripe Dashboard 建立 Product 與 Metered Price</li>
              <li>至「發信設定」分頁填入 Stripe Secret Key、Webhook Secret、Price ID</li>
              <li>建立 Customer 並訂閱該 Price（含 metered item）</li>
              <li>設定 Stripe Webhook 指向 <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60">/api/webhooks/stripe</code></li>
              <li>客戶每發一封信，後台自動建立 UsageEvent</li>
              <li>點上方「手動上報用量」按鈕，或設定 cron job 定期上報</li>
              <li>Stripe 月底依總用量自動扣款</li>
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
