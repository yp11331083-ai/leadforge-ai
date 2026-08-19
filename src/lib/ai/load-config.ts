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
    const platformDeepseekKey = process.env.DEEPSEEK_API_KEY || undefined
    const platformOpencodeKey = process.env.OPENCODE_API_KEY || undefined
    const platformOpenrouterKey = process.env.OPENROUTER_API_KEY || undefined

    // Priority: Groq first (fast + free), then DeepSeek (very cheap, much
    // stronger than small Groq models), then OpenCode Zen (frontier models
    // via gateway), then OpenRouter free models, then Gemini, then BYOK.
    // zai dropped from the default chain: the bundled z-ai-web-dev-sdk has no
    // credentials outside the original sandbox and always fails first, wasting
    // a round-trip before the fallback kicks in.
    // A tenant order saved before a provider existed can omit it even though a
    // platform key is available — prepend so it's never skipped.
    const groqKey = config?.groqApiKey ?? platformGroqKey
    // 平台 Groq key 只授權 openai/gpt-oss-*（及 groq/compound、qwen）系列。
    // 使用者可能在舊版 UI 存了已不支援的 llama-3.1-8b-instant 等模型 —
    // 只要是用平台 key，非開放模型一律退回平台預設，避免每次呼叫 404。
    const savedGroqModel = config?.groqModel
    const groqModel = !config?.groqApiKey && savedGroqModel && !/^(openai\/gpt-oss-|groq\/compound|qwen)/i.test(savedGroqModel)
      ? 'openai/gpt-oss-120b'
      : savedGroqModel ?? 'openai/gpt-oss-120b'
    // DeepSeek is platform-managed (env var only — no EmailConfig column yet)
    const deepseekKey = platformDeepseekKey
    const opencodeKey = platformOpencodeKey
    const openrouterKey = platformOpenrouterKey
    const savedChatOrder = config?.chatProviderOrder?.trim()
    let chatOrder = savedChatOrder && savedChatOrder.length > 0
      ? savedChatOrder
      : 'groq,deepseek,opencode,openrouter,gemini,openai,anthropic'
    const orderList = () => chatOrder.split(',').map((s) => s.trim())
    if (groqKey && !orderList().includes('groq')) chatOrder = `groq,${chatOrder}`
    if (deepseekKey && !orderList().includes('deepseek')) chatOrder = chatOrder.replace('groq,', 'groq,deepseek,')
    if (opencodeKey && !orderList().includes('opencode')) chatOrder = chatOrder.replace('deepseek,', 'deepseek,opencode,')
    if (openrouterKey && !orderList().includes('openrouter')) chatOrder = chatOrder.replace('opencode,', 'opencode,openrouter,')
    const chatProviderOrder = chatOrder

    // Same treatment for search: a tenant order saved before jina existed
    // (or while it was missing) can omit it — prepend when the key is present.
    const savedSearchOrder = config?.searchProviderOrder?.trim()
    let searchOrder = savedSearchOrder && savedSearchOrder.length > 0
      ? savedSearchOrder
      : 'jina,tavily'
    const searchOrderList = () => searchOrder.split(',').map((s) => s.trim())
    const searchJinaKey = config?.jinaApiKey ?? platformJinaKey
    const searchTavilyKey = config?.tavilyApiKey ?? platformTavilyKey
    if (searchJinaKey && !searchOrderList().includes('jina')) searchOrder = `jina,${searchOrder}`
    if (searchTavilyKey && !searchOrderList().includes('tavily')) searchOrder = `${searchOrder},tavily`

    const providerConfig: ProviderConfig = {
      openaiApiKey: config?.openaiApiKey ?? undefined,
      openaiModel: config?.openaiModel ?? 'gpt-4o-mini',
      anthropicApiKey: config?.anthropicApiKey ?? undefined,
      anthropicModel: config?.anthropicModel ?? 'claude-3-5-sonnet-20241022',
      // Platform-managed Gemini (user never sees this key)
      geminiApiKey: config?.geminiApiKey ?? platformGeminiKey,
      geminiModel: config?.geminiModel ?? 'gemini-2.5-flash',
      // Platform-managed Groq (user never sees this key) — free + fast, gpt-oss-120b
      groqApiKey: groqKey,
      groqModel,
      // Platform-managed DeepSeek (user never sees this key)
      deepseekApiKey: deepseekKey,
      deepseekModel: 'deepseek-chat',
      // Platform-managed OpenCode Zen gateway (frontier models)
      opencodeApiKey: opencodeKey,
      opencodeModel: process.env.OPENCODE_MODEL || 'claude-haiku-4-5',
      // OpenRouter free-tier models (":free" suffix models cost $0)
      openrouterApiKey: openrouterKey,
      openrouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
// Platform-managed search + page reader (users never see these)
    tavilyApiKey: config?.tavilyApiKey ?? platformTavilyKey,
    jinaApiKey: config?.jinaApiKey ?? platformJinaKey,
    firecrawlApiKey: config?.firecrawlApiKey ?? undefined,
    chatProviderOrder,
    // Jina search first: free tier works without quota, Tavily falls back
    // when a tenant saved an order that omits jina or its key is exhausted.
    searchProviderOrder: searchOrder,
      pageReaderProviderOrder: config?.pageReaderProviderOrder ?? 'jina',
    }

    setProviderConfig(providerConfig)
  } catch (error) {
    console.error('loadProviderConfig error:', error)
  }
}
