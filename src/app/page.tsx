'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Table2,
  Sparkles,
  Settings,
  Plus,
  Upload,
  Rocket,
  Github,
  Database,
  Mail,
  Wand2,
  AlertTriangle,
  X,
  LayoutDashboard,
  BarChart3,
  Send,
  Crown,
  LogOut,
  Users,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { useLeadStore } from '@/store/lead-store'
import { StatsDashboard } from '@/components/lead-engine/stats-dashboard'
import { LeadsTable } from '@/components/lead-engine/leads-table'
import { ResearchPanel } from '@/components/lead-engine/research-panel'
import { SenderConfigPanel } from '@/components/lead-engine/sender-config-panel'
import { EmailSendingPanel } from '@/components/lead-engine/email-sending-panel'
import { AutoProspectPanel } from '@/components/lead-engine/auto-prospect-panel'
import { LeadDetailSheet } from '@/components/lead-engine/lead-detail-sheet'
import { AddLeadModal, ImportModal } from '@/components/lead-engine/modals'
import { SalesCardFeed } from '@/components/sales-view/sales-card-feed'
import { AnalyticsDashboard } from '@/components/analytics-view/analytics-dashboard'
import { BillingPanel } from '@/components/billing/billing-panel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABELS } from '@/lib/auth/auth-options'
import type { Role } from '@/lib/auth/auth-options'
import { toast } from 'sonner'

const ROLE_VIEW_ACCESS: Record<Role, {
  admin: boolean
  sales: boolean
  analytics: boolean
  billing: boolean
}> = {
  admin: { admin: true, sales: true, analytics: true, billing: true },
  sales_manager: { admin: false, sales: true, analytics: true, billing: false },
  sdr: { admin: false, sales: true, analytics: false, billing: false },
}

