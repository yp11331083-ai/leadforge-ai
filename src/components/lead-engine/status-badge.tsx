import { Badge } from '@/components/ui/badge'
import type { LeadStatus } from '@/store/lead-store'

const STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }
> = {
  new: { label: '新名單', variant: 'outline', className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  researching: { label: '研究中', variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  researched: { label: '已研究', variant: 'secondary', className: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800' },
  drafting: { label: '草稿中', variant: 'secondary', className: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
  ready: { label: '待發送', variant: 'default', className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  sent: { label: '已發送', variant: 'default', className: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800' },
  replied: { label: '已回覆', variant: 'default', className: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new
  return (
    <Badge variant={config.variant} className={`whitespace-nowrap ${config.className}`}>
      {config.label}
    </Badge>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  const color =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 60
      ? 'bg-amber-500'
      : score >= 40
      ? 'bg-orange-500'
      : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold tabular-nums">{score}</span>
    </div>
  )
}

export const ALL_STATUSES: LeadStatus[] = [
  'new',
  'researching',
  'researched',
  'drafting',
  'ready',
  'sent',
  'replied',
]

export const STATUS_LABELS: Record<LeadStatus, string> = Object.fromEntries(
  ALL_STATUSES.map((s) => [s, STATUS_CONFIG[s].label])
) as Record<LeadStatus, string>
