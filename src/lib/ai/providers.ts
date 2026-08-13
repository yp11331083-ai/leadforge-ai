/**
 * 多 AI 提供者抽象層
 *
 * 支援的提供者：
 * - chat completions: zai / openai / anthropic / gemini
 * - web search: zai / tavily
 * - page reader: zai / jina / firecrawl
 *
 * 機制：依優先順序嘗試，遇到 429 或錯誤自動 fallback 到下一個
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface ChatCompletionResult {
  content: string
  provider: string
  model?: string
}

export interface ProviderConfig {
  // Z.ai (always available, built-in via z-ai-web-dev-sdk)
  // OpenAI
  openaiApiKey?: string
  openaiModel?: string
  // Anthropic
  anthropicApiKey?: string
  anthropicModel?: string
  // Gemini
  geminiApiKey?: string
  geminiModel?: string
  // Tavily (search)
  tavilyApiKey?: string
  // Jina (page reader)
  jinaApiKey?: string
  // Firecrawl
  firecrawlApiKey?: string
  // Provider 優先順序
  chatProviderOrder?: string      // "zai,openai,anthropic,gemini"
  searchProviderOrder?: string    // "zai,tavily"
  pageReaderProviderOrder?: string // "zai,jina,firecrawl"
}

export interface SearchResultItem {
  url: string
  name: string
  snippet?: string
  host_name?: string
}

export interface PageContent {
  title: string
  html: string
  url: string
  text?: string
  publishedTime?: string
}

/**
 * 依優先順序嘗試多個 chat provider，第一個成功就回傳
 */
export async function chatWithFallback(
  options: ChatCompletionOptions,
  config: ProviderConfig
): Promise<ChatCompletionResult> {
  const order = (config.chatProviderOrder ?? 'zai,openai,anthropic,gemini')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const errors: string[] = []

  for (const provider of order) {
    try {
      const result = await callChatProvider(provider, options, config)
      if (result) return result
    } catch (e: any) {
      const msg = e.message ?? String(e)
      errors.push(`${provider}: ${msg}`)
      // 429 或錯誤就 fallback 到下一個
      console.warn(`Provider ${provider} failed: ${msg}, trying next...`)
    }
  }

  throw new Error(`所有 chat provider 都失敗：\n${errors.join('\n')}`)
}

async function callChatProvider(
  provider: string,
  options: ChatCompletionOptions,
  config: ProviderConfig
): Promise<ChatCompletionResult | null> {
  switch (provider) {
    case 'zai':
      return await chatWithZai(options)
    case 'openai':
      if (!config.openaiApiKey) return null
      return await chatWithOpenAI(options, config.openaiApiKey, config.openaiModel ?? 'gpt-4o-mini')
    case 'anthropic':
      if (!config.anthropicApiKey) return null
      return await chatWithAnthropic(options, config.anthropicApiKey, config.anthropicModel ?? 'claude-3-5-sonnet-20241022')
    case 'gemini':
      if (!config.geminiApiKey) return null
      return await chatWithGemini(options, config.geminiApiKey, config.geminiModel ?? 'gemini-flash-latest')
    default:
      return null
  }
}

/**
 * Z.ai chat（透過 z-ai-web-dev-sdk）
 */
async function chatWithZai(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  if (!(await isZaiAvailable())) throw new Error('Z.ai not available')
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: options.messages,
    temperature: options.temperature,
    thinking: { type: 'disabled' },
  })
  const content = completion.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('Z.ai 回應為空')
  return { content, provider: 'zai' }
}

/**
 * OpenAI chat completions
 */
async function chatWithOpenAI(
  options: ChatCompletionOptions,
  apiKey: string,
  model: string
): Promise<ChatCompletionResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.5,
      max_tokens: options.maxTokens,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('OpenAI 回應為空')
  return { content, provider: 'openai', model }
}

/**
 * Anthropic Claude chat completions
 */
async function chatWithAnthropic(
  options: ChatCompletionOptions,
  apiKey: string,
  model: string
): Promise<ChatCompletionResult> {
  // Anthropic API 要分開 system message
  const systemMsg = options.messages.find((m) => m.role === 'system')?.content ?? ''
  const userMessages = options.messages.filter((m) => m.role !== 'system')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 4096,
      system: systemMsg,
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const content = data.content?.[0]?.text ?? ''
  if (!content) throw new Error('Anthropic 回應為空')
  return { content, provider: 'anthropic', model }
}

/**
 * Google Gemini chat completions
 */
