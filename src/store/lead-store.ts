import { create } from 'zustand'

export type LeadStatus =
  | 'new'
  | 'researching'
  | 'researched'
  | 'drafting'
  | 'ready'
  | 'sent'
  | 'replied'

export interface Lead {
  id: string
  company: string
  contactName: string | null
  title: string | null
  email: string | null
  linkedinUrl: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  location: string | null
  painPoints: string | null
  hiringSignals: string | null
  icebreaker: string | null
  emailSubject: string | null
  emailBody: string | null
  researchRaw: string | null
  deepResearch: string | null
  researchMode: string
  researchSources: string | null
  status: LeadStatus
  score: number | null
  tags: string | null
  createdAt: string
  updatedAt: string
}

export interface Stats {
  total: number
  new: number
  researched: number
  ready: number
  sent: number
  replied: number
}

interface SenderConfig {
  senderName: string
  senderCompany: string
  senderProduct: string
  tone: 'professional' | 'friendly' | 'concise' | 'bold'
  language: 'zh-TW' | 'en'
}

export interface EmailConfig {
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpFromName: string | null
  smtpFromEmail: string | null
  smtpSecure: boolean
  smartleadApiKey: string | null
  smartleadDefaultCampaignId: string | null
  hunterApiKey: string | null
  calComApiKey: string | null
  stripeSecretKey: string | null
  stripeMeteredPriceId: string | null
  // AI 提供者
  openaiApiKey: string | null
  openaiModel: string | null
  anthropicApiKey: string | null
  anthropicModel: string | null
  geminiApiKey: string | null
  geminiModel: string | null
  tavilyApiKey: string | null
  jinaApiKey: string | null
  firecrawlApiKey: string | null
  chatProviderOrder: string | null
  searchProviderOrder: string | null
  pageReaderProviderOrder: string | null
}

export interface DecisionMaker {
  name: string
  title: string
  seniority: 'c_level' | 'vp' | 'director' | 'manager' | 'other'
  email?: string
  linkedin?: string
  confidence: 'high' | 'medium' | 'low'
  email_source: 'apollo' | 'ai_predicted' | 'web_search' | 'unknown'
  priority: number
  reason?: string
}

export interface EnrichEmailResult {
  decisionMakers: DecisionMaker[]
  companyEmailPattern?: string
  totalFound: number
  hasEmailCount: number
}

export interface SmartleadCampaign {
  id: number
  name: string
  status?: string
  leadsCount?: number
  sequenceSteps?: number
  createdAt?: string
}

export interface ServiceOffering {
  serviceName: string | null
  description: string | null
  targetIndustries: string | null
  targetCompanySize: string | null
  targetLocation: string | null
  keyBenefits: string | null
  idealCustomerSignals: string | null
  updatedAt: string
}

export interface ProspectCandidate {
  company: string
  website: string
  industry?: string
  fit_score: number
  why_they_need_it: string
  suggested_angle: string
  key_signals: string[]
  confidence: 'high' | 'medium' | 'low'
  website_title?: string
}

export interface AutoProspectResult {
  candidates: ProspectCandidate[]
  ai_search_queries: string[]
  total_discovered: number
  evaluated: number
}

