import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { chatWithFallback } from '@/lib/ai/providers'
import { getProviderConfig } from '@/lib/ai/agent'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant
 *
 * AI assistant that can:
 * 1. Answer questions
 * 2. Execute actions (find leads, research, navigate, fill forms)
 *
 * IMPORTANT: Always ask the user for confirmation before taking any action
 * that changes data (like filling in forms, running prospecting, etc).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const { message, context, history = [] } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const recentLeadsStr = context?.recentLeads
      ? context.recentLeads.map((l: any) => l.company + ' (' + l.id + ')').join(', ')
      : 'none'

    const historyStr = history.length > 0
      ? history.map((m: any) => m.role + ': ' + m.content).join('\n')
      : 'No history'

    const systemPrompt = [
      'You are Outrovo assistant, embedded in the Outrovo B2B cold outreach platform.',
      '',
      'You help users with the platform. You can also DO things for them.',
      '',
      '## CRITICAL RULE: Always ask before doing',
      'Before you take ANY action that changes data (finding leads, filling forms, etc),',
      'you MUST ask the user for confirmation first. Example:',
      'User: "I sell invoicing software" → You: "Got it! Would you like me to go to the',
      'Auto-Prospect page and fill in your service description for you?"',
      'Only after the user says yes, include the action in your response.',
      '',
      '## Response Format',
      'ALWAYS respond with plain text in the "reply" field.',
      'NEVER put JSON inside the reply field. The reply is what the user sees as a chat message.',
      '',
      'Respond with this exact JSON structure (no extra text, no markdown):',
      '{"reply":"your text here","action":null}',
      '',
      'If taking an action (only after user confirms):',
      '{"reply":"brief text","action":{"type":"...","params":{...}}}',
      '',
      '## Actions you can take',
      '',
      '### go_to_tab',
      'Navigate user to a tab. Params: {"tab":"admin"} (admin, sales, analytics, billing)',
      '',
      '### go_to_billing',
      'When user asks about plans, pricing, upgrade, or billing.',
      'Params: none needed. Navigates to billing tab.',
      '',
      '### update_plan',
      'When user wants to change their plan (e.g. upgrade to Agency).',
      'Params: none. Navigates to billing tab so they can click Upgrade.',
      'Always confirm first, then navigate them to billing.',
      'Example: {"reply":"Taking you to billing.","action":{"type":"go_to_tab","params":{"tab":"billing"}}}',
      '',
      '### fill_service_description',
      'Go to Auto-Prospect page and fill in the service description form.',
      'Params: {"serviceName":"name","description":"desc","targetIndustries":"optional","targetLocation":"optional"}',
      'ONLY use after user confirms they want you to fill it in.',
      'Example: {"reply":"Filling in your service description now.","action":{"type":"fill_service_description","params":{"serviceName":"Invoicing Tool","description":"Automated invoicing for freelancers"}}}',
      '',
      '### find_leads',
      'Run auto-prospect. Params: {"targetCount":5}',
      'ONLY use after user confirms.',
      '',
      '### research_company',
      'Params: {"website":"https://...","company":"Name"}',
      '',
      '## Guidelines',
      '- Reply in plain English, concise (1-3 sentences)',
      '- If user describes their product, ask if they want you to fill it in the Auto-Prospect page',
      '- If user has no service description set and asks to find leads, tell them to set it first or offer to fill it',
      '- NEVER put JSON or code in the reply field — it must be natural human text',
      '',
      'User context:',
      '- Plan: ' + (context?.plan ?? 'unknown'),
      '- Credits: ' + (context?.credits ?? 'unknown'),
      '- Leads: ' + (context?.leadsCount ?? 'unknown'),
      '- Recent leads: ' + recentLeadsStr,
      '',
      'History:',
      historyStr,
    ].join('\n')

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.5,
      maxTokens: 500,
    }, getProviderConfig())

    // Get raw AI response
    const rawContent = chatResult.content.trim()

    // AGGRESSIVE JSON extraction — the AI often returns JSON but sometimes
    // wraps it in text or markdown. We need to reliably extract {reply, action}.
    let reply = ''
    let action: any = null

    // Step 1: Remove markdown code blocks
    let cleaned = rawContent
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    }

    // Step 2: Try to find and parse a JSON object
    // Look for the FIRST { and LAST } — that's our JSON
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1)
      try {
        const parsed = JSON.parse(jsonStr)
        // If it has a reply field, use it
        if (parsed.reply && typeof parsed.reply === 'string') {
          reply = parsed.reply
          action = parsed.action ?? null
        } else {
          // JSON but no reply field — use the whole thing as reply text
          reply = cleaned
        }
      } catch {
        // Not valid JSON — use the cleaned text as reply
        reply = cleaned
      }
    } else {
      // No JSON found — it's plain text
      reply = cleaned
    }

    // Step 3: Final safety — strip any remaining JSON from the reply
    if (reply.includes('{"reply"') || reply.includes('{ "reply"') || reply.includes("{'reply'")) {
      // Find where JSON starts and cut it
      const jsonStart = reply.search(/\{["\s]*['"]?reply/)
      if (jsonStart >= 0) {
        const beforeJson = reply.slice(0, jsonStart).trim()
        if (beforeJson.length > 5) {
          reply = beforeJson
        } else {
          // The entire reply IS the JSON — try to extract just the reply value
          try {
            const match = reply.match(/"reply"\s*:\s*"([^"]+)"/)
            if (match) reply = match[1]
          } catch {}
        }
      }
    }

    // Step 4: If reply is empty, use a fallback
    if (!reply || reply.trim().length === 0) {
      reply = 'I can help you with that. What would you like me to do?'
    }

    return NextResponse.json({
      reply,
      action,
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
