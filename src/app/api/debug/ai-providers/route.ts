import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { loadProviderConfig } from '@/lib/ai/load-config'
import { getProviderConfig } from '@/lib/ai/agent'

/**
 * Debug endpoint — tests each AI provider directly from the Vercel runtime.
 * Reports which ones work and which fail (with error messages).
 *
 * Usage: GET /api/debug/ai-providers
 */
export async function GET() {
  try {
    await requireUser()
    await loadProviderConfig()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const config = getProviderConfig()
  const results: any = {
    config: {
      chatProviderOrder: config.chatProviderOrder,
      searchProviderOrder: config.searchProviderOrder,
      pageReaderProviderOrder: config.pageReaderProviderOrder,
      hasTavilyKey: !!config.tavilyApiKey,
      hasGeminiKey: !!config.geminiApiKey,
      hasJinaKey: !!config.jinaApiKey,
      hasOpenaiKey: !!config.openaiApiKey,
      hasAnthropicKey: !!config.anthropicApiKey,
      geminiModel: config.geminiModel,
    },
    tests: {},
  }

  // Test 1: Tavily search directly
  if (config.tavilyApiKey) {
    try {
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: config.tavilyApiKey,
          query: 'Stripe payment company',
          max_results: 2,
          include_answer: false,
        }),
      })
      const tavilyData = await tavilyRes.json() as any
      results.tests.tavily = {
        ok: tavilyRes.ok,
        status: tavilyRes.status,
        resultsCount: tavilyData?.results?.length ?? 0,
        firstResultTitle: tavilyData?.results?.[0]?.title ?? null,
        firstResultUrl: tavilyData?.results?.[0]?.url ?? null,
        error: tavilyData?.detail || tavilyData?.message || null,
      }
    } catch (e: any) {
      results.tests.tavily = { ok: false, error: e.message }
    }
  } else {
    results.tests.tavily = { ok: false, error: 'TAVILY_API_KEY not in config' }
  }

  // Test 2: Gemini chat directly
  if (config.geminiApiKey) {
    try {
      const model = config.geminiModel || 'gemini-2.5-flash'
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: OK' }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 10 },
          }),
        }
      )
      const geminiData = await geminiRes.json() as any
      results.tests.gemini = {
        ok: geminiRes.ok,
        status: geminiRes.status,
        model,
        response: geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null,
        error: geminiData?.error?.message || null,
      }
    } catch (e: any) {
      results.tests.gemini = { ok: false, error: e.message }
    }
  } else {
    results.tests.gemini = { ok: false, error: 'GEMINI_API_KEY not in config' }
  }

  // Test 3: Jina page reader directly
  if (config.jinaApiKey) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/https://example.com`, {
        headers: {
          'Accept': 'text/plain',
          'Authorization': `Bearer ${config.jinaApiKey}`,
        },
      })
      const jinaText = await jinaRes.text()
      results.tests.jina = {
        ok: jinaRes.ok,
        status: jinaRes.status,
        responseLength: jinaText.length,
        responsePreview: jinaText.slice(0, 100),
      }
    } catch (e: any) {
      results.tests.jina = { ok: false, error: e.message }
    }
  } else {
    results.tests.jina = { ok: false, error: 'JINA_API_KEY not in config' }
  }

  return NextResponse.json(results)
}
