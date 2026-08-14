import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { chatWithFallback } from '@/lib/ai/providers'
import { getProviderConfig } from '@/lib/ai/agent'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/assistant
 * Body: { message: string, context?: { leadsCount, plan, credits } }
 *
 * AI assistant that helps users with:
 * - How to use the platform
 * - Tips for cold email outreach
 * - Advice on target audience / ICP
 * - Help with service descriptions
 *
 * Does NOT deduct credits — this is a free help feature.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    await loadProviderConfig()
    const { message, context } = await req.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const systemPrompt = `You are Outrovo's AI assistant — a friendly, knowledgeable helper embedded inside the Outrovo B2B cold outreach platform.

Your job: help users get the most out of the platform. You answer questions about:
- How to use features (auto-prospect, research, email generation, sending, billing)
- B2B cold email best practices (subject lines, icebreakers, follow-ups, CTAs)
- How to define their ICP (Ideal Customer Profile)
- How to write a good service description
- How to improve reply rates
- General sales development advice

Guidelines:
- Be CONCISE — max 3-4 short paragraphs per answer. Use bullet points when listing things.
- Be PRACTICAL — give actionable advice, not theory.
- Be FRIENDLY but professional — like a helpful sales mentor.
- If the user asks something you don't know about the platform, say "I'm not sure about that — try checking the [relevant section] or contacting support."
- NEVER make up features that don't exist. The platform has: AI Auto-Prospect, AI Research (basic + deep), AI Email Generation, Email Enrichment (find decision-maker emails), SMTP/Smartlead sending, Cal.com meeting tracking, Stripe billing with 4 plans (Freemium/Starter/Growth/Agency), credit system.
- If context is provided, use it to give personalized advice (e.g. "I see you have 50 credits left — that's enough for ~5 auto-prospect runs").

User context:
${context ? `- Plan: ${context.plan ?? 'unknown'}
- Credits remaining: ${context.credits ?? 'unknown'}
- Total leads: ${context.leadsCount ?? 'unknown'}` : 'No context provided'}

Respond in English unless the user writes in another language.`

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      maxTokens: 800,
    }, getProviderConfig())

    return NextResponse.json({
      reply: chatResult.content,
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