async function chatWithGemini(
  options: ChatCompletionOptions,
  apiKey: string,
  model: string
): Promise<ChatCompletionResult> {
  const systemMsg = options.messages.find((m) => m.role === 'system')?.content ?? ''
  const userMessages = options.messages.filter((m) => m.role !== 'system')

  const body: any = {
    contents: userMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: options.temperature ?? 0.5,
      maxOutputTokens: options.maxTokens ?? 4096,
    },
  }

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg }] }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!content) throw new Error('Gemini 回應為空')
  return { content, provider: 'gemini', model }
}

// ===== Web Search =====

export async function searchWithFallback(
  query: string,
  num: number,
  config: ProviderConfig
): Promise<SearchResultItem[]> {
  const order = (config.searchProviderOrder ?? 'zai,tavily')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const provider of order) {
    try {
      const result = await callSearchProvider(provider, query, num, config)
      if (result && result.length > 0) return result
    } catch (e: any) {
      console.warn(`Search provider ${provider} failed: ${e.message}, trying next...`)
    }
  }

  return []
}

async function callSearchProvider(
  provider: string,
  query: string,
  num: number,
  config: ProviderConfig
): Promise<SearchResultItem[]> {
  switch (provider) {
    case 'zai':
      return await searchWithZai(query, num)
    case 'tavily':
      if (!config.tavilyApiKey) return []
      return await searchWithTavily(query, num, config.tavilyApiKey)
    default:
      return []
  }
}

async function searchWithZai(query: string, num: number): Promise<SearchResultItem[]> {
  if (!(await isZaiAvailable())) throw new Error('Z.ai not available')
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const results = await zai.functions.invoke('web_search', { query, num })
  return (results || []).map((r: any) => ({
    url: r.url ?? '',
    name: r.name ?? r.url ?? '',
    snippet: r.snippet ?? '',
    host_name: r.host_name ?? '',
  }))
}

async function searchWithTavily(query: string, num: number, apiKey: string): Promise<SearchResultItem[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: num,
      include_answer: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`Tavily ${res.status}`)
  }

  const data = await res.json() as any
  return (data.results ?? []).map((r: any) => ({
    url: r.url ?? '',
    name: r.title ?? r.url ?? '',
    snippet: r.content ?? '',
    host_name: (() => { try { return new URL(r.url).hostname } catch { return '' } })(),
  }))
}

// ===== Page Reader =====

export async function fetchPageWithFallback(
  url: string,
  config: ProviderConfig
): Promise<PageContent | null> {
  const order = (config.pageReaderProviderOrder ?? 'zai,jina,firecrawl')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const provider of order) {
    try {
      const result = await callPageReaderProvider(provider, url, config)
      if (result) return result
    } catch (e: any) {
      console.warn(`Page reader ${provider} failed: ${e.message}, trying next...`)
    }
  }

  return null
}

async function callPageReaderProvider(
  provider: string,
  url: string,
  config: ProviderConfig
): Promise<PageContent | null> {
  switch (provider) {
    case 'zai':
      return await fetchPageWithZai(url)
    case 'jina':
      return await fetchPageWithJina(url, config.jinaApiKey)
    case 'firecrawl':
      if (!config.firecrawlApiKey) return null
      return await fetchPageWithFirecrawl(url, config.firecrawlApiKey)
    default:
      return null
  }
}

async function fetchPageWithZai(url: string): Promise<PageContent | null> {
  if (!(await isZaiAvailable())) throw new Error('Z.ai not available')
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const result = await zai.functions.invoke('page_reader', { url })
  if (!result?.data) return null
  return {
    title: result.data.title ?? '',
    html: result.data.html ?? '',
    url: result.data.url ?? url,
    publishedTime: result.data.publishedTime,
  }
}

async function fetchPageWithJina(url: string, apiKey?: string): Promise<PageContent | null> {
  // Jina Reader: https://r.jina.ai/{url}
  // 免費 tier 不需 API key，但有 API key 限額較高
  const headers: Record<string, string> = {
    'Accept': 'text/html',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(`https://r.jina.ai/${url}`, { headers })

  if (!res.ok) {
    throw new Error(`Jina ${res.status}`)
  }

  const text = await res.text()
  // Jina 回傳 markdown 格式，標題在第一行
  const lines = text.split('\n').filter(Boolean)
  const title = lines[0]?.replace(/^Title:\s*/i, '').replace(/^#+\s*/, '') ?? url
  const html = `<div>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>`

  return {
    title,
    html,
    text,
    url,
  }
}

async function fetchPageWithFirecrawl(url: string, apiKey: string): Promise<PageContent | null> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    throw new Error(`Firecrawl ${res.status}`)
  }

  const data = await res.json() as any
  if (!data.data) return null

  return {
    title: data.data.metadata?.title ?? url,
    html: data.data.html ?? '',
    text: data.data.markdown ?? '',
    url,
  }
}
