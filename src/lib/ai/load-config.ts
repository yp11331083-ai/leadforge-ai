import { db } from '@/lib/db'
import { setProviderConfig, type ProviderConfig } from '@/lib/ai/agent'
import { requireUser } from '@/lib/auth/session'

/**
 * Load provider config from:
 * 1. Platform env vars (GEMINI_API_KEY, TAVILY_API_KEY, JINA_API_KEY) — always available
 * 2. User's BYOK keys from DB (optional — overrides platform keys if provided)
 *
 * Platform-managed: Gemini, Tavily, Jina (users don't see these keys)
 * User BYOK: OpenAI, Anthropic (optional advanced setting)
 */
export async function loadProviderConfig(): Promise<void> {
  try {
    const user = await requireUser()
    const config = await db.emailConfig.findUnique({
      where: { tenantId: user.tenantId },
    })

    // Platform-managed keys from env vars
    const platformGeminiKey = process.env.GEMINI_API_KEY || undefined
    const platformTavilyKey = process.env.TAVILY_API_KEY || undefined
    const platformJinaKey = process.env.JINA_API_KEY || undefined
    const platformGroqKey = process.env.GROQ_API_KEY || undefined

    const providerConfig: ProviderConfig = {
      // Chat: Z.ai (built-in) → Gemini (platform) → OpenAI (BYOK) → Anthropic (BYOK)
      openaiApiKey: config?.openaiApiKey ?? undefined,
      openaiModel: config?.openaiModel ?? 'gpt-4o-mini',
      anthropicApiKey: config?.anthropicApiKey ?? undefined,
      anthropicModel: config?.anthropicModel ?? 'claude-3-5-sonnet-20241022',
      // Platform-managed Gemini (user never sees this key)
      geminiApiKey: config?.geminiApiKey ?? platformGeminiKey,
      geminiModel: config?.geminiModel ?? 'gemini-2.5-flash',
      // Platform-managed Groq (user never sees this key) — free + fast Llama 3.3 70B
      groqApiKey: config?.groqApiKey ?? platformGroqKey,
      groqModel: config?.groqModel ?? 'llama-3.1-8b-instant',
      // Platform-managed search + page reader (users never see these)
      tavilyApiKey: config?.tavilyApiKey ?? platformTavilyKey,
      jinaApiKey: config?.jinaApiKey ?? platformJinaKey,
      firecrawlApiKey: config?.firecrawlApiKey ?? undefined,
      // Priority: Groq first (fast + free), then Z.ai, then Gemini, then user BYOK
      chatProviderOrder: config?.chatProviderOrder ?? 'groq,gemini,openai,anthropic',
      searchProviderOrder: config?.searchProviderOrder ?? 'tavily',
      pageReaderProviderOrder: config?.pageReaderProviderOrder ?? 'jina',
    }

    setProviderConfig(providerConfig)
  } catch (error) {
    console.error('loadProviderConfig error:', error)
  }
}