interface LeadStore {
  leads: Lead[]
  stats: Stats
  loading: boolean
  selectedLeadId: string | null
  filterStatus: LeadStatus | 'all'
  searchQuery: string
  senderConfig: SenderConfig
  emailConfig: EmailConfig | null
  smartleadCampaigns: SmartleadCampaign[]
  serviceOffering: ServiceOffering | null
  // Credit balance — fetched after every AI operation so UI stays fresh
  creditBalance: number | null
  creditAllowance: number | null
  fetchCredits: () => Promise<void>
  prospectResult: AutoProspectResult | null
  prospectLoading: boolean
  prospectStage: string
  prospectDetail: string
  prospectStep: number
  prospectTotalSteps: number
  prospectElapsedSeconds: number
  prospectJobId: string | null
  prospectError: string | null
  rateLimitedAt: number | null  // 第一次偵測到 429 的時間戳
  viewMode: 'admin' | 'sales' | 'analytics'
  setViewMode: (mode: 'admin' | 'sales' | 'analytics') => void
  // 當前使用者（從 NextAuth session 拿取）
  currentUser: {
    id: string
    email: string
    name: string
    role: 'admin' | 'sales_manager' | 'sdr'
    tenantId: string
    tenantName: string
    tenantSlug: string
    tenantPlan: string
  } | null
  setCurrentUser: (user: LeadStore['currentUser']) => void
  // actions
  fetchLeads: () => Promise<void>
  createLead: (data: Partial<Lead>) => Promise<Lead | null>
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  researchLead: (id: string, extraContext?: string, mode?: 'basic' | 'deep') => Promise<boolean>
  generateEmail: (id: string) => Promise<boolean>
  sendEmail: (id: string) => Promise<{ success: boolean; error?: string }>
  pushToSmartlead: (id: string, campaignId: number) => Promise<{ success: boolean; error?: string }>
  setFilterStatus: (status: LeadStatus | 'all') => void
  setSearchQuery: (q: string) => void
  setSelectedLeadId: (id: string | null) => void
  setSenderConfig: (cfg: Partial<SenderConfig>) => void
  fetchEmailConfig: () => Promise<void>
  saveEmailConfig: (cfg: Partial<EmailConfig>) => Promise<void>
  testEmailConfig: (action: 'test-smtp' | 'test-smartlead' | 'test-apollo') => Promise<{ success: boolean; message?: string; error?: string }>
  fetchSmartleadCampaigns: () => Promise<void>
  enrichEmail: (id: string) => Promise<{ success: boolean; result?: EnrichEmailResult; error?: string }>
  fetchServiceOffering: () => Promise<void>
  saveServiceOffering: (cfg: Partial<ServiceOffering>) => Promise<void>
  runAutoProspect: (params: {
    serviceName: string
    description: string
    targetIndustries?: string
    targetCompanySize?: string
    targetLocation?: string
    keyBenefits?: string
    idealCustomerSignals?: string
    targetCount?: number
    saveToDb?: boolean
  }) => Promise<{ success: boolean; error?: string; addedToLeads?: number }>
}

const DEFAULT_SENDER: SenderConfig = {
  senderName: 'Alex Chen',
  senderCompany: 'Outrovo',
  senderProduct:
    'AI 驅動的銷售開發自動化平台，幫助 B2B 團隊用更少人力開發更多高品質潛在客戶',
  tone: 'professional',
  language: 'zh-TW',
}

