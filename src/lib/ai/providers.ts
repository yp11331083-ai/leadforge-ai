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

/**
 * Detect whether the z-ai-web-dev-sdk can be instantiated in the current
 * environment. On Vercel serverless, the SDK should always be bundled; if
 * instantiation fails (missing credentials, runtime error), we treat Z.ai
 * as unavailable and fall through to the next provider in the chain.
 */
let zaiAvailabilityCache: boolean | null = null
async function isZaiAvailable(): Promise<boolean> {
  if (zaiAvailabilityCache !== null) return zaiAvailabilityCache
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    // Just check the SDK is loadable — we don't pre-instantiate to avoid
    // burning time on cold starts where Z.ai isn't actually needed.
    if (typeof ZAI?.create !== 'function') {
      zaiAvailabilityCache = false
      return false
    }
    zaiAvailabilityCache = true
    return true
  } catch (e: any) {
    console.warn('[AI] z-ai-web-dev-sdk not available:', e?.message ?? e)
    zaiAvailabilityCache = false
    return false
  }
}

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
  // Hard timeouts (ms) for external calls — a single slow site must not
  // stall the whole prospect pipeline until the serverless maxDuration kills it.
  searchTimeoutMs?: number   // web search (Tavily etc.)
  pageTimeoutMs?: number     // page reader (Jina etc.)
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
  // Groq (OpenAI-compatible, free + very fast)
  groqApiKey?: string
  groqModel?: string
  // DeepSeek (OpenAI-compatible, very cheap, much stronger than small Groq models)
  deepseekApiKey?: string
  deepseekModel?: string
  // OpenCode Zen gateway (OpenAI-compatible, frontier models: Claude/GPT/Gemini)
  opencodeApiKey?: string
  opencodeModel?: string
  // OpenRouter (OpenAI-compatible aggregator — :free models cost nothing)
  openrouterApiKey?: string
  openrouterModel?: string
  // 禁用 Groq 70B→8B 模型階梯（深度評估用：8B 的平原分數比落到
  // Gemini 更糟 — 8B 只適合便宜的分類層）
  noGroqModelLadder?: boolean
  // Tavily (search)
  tavilyApiKey?: string
  // Jina (page reader)
  jinaApiKey?: string
  // Firecrawl
  firecrawlApiKey?: string
  // Provider 優先順序
  chatProviderOrder?: string      // "groq,zai,gemini,openai,anthropic"
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
 *
 * Permanent-failure memo: a provider that failed with a NON-transient
 * error (no balance 402, no payment method, invalid key, missing config)
 * is skipped for the rest of the process — retrying it on every one of
 * ~20+ evaluations per run burned seconds each time for nothing.
 */
const permanentChatFailures = new Set<string>()

export async function chatWithFallback(
  options: ChatCompletionOptions,
  config: ProviderConfig
): Promise<ChatCompletionResult> {
  const order = (config.chatProviderOrder ?? 'groq,gemini,openai,anthropic')
    .split(',')
    .map((s) => s.trim())
    // 'zai' can never work outside the original sandbox (needs .z-ai-config)
    .filter((s) => s && s !== 'zai' && !permanentChatFailures.has(s))

  const errors: string[] = []

  for (const provider of order) {
    try {
      const result = await callChatProvider(provider, options, config)
      if (result) return result
    } catch (e: any) {
      const msg = e.message ?? String(e)
      if (/\b402\b|Insufficient Balance|no payment method|invalid.{0,12}key|Configuration file not found/i.test(msg)) {
        permanentChatFailures.add(provider)
        errors.push(`${provider}: ${msg}`)
        console.warn(`Provider ${provider} permanently unavailable this session — skipping from now on`)
        continue
      }
      // 429 (rate limit) 是暫時性的：退避 3 秒重試一次再換 provider。
      // 免費額度的 Groq 70B 在平行評估下很容易觸發，直接 fallback 會
      // 把全部流量打到下一個（可能也沒設定）的 provider 上。
      if (/\b429\b|rate.?limit/i.test(msg)) {
        // 每日額度上限（TPD）重試也沒用 — 直接換下一個 provider。
        // 每分鐘限流（TPM/RPM）是暫時的：退避 3 秒重試一次。
        if (/per day|\bTPD\b|tokens per day|daily/i.test(msg)) {
          errors.push(`${provider}: ${msg}`)
          console.warn(`Provider ${provider} hit a DAILY limit, trying next provider...`)
          continue
        }
        try {
          await new Promise((r) => setTimeout(r, 3000))
          const retry = await callChatProvider(provider, options, config)
          if (retry) return retry
        } catch (e2: any) {
          errors.push(`${provider}: ${e2.message ?? String(e2)}`)
          console.warn(`Provider ${provider} still rate-limited after backoff, trying next...`)
          continue
        }
      }
      errors.push(`${provider}: ${msg}`)
      // 其他錯誤就 fallback 到下一個
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
      return await chatWithGemini(options, config.geminiApiKey, config.geminiModel ?? 'gemini-2.5-flash')
    case 'groq':
      if (!config.groqApiKey) return null
      return await chatWithGroq(options, config.groqApiKey, config.groqModel ?? 'llama-3.3-70b-versatile', !config.noGroqModelLadder)
    case 'deepseek':
      if (!config.deepseekApiKey) return null
      return await chatWithOpenAICompatible(options, 'https://api.deepseek.com/chat/completions', 'DeepSeek', config.deepseekApiKey, config.deepseekModel ?? 'deepseek-chat')
    case 'opencode':
      if (!config.opencodeApiKey) return null
      return await chatWithOpenAICompatible(options, 'https://opencode.ai/zen/v1/chat/completions', 'OpenCode', config.opencodeApiKey, config.opencodeModel ?? 'claude-haiku-4-5')
    case 'openrouter':
      if (!config.openrouterApiKey) return null
      return await chatWithOpenAICompatible(options, 'https://openrouter.ai/api/v1/chat/completions', 'OpenRouter', config.openrouterApiKey, config.openrouterModel ?? 'meta-llama/llama-3.3-70b-instruct:free')
    default:
      return null
  }
}

/**
 * Z.ai chat（透過 z-ai-web-dev-sdk）
 */
async function chatWithZai(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  if (!(await isZaiAvailable())) throw new Error('z-ai-web-dev-sdk not available in this runtime')
  const ZAI = (await import('z-ai-web-dev-sdk')).default
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: options.messages,
    temperature: options.temperature,
    thinking: { type: 'disabled' },
  })
  const content = completion.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('Z.ai returned an empty response')
  return { content, provider: 'zai' }
}

