'use client'

import { useEffect, useState } from 'react'
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
import { LeadDetailSheet } from '@/components/lead-engine/lead-detail-sheet'
import { AddLeadModal, ImportModal } from '@/components/lead-engine/modals'

export default function Home() {
  const fetchLeads = useLeadStore((s) => s.fetchLeads)
  const fetchEmailConfig = useLeadStore((s) => s.fetchEmailConfig)
  const leads = useLeadStore((s) => s.leads)
  const selectedLeadId = useLeadStore((s) => s.selectedLeadId)
  const setSelectedLeadId = useLeadStore((s) => s.setSelectedLeadId)

  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // 初次載入
  useEffect(() => {
    fetchLeads()
    fetchEmailConfig()
  }, [fetchLeads, fetchEmailConfig])

  // 監聽 filterStatus 變化
  const filterStatus = useLeadStore((s) => s.filterStatus)
  useEffect(() => {
    fetchLeads()
  }, [filterStatus, fetchLeads])

  // 點擊 lead 時自動開啟 detail sheet（detailOpen 直接由 selectedLeadId 推導）
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
                AI Cold Outreach &amp; Lead Generation Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">批次匯入</span>
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">新增名單</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-[1400px] w-full px-4 sm:px-6 py-5 space-y-5">
        {/* 統計儀表板 */}
        <StatsDashboard />

        {/* 主內容 Tabs */}
        <Tabs defaultValue="leads" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="leads">
              <Table2 className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">名單</span>
            </TabsTrigger>
            <TabsTrigger value="research">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI 研究</span>
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">寄件人</span>
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">發信設定</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-4">
            <LeadsTable />
          </TabsContent>

          <TabsContent value="research" className="mt-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <ResearchPanel />
              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="rounded-lg bg-cyan-100 dark:bg-cyan-950/50 p-2">
                      <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">工作流程</h2>
                      <p className="text-xs text-muted-foreground">
                        從研究到發信的完整 4 步驟
                      </p>
                    </div>
                  </div>
                  <ol className="space-y-3">
                    {[
                      {
                        n: '1',
                        title: '建立名單',
                        desc: '手動新增、CSV/JSON 批次匯入，或直接從研究面板輸入網站由 AI 自動建立',
                      },
                      {
                        n: '2',
                        title: 'AI 公司研究',
                        desc: 'Claygent 引擎透過 page_reader 抓取官網，AI 整理出痛點、徵才訊號、採購意圖、切入點',
                      },
                      {
                        n: '3',
                        title: 'AI 生成冷郵件',
                        desc: '根據研究結果，AI 撰寫個人化主旨、開場白、價值主張、行動呼籲',
                      },
                      {
                        n: '4',
                        title: '發送郵件',
                        desc: '透過 SMTP 直接發信，或推送到 Smartlead 由專業發信平台代發，自動追蹤成效',
                      },
                    ].map((step) => (
                      <li key={step.n} className="flex gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {step.n}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{step.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {step.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>

                <Card className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-900">
                  <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                    核心優勢
                  </h3>
                  <ul className="space-y-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                    <li className="flex gap-1.5">
                      <span className="font-bold">▸</span>
                      <span>AI 真實瀏覽網站，不是靠搜尋結果猜測</span>
                    </li>
                    <li className="flex gap-1.5">
                      <span className="font-bold">▸</span>
                      <span>研究 + 郵件一體化，省去切換工具</span>
                    </li>
                    <li className="flex gap-1.5">
                      <span className="font-bold">▸</span>
                      <span>可編輯的 AI 文案，不是黑盒子</span>
                    </li>
                    <li className="flex gap-1.5">
                      <span className="font-bold">▸</span>
                      <span>潛在客戶評分系統，排序聯繫優先級</span>
                    </li>
                  </ul>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="max-w-2xl">
              <SenderConfigPanel />
            </div>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <div className="max-w-2xl">
              <EmailSendingPanel />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 py-4">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Powered by Z.ai · {leads.length} 筆名單
          </span>
          <a
            href="https://chat.z.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-3 w-3" />
            Built with Next.js + z-ai-web-dev-sdk
          </a>
        </div>
      </footer>

      {/* Modals & Sheets */}
      <AddLeadModal open={addOpen} onOpenChange={setAddOpen} />
      <ImportModal open={importOpen} onOpenChange={setImportOpen} />
      <LeadDetailSheet
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedLeadId(null)
        }}
      />
      <Toaster />
    </div>
  )
}
