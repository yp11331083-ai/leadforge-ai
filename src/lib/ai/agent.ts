import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import {
  chatWithFallback,
  searchWithFallback,
  fetchPageWithFallback,
  isGroqDailyCapped,
  type ChatMessage,
  type ProviderConfig,
  type SearchResultItem,
  type PageContent,
} from './providers'

// Re-export so callers can import ProviderConfig from a single module path.
export type { ProviderConfig, ChatMessage, SearchResultItem, PageContent } from './providers'

/**
 * Cheap stable hash (djb2) for cache-keying a service definition.
 */
export function serviceFingerprint(serviceName: string, description: string): string {
  const s = `${serviceName.trim().toLowerCase()}|${description.trim().toLowerCase()}`
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(16)
}

let zaiInstance: ZAI | null = null

export async function getAI() {
  if (!zaiInstance) {
    try {
      zaiInstance = await ZAI.create()
    } catch (e) {
      console.warn('Z.ai SDK not available on this environment')
      throw e
    }
  }
  return zaiInstance
}

// 全域 provider config（從 API route 注入）
let globalProviderConfig: ProviderConfig = {}

export function setProviderConfig(config: ProviderConfig) {
  globalProviderConfig = config
}

export function getProviderConfig(): ProviderConfig {
  return globalProviderConfig
}

/**
 * 使用 page_reader 抓取網站內容（多 provider fallback）
 */
export async function fetchWebsiteContent(url: string) {
  try {
    // 優先用 providers 抽象層（支援 fallback）
    const result = await fetchPageWithFallback(url, globalProviderConfig)
    if (result) {
      return {
        title: result.title,
        html: result.html,
        url: result.url,
        publishedTime: result.publishedTime,
      }
    }
    return null
  } catch (error) {
    console.error('fetchWebsiteContent error:', error)
    return null
  }
}

/**
 * 透過 web_search 搜尋（多 provider fallback）
 */
export async function searchCompanies(query: string, num: number = 10): Promise<SearchResultItem[]> {
  try {
    return await searchWithFallback(query, num, globalProviderConfig)
  } catch (error) {
    console.error('searchCompanies error:', error)
    return []
  }
}

/**
 * 純文字化 HTML：移除標籤、壓縮空白
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000) // 限制長度避免 token 超載
}

/**
 * AI 研究公司：給定網站內容，請 AI 整理出核心痛點、徵才訊號、商業模式摘要
 */
export async function researchCompany(params: {
  company: string
  website: string
  websiteContent: string
  extraContext?: string
}) {
  const zai = await getAI().catch(() => null as any)
  const { company, website, websiteContent, extraContext } = params

  const prompt = `You are a top-tier B2B lead research analyst (similar to Clay's Claygent).

Based on the following information, deeply analyze "${company}" and output a structured research report IN ENGLISH.

Company website: ${website}

Website content summary:
${websiteContent.slice(0, 8000)}

${extraContext ? `Additional context: ${extraContext}` : ''}

Analyze from these five dimensions — each must have concrete insights:

1. **Core Business**: What does this company do? Product/service, target audience, business model
2. **Hiring Signals**: Are they recently hiring for any key roles? (Focus on: sales, marketing, customer success, product — growth-oriented roles) What growth pain does this suggest?
3. **Pain Points** (3-5 items, 1-2 sentences each): Based on their business type and hiring dynamics, what pain points are they most likely facing? Be specific and actionable.
4. **Buying Intent Signals**: Are there any signals suggesting they might be purchasing related tools/services? (e.g. hiring data analysts → may be strengthening data infrastructure)
5. **Outreach Angle**: As a B2B business developer, what's the most resonating angle when reaching out to them?

Output pure JSON (no markdown code block):

{
  "business_summary": "one paragraph describing core business",
  "hiring_signals": ["signal 1", "signal 2"],
  "pain_points": ["pain point 1", "pain point 2", "pain point 3"],
  "buying_signals": ["signal 1", "signal 2"],
  "outreach_angle": "suggested outreach angle"
}`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: 'You are a professional B2B sales research analyst. You excel at deriving actionable business development insights from public company information. You MUST respond in English. Your response must be pure JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  }, globalProviderConfig)

  const raw = chatResult.content
  return parseResearchResult(raw)
}

function parseResearchResult(raw: string) {
  const parsed = extractJsonLoose(raw)
  if (parsed !== undefined) {
    return { success: true, data: parsed, raw }
  }
  // JSON 解析失敗，回傳原始內容
  return { success: false, data: null, raw }
}

/**
 * Lenient JSON extraction from LLM output. Models occasionally wrap JSON in
 * markdown fences, prepend prose, or leave trailing commas — each of those
 * used to discard an entire evaluation result. Strategy:
 *   1. strip ``` fences
 *   2. slice from the first '{'/'[' to the LAST matching close char
 *   3. remove trailing commas before } or ]
 * Returns undefined when nothing JSON-shaped is found.
 */
export function extractJsonLoose(raw: string): any | undefined {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  const firstObj = cleaned.indexOf('{')
  const firstArr = cleaned.indexOf('[')
  let start: number
  let closeChar: string
  if (firstObj === -1 && firstArr === -1) return undefined
  if (firstArr === -1 || (firstObj !== -1 && firstObj < firstArr)) {
    start = firstObj
    closeChar = '}'
  } else {
    start = firstArr
    closeChar = ']'
  }
  const end = cleaned.lastIndexOf(closeChar)
  if (end <= start) return undefined
  cleaned = cleaned.slice(start, end + 1)

  // Trailing commas before a closer are invalid JSON but common LLM output.
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  try {
    return JSON.parse(cleaned)
  } catch {
    return undefined
  }
}

/**
 * 根據 lead 研究結果，生成個人化冷郵件
 */
export async function generateColdEmail(params: {
  company: string
  contactName?: string
  title?: string
  industry?: string
  painPoints?: string[]
  hiringSignals?: string[]
  buyingSignals?: string[]
  outreachAngle?: string
  businessSummary?: string
  senderName: string
  senderCompany: string
  senderProduct: string
  tone: 'professional' | 'friendly' | 'concise' | 'bold'
  language: 'zh-TW' | 'en'
}) {
  const zai = await getAI().catch(() => null as any)
  const {
    company,
    contactName,
    title,
    industry,
    painPoints = [],
    hiringSignals = [],
    buyingSignals = [],
    outreachAngle,
    businessSummary,
    senderName,
    senderCompany,
    senderProduct,
    tone,
    language,
  } = params

  const langInstruction =
    language === 'zh-TW'
      ? '請使用繁體中文撰寫，語氣自然、像真人寫的，避免翻譯腔。'
      : 'Write in natural, native-level English.'

  const toneMap = {
    professional: '專業但不過於正式，展現你對他們業務的理解深度',
    friendly: '友善、輕鬆，像同行業的朋友在交流',
    concise: '極簡、直擊重點，不浪費對方時間',
    bold: '大膽、有觀點，敢於提出挑戰性的問題',
  }

  const prompt = `You are a professional B2B Cold Email expert. Write a cold email based on the provided variables.

[Constraints]
1. Word count must be strictly under 125 words.
2. Tone must be natural and conversational — like a real salesperson wrote it. No formulaic marketing language.
3. NEVER include these spam trigger words: Free, Guarantee, Risk-Free, 100%, Special Offer, $$$, Click Here, Act Now, Limited Time, Buy Now.
4. End with a low-friction Call-to-Action (e.g., "Would you have 2 minutes to watch a quick demo?")
5. Do NOT use "Dear", "Hi there", "Hope this email finds you well", or "I hope you're doing well".

[Input Variables]
- Target Name: ${contactName || 'Unknown (use a general greeting)'}
- Target Title: ${title || 'Unknown'}
- Target Company: ${company}
- Target Industry: ${industry || 'Unknown'}
- User Value Proposition: ${senderProduct}
- Sender Name: ${senderName}
- Sender Company: ${senderCompany}

[Research Insights]
- Business Summary: ${businessSummary || 'N/A'}
- Hiring Signals: ${hiringSignals.join(', ') || 'N/A'}
- Pain Points: ${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') || 'N/A'}
- Buying Signals: ${buyingSignals.join(', ') || 'N/A'}
- Outreach Angle: ${outreachAngle || 'N/A'}

[Language]
${langInstruction}

[Tone]
${toneMap[tone]}

[Email Structure]
1. Subject: Under 50 chars, spark curiosity but not clickbait
2. Icebreaker: 1-2 sentences showing specific understanding of their company
3. Value Proposition: Based on pain points, explain how your product helps (be specific)
4. Social Proof (optional): Brief mention of similar company results
5. CTA: Low-friction next step (e.g., "Tuesday afternoon for 15 min?")

Output PURE JSON (no markdown):
{
  "subject": "email subject",
  "icebreaker": "1-2 sentence opener",
  "body": "full email body (without subject)",
  "cta": "one sentence CTA"
}`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content:
          '你是專業的 B2B 冷郵件寫手。你的郵件回覆率業界頂尖。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  }, globalProviderConfig)

  const raw = chatResult.content
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  try {
    const parsed = JSON.parse(cleaned)
    return { success: true, data: parsed, raw }
  } catch {
    return { success: false, data: null, raw }
  }
}

// ===== 深度研究：多源整合 =====

export interface DeepResearchResult {
  funding: {
    last_round?: string
    total_raised?: string
    valuation?: string
    lead_investors?: string[]
    last_funding_date?: string
  }
  tech_stack: string[]
  competitors: Array<{ name: string; differentiation?: string }>
  recent_news: Array<{ title: string; source?: string; date?: string; summary?: string }>
  open_roles: {
    sales?: string[]
    engineering?: string[]
    product?: string[]
    marketing?: string[]
    other?: string[]
  }
  key_people: Array<{ name: string; title: string; linkedin?: string }>
  growth_signals: string[]
  strategic_initiatives: string[]
}

