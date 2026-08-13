'use client'

import { useMemo } from 'react'
import { Users, Sparkles, MailCheck, MessageSquareReply, TrendingUp, Zap } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useLeadStore } from '@/store/lead-store'

export function StatsDashboard() {
  const stats = useLeadStore((s) => s.stats)

  const items = useMemo(
    () => [
      {
        key: 'total',
        label: 'Total Leads',
        value: stats.total,
        icon: Users,
        color: 'text-slate-600 dark:text-slate-300',
        bg: 'bg-slate-100 dark:bg-slate-800/60',
      },
      {
        key: 'researched',
        label: 'Researched',
        value: stats.researched,
        icon: Sparkles,
        color: 'text-cyan-600 dark:text-cyan-400',
        bg: 'bg-cyan-50 dark:bg-cyan-950/40',
      },
      {
        key: 'ready',
        label: 'Queued',
        value: stats.ready,
        icon: Zap,
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      },
      {
        key: 'sent',
        label: 'Sent',
        value: stats.sent,
        icon: MailCheck,
        color: 'text-teal-600 dark:text-teal-400',
        bg: 'bg-teal-50 dark:bg-teal-950/40',
      },
      {
        key: 'replied',
        label: 'Replied',
        value: stats.replied,
        icon: MessageSquareReply,
        color: 'text-rose-600 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40',
      },
      {
        key: 'rate',
        label: 'Reply Rate',
        value:
          stats.sent + stats.replied > 0
            ? `${Math.round((stats.replied / (stats.sent + stats.replied)) * 100)}%`
            : '—',
        icon: TrendingUp,
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
      },
    ],
    [stats]
  )

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card
            key={item.key}
            className="border-border/60 p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {item.value}
                </p>
              </div>
              <div className={`rounded-lg p-2 ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