/**
 * Generic OpenAI-compatible chat completions (OpenAI, DeepSeek, ...)
 */
async function chatWithOpenAICompatible(
  options: ChatCompletionOptions,
  endpoint: string,
  providerName: string,
  apiKey: string,
  model: string
): Promise<ChatCompletionResult> {
  const res = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
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
    throw new Error(`${providerName} ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as any
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error(`${providerName} 回應為空`)
  return { content, provider: providerName.toLowerCase(), model }
}

/**
 * OpenAI chat completions
 */
async function chatWithOpenAI(
  options: ChatCompletionOptions,
  apiKey: string,
  model: string
): Promise<ChatCompletionResult> {
  return chatWithOpenAICompatible(options, 'https://api.openai.com/v1/chat/completions', 'OpenAI', apiKey, model)
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
      signal: AbortSignal.timeout(90_000),
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

/**
 * Groq's 70B daily quota state. Once the day's 70B tokens are spent every
 * call falls back to 8B, which has a much smaller per-minute pool (~6k TPM)
 * — callers should pace themselves accordingly instead of erroring.
 */
let groqDailyCapped = false
export function markGroqDailyCapped(): void { groqDailyCapped = true }
export function isGroqDailyCapped(): boolean { return groqDailyCapped }

/**
 * Groq chat completions (OpenAI-compatible API).
 * Free + very fast inference for Llama, Mixtral, Gemma models.
 * Docs: https://console.groq.com/docs/api-reference
 *
 * Model ladder: Groq's free tier enforces DAILY token limits PER MODEL —
 * when the primary (70B) quota is exhausted the whole engine used to die.
 * On 429 we transparently retry with a lighter model (8B) which has its
 * own quota pool, rather than returning zero results for the rest of the day.
 */
async function chatWithGroq(
  options: ChatCompletionOptions,
  apiKey: string,
  model: string,
  allowModelLadder = true
): Promise<ChatCompletionResult> {
  const FALLBACK_MODEL = 'llama-3.1-8b-instant'
  const models = model === FALLBACK_MODEL || !allowModelLadder ? [model] : [model, FALLBACK_MODEL]
  let lastError: Error | null = null

  for (const m of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: m,
        messages: options.messages,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens,
      }),
    })

    if (res.ok) {
      const data = await res.json() as any
      const content = data.choices?.[0]?.message?.content ?? ''
      if (!content) throw new Error('Groq returned an empty response')
      return { content, provider: 'groq', model: m }
    }

    const text = await res.text()
    lastError = new Error(`Groq ${res.status} (${m}): ${text.slice(0, 200)}`)
    // 429 = quota/rate — try the lighter model before giving up
    if (res.status !== 429) throw lastError
    if (/per day|\bTPD\b|tokens per day/i.test(text)) markGroqDailyCapped()
    console.warn(`Groq model ${m} rate-limited, falling back to ${FALLBACK_MODEL}...`)
  }

  throw lastError ?? new Error('Groq failed')
}

// ===== Web Search =====

export async function searchWithFallback(
  query: string,
  num: number,
  config: ProviderConfig
): Promise<SearchResultItem[]> {
  const order = (config.searchProviderOrder ?? 'jina,tavily')
    .split(',')
    .map((s) => s.trim())
    // 'zai' can never work outside the original sandbox — every search wasted
    // a failed round-trip (and occasionally the retry timeout) before Tavily
    .filter((s) => s && s !== 'zai')

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
  const signal = AbortSignal.timeout(config.searchTimeoutMs ?? 15_000)
  switch (provider) {
    case 'zai':
      return await searchWithZai(query, num)
    case 'tavily':
      if (!config.tavilyApiKey) return []
      return await searchWithTavily(query, num, config.tavilyApiKey, signal)
    case 'jina':
      if (!config.jinaApiKey) return []
      return await searchWithJina(query, num, config.jinaApiKey, signal)
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

async function searchWithTavily(query: string, num: number, apiKey: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
  // Try Authorization header first (more reliable from cloud environments
  // — Tavily has been known to 401 body-auth requests from cloud IPs)
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: num,
      include_answer: false,
    }),
  })

  if (!res.ok) {
    // Fallback: try the legacy api_key body field
    const fallbackRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: num,
        include_answer: false,
      }),
    })
    if (!fallbackRes.ok) {
      const text = await fallbackRes.text()
      throw new Error(`Tavily ${fallbackRes.status}: ${text.slice(0, 200)}`)
    }
    const fallbackData = await fallbackRes.json() as any
    return (fallbackData.results ?? []).map((r: any) => ({
      url: r.url ?? '',
      name: r.title ?? r.url ?? '',
      snippet: r.content ?? '',
      host_name: (() => { try { return new URL(r.url).hostname } catch { return '' } })(),
    }))
  }

  const data = await res.json() as any
  return (data.results ?? []).map((r: any) => ({
    url: r.url ?? '',
    name: r.title ?? r.url ?? '',
    snippet: r.content ?? '',
    host_name: (() => { try { return new URL(r.url).hostname } catch { return '' } })(),
  }))
}

/**
 * Jina search (https://s.jina.ai/?q=...) — free tier, returns markdown with
 * `[n] Title:` / `[n] URL Source:` / `[n] Description:` blocks. The POST
 * /search endpoint 500s on free keys; this GET endpoint works.
 */
async function searchWithJina(query: string, num: number, apiKey: string, signal?: AbortSignal): Promise<SearchResultItem[]> {
  const url = `https://s.jina.ai/?q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    method: 'GET',
    signal,
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Jina search ${res.status}: ${text.slice(0, 200)}`)
  }
  const markdown = await res.text()

  // Parse blocks like:
  //   [1] Title: Foo Bar
  //   [1] URL Source: https://...
  //   [1] Description: ...
  const results: SearchResultItem[] = []
  const lines = markdown.split('\n')
  let current: { title?: string; url?: string; snippet?: string } | null = null
  let currentIdx = -1
  for (const line of lines) {
    const m = line.match(/^\[(\d+)\]\s+(\w+(?:\s+\w+)?):\s*(.*)$/)
    if (!m) continue
    const idx = parseInt(m[1], 10)
    const field = m[2].toLowerCase()
    const value = m[3].trim()
    if (field === 'title') {
      if (current && currentIdx !== idx) {
        if (current.url) results.push(toSearchItem(current))
        current = null
      }
      current = { title: value }
      currentIdx = idx
    } else if (current && currentIdx === idx) {
      if (field === 'url source' || field === 'url') current.url = value
      else if (field === 'description') current.snippet = value
    }
  }
  if (current && current.url) results.push(toSearchItem(current))

  return results.slice(0, num)
}

function toSearchItem(r: { title?: string; url?: string; snippet?: string }): SearchResultItem {
  return {
    url: r.url ?? '',
    name: r.title ?? r.url ?? '',
    snippet: r.snippet ?? '',
    host_name: (() => { try { return new URL(r.url ?? '').hostname } catch { return '' } })(),
  }
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
  const signal = AbortSignal.timeout(config.pageTimeoutMs ?? 20_000)
  switch (provider) {
    case 'zai':
      return await fetchPageWithZai(url)
    case 'jina':
      return await fetchPageWithJina(url, config.jinaApiKey, signal)
    case 'firecrawl':
      if (!config.firecrawlApiKey) return null
      return await fetchPageWithFirecrawl(url, config.firecrawlApiKey, signal)
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

async function fetchPageWithJina(url: string, apiKey?: string, signal?: AbortSignal): Promise<PageContent | null> {
  // Jina Reader: https://r.jina.ai/{url}
  // 免費 tier 不需 API key，但有 API key 限額較高
  //
  // IMPORTANT: Use 'text/plain' Accept header (NOT 'text/html'). Jina returns
  // markdown by default. Asking for 'text/html' makes Jina attempt a full
  // browser render of the page, which can fail on JS-heavy SPA sites like
  // scale.com, notion.so, etc. With 'text/plain' Jina returns markdown
  // which is more reliable + faster.
  const headers: Record<string, string> = {
    'Accept': 'text/plain',
    'X-Return-Format': 'markdown',
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal })

  if (!res.ok) {
    throw new Error(`Jina ${res.status}`)
  }

  const text = await res.text()
  if (!text || text.length < 50) {
    throw new Error(`Jina returned empty/short response (len=${text.length})`)
  }
  // Jina 回傳 markdown 格式，標題在第一行 "Title: ..."
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

async function fetchPageWithFirecrawl(url: string, apiKey: string, signal?: AbortSignal): Promise<PageContent | null> {
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    signal,
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