const ROLE_COLORS: Record<Role, string> = {
  admin: 'from-amber-500 to-orange-600',
  sales_manager: 'from-violet-500 to-fuchsia-600',
  sdr: 'from-emerald-500 to-teal-600',
}

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  admin: Crown,
  sales_manager: Users,
  sdr: Send,
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const fetchLeads = useLeadStore((s) => s.fetchLeads)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const fetchServiceOffering = useLeadStore((s) => s.fetchServiceOffering)
  const setCurrentUser = useLeadStore((s) => s.setCurrentUser)
  const currentUser = useLeadStore((s) => s.currentUser)
  const leads = useLeadStore((s) => s.leads)
  const selectedLeadId = useLeadStore((s) => s.selectedLeadId)
  const setSelectedLeadId = useLeadStore((s) => s.setSelectedLeadId)
  const rateLimitedAt = useLeadStore((s) => s.rateLimitedAt)
  const viewMode = useLeadStore((s) => s.viewMode)
  const setViewMode = useLeadStore((s) => s.setViewMode)
  const [rateBannerDismissed, setRateBannerDismissed] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // 同步 session user 到 store
  useEffect(() => {
    if (session?.user) {
      const u = session.user as any
      setCurrentUser({
        id: u.id,
        email: u.email ?? '',
        name: u.name ?? '',
        role: u.role,
        tenantId: u.tenantId,
        tenantName: u.tenantName,
        tenantSlug: u.tenantSlug,
        tenantPlan: u.tenantPlan,
      })
    } else {
      setCurrentUser(null)
    }
  }, [session, setCurrentUser])

  // 未登入 → 導向 /login
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // 初次載入
  useEffect(() => {
    if (status === 'authenticated') {
      fetchLeads()
      fetchEmailConfig()
      fetchServiceOffering()
    }
  }, [status, fetchLeads, fetchEmailConfig, fetchServiceOffering])

  const filterStatus = useLeadStore((s) => s.filterStatus)
  useEffect(() => {
    if (status === 'authenticated') fetchLeads()
  }, [filterStatus, fetchLeads, status])

  // 確認 role 能存取當前 view，不能就切到 sales
  useEffect(() => {
    if (currentUser) {
      const access = ROLE_VIEW_ACCESS[currentUser.role]
      if (!access[viewMode]) {
        // 切到預設可存取的 view
        if (access.sales) setViewMode('sales')
        else if (access.analytics) setViewMode('analytics')
        else if (access.admin) setViewMode('admin')
      }
    }
  }, [currentUser, viewMode, setViewMode])

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg mb-3 animate-pulse">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <p className="text-sm text-muted-foreground">載入中...</p>
        </div>
      </div>
    )
  }

  if (!session?.user) return null

  const user = currentUser
  if (!user) return null

  const access = ROLE_VIEW_ACCESS[user.role]
  const RoleIcon = ROLE_ICONS[user.role]

  const detailOpen = !!selectedLeadId
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                LeadForge<span className="text-emerald-600 dark:text-emerald-400"> AI</span>
              </h1>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
                {user.tenantName}
                <span className="ml-1.5 px-1 py-0.5 rounded bg-muted/60 text-[9px] uppercase tracking-wider">
                  {user.tenantPlan}
                </span>
              </p>
            </div>
          </div>

          {/* View switcher */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/60">
            {access.admin && (
              <ViewSwitcherBtn active={viewMode === 'admin'} onClick={() => setViewMode('admin')} icon={LayoutDashboard} label="後台" />
            )}
            {access.sales && (
              <ViewSwitcherBtn active={viewMode === 'sales'} onClick={() => setViewMode('sales')} icon={Send} label="業務前台" />
            )}
            {access.analytics && (
              <ViewSwitcherBtn active={viewMode === 'analytics'} onClick={() => setViewMode('analytics')} icon={BarChart3} label="數據儀表板" />
            )}
            {access.billing && (
              <ViewSwitcherBtn active={viewMode === 'billing'} onClick={() => setViewMode('billing')} icon={CreditCard} label="計費" />
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {viewMode === 'admin' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">批次匯入</span>
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">新增名單</span>
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-muted/60 transition-colors">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_COLORS[user.role]} text-white text-xs font-bold shrink-0`}>
                    {user.name.charAt(0)}
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-medium leading-none">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-none flex items-center gap-0.5">
                      <RoleIcon className="h-2.5 w-2.5" />
                      {ROLE_LABELS[user.role]}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="space-y-1">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <RoleIcon className="h-3 w-3" />
                      <span className="text-xs">{ROLE_LABELS[user.role]}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pt-0.5">
                      租戶：{user.tenantName}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile view switcher */}
        <div className="md:hidden border-t border-border/60 px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {access.admin && (
            <ViewSwitcherBtn active={viewMode === 'admin'} onClick={() => setViewMode('admin')} icon={LayoutDashboard} label="後台" mobile />
          )}
          {access.sales && (
            <ViewSwitcherBtn active={viewMode === 'sales'} onClick={() => setViewMode('sales')} icon={Send} label="業務" mobile />
          )}
          {access.analytics && (
            <ViewSwitcherBtn active={viewMode === 'analytics'} onClick={() => setViewMode('analytics')} icon={BarChart3} label="數據" mobile />
          )}
          {access.billing && (
            <ViewSwitcherBtn active={viewMode === 'billing'} onClick={() => setViewMode('billing')} icon={CreditCard} label="計費" mobile />
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full px-4 sm:px-6 py-5 space-y-5" style={{ maxWidth: viewMode === 'sales' ? '640px' : '1400px' }}>
        {/* Rate limit 橫幅 */}
        {rateLimitedAt && !rateBannerDismissed && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                AI 服務配額暫時用完（429 Too Many Requests）
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                AI 研究、自動開發、郵件生成、找 Email 等功能暫時無法使用。已儲存的名單、研究結果、郵件內容都不受影響，可繼續編輯與發信。
              </p>
            </div>
            <button onClick={() => setRateBannerDismissed(true)} className="text-amber-600 dark:text-amber-400 shrink-0" aria-label="關閉">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* === Admin 後台 === */}
        {viewMode === 'admin' && access.admin && (
          <>
            <StatsDashboard />
            <Tabs defaultValue="leads" className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-5">
                <TabsTrigger value="leads"><Table2 className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">名單</span></TabsTrigger>
                <TabsTrigger value="prospect"><Wand2 className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">自動開發</span></TabsTrigger>
                <TabsTrigger value="research"><Sparkles className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">AI 研究</span></TabsTrigger>
                <TabsTrigger value="settings"><Settings className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">寄件人</span></TabsTrigger>
                <TabsTrigger value="email"><Mail className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">發信</span></TabsTrigger>
              </TabsList>
              <TabsContent value="leads" className="mt-4"><LeadsTable /></TabsContent>
              <TabsContent value="prospect" className="mt-4"><AutoProspectPanel /></TabsContent>
              <TabsContent value="research" className="mt-4">
                <div className="grid gap-5 lg:grid-cols-2">
                  <ResearchPanel />
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg bg-cyan-100 dark:bg-cyan-950/50 p-2"><Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" /></div>
                      <div><h2 className="text-base font-semibold">工作流程</h2><p className="text-xs text-muted-foreground">從研究到發信的完整 4 步驟</p></div>
                    </div>
                    <ol className="space-y-3">
                      {[{n:'1',t:'建立名單',d:'手動新增、CSV/JSON 批次匯入，或直接從研究面板輸入網站由 AI 自動建立'},{n:'2',t:'AI 公司研究',d:'Claygent 引擎透過 page_reader 抓取官網，AI 整理出痛點、徵才訊號、採購意圖、切入點'},{n:'3',t:'AI 生成冷郵件',d:'根據研究結果，AI 撰寫個人化主旨、開場白、價值主張、行動呼籲'},{n:'4',t:'發送郵件',d:'透過 SMTP 直接發信，或推送到 Smartlead 由專業發信平台代發，自動追蹤成效'}].map((step) => (
                        <li key={step.n} className="flex gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-xs font-bold text-emerald-700 dark:text-emerald-400">{step.n}</div>
                          <div><p className="text-sm font-medium">{step.t}</p><p className="text-xs text-muted-foreground mt-0.5">{step.d}</p></div>
                        </li>
                      ))}
                    </ol>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="mt-4"><div className="max-w-2xl"><SenderConfigPanel /></div></TabsContent>
              <TabsContent value="email" className="mt-4"><div className="max-w-2xl"><EmailSendingPanel /></div></TabsContent>
            </Tabs>
          </>
        )}

        {/* === Sales 業務前台 === */}
        {viewMode === 'sales' && access.sales && (
          <SalesCardFeed onEditLead={(id) => setSelectedLeadId(id)} />
        )}

        {/* === Analytics 數據儀表板 === */}
        {viewMode === 'analytics' && access.analytics && (
          <AnalyticsDashboard />
        )}

        {/* === Billing 計費 === */}
        {viewMode === 'billing' && access.billing && (
          <BillingPanel />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 py-4">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Powered by Z.ai · {leads.length} 筆名單
            <span className="ml-2 px-1.5 py-0.5 rounded bg-muted/60">{ROLE_LABELS[user.role]}</span>
          </span>
          <a href="https://chat.z.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ShieldCheck className="h-3 w-3" />
            Tenant-isolated SaaS
          </a>
        </div>
      </footer>

      {/* Modals & Sheets */}
      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
      <LeadDetailSheet
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={(open) => { if (!open) setSelectedLeadId(null) }}
      />
      <Toaster />
    </div>
  )
}

function ViewSwitcherBtn({
  active,
  onClick,
  icon: Icon,
  label,
  mobile,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  mobile?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        active
          ? 'bg-background shadow-sm text-emerald-700 dark:text-emerald-400'
          : 'text-muted-foreground hover:text-foreground'
      } ${mobile ? 'shrink-0' : ''}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
