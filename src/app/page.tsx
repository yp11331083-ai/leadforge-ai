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
  Hammer,
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
  Cpu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { useLeadStore } from '@/store/lead-store'
import { StatsDashboard } from '@/components/lead-engine/stats-dashboard'
import { LeadsTable } from '@/components/lead-engine/leads-table'
import { AutoProspectPanel } from '@/components/lead-engine/auto-prospect-panel'
import { SenderConfigPanel } from '@/components/lead-engine/sender-config-panel'
import { EmailSendingPanel } from '@/components/lead-engine/email-sending-panel'
import { AiProviderPanel } from '@/components/lead-engine/ai-provider-panel'
import { LeadDetailSheet } from '@/components/lead-engine/lead-detail-sheet'
import { AddLeadModal, ImportModal } from '@/components/lead-engine/modals'
import { SalesCardFeed } from '@/components/sales-view/sales-card-feed'
import { AnalyticsDashboard } from '@/components/analytics-view/analytics-dashboard'
import { BillingPanel } from '@/components/billing/billing-panel'
import { AssistantWidget } from '@/components/assistant/assistant-widget'
import { LandingPage } from '@/components/landing/landing-page'
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

  // Not signed in → show landing page (instead of redirecting to /login)
  // User can click "Get Started" on the landing page to go to /signup or /login
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Don't redirect — show landing page instead
    }
  }, [status])

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

  // Confirm role 能存取當前 view，不能就切到 sales
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <img src="/logo.png" alt="Outrovo" className="h-12 w-12 rounded-xl shadow-lg mb-3 animate-pulse" />
          <p className="text-sm text-stone-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Not signed in → show landing page
  if (!session?.user) {
    return <LandingPage />
  }

  const user = currentUser
  if (!user) return null

  const access = ROLE_VIEW_ACCESS[user.role]
  const RoleIcon = ROLE_ICONS[user.role]

  const detailOpen = !!selectedLeadId
  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-stone-50/80 backdrop-blur-lg">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Outrovo" className="h-9 w-9 rounded-xl object-cover shadow-md" />
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                <span>Outrovo</span>
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
              <ViewSwitcherBtn active={viewMode === 'admin'} onClick={() => setViewMode('admin')} icon={LayoutDashboard} label="Admin" />
            )}
            {access.sales && (
              <ViewSwitcherBtn active={viewMode === 'sales'} onClick={() => setViewMode('sales')} icon={Send} label="Sales" />
            )}
            {access.analytics && (
              <ViewSwitcherBtn active={viewMode === 'analytics'} onClick={() => setViewMode('analytics')} icon={BarChart3} label="Analytics" />
            )}
            {access.billing && (
              <ViewSwitcherBtn active={viewMode === 'billing'} onClick={() => setViewMode('billing')} icon={CreditCard} label="Billing" />
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {viewMode === 'admin' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Import</span>
                </Button>
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add Lead</span>
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
                      Workspace: {user.tenantName}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-rose-600 dark:text-rose-400 focus:text-rose-700 dark:focus:text-rose-300"
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile view switcher */}
        <div className="md:hidden border-t border-border/60 px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {access.admin && (
            <ViewSwitcherBtn active={viewMode === 'admin'} onClick={() => setViewMode('admin')} icon={LayoutDashboard} label="Admin" mobile />
          )}
          {access.sales && (
            <ViewSwitcherBtn active={viewMode === 'sales'} onClick={() => setViewMode('sales')} icon={Send} label="Sales" mobile />
          )}
          {access.analytics && (
            <ViewSwitcherBtn active={viewMode === 'analytics'} onClick={() => setViewMode('analytics')} icon={BarChart3} label="Analytics" mobile />
          )}
          {access.billing && (
            <ViewSwitcherBtn active={viewMode === 'billing'} onClick={() => setViewMode('billing')} icon={CreditCard} label="Billing" mobile />
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
                AI Service Quota Exhausted (429 Too Many Requests)
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                AI research, auto-prospecting, email generation, and email enrichment are temporarily unavailable. Saved leads, research results, and email content are not affected — you can still edit and send emails.
              </p>
            </div>
            <button onClick={() => setRateBannerDismissed(true)} className="text-amber-600 dark:text-amber-400 shrink-0" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* === Admin Admin === */}
        {viewMode === 'admin' && access.admin && (
          <>
            <StatsDashboard />
            <Tabs defaultValue="leads" className="w-full">
              <TabsList className="grid w-full max-w-2xl grid-cols-5">
                <TabsTrigger value="leads"><Table2 className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">Leads</span></TabsTrigger>
                <TabsTrigger value="prospect"><Hammer className="mr-1.5 h-3.5 w-3.5 shrink-0" style={{ transform: "scale(0.85)" }} /><span className="hidden md:inline">Prospect</span></TabsTrigger>
                <TabsTrigger value="settings"><Settings className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">Sender</span></TabsTrigger>
                <TabsTrigger value="email"><Mail className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">Email</span></TabsTrigger>
                <TabsTrigger value="providers"><Cpu className="mr-1.5 h-3.5 w-3.5" /><span className="hidden md:inline">AI Providers</span></TabsTrigger>
              </TabsList>
              <TabsContent value="leads" className="mt-4"><LeadsTable /></TabsContent>
              <TabsContent value="prospect" className="mt-4"><AutoProspectPanel /></TabsContent>
              <TabsContent value="settings" className="mt-4"><div className="max-w-2xl"><SenderConfigPanel /></div></TabsContent>
              <TabsContent value="email" className="mt-4"><div className="max-w-2xl"><EmailSendingPanel /></div></TabsContent>
              <TabsContent value="providers" className="mt-4"><div className="max-w-2xl"><AiProviderPanel /></div></TabsContent>
            </Tabs>
          </>
        )}

        {/* === Sales Sales === */}
        {viewMode === 'sales' && access.sales && (
          <SalesCardFeed onEditLead={(id) => setSelectedLeadId(id)} />
        )}

        {/* === Analytics Analytics === */}
        {viewMode === 'analytics' && access.analytics && (
          <AnalyticsDashboard />
        )}

        {/* === Billing Billing === */}
        {viewMode === 'billing' && access.billing && (
          <BillingPanel />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200/60 bg-stone-100 py-4">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 flex items-center justify-between text-xs text-stone-400">
          <span>
            Outrovo · {leads.length} leads
            <span className="ml-2 px-1.5 py-0.5 rounded bg-stone-200/60 text-stone-600">{ROLE_LABELS[user.role]}</span>
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Tenant-isolated SaaS
          </span>
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

      {/* Floating AI Assistant — always available */}
      <AssistantWidget />

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
