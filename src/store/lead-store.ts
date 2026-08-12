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
  apolloApiKey: string | null
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
  prospectResult: AutoProspectResult | null
  prospectLoading: boolean
  prospectStage: string
  prospectDetail: string
  prospectStep: number
  prospectTotalSteps: number
  prospectElapsedSeconds: number
  prospectJobId: string | null
  prospectError: string | null
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
  senderCompany: 'GrowthForge',
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

  researchLead: async (id, extraContext, mode: 'basic' | 'deep' = 'basic') => {
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, extraContext, mode }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('researchLead failed:', data.error)
        return false
      }
      await get().fetchLeads()
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
        console.error('generateEmail failed:', data.error)
        return false
      }
      await get().fetchLeads()
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
        return { success: true }
      }
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
    set({
      prospectLoading: true,
      prospectResult: null,
      prospectStage: '啟動中',
      prospectDetail: '正在建立 AI 任務...',
      prospectStep: 0,
      prospectElapsedSeconds: 0,
      prospectJobId: null,
      prospectError: null,
    })

    try {
      // 步驟 1：啟動任務，取得 jobId
      const startRes = await fetch('/api/auto-prospect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const startData = await startRes.json()

      if (!startRes.ok) {
        set({
          prospectLoading: false,
          prospectStage: '失敗',
          prospectDetail: startData.error ?? '啟動失敗',
          prospectError: startData.error ?? '啟動失敗',
        })
        return { success: false, error: startData.error ?? '啟動失敗' }
      }

      const jobId = startData.jobId as string
      set({ prospectJobId: jobId })

      // 步驟 2：輪詢進度（每 2 秒）
      let pollCount = 0
      const maxPolls = 200 // 最長 400 秒
      while (pollCount < maxPolls) {
        await new Promise((r) => setTimeout(r, 2000))
        pollCount++

        try {
          const statusRes = await fetch(`/api/auto-prospect/status?jobId=${jobId}`)
          if (!statusRes.ok) {
            console.error('status poll failed:', statusRes.status)
            continue
          }
          const status = await statusRes.json()

          set({
            prospectStage: status.stage ?? '',
            prospectDetail: status.detail ?? '',
            prospectStep: status.step ?? 0,
            prospectElapsedSeconds: status.elapsedSeconds ?? 0,
          })

          if (status.status === 'completed') {
            set({
              prospectResult: status.result ?? null,
              prospectLoading: false,
              prospectStage: '完成',
              prospectDetail: status.detail,
              prospectStep: 6,
            })
            if (status.result && params.saveToDb) {
              await get().fetchLeads()
            }
            return { success: true, addedToLeads: 0 }
          }

          if (status.status === 'failed') {
            set({
              prospectLoading: false,
              prospectStage: '失敗',
              prospectDetail: status.error ?? status.detail ?? '自動開發失敗',
              prospectError: status.error ?? '自動開發失敗',
              prospectStep: 6,
            })
            return { success: false, error: status.error ?? '自動開發失敗' }
          }
        } catch (pollErr) {
          console.error('poll error (will retry):', pollErr)
          // 不中斷，繼續輪詢
        }
      }

      // 超過最大輪詢次數
      set({
        prospectLoading: false,
        prospectStage: '超時',
        prospectDetail: '任務執行超過 6 分鐘，請稍後再試或減少目標數量',
        prospectError: '超時',
      })
      return { success: false, error: '任務超時' }
    } catch (e) {
      console.error('runAutoProspect error:', e)
      set({
        prospectLoading: false,
        prospectStage: '錯誤',
        prospectDetail: '網路錯誤，請確認伺服器連線正常',
        prospectError: '網路錯誤',
      })
      return { success: false, error: '網路錯誤' }
    }
  },
}))
