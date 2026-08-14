import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { chatWithFallback } from '@/lib/ai/providers'
import { getProviderConfig } from '@/lib/ai/agent'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant
 * Body: { message: string, context?: { leadsCount, plan, credits, recentLeads }, history?: Message[] }
 *
 * AI assistant that can:
 * 1. Answer questions about the platform
 * 2. Actually DO things — trigger auto-prospect, research, navigate
 *
 * Returns: { reply: string, action?: { type, params } }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const { message, context, history = [] } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Pre-compute recent leads string (avoid nested template literals)
    const recentLeadsStr = context?.recentLeads
      ? context.recentLeads.map((l: any) => l.company + ' (' + l.id + ')').join(', ')
      : 'none'

    const historyStr = history.length > 0
      ? history.map((m: any) => m.role + ': ' + m.content).join('\n')
      : 'No history'

    const systemPrompt = [
      'You are Outrovo AI assistant — embedded inside the Outrovo B2B cold outreach platform.',
      '',
      'You have TWO capabilities:',
      '1. ANSWER questions about the platform, cold email best practices, ICP definition, etc.',
      '2. EXECUTE actions on behalf of the user — you can trigger real platform features.',
      '',
      '## Actions you can take',
      '',
      'When the user asks you to DO something, include an "action" object in your response.',
      'The frontend will execute it.',
      '',
      '### Action: find_leads (Auto-Prospect)',
      'Trigger when user says: "find me leads", "find companies", "prospect", "search for customers"',
      'The user must have a service description set. If they don\'t, ask them to set one first.',
      'Params: { "action": { "type": "find_leads", "params": { "targetCount": 5 } } }',
      '',
      '### Action: research_company',
      'Trigger when user says: "research X", "analyze X", "tell me about company X"',
      'Params: { "action": { "type": "research_company", "params": { "website": "https://example.com", "company": "Name", "mode": "basic" } } }',
      '',
      '### Action: go_to_tab',
      'Trigger when user says: "take me to billing", "show me analytics", "go to leads"',
      'Params: { "action": { "type": "go_to_tab", "params": { "tab": "admin" } } }',
      'Tabs: admin, sales, analytics, billing',
      '',
      '### Action: check_credits',
      'Just answer directly using the context provided — no action needed.',
      '',
      '## Output format',
      '',
      'You MUST respond with valid JSON (no markdown, no code blocks):',
      '{ "reply": "Your response (1-3 sentences).", "action": null }',
      '',
      '## Guidelines',
      '- Be CONCISE — max 2-3 sentences in reply',
      '- Be FRIENDLY but professional',
      '- If user asks to find leads but has no service description, tell them to set it first',
      '- If user asks to research but doesn\'t specify a website, ask them to clarify',
      '- NEVER make up lead IDs',
      '- Respond in English unless user writes in another language',
      '',
      'User context:',
      '- Plan: ' + (context?.plan ?? 'unknown'),
      '- Credits remaining: ' + (context?.credits ?? 'unknown'),
      '- Total leads: ' + (context?.leadsCount ?? 'unknown'),
      '- Recent leads: ' + recentLeadsStr,
      '',
      'Conversation history:',
      historyStr,
    ].join('\n')

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.5,
      maxTokens: 600,
    }, getProviderConfig())

    // Try to parse the response as JSON
    let parsed: { reply: string; action: any } = { reply: chatResult.content, action: null }
    let cleaned = chatResult.content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // If not JSON, treat the whole thing as a reply with no action
      parsed = { reply: chatResult.content, action: null }
    }

    return NextResponse.json({
      reply: parsed.reply ?? chatResult.content,
      action: parsed.action ?? null,
      provider: chatResult.provider,
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    console.error('POST /api/assistant error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Assistant failed' },
      { status: 500 }
    )
  }
}