export interface ResearchSource {
  url: string
  title: string
  type: 'website' | 'linkedin' | 'crunchbase' | 'careers' | 'news'
  fetched: boolean
  content_length: number
}

/**
 * 平行執行多組 web_search，找出可研究的次要來源
 * 注意：避免觸發 429，使用循序 + 小延遲
 */
async function discoverSecondarySources(company: string, website: string) {
  const searches = [
    { type: 'linkedin' as const, query: `${company} site:linkedin.com/company` },
    { type: 'crunchbase' as const, query: `${company} site:crunchbase.com organization` },
    { type: 'careers' as const, query: `${company} careers jobs hiring` },
    { type: 'news' as const, query: `${company} funding announcement acquisition launch 2024 2025` },
  ]

  // 循序執行避免 429 rate limit
  const allResults: Array<{ type: ResearchSource['type']; items: Array<{ url?: string; name?: string }> }> = []
  for (const s of searches) {
    try {
      const items = await searchCompanies(s.query, 3)
      allResults.push({ type: s.type, items })
    } catch (e) {
      console.error(`search ${s.type} failed:`, e)
      allResults.push({ type: s.type, items: [] })
    }
    // 小延遲避免 rate limit
    await new Promise((r) => setTimeout(r, 300))
  }

  // 從搜尋結果挑出最佳 URL（過濾掉官網本身）
  const sources: Array<{ url: string; type: ResearchSource['type']; title: string }> = []
  const websiteHost = (() => {
    try {
      return new URL(website).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()

  for (const { type, items } of allResults) {
    for (const r of items.slice(0, 2)) {
      if (!r?.url) continue
      // 跳過官網本身（已經會被抓）
      try {
        const host = new URL(r.url).hostname.replace(/^www\./, '')
        if (websiteHost && host === websiteHost) continue
      } catch {
        continue
      }
      sources.push({ url: r.url, type, title: r.name ?? r.url })
    }
  }

  // 去重
  const seen = new Set<string>()
  return sources.filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  }).slice(0, 5) // 最多再抓 5 個來源
}

/**
 * 循序抓取多個 URL（避免並行觸發 429）
 */
async function fetchMultipleUrls(
  urls: Array<{ url: string; type: ResearchSource['type']; title: string }>
): Promise<Array<{ url: string; type: ResearchSource['type']; title: string; content: string | null }>> {
  const results: Array<{ url: string; type: ResearchSource['type']; title: string; content: string | null }> = []
  for (const u of urls) {
    const data = await fetchWebsiteContent(u.url)
    results.push({
      url: u.url,
      type: u.type,
      title: u.title,
      content: data ? htmlToText(data.html).slice(0, 6000) : null,
    })
    // 小延遲
    await new Promise((r) => setTimeout(r, 200))
  }
  return results
}

/**
 * 深度研究：同時抓取官網 + LinkedIn + Crunchbase + 徵才頁面 + 新聞
 * 然後用 AI 整合出結構化的全方位公司情報
 */
export async function researchCompanyDeep(params: {
  company: string
  website: string
  websiteContent: string
  extraContext?: string
}): Promise<{
  success: boolean
  data: DeepResearchResult | null
  sources: ResearchSource[]
  raw: string
}> {
  const zai = await getAI().catch(() => null as any)
  const { company, website, websiteContent, extraContext } = params

  // 步驟 1：探索次要來源
  const secondarySources = await discoverSecondarySources(company, website)

  // 步驟 2：平行抓取所有來源
  const fetched = await fetchMultipleUrls(secondarySources)

  // 步驟 3：組裝來源清單（含官網）
  const sources: ResearchSource[] = [
    {
      url: website,
      title: `${company} 官網`,
      type: 'website',
      fetched: true,
      content_length: websiteContent.length,
    },
    ...fetched.map((f) => ({
      url: f.url,
      title: f.title,
      type: f.type,
      fetched: !!f.content,
      content_length: f.content?.length ?? 0,
    })),
  ]

  // 步驟 4：組裝多源上下文
  const sourceBlocks: string[] = []

  sourceBlocks.push(`=== 來源 1：${company} 官網 ===\nURL: ${website}\n內容：\n${websiteContent.slice(0, 6000)}`)

  fetched.forEach((f, i) => {
    if (f.content) {
      sourceBlocks.push(
        `=== 來源 ${i + 2}：${f.title}（${f.type}） ===\nURL: ${f.url}\n內容：\n${f.content.slice(0, 5000)}`
      )
    }
  })

  const combinedSources = sourceBlocks.join('\n\n---\n\n')

  // 步驟 5：AI 整合分析（輸出更豐富的結構化資料）
  const prompt = `你是頂級 B2B 商業情報分析師，擅長從多源公開資料中拼湊出企業的全貌。

請根據以下針對「${company}」收集的多源資料，整理出**結構化的深度情報**。

## 多源研究資料

${combinedSources}

${extraContext ? `## 額外背景\n${extraContext}` : ''}

## 分析維度

請從以下 8 個維度分析，每個維度都要儘可能具體、有數字、有名字：

1. **融資狀態（funding）**：最近一輪融資、總募集金額、估值、主要投資人、融資日期。如果查不到，明確標註 "unknown"。
2. **技術堆疊（tech_stack）**：從徵才訊息、官網、新聞推斷他們使用的關鍵技術（例如：React、Kubernetes、Snowflake、Segment...）。至少列出 5 項，越多越好。
3. **競爭對手（competitors）**：列出 3-5 個直接/間接競爭對手，並簡述差異化定位。
4. **近期新聞（recent_news）**：列出 3-5 則近 12 個月的重要新聞（融資、產品發布、併購、高層異動、重大合作）。
5. **開放職位（open_roles）**：按部門分類（sales/engineering/product/marketing/other），每個部門列出 2-5 個具體職稱。如果查不到就回空陣列。
6. **關鍵人物（key_people）**：列出 3-5 位關鍵主管（CEO、CTO、VP Sales 等），含姓名、職稱。LinkedIn URL 可選。
7. **成長訊號（growth_signals）**：3-5 個暗示他們正在成長/擴張的具體訊號（例如：「正在歐洲開拓市場」、「工程團隊半年內翻倍」）。
8. **戰略倡議（strategic_initiatives）**：3-5 個他們目前正在推動的策略方向（例如：「All-in AI」、「企業版推向 Fortune 500」）。

## 輸出格式

請輸出**純 JSON**（不要 markdown code block），結構如下：

{
  "funding": {
    "last_round": "Series C",
    "total_raised": "$350M",
    "valuation": "$2B",
    "lead_investors": ["Sequoia", "Index Ventures"],
    "last_funding_date": "2024-Q3"
  },
  "tech_stack": ["React", "TypeScript", "Go", "Kubernetes", "Snowflake"],
  "competitors": [
    {"name": "Competitor A", "differentiation": "更聚焦企業版"},
    {"name": "Competitor B", "differentiation": "價格更低但功能較少"}
  ],
  "recent_news": [
    {"title": "...", "source": "TechCrunch", "date": "2024-08", "summary": "..."}
  ],
  "open_roles": {
    "sales": ["Enterprise AE", "SDR Manager"],
    "engineering": ["Staff Engineer", "ML Engineer"],
    "product": ["Senior PM"],
    "marketing": ["Head of Growth"],
    "other": []
  },
  "key_people": [
    {"name": "John Doe", "title": "CEO", "linkedin": ""}
  ],
  "growth_signals": ["訊號1", "訊號2"],
  "strategic_initiatives": ["倡議1", "倡議2"]
}

注意：
- 不要編造資料。查不到的就標 "unknown" 或空陣列。
- 技術堆疊要從徵才訊息或工程 blog 推斷，不要瞎猜。
- 競爭對手差異化要具體，不要寫「類似產品」。`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content:
          '你是頂級 B2B 商業情報分析師。你擅長從 LinkedIn、Crunchbase、徵才頁面、新聞等多源資料中拼湊出企業全貌。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  }, globalProviderConfig)

  const raw = chatResult.content
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  try {
    const parsed = JSON.parse(cleaned) as DeepResearchResult
    return { success: true, data: parsed, sources, raw }
  } catch {
    return { success: false, data: null, sources, raw }
  }
}

// ===== AI 自動開發：根據服務描述找出潛在客戶 =====

export interface ProspectCandidate {
  company: string
  website: string
  industry?: string
  company_type?: 'marketplace' | 'vendor' | 'client'
  fit_score: number // 0-100
  why_they_need_it: string
  suggested_angle: string
  key_signals: string[]
  confidence: 'high' | 'medium' | 'low'
  website_title?: string
  /** exact sentence(s) quoted from the candidate site that evidence the need */
  evidence?: string
}

export interface AutoProspectResult {
  candidates: ProspectCandidate[]
  ai_search_queries: string[]
  total_discovered: number
  evaluated: number
}

/**
 * 步驟 1：AI 根據服務描述，生成多組精準的搜尋查詢詞
 */
export async function generateSearchQueries(params: {
  serviceName: string
  description: string
  targetIndustries?: string
  targetCompanySize?: string
  targetLocation?: string
  idealCustomerSignals?: string
}): Promise<{ success: boolean; queries: string[]; raw: string }> {
  const zai = await getAI().catch(() => null as any)
  const { serviceName, description, targetIndustries, targetCompanySize, targetLocation, idealCustomerSignals } = params

  const prompt = `You are a B2B lead generation expert specializing in finding SMALL to MID-SIZE companies that need a specific service.

My service/product is:

**Service Name**: ${serviceName}
**Detailed Description**: ${description}
${targetIndustries ? `**Target Industries**: ${targetIndustries}` : ''}
${targetCompanySize ? `**Target Company Size**: ${targetCompanySize}` : ''}
${targetLocation ? `**Target Location**: ${targetLocation}` : ''}
${idealCustomerSignals ? `**Ideal Customer Signals**: ${idealCustomerSignals}` : ''}

Design 10 Google search queries that surface websites of SMALL companies that would BUY my service.

## SEARCH STRATEGIES (in priority order):

### Strategy 1: BUYER-side signals (most important)
Search for companies SHOWING the pain my service solves — never for sellers of that service.
- GOOD: "growing D2C skincare brand" / "WooCommerce store Taiwan" / "fintech startup hiring customer support"
- BAD: "AI chatbot agency" / "lead generation company" (those are VENDORS, they never buy)

### Strategy 2: Tech-footprint queries
Find sites built on platforms my typical buyers use:
- "powered by Shopline", "built with WooCommerce", "runs on Shopify Plus" (+ location if given)

### Strategy 3: Hiring-signal queries
Companies hiring for the function my service replaces/boosts:
- "hiring customer support specialist" / "looking for sales rep"

### Strategy 4: Industry + niche directories of BUYERS
- "top D2C coffee brands", "independent fashion labels" (brand lists, not SaaS lists)

## HARD RULES:
1. Each query is 3-8 words. SHORT and SPECIFIC beats long and vague.
2. Append " -site:linkedin.com" to every query — this is the ONLY exclusion allowed. Stacking "-shopee -amazon -pchome ..." is FORBIDDEN (the search API ignores most operators and recall collapses).
3. NEVER search for agencies, vendors, consultancies, or "companies that provide ${serviceName}".
4. ${targetLocation ? `Include "${targetLocation}" in at least 4 queries.` : 'No location restriction.'}
5. No quoted boolean strings longer than 3 words.
6. LANGUAGE SPLIT (mandatory): if the target market's primary language is not English (Taiwan/HK → Traditional Chinese, Japan → Japanese, France → French, etc.), queries 1-5 MUST be in English and queries 6-10 MUST be in that local language. English-only queries surface international directories and blog spam instead of local buyers.${targetLocation ? `\nTarget market: ${targetLocation}` : ''}

Output pure JSON array (no markdown):
["query 1 -site:linkedin.com", "query 2 -site:linkedin.com", ...]`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: 'You are a top-tier B2B lead generation expert. Your response must be a pure JSON array. Respond in English.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
  }, globalProviderConfig)

  const raw = chatResult.content
  const parsed = extractJsonLoose(raw)
  const queries = Array.isArray(parsed)
    ? parsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : []
  if (queries.length > 0) {
    return { success: true, queries, raw }
  }

  // One retry with an explicit nudge — a malformed first response used to
  // abort the whole run before any searching happened.
  const retryResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: 'You are a top-tier B2B lead generation expert. Your response must be a pure JSON array. Respond in English.',
      },
      { role: 'user', content: `${prompt}\n\nIMPORTANT: Your previous answer was not valid JSON. Output ONLY the JSON array, starting with [ and ending with ]. No prose, no markdown.` },
    ],
    temperature: 0.3,
  }, globalProviderConfig)
  const retryParsed = extractJsonLoose(retryResult.content)
  const retryQueries = Array.isArray(retryParsed)
    ? retryParsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    : []
  return { success: retryQueries.length > 0, queries: retryQueries, raw: retryResult.content }
}

/**
 * 步驟 2：從搜尋結果中萃取公司 URL（過濾掉非公司頁面）
 *
 * 優先順序（用戶要求）：
 *   1. 公司官網 (Website URL) — 第一優先
 *   2. LinkedIn 公司頁 / Crunchbase / Y Combinator — 第二優先（官網抓不到時的備援）
 *
 * 對同一家公司，如果搜尋結果中同時出現官網和 LinkedIn，只保留官網。
 *
 * 重要過濾規則：
 *   - 排除目錄/聚合網站（如 topstartups.io, growjo.com, traz Cooper）
 *   - 排除帶查詢字串的 URL（通常是目錄頁面，如 ?industries=SaaS）
 *   - YC /companies/location/X 是目錄，不是公司
 */
export function extractCompanyUrls(
  searchResults: Array<{ url?: string; name?: string; host_name?: string }>
): Array<{ url: string; name: string }> {
  // 第一階段：先收集所有「看起來像公司」的 URL，分為官網和社交平台兩類
  const websites: Array<{ url: string; name: string; host: string }> = []
  const socials: Array<{ url: string; name: string; host: string; platform: 'linkedin' | 'crunchbase' | 'yc' }> = []

  const excludePatterns = [
    /youtube\.com|facebook\.com|twitter\.com|x\.com|tiktok\.com/i,
    /wikipedia\.org/i,
    /\.pdf$|\.jpg$|\.png$/i,
    /google\.com\/search/i,
    /news\./i,
    // 排除 LinkedIn 職缺頁（不是公司頁）
    /linkedin\.com\/jobs\//i,
    // 排除 LinkedIn 個人 profile
    /linkedin\.com\/in\//i,
    // 排除博客文章路徑
    /\/blog\//i,
    /\/learn\//i,
    /\/articles?\//i,
    /\/news\//i,
    // 排除求職網
    /indeed\.com|glassdoor\.com|monster\.com|ziprecruiter\.com/i,
    // 排除文章網站
    /medium\.com|substack\.com|wordpress\.com|dev\.to/i,
    /techcrunch\.com|venturebeat\.com|thenextweb\.com|theverge\.com/i,
    /bloomberg\.com|reuters\.com|forbes\.com|businessinsider\.com/i,
    /github\.com|gitlab\.com|bitbucket\.org/i,
    /g2\.com|capterra\.com|trustpilot\.com/i,  // 評論網站
    // 排除目錄/聚合網站（列出多家公司，不是公司本身）
    /topstartups\.io|growjo\.com|tracxn\.com|cbinsights\.com/i,
    /deployhq\.com|semrush\.com|similarweb\.com|builtwith\.com/i,
    /producthunt\.com|betalist\.com|saa.sh|getlatka\.com/i,
    /apollo\.io|zoominfo\.com|lusha\.com|clearbit\.com/i,
    /clutch\.co|GoodFirms\.org/i,
    // Exclude big e-commerce platforms/marketplaces (NOT our target customers)
    /shopee\./i,
    /pchome\./i,
    /momo\./i,
    /rakuten\./i,
    /amazon\./i,
    /ebay\./i,
    /aliexpress\./i,
    /shopify\./i,
    /etsy\./i,
    /carousell\./i,
    /walmart\./i,
    /costco\./i,
    /u-buy\./i,
    /ubuy\./i,
    // E-commerce STORE-BUILDING platforms / MarTech vendors — they COMPETE with
    // e-commerce service providers, they never buy from them. Tech-footprint
    // queries ("powered by Shopline") deliberately surface these domains.
    /shopline\./i,
    /91app\./i,
    /cyberbiz\./i,
    /wix\.com/i,
    /squarespace\./i,
    /bigcommerce\./i,
    /woocommerce\./i,
    /magento\./i,
    /godaddy\./i,
    /shopbase\./i,
    /easystore\./i,
    /meepshop\./i,
    /waca\./i,
    /1shop\.com/i,
    // Job boards / recruiting platforms — recurring junk category: they are
    // talent infrastructure, never buyers of B2B services, and kept showing
    // up as false "client" matches
    /wellfound\./i,
    /himalayas\./i,
    /dailyremote\./i,
    /remoteok\./i,
    /weworkremotely\./i,
    /jobgether\./i,
    /fintechfans\./i,
    /nodesk\./i,
    /builtin\./i,
    /angel\.co/i,
    /roberthalf\./i,
    /manpower\./i,
    /adecco\./i,
    /randstad\./i,
  ]

  // 通用目錄路徑模式（這些 path 通常出現在聚合網站，不是公司首頁）
  const directoryPathPatterns = [
    /\/companies\/location\//i,        // ycombinator.com/companies/location/india
    /\/companies\?/i,                  // 任何 ?companies=
    /\/startups\/list/i,
    /\/companies\/category/i,
    /\/companies\/industry/i,
    /\/collections?\//i,
    /\/topics?\//i,
    /\/tags?\//i,
    /\/categories?\//i,
    /\/top-/i,                         // top-100-startups, top-50-saas
    /\/best-/i,                        // best-crm-tools
    /\/list-of-/i,
  ]

  for (const r of searchResults) {
    if (!r?.url) continue
    const url = r.url

    // 排除帶查詢字串的 URL（通常是目錄頁面，如 topstartups.io?industries=SaaS）
    try {
      const parsed = new URL(url)
      if (parsed.search && parsed.search.length > 0) {
        // 有 query string — 大概率是目錄/搜尋頁，不是公司首頁
        continue
      }
    } catch {
      continue
    }

    if (excludePatterns.some((p) => p.test(url))) continue

    try {
      const host = new URL(url).hostname.replace(/^www\./, '')
      const name = r.name ?? host
      const path = new URL(url).pathname

      // LinkedIn 公司頁（必須是 /company/{name}，不能是 /company/{name}/about 等子頁）
      if (/linkedin\.com\/company\//.test(url)) {
        // 過濾掉 LinkedIn 目錄頁面
        if (/\/company\/showcase\//i.test(path)) continue
        socials.push({ url, name, host, platform: 'linkedin' })
        continue
      }

      // Crunchbase 公司頁（必須是 /organization/{name}）
      if (/crunchbase\.com\/organization\//.test(url)) {
        socials.push({ url, name, host, platform: 'crunchbase' })
        continue
      }

      // Y Combinator 公司頁 — 必須是 /companies/{name}，不能是 /companies/location/X 或 /companies?...
      if (/ycombinator\.com\/companies\//.test(url)) {
        // 過濾目錄頁面
        if (directoryPathPatterns.some((p) => p.test(path))) continue
        // /companies/location/X 通常是目錄，跳過
        if (/\/companies\/location\//i.test(path)) continue
        // 沒有具體公司名的也跳過
        const parts = path.split('/').filter(Boolean)
        if (parts.length < 2) continue
        socials.push({ url, name, host, platform: 'yc' })
        continue
      }

      // 一般公司網站。搜尋引擎常回深層頁（產品頁/關於頁）而非首頁，
      // 舊版只接受 path === '/' 造成 ~98% 的結果被丟掉（漏斗被餓死）。
      // 現在：排除文章式路徑後，一律正規化到網站根網址。
      const articlePathPatterns = [
        /\/blog(\/|$)/i, /\/articles?(\/|$)/i, /\/news(\/|$)/i, /\/press(\/|$)/i,
        /\/posts?(\/|$)/i, /\/stories(\/|$)/i, /\/guides?(\/|$)/i,
        /\/insights?(\/|$)/i, /\/resources(\/|$)/i, /\/case-stud/i,
        /\/20\d{2}(\/|$)/i,  // date-prefixed news URLs
        /\/(p|page)\/?\d+/i, // pagination
      ]
      if (articlePathPatterns.some((p) => p.test(path))) continue

      // 子網域黑名單：careers.nike.com / help.x.com 是大公司的部門頁，
      // 不是潛在客戶的官網，評估只會浪費一次 LLM 呼叫。
      // blog.shopline.tw 這類內容行銷子網域尤其危險：它是平台商的
      // 行銷能力展示，曾被誤判成「缺乏行銷的潛在客戶」還拿了 85 分。
      if (/^(careers?|jobs?|help|support|docs?|developer|community|status|portal|app|blog|news|press|learn|academy|events|info)\./i.test(host)) continue

      if (!/\.gov|\.edu|\.mil/i.test(host)) {
        // 深層連結的 title 常是文章標題不是公司名 — 用 host_name（Tavily 提供）
        // 或 host 本身當公司名，比錯誤的標題好
        const deepLink = path !== '/' && path !== ''
        const displayName = deepLink
          ? prettifyHost(r.host_name || host)
          : name
        websites.push({ url: `https://${host}`, name: displayName, host })
      }
    } catch {
      continue
    }
  }

  // 第二階段：組合結果。官網優先，LinkedIn/Crunchbase/YC 只在沒有對應官網時才加入。
  const companies: Array<{ url: string; name: string }> = []
  const seenHosts = new Set<string>()
  const seenNames = new Set<string>()

  // 2a. 先加所有官網（去重 by host 和 name）
  for (const w of websites) {
    const nameKey = w.name.toLowerCase().trim()
    if (seenHosts.has(w.host) || seenNames.has(nameKey)) continue
    seenHosts.add(w.host)
    seenNames.add(nameKey)
    companies.push({ url: w.url, name: w.name })
  }

  // 2b. 再加社交平台結果（用 name 去重，如果 name 已經有官網就跳過）
  for (const s of socials) {
    const nameKey = s.name.toLowerCase().trim()
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)
    companies.push({ url: s.url, name: s.name })
  }

  return companies
}