export const useLeadStore = create<LeadStore>((set, get) => ({
  leads: [],
  stats: { total: 0, new: 0, researched: 0, ready: 0, sent: 0, replied: 0 },
  loading: false,
  selectedLeadId: null,
  filterStatus: 'all',
  searchQuery: '',
  senderConfig: DEFAULT_SENDER,
  emailConfig: null,
  smartleadCampaigns: [],
  serviceOffering: null,
  prospectResult: null,
  prospectLoading: false,
  prospectStage: '',
  prospectDetail: '',
  prospectStep: 0,
  prospectTotalSteps: 6,
  prospectElapsedSeconds: 0,
  prospectJobId: null,
  prospectError: null,
  rateLimitedAt: null,
  creditBalance: null,
  creditAllowance: null,
  fetchCredits: async () => {
    try {
      const res = await fetch('/api/credits/balance')
      if (!res.ok) return
      const data = await res.json()
      set({ creditBalance: data.balance, creditAllowance: data.monthlyAllowance })
    } catch (e) {
      console.error('fetchCredits error:', e)
    }
  },
  viewMode: 'admin',
  setViewMode: (mode) => set({ viewMode: mode }),
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),

  fetchLeads: async () => {
    set({ loading: true })
    try {
      const { filterStatus, searchQuery } = get()
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/leads?${params.toString()}`)
      const data = await res.json()
      set({ leads: data.leads ?? [], stats: data.stats ?? get().stats })
    } catch (e) {
      console.error('fetchLeads error:', e)
    } finally {
      set({ loading: false })
    }
  },

  createLead: async (data) => {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const lead = await res.json()
      await get().fetchLeads()
      return lead
    } catch (e) {
      console.error('createLead error:', e)
      return null
    }
  },

  updateLead: async (id, data) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      await get().fetchLeads()
    } catch (e) {
      console.error('updateLead error:', e)
    }
  },

  deleteLead: async (id) => {
    try {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' })
      await get().fetchLeads()
    } catch (e) {
      console.error('deleteLead error:', e)
    }
  },

  researchLead: async (id, extraContext, mode = 'basic') => {
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, extraContext, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        const isRateLimited = (data.error ?? '').includes('429') || (data.error ?? '').includes('Too many requests')
        if (isRateLimited) {
          set({ rateLimitedAt: Date.now() })
        }
        // Refresh credits even on failure (may have been refunded)
        get().fetchCredits()
        console.error('researchLead failed:', data.error)
        return false
      }
      await get().fetchLeads()
      // Refresh credit balance — research just deducted credits
      get().fetchCredits()
      return true
    } catch (e) {
      console.error('researchLead error:', e)
      return false
    }
  },

  generateEmail: async (id) => {
    try {
      const cfg = get().senderConfig
      const res = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, ...cfg }),
      })
      const data = await res.json()
      if (!res.ok) {
        const isRateLimited = (data.error ?? '').includes('429') || (data.error ?? '').includes('Too many requests')
        if (isRateLimited) {
          set({ rateLimitedAt: Date.now() })
        }
        // Refresh credits even on failure (may have been refunded)
        get().fetchCredits()
        console.error('generateEmail failed:', data.error)
        return false
      }
      await get().fetchLeads()
      // Refresh credit balance — email gen just deducted credits
      get().fetchCredits()
      return true
    } catch (e) {
      console.error('generateEmail error:', e)
      return false
    }
  },

  setFilterStatus: (status) => set({ filterStatus: status }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
  setSenderConfig: (cfg) =>
    set((s) => ({ senderConfig: { ...s.senderConfig, ...cfg } })),

  fetchEmailConfig: async () => {
    try {
      const res = await fetch('/api/email-config')
      const data = await res.json()
      if (res.ok) {
        set({ emailConfig: data })
      }
    } catch (e) {
      console.error('fetchEmailConfig error:', e)
    }
  },

  saveEmailConfig: async (cfg) => {
    try {
      const res = await fetch('/api/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const data = await res.json()
      if (res.ok) {
        set({ emailConfig: data })
      }
    } catch (e) {
      console.error('saveEmailConfig error:', e)
    }
  },

  testEmailConfig: async (action) => {
    try {
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        return { success: true, message: data.message }
      }
      return { success: false, error: data.error ?? '測試失敗' }
    } catch (e) {
      console.error('testEmailConfig error:', e)
      return { success: false, error: '測試過程發生錯誤' }
    }
  },

  fetchSmartleadCampaigns: async () => {
    try {
      const res = await fetch('/api/smartlead/campaigns')
      const data = await res.json()
      if (res.ok) {
        set({ smartleadCampaigns: data.campaigns ?? [] })
      }
    } catch (e) {
      console.error('fetchSmartleadCampaigns error:', e)
    }
  },

  sendEmail: async (id) => {
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      })
      const data = await res.json()
      if (res.ok) {
        await get().fetchLeads()
        // Refresh credit balance — sending email costs 1 credit
        get().fetchCredits()
        return { success: true }
      }
      // Refresh credits on failure too (insufficient credits error path)
      get().fetchCredits()
      return { success: false, error: data.error ?? '發信失敗' }
    } catch (e) {
      console.error('sendEmail error:', e)
      return { success: false, error: '發信過程發生錯誤' }
    }
  },

  pushToSmartlead: async (id, campaignId) => {
    try {
      const res = await fetch('/api/smartlead/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, campaignId }),
      })
      const data = await res.json()
      if (res.ok) {
        await get().fetchLeads()
        return { success: true }
      }
      return { success: false, error: data.error ?? '推送失敗' }
    } catch (e) {
      console.error('pushToSmartlead error:', e)
      return { success: false, error: '推送過程發生錯誤' }
    }
  },

  enrichEmail: async (id) => {
    try {
      const res = await fetch('/api/enrich-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      })
      const data = await res.json()
      if (res.ok) {
        await get().fetchLeads()
        // Refresh credit balance — enrichment just deducted credits
        get().fetchCredits()
        return {
          success: true,
          result: {
            decisionMakers: data.decisionMakers ?? [],
            companyEmailPattern: data.companyEmailPattern,
            totalFound: data.totalFound ?? 0,
            hasEmailCount: data.hasEmailCount ?? 0,
          },
        }
      }
      const isRateLimited = (data.error ?? '').includes('429') || (data.error ?? '').includes('Too many requests')
      if (isRateLimited) {
        set({ rateLimitedAt: Date.now() })
      }
      // Refresh credits even on failure (may have been refunded)
      get().fetchCredits()
      return { success: false, error: data.error ?? 'Email enrichment 失敗' }
    } catch (e) {
      console.error('enrichEmail error:', e)
      return { success: false, error: '網路錯誤' }
    }
  },

  fetchServiceOffering: async () => {
    try {
      const res = await fetch('/api/service-offering')
      const data = await res.json()
      if (res.ok) set({ serviceOffering: data })
    } catch (e) {
      console.error('fetchServiceOffering error:', e)
    }
  },

  saveServiceOffering: async (cfg) => {
    try {
      const res = await fetch('/api/service-offering', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const data = await res.json()
      if (res.ok) set({ serviceOffering: data })
    } catch (e) {
      console.error('saveServiceOffering error:', e)
    }
  },

  runAutoProspect: async (params) => {
    const startTime = Date.now()
    set({
      prospectLoading: true,
      prospectResult: null,
      prospectStage: '啟動中',
      prospectDetail: 'AI 正在啟動自動開發引擎...',
      prospectStep: 0,
      prospectElapsedSeconds: 0,
      prospectJobId: null,
      prospectError: null,
    })

    // Live ticking clock — shown while SSE events stream in
    const ticker = setInterval(() => {
      set((s) => ({
        prospectElapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
      }))
    }, 1000)

    try {
      const res = await fetch('/api/auto-prospect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(params),
      })

      // 402 = insufficient credits, 400 = validation error — return as JSON
      if (!res.ok && res.status !== 200) {
        const errData = await res.json().catch(() => ({}) as any)
        const errorMsg = errData?.error ?? `HTTP ${res.status}`
        const isInsufficientCredits = res.status === 402
        set({
          prospectLoading: false,
          prospectStage: isInsufficientCredits ? 'AI 點數不足' : '失敗',
          prospectDetail: isInsufficientCredits
            ? errorMsg
            : errorMsg,
          prospectError: errorMsg,
          prospectStep: 6,
        })
        return { success: false, error: errorMsg }
      }

      // The response is a Server-Sent Events stream
      // Parse it line by line, updating progress as events arrive
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        // Fallback: treat as JSON (shouldn't happen with new code)
        const data = await res.json().catch(() => ({}) as any)
        const errorMsg = data?.error ?? '回應格式錯誤'
        set({
          prospectLoading: false,
          prospectStage: '失敗',
          prospectDetail: errorMsg,
          prospectError: errorMsg,
          prospectStep: 6,
        })
        return { success: false, error: errorMsg }
      }

      // Read the SSE stream
      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: any = null
      let addedToLeads = 0
      let hadError = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''  // keep the last incomplete chunk

        for (const evt of events) {
          // Each event looks like: "data: {...json...}"
          const line = evt.trim()
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          let data: any
          try {
            data = JSON.parse(jsonStr)
          } catch {
            continue
          }

          if (data.type === 'progress') {
            set({
              prospectStage: data.stage ?? '執行中',
              prospectDetail: data.detail ?? '',
              prospectStep: data.step ?? 1,
            })
          } else if (data.type === 'complete') {
            finalResult = data.result
            addedToLeads = data.addedToLeads ?? 0
            set({
              prospectResult: data.result ?? null,
              prospectLoading: false,
              prospectStage: '完成',
              prospectDetail: data.detail ?? `找到 ${data.result?.candidates?.length ?? 0} 家潛在客戶`,
              prospectStep: 6,
            })
            // Refresh credit balance so UI shows the deduction immediately
            get().fetchCredits()
          } else if (data.type === 'error') {
            hadError = true
            const errorMsg = data.error ?? '自動開發失敗'
            const isRateLimited = errorMsg.includes('429') || errorMsg.includes('Too many requests')
            set({
              prospectLoading: false,
              prospectStage: isRateLimited ? 'AI 配額用完' : '失敗',
              prospectDetail: isRateLimited
                ? 'AI 服務配額已用完（429）。這通常是每日配額限制，請過 1-2 小時再試。已儲存的名單與設定不受影響。'
                : errorMsg + (data.creditsRefunded ? `（已退還 ${data.creditsRefunded} 點數）` : ''),
              prospectError: errorMsg,
              prospectStep: 6,
              rateLimitedAt: isRateLimited ? Date.now() : null,
            })
            // Refresh credit balance (may have been refunded)
            get().fetchCredits()
          }
        }
      }

      if (hadError) {
        return { success: false, error: 'auto-prospect failed' }
      }

      if (finalResult && params.saveToDb) {
        await get().fetchLeads()
      }
      return { success: true, addedToLeads }
    } catch (e: any) {
      console.error('runAutoProspect error:', e)
      const msg = e?.message ?? '網路錯誤'
      // Vercel returns 504 FUNCTION_TIMEOUT when maxDuration is exceeded
      const isTimeout = msg.includes('timeout') || msg.includes('aborted') || e?.name === 'AbortError'
      set({
        prospectLoading: false,
        prospectStage: isTimeout ? '超時' : '錯誤',
        prospectDetail: isTimeout
          ? 'AI 任務超過伺服器時間上限（Vercel Hobby 限制 60 秒 / Pro 限制 300 秒）。請減少目標數量後再試，或將服務介紹寫得更精簡。'
          : '網路錯誤，請確認伺服器連線正常',
        prospectError: isTimeout ? '超時' : msg,
        prospectStep: 6,
      })
      return { success: false, error: isTimeout ? '超時' : msg }
    } finally {
      clearInterval(ticker)
    }
  },
}))
