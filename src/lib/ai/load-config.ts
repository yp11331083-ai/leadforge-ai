import { db } from '@/lib/db'
import { setProviderConfig, type ProviderConfig } from '@/lib/ai/agent'
import { requireUser } from '@/lib/auth/session'

/**
 * 從資料庫載入 tenant 的 provider config 並注入到 agent.ts 的全域變數
 * 在每個使用 AI 的 API route 開頭呼叫
 */
export async function loadProviderConfig(): Promise<void> {
  try {
    const user = await requireUser()
    const config = await db.emailConfig.findUnique({
      where: { tenantId: user.tenantId },
    })

    if (!config) {
      setProviderConfig({})
      return
    }

    const providerConfig: ProviderConfig = {
      openaiApiKey: config.openaiApiKey ?? undefined,
      openaiModel: config.openaiModel ?? 'gpt-4o-mini',
      anthropicApiKey: config.anthropicApiKey ?? undefined,
      anthropicModel: config.anthropicModel ?? 'claude-3-5-sonnet-20241022',
      geminiApiKey: config.geminiApiKey ?? undefined,
      geminiModel: config.geminiModel ?? 'gemini-2.0-flash',
      tavilyApiKey: config.tavilyApiKey ?? undefined,
      jinaApiKey: config.jinaApiKey ?? undefined,
      firecrawlApiKey: config.firecrawlApiKey ?? undefined,
      chatProviderOrder: config.chatProviderOrder ?? 'zai,openai,anthropic,gemini',
      searchProviderOrder: config.searchProviderOrder ?? 'zai,tavily',
      pageReaderProviderOrder: config.pageReaderProviderOrder ?? 'zai,jina,firecrawl',
    }

    setProviderConfig(providerConfig)
  } catch (error) {
    console.error('loadProviderConfig error:', error)
  }
}