/**
 * Derive a display name from a hostname: "acme-corp.com.tw" → "Acme Corp"
 */
function prettifyHost(host: string): string {
  const label = host.split('.')[0].replace(/[-_]+/g, ' ').trim()
  if (!label) return host
  return label.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * 步驟 3：AI 評估每個候選公司與你服務的契合度
 */
export async function evaluateProspectFit(params: {
  serviceName: string
  description: string
  keyBenefits?: string
  idealCustomerSignals?: string
  companyUrl: string
  companyName: string
  websiteContent: string
  targetLocation?: string
  targetCompanySize?: string
}): Promise<{
  success: boolean
  data: ProspectCandidate | null
  raw: string
}> {
  const zai = await getAI().catch(() => null as any)
  const { serviceName, description, keyBenefits, idealCustomerSignals, companyUrl, companyName, websiteContent, targetLocation, targetCompanySize } = params

  const prompt = `You are a top-tier B2B business analyst skilled at evaluating whether a company needs a given service.

## CRITICAL: Three-Step Company Type Detection
Before evaluating fit, determine what TYPE of company this is:

### Step 1: Is this a MARKETPLACE/PLATFORM (not a potential client)?
Marketplaces and platforms (Shopee, Amazon, PChome, Shopify) are infrastructure — they do NOT need B2B services.
Signals: "marketplace", "seller center", "thousands of sellers", "platform for", "e-commerce platform"
→ If YES: fit_score MUST be ≤ 10

### Step 2: Is this a VENDOR/COMPETITOR (sells similar services)?
If the company IS a marketing/design/dev agency, consultancy, or SaaS platform that offers similar services → they are a COMPETITOR.
Signals: "our services include", "we offer", "marketing agency", "design studio", "we help clients"
→ If YES: fit_score MUST be ≤ 15

### Step 3: Is this a real CLIENT (would buy this service)?
If the company is a non-marketing business (manufacturer, retailer, hospital, real estate, logistics, D2C brand) → they are a potential CLIENT.
Only then evaluate fit normally.

## My Service

**Service Name**: ${serviceName}
**Service Description**: ${description}
${keyBenefits ? `**Key Value**: ${keyBenefits}` : ''}
${idealCustomerSignals ? `**Ideal Customer Signals**: ${idealCustomerSignals}` : ''}
${targetLocation ? `**Target Location**: ${targetLocation} — If the candidate company is NOT in this region, fit_score MUST be ≤ 10` : ''}
${targetCompanySize ? `**Target Size**: ${targetCompanySize} — Small companies (10-100 employees) are BEST. Enterprise companies (5000+) get fit_score ≤ 30` : ''}

## Candidate Company

**Company Name**: ${companyName}
**Company Website**: ${companyUrl}

**Website Content** (trimmed — enough for type detection + a specific hook):
${websiteContent.slice(0, 3000)}

## Task

1. FIRST: What TYPE of company is this? (Marketplace / Vendor / Client)
2. If Client: Evaluate fit from these dimensions:
   - Business Fit: Does what they do suggest they'd use my service?
   - Size Fit: Are they small enough to need external help? (Small companies = better fit)
   - Signal Strength: Do website signals suggest they have pain points?
3. Write a SPECIFIC email hook — reference something ACTUALLY on their website.

## Output Format (pure JSON, no markdown):

{
  "company": "${companyName}",
  "website": "${companyUrl}",
  "industry": "inferred industry (English)",
  "fit_score": 75,
  "why_they_need_it": "2-3 sentences. Reference something SPECIFIC from their website.",
  "suggested_angle": "1 sentence. Reference a SPECIFIC thing about this company.",
  "key_signals": ["specific signal 1", "specific signal 2", "specific signal 3"],
  "confidence": "high"
}

Rules:
- Marketplaces/platforms (Shopee, Amazon, etc.) → fit_score ≤ 10
- Competitors/vendors (same industry as my service) → fit_score ≤ 15
- Non-company websites (directories) → fit_score ≤ 10
- Wrong location → fit_score ≤ 10
- Email hook MUST reference something specific from the website. Generic phrases FORBIDDEN.
- ALL text in English.`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: 'You are a top-tier B2B business analyst. You objectively evaluate company fit — you do not blindly give high scores. You MUST respond in English. Your response must be pure JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  }, globalProviderConfig)

  const raw = chatResult.content
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  try {
    const data = JSON.parse(cleaned) as ProspectCandidate
    return { success: true, data, raw }
  } catch {
    return { success: false, data: null, raw }
  }
}

/**
 * Pre-AI heuristic filter — reject obvious competitors/platforms BEFORE
 * spending AI tokens on evaluation. This saves credits and improves quality.
 */
function isLikelyCompetitor(websiteText: string, serviceName: string, description: string): boolean {
  const text = websiteText.toLowerCase()
  const serviceLower = (serviceName + ' ' + description).toLowerCase()
  
  // Detect if the user's service is marketing/sales/tech related
  const isMarketingService = /marketing|advertis|seo|social media|content|brand|campaign|lead gen|outbound|sales|crm/.test(serviceLower)
  const isDevService = /software|develop|engineer|code|app|web|tech|saas|platform|system/.test(serviceLower)
  
  if (isMarketingService) {
    // Check if the candidate is also a marketing agency
    const agencySignals = [
      'marketing agency',
      'we offer marketing',
      'our marketing services',
      'digital marketing agency',
      'we provide marketing',
      'advertising agency',
      'we help brands',
      'we help clients with marketing',
      'content marketing services',
      'social media management',
      'seo services',
      'ppc management',
      'we are a marketing',
      'marketing consultancy',
      'growth agency',
      'performance marketing',
    ]
    for (const signal of agencySignals) {
      if (text.includes(signal)) return true
    }
  }
  
  if (isDevService) {
    // Check if the candidate is also a dev/software agency
    const devSignals = [
      'software development agency',
      'we build software',
      'web development agency',
      'we develop apps',
      'software house',
      'tech consultancy',
      'we build platforms',
      'we are a software company',
      'it services company',
      'system integration',
    ]
    for (const signal of devSignals) {
      if (text.includes(signal)) return true
    }
  }
  
  // Check for marketplace/platform signals (always reject)
  const marketplaceSignals = [
    'marketplace',
    'seller center',
    'thousands of sellers',
    'join as a seller',
    'sell on our platform',
    'e-commerce platform for sellers',
  ]
  for (const signal of marketplaceSignals) {
    if (text.includes(signal)) return true
  }
  
  return false
}

/**
 * Check if a URL belongs to the user's own company (self-exclusion)
 */
function isSelfDomain(url: string, selfWebsite?: string): boolean {
  if (!selfWebsite) return false
  try {
    const selfHost = new URL(selfWebsite).hostname.replace(/^www\./, '')
    const candidateHost = new URL(url).hostname.replace(/^www\./, '')
    // Check if domains match or one is a subdomain of the other
    if (selfHost === candidateHost) return true
    if (candidateHost.endsWith('.' + selfHost)) return true
    if (selfHost.endsWith('.' + candidateHost)) return true
    return false
  } catch {
    return false
  }
}

/**
 * 主函式：自動開發潛在客戶
 * 1. AI 生成搜尋查詢詞
 * 2. web_search 找候選公司
 * 3. 萃取公司 URL + 排除自己
 * 4. page_reader 抓每家公司網站
 * 5. Pre-AI 篩選（排除明顯的競爭對手）
 * 6. AI 評估契合度（用 70B 模型）
 * 7. 依分數排序回傳 top N
 */
export async function autoProspect(params: {
  serviceName: string
  description: string
  targetIndustries?: string
  targetCompanySize?: string
  targetLocation?: string
  keyBenefits?: string
  idealCustomerSignals?: string
  targetCount?: number
  selfWebsite?: string // 用戶自己的公司網站，用於排除
  /** stable fingerprint of the service definition — enables the eval cache */
  serviceHash?: string
  /** companies the user already picked as leads — feedback signal for eval */
  positiveExamples?: string[]
  onProgress?: (stage: string, detail?: string) => void
}): Promise<{
  success: boolean
  result: AutoProspectResult | null
  error?: string
}> {
  const {
    serviceName,
    description,
    targetIndustries,
    targetCompanySize,
    targetLocation,
    keyBenefits,
    idealCustomerSignals,
    targetCount = 10,
    selfWebsite,
    serviceHash,
    positiveExamples,
    onProgress,
  } = params

  // 步驟 1：AI 生成搜尋查詢詞
  onProgress?.('Generate search strategy', 'Designing targeted search queries...')
  const queryResult = await generateSearchQueries({
    serviceName,
    description,
    targetIndustries,
    targetCompanySize,
    targetLocation,
    idealCustomerSignals,
  })

  if (!queryResult.success || queryResult.queries.length === 0) {
    return { success: false, result: null, error: `Failed to generate search strategy (raw: ${queryResult.raw?.slice(0, 800) ?? 'no response'})` }
  }

  onProgress?.('Search candidates', `Searching with ${queryResult.queries.length} queries...`)

  // 步驟 2：並行執行 web_search（concurrency 3 — 快 4 倍，又不會打爆 Tavily）
  const SEARCH_CONCURRENCY = 3
  const allSearchResults: Array<{ url?: string; name?: string; host_name?: string }> = []
  const searchQueue = [...queryResult.queries]
  let searchDone = 0
  const searchWorkers = Array.from(
    { length: Math.min(SEARCH_CONCURRENCY, searchQueue.length) },
    async () => {
      while (searchQueue.length > 0) {
        const q = searchQueue.shift()!
        try {
          const results = await searchCompanies(q, 10)
          allSearchResults.push(...results)
        } catch (e) {
          console.error(`search failed for "${q}":`, e)
        }
        searchDone++
        onProgress?.('Search candidates', `Searched ${searchDone}/${queryResult.queries.length} queries — ${allSearchResults.length} results`)
      }
    }
  )
  await Promise.all(searchWorkers)

  // 步驟 3：萃取公司 URL + 排除自己
  let candidates = extractCompanyUrls(allSearchResults)
  
  // Self-exclusion: remove the user's own company
  if (selfWebsite) {
    const before = candidates.length
    candidates = candidates.filter((c) => !isSelfDomain(c.url, selfWebsite))
    if (candidates.length < before) {
      onProgress?.('Filter companies', `Excluded ${before - candidates.length} self-company results`)
    }
  }

  onProgress?.('Filter companies', `Extracted ${candidates.length} companies from ${allSearchResults.length} results`)

  if (candidates.length === 0) {
    return {
      success: false,
      result: null,
      error: 'No matching company websites found. Try adjusting your service description.',
    }
  }

  // Use 70B model for evaluation (better quality than 8B)
  const evalConfig = {
    ...globalProviderConfig,
    groqModel: 'llama-3.3-70b-versatile',
  }

  const toEvaluate = candidates
  onProgress?.('Fit analysis', `Evaluating ${toEvaluate.length} candidates...`)

  // 步驟 4 + 5 + 6：抓網站 → Pre-AI 篩選 → AI 評估
  // Worker pool instead of a sequential loop: each candidate costs a page
  // fetch (~2-5s) plus an LLM call (~3-8s), so 30 candidates took 3-5 minutes
  // end-to-end. Three workers + 400ms pacing stay under Groq's free-tier
  // per-minute token limits (the 70B daily pool falls back to 8B at ~6k
  // TPM — 4 unpaced workers tripped it constantly). Early-exit is checked
  // after every completion.
  const EVAL_CONCURRENCY = 3
  const EVAL_PACE_MS = 400
  // 70B 每日額度耗盡後降級 8B，其限流只有 ~6k tokens/分鐘。並行節奏
  // （N workers 各自睡眠）合計流量仍會超標 — 改走單一序列佇列：頁面
  // 抓取維持並行，只有 LLM 評估一次一家、間隔 9.5 秒（≈5.7k TPM），
  // 使用者看到穩定進度而非間隔性錯誤
  const LLM_CAPPED_SPACING_MS = 9_500
  let llmChain: Promise<void> = Promise.resolve()
  const serializedLLM = <T>(run: () => Promise<T>): Promise<T> => {
    const wrapped = async () => {
      if (isGroqDailyCapped()) {
        // 讓使用者在間隔中看到動靜，而不是以為卡住了
        onProgress?.('Fit analysis', 'Pacing for shared AI quota — one company every ~10s...')
        await new Promise((r) => setTimeout(r, LLM_CAPPED_SPACING_MS))
      }
      return run()
    }
    const result = llmChain.then(wrapped)
    llmChain = result.then(() => undefined, () => undefined)
    return result
  }
  const evaluated: ProspectCandidate[] = []
  let skippedCompetitors = 0
  let skippedVendors = 0
  let cacheHits = 0
  let nextIndex = 0
  let completed = 0
  let shouldStop = false

  const evalWorker = async () => {
    while (!shouldStop) {
      const i = nextIndex++
      if (i >= toEvaluate.length) break
      const c = toEvaluate[i]

      try {
        // 抓網站內容
        const websiteData = await fetchWebsiteContent(c.url)
        const websiteText = websiteData ? htmlToText(websiteData.html).slice(0, 6000) : ''

        // Pre-AI 篩選：檢查是否是競爭對手/平台（免費，關鍵字）
        if (websiteText && isLikelyCompetitor(websiteText, serviceName, description)) {
          skippedCompetitors++
          completed++
          onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — skipped (competitor)`)
          continue
        }

        // 完整 host 當快取 key（不用 extractDomain 的 last-2-parts —
        // 那會把所有 co.uk 網站撞成同一個 key）
        let domain = c.url
        try {
          domain = new URL(c.url).hostname.replace(/^www\./, '').toLowerCase()
        } catch { /* keep raw url */ }

        // ===== 快取命中：0 token 直接用上次的判決 =====
        if (serviceHash) {
          const cached = await readEvalCache(domain, serviceHash)
          if (cached) {
            completed++
            cacheHits++
            if (cached.type !== 'buyer' || !cached.candidate) {
              skippedVendors++
              onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — dropped (${cached.type}, cached)`)
            } else {
              evaluated.push({ ...cached.candidate, website_title: websiteData?.title })
              onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — fit ${cached.candidate.fit_score} (cached)`)
            }
            continue
          }
        }

        // ===== Stage 1：便宜分類（~300 tokens）— 非 buyer 在此止步 =====
        const cls = await serializedLLM(() => classifyProspect({
          serviceName,
          description,
          companyName: c.name,
          companyUrl: c.url,
          websiteContent: websiteText,
        }, evalConfig))

        if (cls && cls !== 'buyer') {
          completed++
          skippedVendors++
          if (serviceHash) await writeEvalCache(domain, serviceHash, { type: cls })
          onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — dropped (${cls})`)
          continue
        }
        // 分類失敗（null）→ 保守起見繼續深度評估

        // ===== Stage 2：深度評估（僅存活者，需引用證據）=====
        const fitResult = await serializedLLM(() => evaluateProspectFitWithModel({
          serviceName,
          description,
          keyBenefits,
          idealCustomerSignals,
          companyUrl: c.url,
          companyName: c.name,
          websiteContent: websiteText || `(Could not fetch website content, judging by URL only: ${c.url})`,
          targetLocation,
          targetCompanySize,
          selfWebsite,
          positiveExamples,
        }, evalConfig))

        completed++
        if (fitResult.success && fitResult.data) {
          // 分類由程式碼強制執行，不信任分數：模型（尤其 8B）曾給
          // 平台商/供應商 40-85 分 — company_type 非 client 一律丟棄
          if (fitResult.data.company_type && fitResult.data.company_type !== 'client') {
            skippedVendors++
            if (serviceHash) await writeEvalCache(domain, serviceHash, { type: fitResult.data.company_type })
            onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — dropped (${fitResult.data.company_type})`)
          } else {
            // 證據規則程式側強制：沒有引用證據 → 分數封頂 + 低信心
            const hasEvidence = !!(fitResult.data.evidence && fitResult.data.evidence.length >= 20)
            if (!hasEvidence) {
              fitResult.data.fit_score = Math.min(fitResult.data.fit_score, 20)
              fitResult.data.confidence = 'low'
            }
            // 備援模型（8B）的結果一律標低信心 — 不再出現假 high confidence
            if (isGroqDailyCapped()) {
              fitResult.data.confidence = 'low'
            }
            const candidate = { ...fitResult.data, website_title: websiteData?.title }
            evaluated.push(candidate)
            if (serviceHash) await writeEvalCache(domain, serviceHash, { type: 'buyer', candidate })
            onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — fit ${candidate.fit_score}${candidate.confidence === 'low' ? ' (low conf)' : ''}`)
          }
        } else {
          onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — no valid evaluation`)
        }
      } catch (e) {
        completed++
        console.error(`evaluate ${c.name} failed:`, e)
        onProgress?.('Fit analysis', `(${completed}/${toEvaluate.length}) ${c.name} — evaluation error`)
      }

      await new Promise((r) => setTimeout(r, EVAL_PACE_MS))

      // Early exit once we have enough high-confidence candidates
      // (threshold 40 + ×3 window — looser than 60/×2 so users see more results)
      const highConfCount = evaluated.filter((e) => e.fit_score >= 40).length
      if (highConfCount >= targetCount && nextIndex >= targetCount * 3) {
        shouldStop = true
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(EVAL_CONCURRENCY, toEvaluate.length) }, () => evalWorker())
  )

  // 步驟 7：排序 + 分層過濾 + 取 top N（同分用公司名穩定排序，並行完成順序不影響結果）
  // 分層而非單一門檻：≥30 是有實質商業關聯的線索；10–29 只在強線索不夠時
  // 補位並標記低信心（UI 可顯示「低信心」徽章）。之前 >10 的平面門檻讓
  // 完全無關產業的公司（如獵頭公司之於電商行銷服務）直接混進名單。
  evaluated.sort((a, b) => b.fit_score - a.fit_score || String(a.company).localeCompare(String(b.company)))

  // 範本偵測：弱模型會對每家候選複製貼上同一套「why they need you」
  // （實例：三家公司共用 "gain a competitive edge in the market"）。
  // 理由與先前的候選高度重複 → 不是針對這家公司寫的 → 降分 + 低信心。
  penalizeTemplateReasons(evaluated)

  const strongLeads = evaluated.filter((e) => e.fit_score >= 30)
  const backfillLeads = evaluated
    .filter((e) => e.fit_score > 10 && e.fit_score < 30)
    .map((e) => ({ ...e, confidence: 'low' as const }))
  const qualified = [...strongLeads, ...backfillLeads]
  const top = qualified.slice(0, targetCount)

  const droppedCount = evaluated.length - qualified.length
  const backfilledCount = Math.max(0, top.length - strongLeads.slice(0, targetCount).length)
  onProgress?.(
    'Complete',
    `Found ${top.length} best-matching leads${droppedCount > 0 ? ` (filtered out ${droppedCount} non-company websites)` : ''}${skippedCompetitors > 0 ? `, skipped ${skippedCompetitors} competitors` : ''}${skippedVendors > 0 ? `, dropped ${skippedVendors} vendors/platforms` : ''}${cacheHits > 0 ? `, ${cacheHits} from cache (0 AI credits)` : ''}${backfilledCount > 0 ? `, ${backfilledCount} low-confidence (marked)` : ''}`
  )

  return {
    success: true,
    result: {
      candidates: top,
      ai_search_queries: queryResult.queries,
      total_discovered: candidates.length,
      evaluated: evaluated.length,
    },
  }
}

/**
 * ===== Stage 1: cheap classification (~300 tokens per candidate) =====
 *
 * The redesigned funnel spends a SMALL model call to decide whether a
 * candidate deserves the expensive deep evaluation. Classification is a
 * task small models handle far more reliably than scoring — and killing
 * non-buyers here cuts total token spend by more than half.
 */
export type ProspectClass =
  | 'buyer'      // a business that could plausibly BUY my service
  | 'vendor'     // sells the same service category as me (competitor)
  | 'platform'   // marketplace / store-builder / SaaS infrastructure
  | 'media'      // blog, news, directory, course site
  | 'jobboard'   // recruiting / job listings
  | 'irrelevant' // anything else

/**
 * 範本理由偵測（跨候選）：把 why_they_need_it + suggested_angle 切成 5-gram，
 * 與已見過的候選比較 — 重複率高於閾值代表模型在複製貼上通用理由，
 * 而非針對該公司寫。第一個出現者保留，其後的重複者降分至 20 以下
 * （落入低信心備補區）。
 */
function penalizeTemplateReasons(candidates: ProspectCandidate[]): void {
  const seenNgrams = new Set<string>()
  const ngramSize = 5
  const toNgrams = (text: string): string[] => {
    const words = String(text ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    const grams: string[] = []
    for (let i = 0; i + ngramSize <= words.length; i++) {
      grams.push(words.slice(i, i + ngramSize).join(' '))
    }
    return grams
  }

  for (const c of candidates) {
    const grams = toNgrams(`${c.why_they_need_it} ${c.suggested_angle}`)
    if (grams.length === 0) continue
    let repeated = 0
    for (const g of grams) {
      if (seenNgrams.has(g)) repeated++
    }
    const repeatRatio = repeated / grams.length
    if (repeatRatio >= 0.3) {
      // 與其他候選高度重複 — 通用範本，不是這家公司的專屬理由
      c.fit_score = Math.min(c.fit_score, 20)
      c.confidence = 'low'
    }
    for (const g of grams) seenNgrams.add(g)
  }
}

async function classifyProspect(params: {
  serviceName: string
  description: string
  companyName: string
  companyUrl: string
  websiteContent: string
}, config: any): Promise<ProspectClass | null> {
  const { serviceName, description, companyName, companyUrl, websiteContent } = params

  const prompt = `Classify one company for a B2B outreach tool.

My service: ${serviceName} — ${description.slice(0, 300)}

Candidate company: ${companyName} (${companyUrl})
Page excerpt:
"""
${websiteContent.slice(0, 1200) || '(no content fetched)'}
"""

Also check the DOMAIN itself: known store-building/SaaS platforms (shopify, shopline, 91app, cyberbiz, wix, squarespace, woocommerce...) are "platform" even if the page looks like a blog.

Classify into exactly one:
- buyer: a business that could plausibly PAY for my service
- vendor: sells the same service category as mine
- platform: marketplace / store-builder / SaaS tooling / infrastructure
- media: blog, news site, magazine, directory, course content
- jobboard: job listings / recruiting platform
- irrelevant: anything else

IMPORTANT:
- The page may be in ANY language (Traditional Chinese, Japanese...). Translate mentally before classifying — a Taiwanese D2C brand selling products online IS a "buyer" for an e-commerce marketing service.
- RECALL BIAS: when torn between "buyer" and anything else, choose "buyer" — a second, stricter stage re-checks survivors with required evidence. Only drop a candidate when you are CONFIDENT it is not a buyer.

Output pure JSON: {"type":"buyer","evidence":"short quote or domain reason"}`

  try {
    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: 'You are a strict B2B lead classifier. Respond with pure JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 120,
    }, config)
    const parsed = extractJsonLoose(chatResult.content)
    const t = String(parsed?.type ?? '').toLowerCase()
    if (['buyer', 'vendor', 'platform', 'media', 'jobboard', 'irrelevant'].includes(t)) {
      return t as ProspectClass
    }
    return null
  } catch {
    return null
  }
}

/**
 * ===== Evaluation cache (ProspectEvalCache) =====
 * Verdict JSON: { type: ProspectClass, candidate?: ProspectCandidate }
 */
const EVAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

async function readEvalCache(domain: string, serviceHash: string): Promise<{ type: string; candidate?: ProspectCandidate } | null> {
  try {
    const row = await db.prospectEvalCache.findUnique({
      where: { domain_serviceHash: { domain, serviceHash } },
    })
    if (!row) return null
    if (Date.now() - row.createdAt.getTime() > EVAL_CACHE_TTL_MS) return null
    return JSON.parse(row.verdict)
  } catch (e) {
    console.warn('readEvalCache failed:', e)
    return null
  }
}

async function writeEvalCache(domain: string, serviceHash: string, verdict: { type: string; candidate?: ProspectCandidate }): Promise<void> {
  try {
    await db.prospectEvalCache.upsert({
      where: { domain_serviceHash: { domain, serviceHash } },
      create: { domain, serviceHash, verdict: JSON.stringify(verdict) },
      update: { verdict: JSON.stringify(verdict), createdAt: new Date() },
    })
  } catch (e) {
    console.warn('writeEvalCache failed:', e)
  }
}

/**
 * evaluateProspectFit with custom model config (for 70B)
 */
async function evaluateProspectFitWithModel(params: {
  serviceName: string
  description: string
  keyBenefits?: string
  idealCustomerSignals?: string
  companyUrl: string
  companyName: string
  websiteContent: string
  targetLocation?: string
  targetCompanySize?: string
  selfWebsite?: string
  positiveExamples?: string[]
}, config: any): Promise<{
  success: boolean
  data: ProspectCandidate | null
  raw: string
}> {
  const { serviceName, description, keyBenefits, idealCustomerSignals, companyUrl, companyName, websiteContent, targetLocation, targetCompanySize } = params

  const prompt = `You are a top-tier B2B business analyst. You evaluate whether a company would BUY a specific service.

## CRITICAL: Four-Step Company Type Detection

### Step 0: RELEVANCE GATE — could this company's business model plausibly USE this service category?
Ask: does this company have the kind of operation where my service is a natural fit?
If the company's core business has no plausible use for my service category → fit_score MUST be ≤ 10.
Examples: a headhunting firm for an e-commerce marketing service; a law firm for game-dev tooling; a restaurant chain for B2B SaaS prospecting tools.
"Every company needs marketing" is NOT a valid reason — the service must fit HOW this company actually sells.

### Step 1: Is this a MARKETPLACE or PLATFORM VENDOR?
Marketplaces (Shopee, Amazon, PChome) are infrastructure — they do NOT buy B2B services.
Store-building / MarTech platforms (Shopify, SHOPLINE, 91APP, Cyberbiz, Wix, Squarespace, WooCommerce, BigCommerce, Magento) SELL e-commerce and marketing tooling — for an e-commerce/marketing service they are COMPETITORS, never customers. Their seminars, blogs, and "retail academies" are their OWN content marketing — evidence of marketing STRENGTH, not a gap you can sell into.
Check the DOMAIN and brand name, not just the page text — blog.shopline.tw is SHOPLINE.
Signals: "marketplace", "seller center", "thousands of sellers", "platform for sellers", "start free trial", "book a demo", "pricing plans", "our platform", "API documentation", "app store / integrations marketplace"
If YES → fit_score MUST be ≤ 10

### Step 2: Is this a VENDOR/COMPETITOR of my service?
If the company sells similar services to what I offer → they are a COMPETITOR, not a customer.
Signals: "marketing agency", "we offer marketing services", "design studio", "our services include", "we help clients"
If YES → fit_score MUST be ≤ 15
${params.selfWebsite ? `My own company is ${params.selfWebsite} — companies in my own category (including platforms whose customers I serve) are competitors, fit_score ≤ 10.` : ''}

### Step 3: Is this a real CLIENT?
If the company is a non-marketing business (manufacturer, retailer, hospital, D2C brand, etc.) → potential CLIENT.
Only then evaluate fit normally.

### REVERSE-SIGNAL RULE (critical):
Strong marketing capability on the candidate's site — active blog, seminars/webinars, case studies, big ad presence — is evidence AGAINST needing outsourced marketing services. NEVER twist it into a need ("they do content marketing, so they'd benefit from more") — that reasoning is forbidden. Only recommend companies whose site shows a real GAP my service fills.

## My Service
**Service Name**: ${serviceName}
**Service Description**: ${description}
${keyBenefits ? `**Key Value**: ${keyBenefits}` : ''}
${idealCustomerSignals ? `**Ideal Customer Signals**: ${idealCustomerSignals}` : ''}
${targetLocation ? `**Target Location**: ${targetLocation} — if company is NOT here, fit_score ≤ 10` : ''}
${targetCompanySize ? `**Target Size**: ${targetCompanySize} — small companies (10-100) are BEST, large enterprises (5000+) get fit_score ≤ 30` : ''}
${params.positiveExamples && params.positiveExamples.length > 0 ? `**Leads the user already picked** (they liked companies like these — favor SIMILAR business types): ${params.positiveExamples.join(', ')}` : ''}

## Candidate Company
**Company Name**: ${companyName}
**Company Website**: ${companyUrl}

**Website Content** (trimmed — enough for type detection + a specific hook):
${websiteContent.slice(0, 3000)}

## Task
1. FIRST: RELEVANCE GATE — does this company's business model plausibly use my service category? If not → fit_score ≤ 10, stop.
2. What TYPE is this company? (Marketplace / Vendor / Client)
3. If Client: Evaluate fit — would they BUY my service?
4. Write a SPECIFIC email hook referencing something ACTUALLY on their website.

## Output (pure JSON):
{
  "company": "${companyName}",
  "website": "${companyUrl}",
  "industry": "industry in English",
  "company_type": "client",
  "fit_score": 75,
  "why_they_need_it": "2-3 sentences referencing SPECIFIC website content. If the business linkage is weak, say so plainly instead of inventing one.",
  "suggested_angle": "1 sentence with a SPECIFIC reference to this company.",
  "key_signals": ["specific signal 1", "signal 2", "signal 3"],
  "evidence": "the exact sentence(s) copied verbatim from the website content above that prove the need",
  "confidence": "high"
}

"company_type" MUST be exactly one of: "marketplace", "vendor", "client".
Classify FIRST (Steps 0-3), then score. Non-client types are dropped by
the caller regardless of fit_score — do not give a vendor a high score.

EVIDENCE RULE (hard): "evidence" must be a VERBATIM quote from the
website content above. If you cannot find a sentence that genuinely
supports the need, set fit_score ≤ 20 and confidence "low" — an
invented need is worse than no lead.

Rules:
- Irrelevant business model (fails the relevance gate) → fit_score ≤ 10
- Marketplaces → fit_score ≤ 10
- Competitors/agencies → fit_score ≤ 15
- Wrong location → fit_score ≤ 10
- Do NOT inflate scores to be nice — a wrong lead costs the user real outreach time
- Email hook MUST be specific (no generic templates)
- ALL text in English`

  const messages = [
    {
      role: 'system',
      content: 'You are a B2B business analyst. You objectively evaluate fit. Respond in English. Pure JSON only.',
    },
    { role: 'user', content: prompt },
  ] as ChatMessage[]

  const chatResult = await chatWithFallback({
    messages,
    temperature: 0.3,
  }, config)

  const raw = chatResult.content
  const parsed = extractJsonLoose(raw)
  if (isValidProspectCandidate(parsed)) {
    return { success: true, data: parsed, raw }
  }

  // One retry with an explicit nudge — a malformed response used to silently
  // drop the candidate after we'd already spent a page fetch on it.
  const retryResult = await chatWithFallback({
    messages: [
      ...messages,
      { role: 'assistant', content: raw.slice(0, 2000) },
      { role: 'user', content: 'That was not valid JSON. Output ONLY the JSON object — no prose, no markdown fences. Use exactly the schema from the previous instruction.' },
    ],
    temperature: 0.2,
  }, config)

  const retryParsed = extractJsonLoose(retryResult.content)
  if (isValidProspectCandidate(retryParsed)) {
    return { success: true, data: retryParsed, raw: retryResult.content }
  }
  return { success: false, data: null, raw: retryResult.content }
}

function isValidProspectCandidate(data: any): data is ProspectCandidate {
  return (
    !!data &&
    typeof data === 'object' &&
    typeof data.company === 'string' &&
    typeof data.fit_score === 'number' &&
    Number.isFinite(data.fit_score)
  )
}

// ===== Email Enrichment：找出決策者 email =====

export interface DecisionMaker {
  name: string
  title: string
  seniority: 'c_level' | 'vp' | 'director' | 'manager' | 'other'
  email?: string
  linkedin?: string
  confidence: 'high' | 'medium' | 'low'  // email 信心度
  email_source: 'hunter' | 'ai_predicted' | 'web_search' | 'unknown'
  priority: number  // 1=最高優先
  reason?: string  // 為什麼這個人是對的聯絡人
}

export interface EnrichEmailResult {
  decisionMakers: DecisionMaker[]
  companyEmailPattern?: string  // 例如 "first.last@company.com"
  totalFound: number
  hasEmailCount: number
}

/**
 * 決策者優先級排序規則
 * 用戶要求：
 * 1. VP of Sales / VP Sales / Sales Director → 第一優先
 * 2. CEO / Founder → 第二優先
 * 3. CRO / CMO / COO → 第三優先
 * 4. SDR / AE → 永遠跳過（除非真的找不到別的）
 */
export function rankTitle(title: string): { seniority: DecisionMaker['seniority']; priority: number; reason: string } {
  const t = title.toLowerCase()

  // VP Sales / VP of Sales / Sales Director → 最優先
  if (/\b(vp|vice president)\b.*\b(sales|revenue|growth)\b/i.test(t) ||
      /\b(sales|revenue)\b.*\b(vp|vice president)\b/i.test(t) ||
      /\bdirector\b.*\b(sales|revenue|growth)\b/i.test(t) ||
      /\b(sales|revenue|growth)\b.*\bdirector\b/i.test(t)) {
    return { seniority: 'vp', priority: 1, reason: '業務最高主管 — 直接背負業績' }
  }

  // CRO (Chief Revenue Officer)
  if (/\bcro\b|\bchief revenue officer\b/i.test(t)) {
    return { seniority: 'c_level', priority: 1, reason: '營收長 — 業績最高決策者' }
  }

  // CEO / Founder / Co-Founder / President
  if (/\bceo\b|\bchief executive\b|\bfounder\b|\bco-founder\b|\bco founder\b|\bpresident\b/i.test(t)) {
    return { seniority: 'c_level', priority: 2, reason: 'CEO/創辦人 — 能做預算決定' }
  }

  // CMO / COO / CTO
  if (/\bcmo\b|\bchief marketing\b|\bcoo\b|\bchief operating\b|\bcto\b|\bchief technology\b|\bchief product\b|\bcpo\b/i.test(t)) {
    return { seniority: 'c_level', priority: 3, reason: 'C-level 主管' }
  }

  // Head of Sales / Head of Growth
  if (/\bhead\b.*\b(sales|revenue|growth|business development|bd)\b/i.test(t) ||
      /\b(sales|revenue|growth)\b.*\bhead\b/i.test(t)) {
    return { seniority: 'director', priority: 2, reason: '業務主管 — 高階業務決策者' }
  }

  // Director / Senior Director（其他部門）
  if (/\bdirector\b/i.test(t)) {
    return { seniority: 'director', priority: 3, reason: 'Director 主管' }
  }

  // SDR / AE / Account Executive → 跳過
  if (/\b(sdr|sales development|account executive|\bae\b|business development rep|bd rep)\b/i.test(t)) {
    return { seniority: 'manager', priority: 99, reason: '業務專員 — 太基層，跳過' }
  }

  // 其他經理
  if (/\b(manager|lead|principal)\b/i.test(t)) {
    return { seniority: 'manager', priority: 5, reason: 'Manager 級 — 視情況聯繫' }
  }

  return { seniority: 'other', priority: 4, reason: '其他' }
}

/**
 * 從網域名稱與人名預測 email 格式
 * 常見格式：first.last@company.com / first@company.com / firstinitiallast@company.com
 */
export function predictEmailFormats(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '')
  const fi = f.charAt(0)
  const li = l.charAt(0)

  if (!f && !l) return []
  if (!l) return [`${f}@${domain}`]
  if (!f) return [`${l}@${domain}`]

  return [
    `${f}.${l}@${domain}`,      // john.doe@company.com (最常見)
    `${f}@${domain}`,           // john@company.com (新創常見)
    `${f}${l}@${domain}`,       // johndoe@company.com
    `${fi}${l}@${domain}`,      // jdoe@company.com
    `${fi}.${l}@${domain}`,    // j.doe@company.com
    `${f}${li}@${domain}`,      // johnd@company.com
    `${f}_${l}@${domain}`,      // john_doe@company.com
    `${l}@${domain}`,           // doe@company.com (少見)
  ]
}

/**
 * 從網址萃取網域名稱
 */
export function extractDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    // 取最後兩段（例如 example.com 從 mail.example.com）
    const parts = host.split('.')
    if (parts.length >= 2) {
      return parts.slice(-2).join('.')
    }
    return host
  } catch {
    return null
  }
}

/**
 * 透過 Hunter.io API 找人 (Domain Search)
 * Free tier: 25 searches/month, $34/mo for 500 searches
 */
async function findPeopleWithHunter(params: {
  hunterApiKey: string
  domain: string
}): Promise<DecisionMaker[]> {
  const { hunterApiKey, domain } = params

  try {
    // Hunter.io Domain Search API
    // Returns all public emails found for a domain
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterApiKey}&limit=20`,
      { method: 'GET' }
    )

    if (!res.ok) {
      console.error('Hunter.io API failed:', res.status)
      return []
    }

    const data = await res.json() as {
      data?: {
        emails?: Array<{
          value?: string
          first_name?: string
          last_name?: string
          position?: string
          confidence?: number
          linkedin?: string
          type?: string
        }>
      }
    }

    const emails = data.data?.emails ?? []
    return emails.map((p) => {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'
      const title = p.position ?? ''
      const rank = rankTitle(title)
      const confScore = p.confidence ?? 0
      return {
        name,
        title,
        seniority: rank.seniority,
        email: p.value,
        linkedin: p.linkedin,
        confidence: confScore >= 80 ? 'high' as const : confScore >= 50 ? 'medium' as const : 'low' as const,
        email_source: p.value ? 'hunter' as const : 'unknown' as const,
        priority: rank.priority,
        reason: rank.reason,
      }
    })
  } catch (e) {
    console.error('Hunter.io API error:', e)
    return []
  }
}

