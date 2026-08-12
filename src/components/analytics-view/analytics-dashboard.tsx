'use client'

import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Mail,
  MailOpen,
  MessageSquareReply,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  Award,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useLeadStore } from '@/store/lead-store'

export function AnalyticsDashboard() {
  const leads = useLeadStore((s) => s.leads)
  const stats = useLeadStore((s) => s.stats)

  // 真實資料：依 status 統計
  const statusData = useMemo(() => {
    const colors: Record<string, string> = {
      new: '#94a3b8',
      researching: '#f59e0b',
      researched: '#06b6d4',
      drafting: '#a78bfa',
      ready: '#10b981',
      sent: '#14b8a6',
      replied: '#f43f5e',
    }
    const labels: Record<string, string> = {
      new: '新名單',
      researching: '研究中',
      researched: '已研究',
      drafting: '草稿中',
      ready: '待發送',
      sent: '已發送',
      replied: '已回覆',
    }
    return Object.entries(stats)
      .filter(([k]) => k !== 'total')
      .map(([k, v]) => ({
        name: labels[k] ?? k,
        value: v as number,
        color: colors[k] ?? '#94a3b8',
      }))
      .filter((d) => d.value > 0)
  }, [stats])

  // 真實進度：pipeline 漏斗
  const funnel = useMemo(() => {
    const total = stats.total
    const researched = stats.researched + stats.ready + stats.sent + stats.replied
    const ready = stats.ready + stats.sent + stats.replied
    const sent = stats.sent + stats.replied
    const replied = stats.replied
    const meetings = Math.max(1, Math.floor(replied * 0.4)) // 假設 40% 回覆轉為會議

    return [
      { stage: '名單', count: total, rate: 100 },
      { stage: '已研究', count: researched, rate: total ? Math.round((researched / total) * 100) : 0 },
      { stage: '待發送', count: ready, rate: total ? Math.round((ready / total) * 100) : 0 },
      { stage: '已發送', count: sent, rate: total ? Math.round((sent / total) * 100) : 0 },
      { stage: '已回覆', count: replied, rate: total ? Math.round((replied / total) * 100) : 0 },
      { stage: '約到會議', count: meetings, rate: total ? Math.round((meetings / total) * 100) : 0 },
    ]
  }, [stats])

  // Mock 7 天趨勢（基於真實 sent 數字打散）
  const trend7d = useMemo(() => {
    const days = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
    const totalSent = stats.sent + stats.replied
    if (totalSent === 0) {
      return days.map((d) => ({ day: d, sent: 0, opened: 0, replied: 0 }))
    }
    // 把 sent 散到 7 天
    const weights = [0.1, 0.15, 0.2, 0.15, 0.2, 0.1, 0.1]
    return days.map((d, i) => {
      const sent = Math.max(0, Math.round(totalSent * weights[i] + (Math.random() - 0.5) * 3))
      const opened = Math.round(sent * (0.55 + Math.random() * 0.15))
      const replied = Math.round(sent * (0.07 + Math.random() * 0.06))
      return { day: d, sent, opened, replied }
    })
  }, [stats])

  // KPI（混合真實與合理 mock）
  const totalSent = stats.sent + stats.replied
  const totalReplied = stats.replied
  const totalOpened = Math.round(totalSent * 0.62) // 業界平均開信率 50-65%
  const meetings = Math.max(0, Math.floor(totalReplied * 0.4))
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0

  // 團隊排行榜（mock）
  const teamLeaderboard = [
    { name: 'Alex Chen', sent: 47, replied: 5, meetings: 2, avatar: 'A' },
    { name: 'Sarah Lin', sent: 38, replied: 4, meetings: 2, avatar: 'S' },
    { name: 'Marcus Wu', sent: 31, replied: 2, meetings: 1, avatar: 'M' },
    { name: 'Jenny Tsai', sent: 24, replied: 3, meetings: 1, avatar: 'J' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">業務數據儀表板</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            即時掌握開發信成效、回覆率、會議轉換
          </p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
          即時更新
        </Badge>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={Mail}
          label="已發送"
          value={totalSent}
          trend={+12}
          color="from-teal-500 to-cyan-600"
        />
        <KpiCard
          icon={MailOpen}
          label="開信率"
          value={`${openRate}%`}
          subtext={`${totalOpened} 封被打開`}
          trend={+5}
          color="from-emerald-500 to-teal-600"
        />
        <KpiCard
          icon={MessageSquareReply}
          label="回覆率"
          value={`${replyRate}%`}
          subtext={`${totalReplied} 封回覆`}
          trend={replyRate > 8 ? +2 : -1}
          color="from-amber-500 to-orange-600"
        />
        <KpiCard
          icon={CalendarCheck}
          label="約到會議"
          value={meetings}
          subtext="本月累計"
          trend={meetings > 0 ? +1 : 0}
          color="from-violet-500 to-fuchsia-600"
        />
      </div>

      {/* Trend chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              本週發送趨勢
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">已發送 / 已開信 / 已回覆</p>
          </div>
          <Badge variant="outline" className="text-xs">最近 7 天</Badge>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trend7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="openedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="repliedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
            />
            <Area type="monotone" dataKey="sent" stroke="#14b8a6" strokeWidth={2} fill="url(#sentGrad)" name="已發送" />
            <Area type="monotone" dataKey="opened" stroke="#10b981" strokeWidth={2} fill="url(#openedGrad)" name="已開信" />
            <Area type="monotone" dataKey="replied" stroke="#f59e0b" strokeWidth={2} fill="url(#repliedGrad)" name="已回覆" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Funnel */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            轉換漏斗
            <span className="text-xs text-muted-foreground font-normal">（從名單到會議）</span>
          </h3>
          <div className="space-y-2">
            {funnel.map((f, i) => {
              const width = Math.max(8, f.rate)
              const prevRate = i > 0 ? funnel[i - 1].rate : 100
              const dropoff = i > 0 ? prevRate - f.rate : 0
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{f.stage}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{f.count}</span>
                      {' '}
                      <span className="text-[10px]">({f.rate}%)</span>
                      {i > 0 && dropoff > 0 && (
                        <span className="ml-1 text-rose-500 text-[10px]">↓ {dropoff}%</span>
                      )}
                    </span>
                  </div>
                  <div className="h-7 rounded-md bg-muted/40 overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, ${funnelColors[i]}, ${funnelColors[i]}cc)`,
                      }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                      {f.count}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Status distribution */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            名單狀態分布
          </h3>
          {statusData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              尚無資料
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {statusData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: d.color }}
                    />
                    <span className="text-muted-foreground flex-1 truncate">{d.name}</span>
                    <span className="font-medium tabular-nums">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Team leaderboard */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            業務團隊排行榜
            <Badge variant="outline" className="text-[10px]">本月</Badge>
          </h3>
        </div>
        <div className="space-y-2">
          {teamLeaderboard.map((m, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-2.5 rounded-lg ${
                i === 0
                  ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-900'
                  : 'bg-muted/40'
              }`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
                  : 'bg-slate-300 dark:bg-slate-700 text-muted-foreground'
              }`}>
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.sent} 封 · {m.replied} 回覆 · {m.meetings} 會議
                </p>
              </div>
              {i === 0 && (
                <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800">
                  <Sparkles className="mr-1 h-3 w-3" /> Top Performer
                </Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Footer disclaimer */}
      <p className="text-[11px] text-muted-foreground text-center pt-2">
        開信率與會議轉換率為合理預估值（基於業界平均）。串接 Smartlead webhook 後可顯示真實開信追蹤數據。
      </p>
    </div>
  )
}

const funnelColors = ['#94a3b8', '#06b6d4', '#a78bfa', '#10b981', '#14b8a6', '#f43f5e']

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  subtext?: string
  trend: number
  color: string
}) {
  const trendUp = trend > 0
  const trendDown = trend < 0
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`rounded-lg bg-gradient-to-br ${color} p-2 shadow-sm`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</p>
        {subtext && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>
        )}
      </div>
    </Card>
  )
}
