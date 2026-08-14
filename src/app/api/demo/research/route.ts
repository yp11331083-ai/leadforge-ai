import { NextRequest, NextResponse } from 'next/server'
import { chatWithFallback, type ProviderConfig } from '@/lib/ai/providers'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/demo/research
 * Body: { product: string }
 *
 * PUBLIC endpoint (no auth required) for the landing page interactive demo.
 * Generates a sample company research + personalized email hook based on
 * the user's product description.
 *
 * Uses platform AI providers (Groq → Gemini fallback).
 * Does NOT deduct credits — this is a free demo.
 *
 * Rate limit: simple in-memory IP-based limit (5 requests per IP per hour)
 */
const ipRequestMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = ipRequestMap.get(ip)
  if (!entry || now > entry.resetAt) {
    ipRequestMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count++
  return true
}

function loadDemoConfig(): ProviderConfig {
  return {
    groqApiKey: process.env.GROQ_API_KEY || undefined,
    groqModel: 'llama-3.3-70b-versatile',
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    geminiModel: 'gemini-2.5-flash',
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    chatProviderOrder: 'groq,gemini,openai,anthropic',
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in an hour or sign up for full access.' },
        { status: 429 }
      )
    }

    const { product } = await req.json()
    if (!product?.trim() || product.length < 5) {
      return NextResponse.json(
        { error: 'Please describe your product in at least a few words.' },
        { status: 400 }
      )
    }

    const config = loadDemoConfig()

    const prompt = [
      'You are a B2B sales research AI. A founder describes their product below.',
      'Generate a SAMPLE prospect analysis as if you found a real company that needs this product.',
      '',
      'Product description: ' + product,
      '',
      'Pick a REAL, well-known company that would plausibly need this product.',
      'Do NOT pick the founder\'s own company — pick a potential CUSTOMER.',
      '',
      'Respond in pure JSON (no markdown):',
      '{',
      '  "company": "Real Company Name",',
      '  "website": "real-website.com",',
      '  "industry": "Industry",',
      '  "fit_score": 85,',
      '  "pain_point": "One specific pain point this company has that the product solves",',
      '  "email_hook": "A personalized 1-sentence email opener that references something specific about this company",',
      '  "why_they_need_it": "One sentence explaining why they need this product"',
      '}',
      '',
      'The email_hook must be specific to the company (not generic). It should sound like a real salesperson wrote it after researching the company.',
      'Respond in English.',
    ].join('\n')

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: 'You are a B2B sales research AI. Respond in pure JSON. Be specific and realistic.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 500,
    }, config)

    let cleaned = chatResult.content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        company: 'Sample Company',
        website: 'example.com',
        industry: 'Technology',
        fit_score: 75,
        pain_point: 'Unable to parse AI response',
        email_hook: 'Error generating hook',
        why_they_need_it: 'Please try again',
      }
    }

    return NextResponse.json({ result: parsed })
  } catch (error: any) {
    console.error('POST /api/demo/research error:', error)
    return NextResponse.json(
      { error: 'Demo failed — please try again' },
      { status: 500 }
    )
  }
}