/**
 * AI 透過 web_search 找決策者
 */
async function findPeopleWithAI(params: {
  companyName: string
  domain: string
}): Promise<DecisionMaker[]> {
  const { companyName, domain } = params
  const zai = await getAI().catch(() => null as any)

  // 5 組搜尋策略（漸進放寬）
  const searches = [
    // 1. 嚴格 LinkedIn 限定 + VP Sales
    { query: `"${companyName}" "VP of Sales" OR "VP Sales" OR "Vice President of Sales" site:linkedin.com`, label: 'VP Sales LinkedIn' },
    // 2. LinkedIn 限定 + CEO/Founder
    { query: `"${companyName}" CEO OR founder OR "Co-Founder" site:linkedin.com`, label: 'CEO LinkedIn' },
    // 3. Sales Director
    { query: `"${companyName}" "Sales Director" OR "Director of Sales" OR "Head of Sales" site:linkedin.com`, label: 'Sales Director LinkedIn' },
    // 4. CRO + 其他 C-level
    { query: `"${companyName}" "Chief Revenue Officer" OR CRO OR "Chief Marketing Officer" OR CMO site:linkedin.com`, label: 'C-level LinkedIn' },
    // 5. 不限 LinkedIn，找公司領導頁
    { query: `"${companyName}" leadership team about founders executives`, label: 'Leadership page' },
  ]

  const found: Array<{ name: string; title: string; linkedin?: string; source: string }> = []

  for (const s of searches) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const results = await searchCompanies(s.query, 5)
        for (const r of results) {
          if (!r?.name) continue
          const title = r.name

          // 從搜尋結果標題萃取姓名
          // 標題通常長這樣：
          // "John Doe - VP of Sales at ACME | LinkedIn"
          // "Jane Smith | CEO & Founder at ACME"
          // "ACME - CEO & Founder John Smith"
          const nameMatch = title.match(/^([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,3})(?:\s*[-–|]|\s+at\s|\s+\|)/)
          const altNameMatch = !nameMatch ? title.match(/\b([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,2})\b/) : null

          // 從標題萃取職稱
          const titlePatterns = [
            /\b((?:VP|Vice President)\s*(?:of\s+)?(?:Sales|Revenue|Growth|Marketing))\b/i,
            /\b((?:Sales|Revenue|Marketing)\s+Director)\b/i,
            /\b((?:Director|Head)\s+of\s+(?:Sales|Revenue|Growth|Marketing))\b/i,
            /\b(Chief\s+(?:Executive|Revenue|Marketing|Operating|Technology)\s+Officer)\b/i,
            /\b(CEO|CTO|CMO|COO|CRO|CFO)\b/i,
            /\b(Founder|Co-Founder|Co\s*Founder)\b/i,
            /\b(President)\b/i,
          ]

          let extractedTitle: string | null = null
          for (const pattern of titlePatterns) {
            const m = title.match(pattern)
            if (m) {
              extractedTitle = m[1] || m[0]
              break
            }
          }

          const name = nameMatch?.[1] ?? altNameMatch?.[1]
          if (!name || !extractedTitle) continue

          // 過濾掉公司名當人名的情況（公司名通常包含「Inc, Ltd, LLC, Co」等）
          if (/\b(Inc|Ltd|LLC|Corp|Company|Co\.?)\b/i.test(name)) continue

          // 只接受長度合理的人名（2-4 個字）
          const nameWords = name.split(/\s+/)
          if (nameWords.length < 2 || nameWords.length > 4) continue

          found.push({
            name: name.trim(),
            title: extractedTitle,
            linkedin: r.url && /linkedin\.com/.test(r.url) ? r.url : undefined,
            source: s.label,
          })
        }
        break  // 成功，跳出 retry 迴圈
      } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (msg.includes('429') && attempt === 0) {
          // 429 rate limit, 等 5 秒後重試
          console.warn(`search "${s.label}" 429, retrying in 5s...`)
          await new Promise((r) => setTimeout(r, 5000))
          continue
        }
        console.error(`search "${s.label}" failed:`, e)
        break
      }
    }
    // 搜尋之間的延遲（避免 429）
    await new Promise((r) => setTimeout(r, 800))
  }

  // 去重（同名同 title）
  const seen = new Set<string>()
  const unique = found.filter((p) => {
    const key = `${p.name}|${p.title}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) {
    // 如果都搜尋不到，用 AI 從深度研究裡的 key_people 找
    // （這裡因為沒有 lead 上下文，先回空陣列）
    return []
  }

  // 用 AI 評估每個人，並嘗試找出 email
  const decisionMakers: DecisionMaker[] = []
  for (const person of unique.slice(0, 10)) {
    const rank = rankTitle(person.title)
    if (rank.priority === 99) continue  // 跳過 SDR/AE

    // 從姓名與網域預測 email 格式
    const nameParts = person.name.split(' ')
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.slice(1).join(' ') ?? ''
    const predictedEmails = predictEmailFormats(firstName, lastName, domain)

    decisionMakers.push({
      name: person.name,
      title: person.title,
      seniority: rank.seniority,
      email: predictedEmails[0],  // 最高機率格式
      linkedin: person.linkedin,
      confidence: 'medium',
      email_source: 'ai_predicted',
      priority: rank.priority,
      reason: rank.reason,
    })
  }

  return decisionMakers
}

/**
 * 主函式：找出公司決策者 email
 */
export async function enrichEmail(params: {
  companyName: string
  website: string
  hunterApiKey?: string
  existingKeyPeople?: Array<{ name: string; title: string; linkedin?: string }>
}): Promise<{
  success: boolean
  result: EnrichEmailResult | null
  error?: string
}> {
  const { companyName, website, hunterApiKey, existingKeyPeople } = params

  const domain = extractDomain(website)
  if (!domain) {
    return { success: false, result: null, error: 'Unable to extract domain from URL' }
  }

  let decisionMakers: DecisionMaker[] = []

  // Strategy 0: Use key_people from deep research (no API cost)
  if (existingKeyPeople && existingKeyPeople.length > 0) {
    for (const p of existingKeyPeople.slice(0, 8)) {
      const rank = rankTitle(p.title)
      if (rank.priority === 99) continue

      const nameParts = p.name.split(' ')
      const firstName = nameParts[0] ?? ''
      const lastName = nameParts.slice(1).join(' ') ?? ''
      const predictedEmails = predictEmailFormats(firstName, lastName, domain)

      decisionMakers.push({
        name: p.name,
        title: p.title,
        seniority: rank.seniority,
        email: predictedEmails[0],
        linkedin: p.linkedin,
        confidence: 'medium',
        email_source: 'ai_predicted',
        priority: rank.priority,
        reason: `${rank.reason} (from deep research)`,
      })
    }
  }

  // Strategy 1: Hunter.io API (if API key provided and not enough decision makers)
  if (hunterApiKey && decisionMakers.length < 3) {
    const hunterPeople = await findPeopleWithHunter({
      hunterApiKey,
      domain,
    })
    // Merge, avoid duplicates
    const existingNames = new Set(decisionMakers.map((d) => d.name.toLowerCase()))
    for (const p of hunterPeople) {
      if (!existingNames.has(p.name.toLowerCase())) {
        decisionMakers.push(p)
      }
    }
  }

  // Strategy 2: AI web_search (if still no results)
  if (decisionMakers.length === 0) {
    decisionMakers = await findPeopleWithAI({ companyName, domain })
  }

  // 排序：優先級 1 > 2 > 3，有 email > 沒 email
  decisionMakers.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    const aHasEmail = a.email ? 0 : 1
    const bHasEmail = b.email ? 0 : 1
    return aHasEmail - bHasEmail
  })

  // 取前 5 個
  const top = decisionMakers.slice(0, 5)

  return {
    success: true,
    result: {
      decisionMakers: top,
      companyEmailPattern: `*@${domain}`,
      totalFound: decisionMakers.length,
      hasEmailCount: top.filter((d) => d.email).length,
    },
  }
}

