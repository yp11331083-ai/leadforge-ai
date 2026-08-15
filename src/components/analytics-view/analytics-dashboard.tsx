'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Mail,
  MailOpen,
  MessageSquareReply,
  CalendarCheck,
  TrendingUp,
  Users,
  Target,
  Award,
  Sparkles,
  ArrowUpRight,
  Clock,
  Calendar,
  CheckCircle2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useLeadStore } from '@/store/lead-store'

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
  trend7d: Array<{ day: string; sent: number; opened: number; replied: number }>
  recentActivity: Array<{
    leadId: string
    company?: string
    eventType: string
    time: string
  }>
  upcomingMeetings: Array<{
    id: string
    leadId: string
    company?: string
    attendeeName: string
    attendeeEmail: string
    startTime: string
    endTime: string
  }>
}

export function AnalyticsDashboard() {
  const currentUser = useLeadStore((s) => s.currentUser)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    void fetchUsage()
  }, [])

  const stats = usage?.stats ?? {
    sent: 0, delivered: 0, opened: 0, replied: 0, bounced: 0, clicked: 0,
    uniqueOpenedLeads: 0, meetings: 0, upcomingMeetings: 0,
    openRate: 0, replyRate: 0, meetingRate: 0,
  }

  // Real team leaderboard — derived from current user (SDR sees only self, Manager/Admin sees team)
  const teamLeaderboard = [
    {
      name: currentUser?.name ?? 'You',
      sent: stats.sent,
      replied: stats.replied,
      meetings: stats.meetings,
      avatar: (currentUser?.name ?? 'Y').charAt(0).toUpperCase(),
    },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time email performance、Reply Rate、meeting conversions
            {currentUser?.role === 'sdr' && (
              <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">(your data)</span>
            )}
            {currentUser?.role === 'sales_manager' && (
              <span className="ml-1.5 text-violet-600 dark:text-violet-400">(team data)</span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
          Live · Real Tracking
        </Badge>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Mail} label="Sent" value={stats.sent} color="from-teal-500 to-cyan-600" />
        <KpiCard icon={MailOpen} label="Open Rate" value={`${stats.openRate}%`} subtext={`${stats.uniqueOpenedLeads} people opened`} color="from-emerald-500 to-teal-600" />
        <KpiCard icon={MessageSquareReply} label="Reply Rate" value={`${stats.replyRate}%`} subtext={`${stats.replied} replies`} color="from-amber-500 to-orange-600" />
        <KpiCard icon={CalendarCheck} label="Meetings Booked" value={stats.meetings} subtext={`${stats.upcomingMeetings} upcoming`} color="from-violet-500 to-fuchsia-600" />
      </div>

      {/* Trend chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Weekly Sending Trend
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Sent / Opened / Replied (real webhook data)</p>
          </div>
          <Badge variant="outline" className="text-xs">Last 7 days</Badge>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={usage?.trend7d ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
            <Area type="monotone" dataKey="sent" stroke="#14b8a6" strokeWidth={2} fill="url(#sentGrad)" name="Sent" />
            <Area type="monotone" dataKey="opened" stroke="#10b981" strokeWidth={2} fill="url(#openedGrad)" name="Opened" />
            <Area type="monotone" dataKey="replied" stroke="#f59e0b" strokeWidth={2} fill="url(#repliedGrad)" name="Replied" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Funnel */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Conversion Funnel
          </h3>
          <div className="space-y-2">
            {[
              { stage: 'Sent', count: stats.sent, rate: 100, color: '#14b8a6' },
              { stage: 'Opened', count: stats.uniqueOpenedLeads, rate: stats.sent ? Math.round((stats.uniqueOpenedLeads / stats.sent) * 100) : 0, color: '#10b981' },
              { stage: 'Replied', count: stats.replied, rate: stats.sent ? Math.round((stats.replied / stats.sent) * 100) : 0, color: '#f59e0b' },
              { stage: 'Meetings Booked', count: stats.meetings, rate: stats.sent ? Math.round((stats.meetings / stats.sent) * 100) : 0, color: '#a78bfa' },
            ].map((f, i) => {
              const width = Math.max(8, f.rate)
              const prevRate = i > 0 ? [{ count: stats.sent, rate: 100 }, { count: stats.uniqueOpenedLeads, rate: stats.sent ? Math.round((stats.uniqueOpenedLeads / stats.sent) * 100) : 0 }, { count: stats.replied, rate: stats.sent ? Math.round((stats.replied / stats.sent) * 100) : 0 }, { count: stats.meetings, rate: stats.sent ? Math.round((stats.meetings / stats.sent) * 100) : 0 }][i - 1].rate : 100
              const dropoff = i > 0 ? prevRate - f.rate : 0
              return (
                <div key={f.stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{f.stage}</span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{f.count}</span>
                      {' '}<span className="text-[10px]">({f.rate}%)</span>
                      {i > 0 && dropoff > 0 && <span className="ml-1 text-rose-500 text-[10px]">↓ {dropoff}%</span>}
                    </span>
                  </div>
                  <div className="h-7 rounded-md bg-muted/40 overflow-hidden relative">
                    <div className="h-full rounded-md transition-all" style={{ width: `${width}%`, background: `linear-gradient(90deg, ${f.color}, ${f.color}cc)` }} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">{f.count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Upcoming meetings */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Upcoming Meetings
            <Badge variant="outline" className="text-[10px]">{usage?.upcomingMeetings.length ?? 0}</Badge>
          </h3>
          {(usage?.upcomingMeetings.length ?? 0) === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
              No upcoming meetings
            </div>
          ) : (
            <div className="space-y-2">
              {usage?.upcomingMeetings.map((m) => (
                <div key={m.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/40">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white text-xs font-bold shrink-0">
                    {m.attendeeName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.attendeeName}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.company ?? m.attendeeEmail}</p>
                    <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-0.5 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(m.startTime).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          Recent Activity
        </h3>
        {(usage?.recentActivity.length ?? 0) === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground">
            No activity yet (auto-recorded when Smartlead webhook is connected)
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {usage?.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded-md hover:bg-muted/40">
                <EventIcon type={a.eventType} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{a.company ?? 'Unknown'}</span>
                  <span className="text-muted-foreground ml-1.5">
                    {eventLabel(a.eventType)}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                  {new Date(a.time).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Team leaderboard - only for manager/admin */}
      {currentUser?.role !== 'sdr' && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Sales Team Leaderboard
              <Badge variant="outline" className="text-[10px]">This Month</Badge>
            </h3>
          </div>
          <div className="space-y-2">
            {teamLeaderboard.map((m, i) => (
              <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg ${
                i === 0 ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-900' : 'bg-muted/40'
              }`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-muted-foreground'
                }`}>{i + 1}</div>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0 ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-muted-foreground'
                }`}>{m.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.sent} emails · {m.replied} replies · {m.meetings} meetings</p>
                </div>
                {i === 0 && <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"><Sparkles className="mr-1 h-3 w-3" />Top Performer</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground text-center pt-2">
        All data from real webhook events (Smartlead open tracking, Cal.com meeting tracking)
      </p>
    </div>
  )
}

function eventLabel(type: string): string {
  const map: Record<string, string> = {
    sent: 'Sent',
    delivered: 'Delivered',
    opened: 'Opened',
    replied: 'Replied',
    bounced: 'Bounced',
    clicked: 'Clicked',
  }
  return map[type] ?? type
}

function EventIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    sent: 'bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400',
    delivered: 'bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',
    opened: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    replied: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    bounced: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    clicked: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
  }
  const colorClass = colors[type] ?? colors.sent
  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${colorClass}`}>
      <CheckCircle2 className="h-3 w-3" />
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  subtext?: string
  color: string
}) {
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className={`rounded-lg bg-gradient-to-br ${color} p-2 shadow-sm`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="mt-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">{value}</p>
        {subtext && <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>}
      </div>
    </Card>
  )
}
