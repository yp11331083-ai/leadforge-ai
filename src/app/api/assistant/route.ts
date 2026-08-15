import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { chatWithFallback } from '@/lib/ai/providers'
import { getProviderConfig } from '@/lib/ai/agent'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const { message, context, history = [] } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Build context strings
    const serviceStr = context?.serviceOffering
      ? Object.entries(context.serviceOffering)
          .filter(([_, v]) => v && String(v).trim())
          .map(([k, v]) => '  ' + k + ': ' + v)
          .join('\n')
      : '  (none set yet)'

    const recentLeadsStr = context?.recentLeads?.length
      ? context.recentLeads.map((l: any) => l.company + ' (ID: ' + l.id + ')').join(', ')
      : 'none'

    const historyStr = history.length > 0
      ? history.map((m: any) => m.role + ': ' + m.content).join('\n')
      : 'none'

    const systemPrompt = [
      'You are Outrovo assistant. You are smart, concise, and action-oriented.',
      '',
      '## YOUR PERSONALITY',
      '- You are a confident sales operations assistant.',
      '- You understand typos: "tes"="yes", "ye"="yes", "ya"="yes", "nope"="no", "yep"="yes".',
      '- You remember what the user said earlier in the conversation.',
      '- You NEVER repeat yourself or ask the same question twice.',
      '- You take ACTION, not just talk. When the user tells you something, you SAVE it immediately.',
      '- You do NOT ask for permission to save form fields. Just save them.',
      '- You ONLY ask for confirmation before CREDIT-COSTING actions (find leads, send emails).',
      '- You ALWAYS respond in English. Even if the user writes in Chinese, respond in English.',
      '- If the user gives multiple pieces of info, save ALL in ONE action.',
      '',
      '## EXAMPLES OF GOOD BEHAVIOR',
      'User: "target industry is SaaS" → You save it and say "Done! Industry set to SaaS. Want me to find leads?"',
      'User: "company size 1-40, location Taiwan" → You save BOTH at once and say "Updated! Size: 1-40, Location: Taiwan."',
      'User: "tes" / "ye" / "yep" → You treat as "yes" and proceed.',
      'User: "find 5 leads" → You ask "That will use about 15 credits. Proceed?" then run find_leads.',
      '',
      '## ACTIONS',
      '',
      '### update_service_field',
      'Save service fields. MERGES with existing — only updates fields provided.',
      '{"action":{"type":"update_service_field","params":{"targetIndustries":"SaaS","targetCompanySize":"1-40 employees"}}}',
      'Do NOT ask before using this action. Just save and confirm.',
      '',
      '### find_leads',
      'Run auto-prospect. ALWAYS ask before running (costs credits).',
      '{"action":{"type":"find_leads","params":{"targetCount":5}}}',
      '',
      '### go_to_tab',
      '{"action":{"type":"go_to_tab","params":{"tab":"admin"}}}',
      'Tabs: admin, sales, analytics, billing',
      '',
      '### go_to_billing / update_plan',
      '{"action":{"type":"go_to_billing"}}',
      '',
      '### research_company',
      '{"action":{"type":"research_company","params":{"website":"https://example.com","company":"Name"}}}',
      '',
      '## RESPONSE FORMAT',
      'Always respond with JSON: {"reply":"your text","action":null}',
      'Or with action: {"reply":"brief text","action":{"type":"...","params":{...}}}',
      'The reply field MUST be plain English text, NEVER JSON.',
      'Keep replies SHORT — 1-2 sentences max.',
      '',
      '## CURRENT SERVICE DESCRIPTION:',
      serviceStr,
      '',
      '## USER CONTEXT:',
      '- Plan: ' + (context?.plan ?? 'unknown'),
      '- Credits: ' + (context?.credits ?? 'unknown'),
      '- Leads: ' + (context?.leadsCount ?? 0),
      '- Recent leads: ' + recentLeadsStr,
      '',
      '## CONVERSATION HISTORY:',
      historyStr,
    ].join('\n')

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.4,
      maxTokens: 400,
    }, getProviderConfig())

    // AGGRESSIVE JSON extraction
    let reply = ''
    let action: any = null

    let cleaned = chatResult.content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    }

    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1)
      try {
        const parsed = JSON.parse(jsonStr)
        if (parsed.reply && typeof parsed.reply === 'string') {
          reply = parsed.reply
          action = parsed.action ?? null
        } else {
          reply = cleaned
        }
      } catch {
        reply = cleaned
      }
    } else {
      reply = cleaned
    }

    // Strip any remaining JSON from reply
    if (reply.includes('{"reply"') || reply.includes('{ "reply"')) {
      const jsonStart = reply.search(/\{["\s]*['"]?reply/)
      if (jsonStart >= 0) {
        const beforeJson = reply.slice(0, jsonStart).trim()
        if (beforeJson.length > 5) {
          reply = beforeJson
        } else {
          try {
            const match = reply.match(/"reply"\s*:\s*"([^"]+)"/)
            if (match) reply = match[1]
          } catch {}
        }
      }
    }

    if (!reply || reply.trim().length === 0) {
      reply = 'I can help with that. What do you need?'
    }

    return NextResponse.json({ reply, action, provider: chatResult.provider })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    console.error('POST /api/assistant error:', error)
    return NextResponse.json({ error: error?.message ?? 'Assistant failed' }, { status: 500 })
  }
}
