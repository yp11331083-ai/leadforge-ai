import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { fetchWebsiteContent, htmlToText } from '@/lib/ai/agent'
import { chatWithFallback } from '@/lib/ai/providers'
import { getProviderConfig } from '@/lib/ai/agent'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * POST /api/analyze-website
 * Body: { url: string }
 *
 * Fetches a website, analyzes its content, and returns a structured
 * service description that can be used to auto-fill the Auto-Prospect form.
 */
export async function POST(req: NextRequest) {
  try {
    await requireUser()
    await loadProviderConfig()
    const { url } = await req.json()

    if (!url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Fetch website content
    const websiteData = await fetchWebsiteContent(url)
    if (!websiteData) {
      return NextResponse.json({ error: 'Could not fetch website content' }, { status: 502 })
    }

    const websiteText = htmlToText(websiteData.html).slice(0, 8000)

    const prompt = [
      'You are a B2B service analyst. Analyze the following website content and extract',
      'the service description that can be used for lead prospecting.',
      '',
      'Website URL: ' + url,
      '',
      'Website content:',
      websiteText,
      '',
      'Extract the following fields based on what this company does:',
      '',
      'Respond with pure JSON (no markdown):',
      '{',
      '  "serviceName": "short name of their service/product",',
      '  "description": "1-2 sentence description of what they do and who they help",',
      '  "targetIndustries": "comma-separated industries they serve",',
      '  "targetCompanySize": "approximate target company size if mentioned",',
      '  "targetLocation": "geographic region if mentioned",',
      '  "keyBenefits": "key value proposition in English",',
      '  "idealCustomerSignals": "signals that indicate a good fit customer"',
      '}',
      '',
      'All fields must be in English. If a field cannot be determined, set it to null.',
    ].join('\n')

    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: 'You are a B2B service analyst. Respond in pure JSON. Always respond in English.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 500,
    }, getProviderConfig())

    let cleaned = chatResult.content.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    }

    let parsed: any
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Try to extract JSON
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch { parsed = {} }
      } else {
        parsed = {}
      }
    }

    return NextResponse.json({
      serviceName: parsed.serviceName ?? '',
      description: parsed.description ?? '',
      targetIndustries: parsed.targetIndustries ?? '',
      targetCompanySize: parsed.targetCompanySize ?? '',
      targetLocation: parsed.targetLocation ?? '',
      keyBenefits: parsed.keyBenefits ?? '',
      idealCustomerSignals: parsed.idealCustomerSignals ?? '',
    })
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }
    console.error('POST /api/analyze-website error:', error)
    return NextResponse.json({ error: error?.message ?? 'Analysis failed' }, { status: 500 })
  }
}
