'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Bot, X, Send, Loader2, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { useLeadStore } from '@/store/lead-store'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant'
  content: string
  actionResult?: 'pending' | 'success' | 'failed'
  actionLabel?: string
}

const SUGGESTED_QUESTIONS = [
  'Find me 5 leads in fintech',
  'Research stripe.com',
  'How many credits do I have?',
  'Take me to billing',
]

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const creditBalance = useLeadStore((s) => s.creditBalance)
  const currentUser = useLeadStore((s) => s.currentUser)
  const leads = useLeadStore((s) => s.leads)
  const runAutoProspect = useLeadStore((s) => s.runAutoProspect)
  const researchLead = useLeadStore((s) => s.researchLead)
  const generateEmail = useLeadStore((s) => s.generateEmail)
  const enrichEmail = useLeadStore((s) => s.enrichEmail)
  const setViewMode = useLeadStore((s) => s.setViewMode)
  const fetchServiceOffering = useLeadStore((s) => s.fetchServiceOffering)
  const serviceOffering = useLeadStore((s) => s.serviceOffering)

  useEffect(() => {
    fetchServiceOffering()
  }, [fetchServiceOffering])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const executeAction = async (action: any): Promise<{ success: boolean; label: string }> => {
    if (!action?.type) return { success: false, label: 'Unknown action' }

    try {
      switch (action.type) {
        case 'go_to_tab': {
          const tab = action.params?.tab
          if (tab && ['admin', 'sales', 'analytics', 'billing'].includes(tab)) {
            setViewMode(tab as any)  // 'billing' works at runtime even though the type doesn't include it
            return { success: true, label: 'Switched to ' + tab }
          }
          return { success: false, label: 'Invalid tab' }
        }

        case 'find_leads': {
          const targetCount = Math.min(action.params?.targetCount ?? 5, 10)
          const desc = action.params?.description
          const serviceName = serviceOffering?.serviceName || ''
          const description = desc || serviceOffering?.description || ''

          if (!serviceName || !description) {
            return {
              success: false,
              label: 'Please set your service description in the Auto-Prospect tab first',
            }
          }

          toast.info('Starting auto-prospect from assistant...')
          const result = await runAutoProspect({
            serviceName,
            description,
            targetCount,
            saveToDb: true,
          })

          if (result.success) {
            return {
              success: true,
              label: `Found and added leads to your list`,
            }
          }
          return { success: false, label: result.error ?? 'Auto-prospect failed' }
        }

        case 'research_company': {
          const { website, company, mode = 'basic' } = action.params || {}
          if (!website) {
            return { success: false, label: 'No website specified' }
          }

          // Create a temporary lead or research directly
          try {
            const res = await fetch('/api/research', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ website, company: company || website, mode }),
            })
            const data = await res.json()
            if (res.ok && data.success) {
              return { success: true, label: `Research complete for ${company || website}` }
            }
            return { success: false, label: data.error ?? 'Research failed' }
          } catch (e) {
            return { success: false, label: 'Research request failed' }
          }
        }

        case 'generate_email': {
          const { leadId } = action.params || {}
          if (!leadId) {
            return { success: false, label: 'No lead specified — tell me which company' }
          }
          const success = await generateEmail(leadId)
          return {
            success,
            label: success ? 'Email generated — check the lead' : 'Email generation failed',
          }
        }

        case 'enrich_email': {
          const { leadId } = action.params || {}
          if (!leadId) {
            return { success: false, label: 'No lead specified — tell me which company' }
          }
          const result = await enrichEmail(leadId)
          return {
            success: result.success,
            label: result.success
              ? 'Email found — check the lead'
              : result.error ?? 'Enrichment failed',
          }
        }

        default:
          return { success: false, label: `Unknown action: ${action.type}` }
      }
    } catch (e: any) {
      return { success: false, label: e?.message ?? 'Action failed' }
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const recentLeads = leads.slice(0, 5).map((l) => ({
        company: l.company,
        id: l.id,
        website: l.website,
      }))

      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            plan: currentUser?.tenantPlan ?? 'unknown',
            credits: creditBalance ?? 'unknown',
            leadsCount: leads.length,
            recentLeads,
          },
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })
      const data = await res.json()

      if (res.ok && data.reply) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: data.reply,
          actionResult: data.action ? 'pending' : undefined,
          actionLabel: data.action?.type,
        }
        setMessages((m) => [...m, assistantMsg])

        // If there's an action, execute it
        if (data.action) {
          const result = await executeAction(data.action)

          // Update the assistant message with the result
          setMessages((m) =>
            m.map((msg, i) =>
              i === m.length - 1
                ? {
                    ...msg,
                    actionResult: result.success ? 'success' : 'failed',
                    actionLabel: result.label,
                  }
                : msg
            )
          )

          // If action failed, add a follow-up message
          if (!result.success) {
            setMessages((m) => [
              ...m,
              {
                role: 'assistant',
                content: `⚠️ ${result.label}. Want me to try something else?`,
              },
            ])
          }
        }
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: data.error ?? 'Sorry, I could not process that. Please try again.',
          },
        ])
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Network error — please check your connection and try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg hover:scale-105 transition-transform"
          aria-label="Open assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100vw-3rem)] max-w-md">
          <Card className="flex flex-col h-[32rem] max-h-[80vh] shadow-2xl border-violet-200 dark:border-violet-800">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-violet-100 dark:border-violet-900 bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Outrovo Assistant</p>
                  <p className="text-[10px] text-muted-foreground">
                    {loading ? 'Working...' : 'Ask me to do anything'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50">
                    <Bot className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Hi! I'm your assistant</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      I can find leads, research companies, generate emails, and more. Just tell me what you need.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {SUGGESTED_QUESTIONS.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-md bg-muted/50 hover:bg-violet-100 dark:hover:bg-violet-950/40 transition-colors flex items-center justify-between group"
                      >
                        <span>{q}</span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i}>
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-violet-600 text-white rounded-br-sm'
                          : 'bg-muted text-foreground rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>

                  {/* Action result indicator */}
                  {msg.actionResult && (
                    <div
                      className={`flex items-center gap-1.5 mt-1 ml-1 text-[11px] ${
                        msg.actionResult === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : msg.actionResult === 'failed'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {msg.actionResult === 'pending' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : msg.actionResult === 'success' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      <span>{msg.actionLabel}</span>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs text-muted-foreground">Working...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-violet-100 dark:border-violet-900">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(input)
                }}
                className="flex gap-2"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me to do anything..."
                  disabled={loading}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading || !input.trim()}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
