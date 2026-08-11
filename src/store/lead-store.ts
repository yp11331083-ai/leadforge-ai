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
}

export interface SmartleadCampaign {
  id: number
  name: string
  status?: string
  leadsCount?: number
  sequenceSteps?: number
  createdAt?: string
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
  testEmailConfig: (action: 'test-smtp' | 'test-smartlead') => Promise<{ success: boolean; message?: string; error?: string }>
  fetchSmartleadCampaigns: () => Promise<void>
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
}))
