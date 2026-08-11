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

interface LeadStore {
  leads: Lead[]
  stats: Stats
  loading: boolean
  selectedLeadId: string | null
  filterStatus: LeadStatus | 'all'
  searchQuery: string
  senderConfig: SenderConfig
  // actions
  fetchLeads: () => Promise<void>
  createLead: (data: Partial<Lead>) => Promise<Lead | null>
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>
  deleteLead: (id: string) => Promise<void>
  researchLead: (id: string, extraContext?: string) => Promise<boolean>
  generateEmail: (id: string) => Promise<boolean>
  setFilterStatus: (status: LeadStatus | 'all') => void
  setSearchQuery: (q: string) => void
  setSelectedLeadId: (id: string | null) => void
  setSenderConfig: (cfg: Partial<SenderConfig>) => void
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

  researchLead: async (id, extraContext) => {
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id, extraContext }),
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
}))
