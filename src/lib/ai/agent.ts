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
 * 非人名的常見新聞/網頁字詞 — LLM 曾把標題片段誤當人名
 * （"After SpaceX's Youngest"、"Insane Plot Twist"、"LinkedIn Bans"）。
 * 名字 token 出現在這裡就直接拒絕。
 */
const NAME_STOPWORDS = new Set([
  'after', 'before', 'inside', 'behind', 'between', 'above', 'below', 'meet', 'meeting',
  'how', 'why', 'what', 'who', 'when', 'where', 'which', 'this', 'that', 'these', 'those',
  'the', 'and', 'or', 'but', 'with', 'without', 'from', 'into', 'onto', 'upon', 'over',
  'under', 'through', 'during', 'while', 'his', 'her', 'their', 'our', 'your', 'my', 'its',
  'him', 'she', 'they', 'we', 'you', 'himself', 'herself', 'themselves', 'another', 'former',
  'banned', 'ban', 'bans', 'linkedin', 'startup', 'startups', 'company', 'companies',
  'business', 'businesses', 'engineer', 'engineering', 'school', 'bathroom', 'zoom',
  'raised', 'raise', 'million', 'millionaire', 'billion', 'years', 'year', 'old', 'young',
  'becomes', 'became', 'exclusive', 'secures', 'secured', 'secure', 'investment', 'investor',
  'invest', 'intern', 'internship', 'underage', 'free', 'press', 'journal', 'journalist',
  'insider', 'story', 'stories', 'plot', 'twist', 'insane', 'spacex', 'aerospace', 'hiring',
  'careers', 'career', 'opening', 'openings', 'apply', 'remote', 'salary', 'today', 'now',
  'new', 'news', 'weekly', 'daily', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december', 'spring', 'summer', 'autumn',
  'winter', 'inside', 'during', 'against', 'around', 'about', 'first', 'second', 'third',
  'last', 'next', 'best', 'top', 'biggest', 'largest', 'smallest', 'latest', 'leading',
  'world', 'global', 'national', 'local', 'regional', 'industry', 'market', 'markets',
  'across', 'amid', 'amidst', 'reports', 'report', 'reveals', 'reveal', 'explains',
  'explain', 'explained', 'watch', 'read', 'inside', 'nearly', 'almost', 'just', 'only',
  'ever', 'still', 'already', 'even', 'also', 'very', 'really', 'actually', 'apparently',
  'reportedly', 'allegedly', 'officially', 'launches', 'launched', 'launch', 'releases',
  'released', 'release', 'announces', 'announced', 'announcement', 'acquires', 'acquired',
  'acquisition', 'merges', 'merged', 'merger', 'partners', 'partner', 'partnership',
  'raises', 'secured', 'lands', 'landed', 'wins', 'won', 'names', 'named', 'namesake',
  'insights', 'insight', 'deep', 'dive', 'guide', 'guide', 'tutorial', 'review', 'reviews',
  'analysis', 'analyst', 'analysts', 'analytics', 'survey', 'studies', 'study', 'research',
  'researchers', 'findings', 'finding', 'result', 'results', 'data', 'datasets', 'dataset',
  'metrics', 'metric', 'stats', 'statistics', 'score', 'scores', 'ranking', 'rankings',
  'ranked', 'rate', 'rates', 'rating', 'ratings', 'risk', 'risks', 'threat', 'threats',
  'security', 'cyber', 'hacker', 'hackers', 'hacking', 'breach', 'breaches', 'leak',
  'leaks', 'leaked', 'attack', 'attacks', 'attacked', 'vulnerability', 'vulnerabilities',
  'exploit', 'exploits', 'exploited', 'malware', 'ransomware', 'phishing', 'scam', 'scams',
  'fraud', 'fake', 'false', 'real', 'genuine', 'original', 'copies', 'copy', 'clone',
  'clones', 'cloned', 'imitation', 'imitations', 'counterfeit', 'bogus', 'bogus',
  // 新聞標題動詞 — LLM 曾把 "Vercel Appoints Amit" 整段當成人名
  'appoints', 'appointed', 'appoint', 'hires', 'hired', 'hire', 'joins', 'joined', 'join',
  'steps', 'steps-down', 'quits', 'quit', 'leaves', 'left', 'departs', 'departed', 'depart',
  'exits', 'exited', 'exit', 'taps', 'tapped', 'tap', 'unveils', 'unveiled', 'unveil',
  'welcomes', 'welcomed', 'promotes', 'promoted', 'promote', 'elevates', 'elevated',
  'boots', 'booted', 'ousts', 'ousted', 'fires', 'fired', 'sacks', 'sacked', 'lays',
  'replaces', 'replaced', 'replace', 'reshuffles', 'reshuffled', 'reshuffle', 'appoints',
  'hiring', 'named', 'names', 'claims', 'claimed', 'backs', 'backed', 'funds', 'funded',
  'calls', 'called', 'says', 'said', 'speaks', 'spoke', 'talks', 'talked', 'warns', 'warned',
  'slams', 'slammed', 'praises', 'praised', 'criticizes', 'criticized', 'praised',
])

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
- These surface the PLATFORM'S OWN pages too — that's fine, later filters drop them; the brand pages they surface are gold.

### Strategy 3: Hiring-signal queries
Companies hiring for the function my service replaces/boosts:
- "hiring customer support specialist" / "looking for sales rep"

### Strategy 4: Industry + niche directories of BUYERS
- "top D2C coffee brands", "independent fashion labels" (brand lists, not SaaS lists)

### Strategy 5: BRAND-HOMEPAGE bias (critical for e-commerce services)
If my buyers are brands/sellers, target their OFFICIAL STORE pages, not content about e-commerce:
- GOOD: "品牌 官網" (brand official site), "official online store Taiwan", "品牌旗艦店 網站"
- BAD: "電商廣告" / "e-commerce marketing platform" / "購物平台" (these surface MARKETPLACES and AD PLATFORMS like momo ads / taobao, never buyers)

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
    // Giant marketplace ecosystems — including ALL their subdomains
    // (ads.momoshop.com.tw, guangtao.taobao.com are platform departments,
    // never prospects). NOTE: /momo\./ only matches momo.com (Japan) —
    // Taiwan's momoSHOP needs its own pattern.
    /momoshop\./i,
    /taobao\./i,
    /tmall\./i,
    /alibaba\./i,
    /1688\./i,
    /jd\.com/i,
    /pinduoduo\./i,
    /yangkeduo\./i,
    /vip\.com/i,
    /ruten\./i,
    /buy\.yahoo\./i,
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
      if (/^(careers?|jobs?|help|support|docs?|developer|community|status|portal|app|blog|news|press|learn|academy|events|info|ads?|dsp|seller|merchant|vendor|affiliate)\./i.test(host)) continue

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

  // 深度評估：70B 起跳，禁用 8B 階梯 — 8B 的平原分數比落到
  // Gemini/DeepSeek 更糟。分類層（便宜）保留階梯。
  const evalConfig = {
    ...globalProviderConfig,
    groqModel: 'llama-3.3-70b-versatile',
    noGroqModelLadder: true,
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
  // 70B 每日額度耗盡後所有流量落到下一個 provider（Gemini 免費層），
  // 它有自己的 RPM 上限 — 序列佇列間隔 12 秒（≈5/分，含 429 重試仍在
  // 免費限額內），頁面抓取維持並行，使用者看到穩定進度而非間隔性錯誤
  const LLM_CAPPED_SPACING_MS = 12_000
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
            // 低信心只標記真正由弱模型（8B）服務的結果，而不是全域旗標 —
            // Gemini/70B 的結果不該被誤標
            if (fitResult.servedBy?.includes('8b')) {
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
- GIANT ECOSYSTEM DOMAINS (decisive, overrides recall bias): any subdomain of taobao/tmall/alibaba/1688/jd/momoshop/shopee/pchome/rakuten/momo/amazon is "platform" — these are marketplaces, not prospects. Same for their ads/media subdomains.
- MARKETING/PR/MEDIA VENDOR SIGNALS (decisive): if the site sells marketing, PR, press-release distribution (海外發稿), media buying, ad operations, or agency services → "vendor". Marketing service providers never buy marketing services.
- RECALL BIAS (only after the two checks above): when torn between "buyer" and anything else, choose "buyer" — a second, stricter stage re-checks survivors with required evidence. Only drop a candidate when you are CONFIDENT it is not a buyer.

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
 * Verdict JSON: { v: 2, type: ProspectClass, candidate?: ProspectCandidate }
 * v:2 之後的判決才可信 — v1（8B 平原分數時期）的快取一律忽略。
 */
const EVAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const EVAL_CACHE_VERSION = 2

async function readEvalCache(domain: string, serviceHash: string): Promise<{ type: string; candidate?: ProspectCandidate } | null> {
  try {
    const row = await db.prospectEvalCache.findUnique({
      where: { domain_serviceHash: { domain, serviceHash } },
    })
    if (!row) return null
    if (Date.now() - row.createdAt.getTime() > EVAL_CACHE_TTL_MS) return null
    const parsed = JSON.parse(row.verdict)
    if (parsed?.v !== EVAL_CACHE_VERSION) return null
    return parsed
  } catch (e) {
    console.warn('readEvalCache failed:', e)
    return null
  }
}

async function writeEvalCache(domain: string, serviceHash: string, verdict: { type: string; candidate?: ProspectCandidate }): Promise<void> {
  try {
    await db.prospectEvalCache.upsert({
      where: { domain_serviceHash: { domain, serviceHash } },
      create: { domain, serviceHash, verdict: JSON.stringify({ v: EVAL_CACHE_VERSION, ...verdict }) },
      update: { verdict: JSON.stringify({ v: EVAL_CACHE_VERSION, ...verdict }), createdAt: new Date() },
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
  servedBy?: string
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
    return { success: true, data: parsed, raw, servedBy: `${chatResult.provider}/${chatResult.model ?? ''}` }
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
    return { success: true, data: retryParsed, raw: retryResult.content, servedBy: `${retryResult.provider}/${retryResult.model ?? ''}` }
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
  /** 其他可能格式（ContactOut 級：同一人提供多個候選信箱） */
  emailAlternates?: string[]
  linkedin?: string
  confidence: 'high' | 'medium' | 'low'  // email 信心度
  email_source: 'hunter' | 'ai_predicted' | 'web_search' | 'website' | 'unknown'
  /** true = email 是公司自己公布的（官網頁面上找到），不是猜測 */
  verified?: boolean
  priority: number  // 1=最高優先
  reason?: string  // 為什麼這個人是對的聯絡人
}

export interface EnrichEmailResult {
  decisionMakers: DecisionMaker[]
  companyEmailPattern?: string  // 例如 "first.last@company.com"
  totalFound: number
  hasEmailCount: number
  /** 官網上直接找到的通用信箱（info@、service@ 等）— 公司自己公布的，可放心用 */
  companyGenericEmails?: string[]
  /** 官網找到的個人信箱數（已驗證） */
  verifiedEmailCount?: number
}

/**
 * ===== Stage A：官網信箱探勘（免費、已驗證）=====
 *
 * 台灣中小企業的 /contact、/about、/team、隱私權頁常常直接印著 email。
 * 這是唯一「公司自己公布」的來源 — 比 Hunter 或格式猜測都可靠，
 * 而且不用任何 API key。挖到的信箱比對決策者姓名後可直接標 verified。
 */
const WEBSITE_EMAIL_JUNK = /^(no.?reply|donotreply|postmaster|abuse|spam|root|mailer.?daemon|unsubscribe|privacy|gdpr)/i
const WEBSITE_EMAIL_SAAS_DOMAINS = /\.(sentry|wixpress|shopline|cyberbiz|91app|square\.site|myshopify|cloudflare|example|test)\./i
const GENERIC_MAILBOX_RE = /^(info|contact|hello|hi|service|support|sales|marketing|admin|office|team|inquiry|inquiries|cs|help|helpdesk|customerservice|customercare|general|mail|email|press|pr|hr|jobs|career)/i

export async function mineWebsiteEmails(website: string): Promise<{
  personal: string[]
  generic: string[]
  /** 首頁文字開頭 — 公司業務描述，用於同名公司消歧 */
  homepageText: string
}> {
  const domain = extractDomain(website)
  if (!domain) return { personal: [], generic: [], homepageText: '' }

  const origin = website.replace(/\/$/, '')
  const paths = ['', '/contact', '/contact-us', '/about', '/team']
  const emails = new Set<string>()
  let homepageText = ''
  const teamTexts: string[] = []

  await Promise.all(paths.map(async (p) => {
    try {
      const page = await fetchPageWithFallback(`${origin}${p}`, globalProviderConfig)
      if (!page) return
      const haystack = `${page.html ?? ''} ${page.text ?? ''}`
      if (p === '') {
        homepageText = (page.text || htmlToText(page.html ?? '')).slice(0, 800)
      } else if (p === '/about' || p === '/team') {
        teamTexts.push((page.text || htmlToText(page.html ?? '')).slice(0, 900))
      }
      // mailto: 連結 + 純文字 email
      const mailtos = [...haystack.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi)].map((m) => m[1])
      const plain = [...haystack.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)].map((m) => m[0])
      for (const e of [...mailtos, ...plain]) {
        const email = e.toLowerCase().replace(/[.,;:)]+$/, '')
        // 只要目標網域自己的信箱，且排除機器信箱與 SaaS 追蹤網域
        if (!email.endsWith(`@${domain}`)) continue
        if (WEBSITE_EMAIL_JUNK.test(email.split('@')[0])) continue
        if (WEBSITE_EMAIL_SAAS_DOMAINS.test(email)) continue
        // 排除誤抓的檔名/雜訊（過長或含奇怪連續符號）
        if (email.split('@')[0].length > 40) continue
        emails.add(email)
      }
    } catch {
      // 單頁失敗不影響其他頁
    }
  }))

  const personal: string[] = []
  const generic: string[] = []
  for (const e of emails) {
    if (GENERIC_MAILBOX_RE.test(e.split('@')[0])) generic.push(e)
    else personal.push(e)
  }
  // 首頁 + about/team 頁的合併文字 — 業務消歧與「誰是真的團隊成員」的錨定
  const siteContext = [homepageText, ...teamTexts].filter(Boolean).join('\n').slice(0, 2200)
  return { personal, generic: generic.slice(0, 5), homepageText: siteContext }
}

/**
 * 用官網找到的個人信箱反推公司的 email 命名格式，把預測清單裡
 * 符合該格式的排到最前（例：官網有 jane.wang@ → {first}.{last}@ 最可能）
 */
function reorderPredictionsByObservedFormat(
  predictions: string[],
  observedEmails: string[],
  preferFirstFormat = false
): string[] {
  if (observedEmails.length === 0 && !preferFirstFormat) return predictions
  const observed = observedEmails[0]?.split('@')[0]
  const hasDot = observed?.includes('.')
  const localWords = observed?.replace(/[^a-z]/g, '').length ?? 0
  const scored = predictions.map((p) => {
    const local = p.split('@')[0]
    let score = 0
    // 官網已觀察到某格式 → 優先該格式的形態（含點/不含點/長度接近）
    if (hasDot !== undefined) {
      if (hasDot === local.includes('.')) score += 2
      score -= Math.abs(local.replace(/[^a-z]/g, '').length - localWords) * 0.1
    } else if (preferFirstFormat) {
      // 無觀察樣本：新創/小型公司大多用 first@（Ivan Maryasin → ivan@monite.com）
      const isPlainFirst = /^[a-z]+@/.test(p)
      if (isPlainFirst) score += 2
      score += /^[a-z]+\.[a-z]+@/.test(p) ? 0 : 1
    }
    return { p, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.p)
}

/**
 * 判斷官網挖到的個人信箱是否屬於某位決策者（比對姓名組合）
 */
function emailBelongsToPerson(email: string, firstName: string, lastName: string): boolean {
  const local = email.split('@')[0]
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '')
  const l = (lastName || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!f) return false
  const forms = l ? [f, l, `${f}.${l}`, `${f}${l}`, `${f[0]}${l}`, `${f}.${l[0]}`, `${f}_${l}`] : [f]
  return forms.includes(local)
}

/**
 * 從搜尋結果原始文字（標題/摘要/官網文字）找出真實存在的 email —
 * ContactOut 級：同一人可能有多個信箱（公司格式 + 其他域）。只回傳
 * 與目標網域相符者，避免把別家公司的信箱掛到這家公司的人頭上。
 */
function scanEmailsFromRaw(
  raw: Array<{ title: string; snippet?: string; url?: string }>,
  companyContext: string | undefined,
  domain: string
): string[] {
  const text = [
    ...raw.map((r) => `${r.title} ${r.snippet ?? ''}`),
    companyContext ?? '',
  ].join(' ')
  const found = new Set<string>()
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const email = m[0].toLowerCase()
    const [, emailDomain] = email.split('@')
    if (emailDomain === domain) found.add(email)
  }
  return [...found]
}

/**
 * 一個人的 email 候選清單（ContactOut 級）：先放搜尋結果/官網文字中
 * 實際出現的（verified），再補上格式預測的候選。
 */
function buildEmailCandidates(
  firstName: string,
  lastName: string,
  domain: string,
  rawEmails: string[],
  observedFormats: string[],
  preferFirstFormat = false
): { email?: string; emailAlternates?: string[]; source: 'website' | 'ai_predicted'; confidence: 'high' | 'low' } {
  // 1. 官網/原始文字中實際出現、且比對得上這個人的信箱 → verified
  //   （observedFormats 是官網挖到的 — 公司自己公布的，比搜尋摘要更可靠）
  const verified = [
    ...observedFormats,
    ...rawEmails,
  ].filter((e) => emailBelongsToPerson(e, firstName, lastName))
  // 2. 格式預測（用官網觀察到的格式排序；無觀察樣本時偏好 first@ — 新創/SaaS 最常見）
  const predictions = reorderPredictionsByObservedFormat(
    predictEmailFormats(firstName, lastName, domain),
    observedFormats,
    observedFormats.length === 0 || preferFirstFormat
  )
  const unique: string[] = []
  for (const e of [...verified, ...predictions]) {
    if (!unique.includes(e)) unique.push(e)
  }
  if (unique.length === 0) return { source: 'ai_predicted' as const, confidence: 'low' as const }
  return {
    email: unique[0],
    emailAlternates: unique.slice(1, 5),
    source: verified.length > 0 ? 'website' : 'ai_predicted',
    confidence: verified.length > 0 ? 'high' : 'low',
  }
}

/**
 * 買方情境分類 — 決定哪一類職位是「該公司真正的採購決策者」。
 * 用戶提供的人員定位規則：
 * - CEO/Founder：目標是小型企業/新創時最佳（高階主管直接做採購決策）。
 * - CTO/Tech Lead：賣技術工具/API/軟體/開發者服務時最佳。
 * - SDR/BDR/Sales：賣銷售工具/外展軟體/潛在客戶開發服務時最佳。
 * 由官網首頁文字（homepageText / companyContext）推斷目標公司業務類型。
 */
export type BuyerContext = 'smb' | 'devtools' | 'sales_tools' | 'general'

export function classifyBuyerContext(companyContext?: string): BuyerContext {
  const t = (companyContext ?? '').toLowerCase()
  const hit = (re: RegExp) => (t.match(re) ?? []).length
  const devtools = hit(/\b(api|sdk|developer|developers|software|code|coding|programming|infrastructure|devtool|technical|engineering|documentation|open source|cloud)\b/g)
  const salesTools = hit(/\b(sales|outreach|lead generation|leadgen|prospecting|crm|sales automation|sales platform|revenue intelligence|email finder|sales engagement|cold email|b2b|demand generation)\b/g)
  const smb = hit(/\b(small business|startup|start-up|smb|solo founder|small team|small teams|entrepreneur|founder-led|bootstrapped|early-stage)\b/g)
  if (salesTools >= 2 && salesTools > devtools && salesTools > smb) return 'sales_tools'
  if (devtools >= 2 && devtools > smb) return 'devtools'
  if (smb >= 2) return 'smb'
  return 'general'
}

export function buyerContextLabel(ctx: BuyerContext): string {
  switch (ctx) {
    case 'smb': return '小型企業/新創 — CEO/Founder 直接決策'
    case 'devtools': return '技術/開發者工具公司 — CTO/Tech Lead 是技術採購決策者'
    case 'sales_tools': return '銷售工具公司 — SDR/BDR/Sales 是直接使用者與決策者'
    default: return '一般公司'
  }
}

/**
 * 決策者優先級排序規則
 * 用戶要求：
 * 1. VP of Sales / VP Sales / Sales Director → 第一優先
 * 2. CEO / Founder → 第二優先
 * 3. CRO / CMO / COO → 第三優先
 * 4. SDR / AE → 永遠跳過（除非真的找不到別的）
 * 5. 依買方情境（buyerContext）提升該類職位優先級：
 *    - smb → CEO/Founder 最優先
 *    - devtools → CTO/Tech Lead 最優先
 *    - sales_tools → SDR/BDR/Sales 最優先（不再跳過）
 */
export function rankTitle(title: string, buyerContext: BuyerContext = 'general'): { seniority: DecisionMaker['seniority']; priority: number; reason: string } {
  const t = title.toLowerCase()

  const isFounderCeo = /\bceo\b|\bchief executive\b|\bfounder\b|\bco-founder\b|\bco founder\b|\bpresident\b|\bowner\b|\bcro\b|chief revenue officer/i.test(t)
  const isTechLead = /\b(cto|chief technology|chief technical|tech lead|technical lead|head of engineering|engineering director|chief architect|engineering lead)\b|\bvp of engineering\b|\bvice president of engineering\b|\bvp engineering\b|\bvice president engineering\b|\bhead of developer\b|\bhead of development\b|\bengineering manager\b/i.test(t)
  const isSdrSales = /\b(sdr|bdr|sales development|account executive|\bae\b|business development rep|bd rep)\b/i.test(t)

  // 買方情境優先：該公司「真正會買單」的角色排最前面
  if (buyerContext === 'devtools' && isTechLead) {
    return { seniority: 'c_level', priority: 1, reason: 'CTO/技術主管 — 技術型公司由技術決策者拍板' }
  }
  if (buyerContext === 'sales_tools' && isSdrSales) {
    return { seniority: 'manager', priority: 1, reason: 'SDR/業務 — 銷售工具公司的直接使用者與決策者' }
  }

  // 1. CEO / 創辦人 / 總裁 / CRO — 最終決策者，最優先
  //（舊版把他們排在「業務主管」之後 — Director of Growth 壓過
  //  Co-Founder & CEO，用戶反應 Linear 案例排序錯誤）
  if (isFounderCeo) {
    return {
      seniority: 'c_level',
      priority: 1,
      reason: buyerContext === 'smb' ? 'CEO/創辦人 — 小型/新創公司由最高主管直接決策' : 'CEO/創辦人 — 能做預算決定的最終決策者',
    }
  }

  // SDR / AE 先擋（避免 'sales' 字眼被下面業務主管分支吃掉）
  //（sales_tools 情境已在上方提升為高優先，不會走到這裡）
  if (isSdrSales) {
    return { seniority: 'manager', priority: 99, reason: '業務專員 — 太基層，跳過' }
  }

  // 2. 業務最高主管 — 只認 sales/revenue/commercial
  //（growth 是行銷向職稱，不背直接業績 — 舊版把 Director of Growth
  //  當業務最高主管是錯的）
  if (/\b(vp|vice president|head|director)\b.*\b(sales|revenue|commercial)\b/i.test(t) ||
      /\b(sales|revenue|commercial)\b.*\b(vp|vice president|head|director)\b/i.test(t)) {
    return { seniority: 'vp', priority: 2, reason: '業務最高主管 — 直接背負業績' }
  }

  // 2.5 技術主管（devtools 情境已在上方提升；一般情境仍算主管級）
  if (isTechLead) {
    return { seniority: 'c_level', priority: 3, reason: '技術主管（CTO/工程主管）' }
  }

  // 3. 其他 C-level（含 CFO — 舊版漏掉掉進「其他」）
  if (/\bcmo\b|chief marketing|\bcoo\b|chief operating|\bcto\b|chief technology|\bcpo\b|chief product|\bcfo\b|chief financial/i.test(t)) {
    return { seniority: 'c_level', priority: 3, reason: 'C-level 主管' }
  }

  // 3. 行銷/成長主管 — 影響成長預算，但不是業績負責人
  if (/\b(vp|vice president|head|director)\b.*\b(marketing|growth|brand|demand)\b/i.test(t) ||
      /\b(marketing|growth)\b.*\b(vp|vice president|head|director)\b/i.test(t)) {
    return { seniority: 'director', priority: 3, reason: '行銷/成長主管 — 影響成長預算' }
  }

  // 4. 其他 Director
  if (/\bdirector\b/i.test(t)) {
    return { seniority: 'director', priority: 4, reason: 'Director 主管' }
  }

  // 5. 其他經理
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
 * 保險絲：模型/正則都曾把新聞標題字詞當成人名輸出
 * （"After SpaceX's Youngest"、"Insane Plot Twist"、"LinkedIn Bans"）。
 * 人名必須：全字母 token（無撇號/連字號/數字）、不含常見非人名詞、
 * 且完整出現在原始結果或官網文字中（grounding — 防純幻覺）。
 */
function isPlausiblePersonName(
  name: string,
  raw: Array<{ title: string; snippet?: string }>,
  companyContext?: string,
  companyName?: string
): boolean {
  const tokens = name.toLowerCase().split(/\s+/)
  if (!tokens.every((t) => /^[a-z]{2,}$/.test(t))) return false
  if (tokens.some((t) => NAME_STOPWORDS.has(t))) return false
  // 公司名 token 混進人名 = 標題碎片（"Vercel Appoints Amit"、"Monite Raises $20M"）
  if (companyName) {
    const companyTokens = companyName.toLowerCase().split(/\s+/).filter((t) => t.length >= 3)
    if (tokens.some((t) => companyTokens.includes(t))) return false
  }
  const groundText = `${raw.map((r) => `${r.title} ${r.snippet ?? ''}`).join(' ')} ${companyContext ?? ''}`.toLowerCase()
  return groundText.includes(name.toLowerCase())
}

/**
 * LLM 結構化真人萃取：餵入原始搜尋結果，請模型判斷哪些是「任職於目標
 * 公司的真人」。這是 ContactOut 級品質與正則垃圾的差別所在 — 模型能
 * 看懂「Joined Vercel」是頁面標題碎片、「Sales UK」是部門、某個 founder
 * 其實屬於別家公司，而正則只會抓大寫片語。
 */
async function llmExtractPeople(
  raw: Array<{ title: string; snippet?: string; url?: string; source: string }>,
  companyName: string,
  domain: string,
  companyContext?: string,
  buyerContext: BuyerContext = 'general'
): Promise<Array<{ name: string; title: string; linkedin?: string; source: string }>> {
  const resultsText = raw
    .slice(0, 25)
    .map((r, i) => `[${i}] TITLE: ${r.title}\n    SNIPPET: ${(r.snippet ?? '').slice(0, 400)}\n    URL: ${r.url ?? ''}`)
    .join('\n')

  const prompt = `You extract REAL PEOPLE from messy web-search results.

Target company: "${companyName}" (website domain: ${domain}).
What THIS company's own website says (ground truth — use it to disambiguate same-named companies):
"""
${(companyContext ?? '').slice(0, 2000) || '(site unavailable — rely on the domain alone)'}
"""

Search results (titles + snippets + URLs):
${resultsText}

Rules:
1. It is a REAL PERSON (first + last name). The name MUST appear VERBATIM in a result (title or snippet) or in the site text. NEVER splice a name from title fragments ("After SpaceX's Youngest", "Insane Plot Twist"). NOT a page fragment, department, job listing, or course/event.
2. BUSINESS-MATCH: the person must belong to the target company, not another company with the same/similar name. Compare their snippet's business description against the site text above. If a result describes a DIFFERENT business (e.g. an aviation Aviato when the site text says private-market data platform), that person is from a different company — reject them. If the snippet clearly describes the same business, accept them.
3. Their title is a leadership/senior role (C-level, VP, Director, Head, Founder). Title is REQUIRED — derive it from the title/snippet; if genuinely unknown, reject.
4. linkedin must be a PERSONAL profile URL (contains /in/ or /pub/) if provided.

SELECTION POLICY:
- Max 2 founders/CEOs total — pick the ones with the STRONGEST explicit tie to ${domain}.
- DIVERSIFY by role: prefer one VP of Sales/CRO, one CMO/Head of Marketing, one COO/other C-level.
- Buyer context: ${buyerContextLabel(buyerContext)}. When the company type matches a buyer persona, PRIORITIZE those roles in your output (they are the real decision makers for a vendor selling into them): ${buyerContext === 'devtools' ? 'CTO, CTO/Co-founder, Tech Lead, Head of Engineering, VP Engineering.' : buyerContext === 'sales_tools' ? 'SDR, BDR, Account Executive, Sales Development, Sales/Business Development staff (they are the hands-on users of sales tools).' : buyerContext === 'smb' ? 'CEO, Founder, Owner (top execs decide directly in small companies).' : 'CEO/Founder, VP Sales, C-level.'}
- Max 5 people, best first. Empty array [] if none qualify.

Return pure JSON:
[{"name":"Jane Wang","title":"VP of Sales","linkedin":"https://www.linkedin.com/in/..."}]`

  try {
    const chatResult = await chatWithFallback({
      messages: [
        { role: 'system', content: 'You are a precise contact-data extraction engine. Respond with pure JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 3000,
    }, { ...globalProviderConfig, noGroqModelLadder: true })
    const parsed = extractJsonLoose(chatResult.content)
    if (!Array.isArray(parsed)) return []
    const out: Array<{ name: string; title: string; linkedin?: string; source: string }> = []
    for (const p of parsed) {
      const name = String(p?.name ?? '').trim()
      const title = String(p?.title ?? '').trim()
      if (!name || !title) continue
      if (/^n\/?a$/i.test(title)) continue
      // 模型輸出仍過一道保險絲：真人名不該含職稱/招募/公司字眼
      if (/\b(vice president|\bvp\b|president|chief|officer|director|head|manager|executive|\bceo\b|\bcto\b|\bcmo\b|\bcoo\b|\bcro\b|\bcfo\b|founder|owner|jobs?|hiring|careers?|vacanc|opening|apply|remote|salary|group|agency|solutions|consulting|partners?|holdings)\b/i.test(name)) continue
      const words = name.split(/\s+/)
      if (words.length < 2 || words.length > 4) continue
      // 保險絲 2：弱模型曾把新聞標題字詞當成人名輸出（"After SpaceX's
      // Youngest"、"Insane Plot Twist"、"LinkedIn Bans" 等，全部是標題片段）。
      if (!isPlausiblePersonName(name, raw, companyContext, companyName)) continue
      const li = String(p?.linkedin ?? '')
      out.push({
        name,
        title,
        linkedin: /linkedin\.com\/(in|pub)\//.test(li) ? li : undefined,
        source: 'llm-extracted',
      })
    }
    // 官網錨定：名字出現在公司自己網站（首頁/about/team）的人 = 鐵證。
    // 排在創辦人上限之前套用 — 同名污染案例中，真創辦人在官網上、
    // 冒牌的不在，錨定排序讓真的人先佔住創辦人名額（aviato.co 實測：
    // LLM 把別家公司的創辦人排前面，真創辦人 Eric Zhu 被上限誤殺）
    const siteText = (companyContext ?? '').toLowerCase()
    if (siteText) {
      out.sort((a, b) => {
        const aOnSite = siteText.includes(a.name.toLowerCase()) ? 0 : 1
        const bOnSite = siteText.includes(b.name.toLowerCase()) ? 0 : 1
        return aOnSite - bOnSite
      })
    }
    // 創辦人上限改成程式碼強制 — 弱模型曾無視 prompt 上限，一次回
    // 5 個「創辦人」其中包含劇集虛構角色（Erlich Bachman 事件）
    const FOUNDER_RE = /\bceo\b|\bchief executive\b|founder|\bpresident\b|\bowner\b/i
    let founderCount = 0
    const capped: typeof out = []
    for (const p of out) {
      if (FOUNDER_RE.test(p.title)) {
        founderCount++
        if (founderCount > 2) continue  // 保留前兩位（LLM 排 best-first）
      }
      capped.push(p)
      if (capped.length >= 5) break
    }

    // LinkedIn 回填：人常從新聞結果找到（網域錨定搜尋），新聞頁沒有
    // LinkedIn 連結 — 回頭掃原始結果，找標題含此人姓名的個人檔案頁
    // （aviato.co 實測：Eric Zhu 從 TechCrunch 找到但 /in/ericzhu105
    //  在 LinkedIn 搜尋結果裡，合併後兩者都該有）
    for (const p of capped) {
      if (p.linkedin) continue
      const nameKey = p.name.toLowerCase()
      const profile = raw.find((r) => {
        if (!r.url || !/linkedin\.com\/(in|pub)\//.test(r.url)) return false
        const title = (r.title ?? '').toLowerCase()
        return title.includes(nameKey)
      })
      if (profile) p.linkedin = profile.url
    }
    return capped
  } catch (e) {
    console.warn('llmExtractPeople failed (providers unavailable):', e instanceof Error ? e.message : e)
    return []
  }
}

/**
 * 舊正則萃取路徑（LLM 不可用時的備援 — 品質較差）
 */
function regexExtractPeople(
  raw: Array<{ title: string; snippet?: string; url?: string; source: string }>,
  companyContext?: string,
  companyName?: string
): Array<{ name: string; title: string; linkedin?: string; source: string }> {
  const found: Array<{ name: string; title: string; linkedin?: string; source: string }> = []

  const titlePatterns = [
    /\b((?:VP|Vice President)\s*(?:of\s+)?(?:Sales|Revenue|Growth|Marketing))\b/i,
    /\b((?:Sales|Revenue|Marketing)\s+Director)\b/i,
    /\b((?:Director|Head)\s+of\s+(?:Sales|Revenue|Growth|Marketing))\b/i,
    /\b(Chief\s+(?:Executive|Revenue|Marketing|Operating|Technology)\s+Officer)\b/i,
    /\b(CEO|CTO|CMO|COO|CRO|CFO)\b/i,
    /\b(Founder|Co-Founder|Co\s*Founder)\b/i,
    /\b(President)\b/i,
  ]
  const junkNameRe = /\b(vice president|\bvp\b|president|chief|officer|director|head|manager|executive|specialist|associate|\bceo\b|\bcto\b|\bcmo\b|\bcoo\b|\bcro\b|\bcfo\b|founder|co.?founder|owner|group|agency|studio|labs?|solutions|consulting|partners?|ventures|holdings|strategy|recruitment|jobs?|hiring|careers?|vacanc|opening|apply|remote|salary|inc|ltd|llc|corp|company)\b/i

  for (const r of raw) {
    const title = r.title
    const nameMatch = title.match(/^([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,3})(?:\s*[-–|]|\s+at\s|\s+\|)/)
    const altNameMatch = !nameMatch ? title.match(/\b([A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+){1,2})\b/) : null

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
    if (junkNameRe.test(name)) continue
    // 保險絲：標題碎片不是人名（"After SpaceX's Youngest"、"Insane Plot Twist"）
    if (!isPlausiblePersonName(name, raw, companyContext, companyName)) continue
    const nameWords = name.split(/\s+/)
    if (nameWords.length < 2 || nameWords.length > 4) continue

    found.push({
      name: name.trim(),
      title: extractedTitle,
      linkedin: r.url && /linkedin\.com\/(in|pub)\//.test(r.url) ? r.url : undefined,
      source: r.source,
    })
  }
  return found
}

/**
 * AI 透過 web_search 找決策者
 *
 * 兩階段：搜集原始搜尋結果 → 一次 LLM 呼叫做結構化真人萃取。
 * 舊版用正則從標題抓「大寫片語」當人名，產出「Joined Vercel」「Sales UK」
 * 「Today I'm」這種網頁標題碎片（Vercel 實測 5 筆裡 4 筆垃圾）。
 * LLM 判斷「這是不是真人、是否任職於目標公司」比正則可靠得多；
 * 正則路徑保留為 LLM 不可用時的備援。
 */
/**
 * 自有資料源探勘 — 不依賴任何第三方搜尋 API（無 Tavily/Jina）：
 * 1. LinkedIn 公司頁員工列表（訪客模式直接抓取 — 名字 + 個人檔案 URL）
 * 2. Google News RSS（免費、免金鑰）— 網域錨定新聞（標題常含創辦人名字）
 * 3. 公司官網 /about /team 頁文字（已在 mineWebsiteEmails 挖過 — 業務消歧 ground truth）
 * 全部輸出成 llmExtractPeople 能吃的 raw 格式，既有 LLM 萃取/回填流程不變。
 */
async function discoverOwnSources(params: {
  companyName: string
  domain: string
  website: string
  companyContext?: string
}): Promise<Array<{ title: string; snippet?: string; url?: string; source: string }>> {
  const { companyName, domain, website, companyContext } = params
  const raw: Array<{ title: string; snippet?: string; url?: string; source: string }> = []

  // ===== 1. LinkedIn 公司頁員工（訪客模式）=====
  try {
    const liPeople = await discoverLinkedInEmployees(website, companyName, domain)
    if (liPeople.length > 0) raw.push(...liPeople)
  } catch (e) {
    console.warn('LinkedIn employees discovery failed:', e instanceof Error ? e.message : e)
  }

  // ===== 2. Google News RSS — 網域錨定（新聞頁沒 LinkedIn 連結，但標題含人名）=====
  try {
    const news = await discoverGoogleNews(companyName, domain)
    if (news.length > 0) raw.push(...news)
  } catch (e) {
    console.warn('Google News discovery failed:', e instanceof Error ? e.message : e)
  }

  // ===== 3. 官網 /about /team 文字 — 業務消歧與「誰是真團隊」的錨定 =====
  if (companyContext && companyContext.trim().length > 0) {
    raw.push({
      title: `${companyName} official website (home/about/team)`,
      snippet: companyContext,
      url: website,
      source: 'Company website',
    })
  }

  return raw
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

/**
 * 從公司官網找到 LinkedIn 公司頁，抓「Employees at X」區塊
 * （訪客模式直接抓 HTML — 免費、免金鑰、無需登入）
 */
async function discoverLinkedInEmployees(
  website: string,
  companyName: string,
  domain: string
): Promise<Array<{ title: string; snippet?: string; url?: string; source: string }>> {
  const origin = website.replace(/\/$/, '')
  let companyUrl: string | null = null

  // 1. 官網 HTML 裡找 linkedin.com/company/ 連結（最準 — 公司自己放的）
  try {
    const homeRes = await fetch(origin, {
      headers: { 'user-agent': BROWSER_UA },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    })
    if (homeRes.ok) {
      const html = await homeRes.text()
      const m = html.match(/https?:\/\/(?:www\.|[a-z]{2}\.)?linkedin\.com\/company\/[a-zA-Z0-9-]+/i)
      if (m) companyUrl = m[0]
    }
  } catch {}

  // 2. 官網沒有 → 猜 slug（網域主體 / 公司名小寫）
  if (!companyUrl) {
    const slugCandidates = [
      domain.split('.')[0],
      companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      companyName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    ]
    for (const slug of [...new Set(slugCandidates)]) {
      try {
        const res = await fetch(`https://www.linkedin.com/company/${slug}`, {
          headers: { 'user-agent': BROWSER_UA },
          signal: AbortSignal.timeout(15_000),
          redirect: 'follow',
        })
        if (res.ok) {
          const html = await res.text()
          if (html.includes('employees-at') || /Employees at/i.test(html)) {
            companyUrl = `https://www.linkedin.com/company/${slug}`
            break
          }
        }
      } catch {}
    }
  }

  if (!companyUrl) return []

  const res = await fetch(companyUrl, {
    headers: { 'user-agent': BROWSER_UA },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  })
  if (!res.ok) return []
  const html = await res.text()
  return parseLinkedInEmployees(html)
}

/**
 * 解析 LinkedIn 公司頁的員工區塊（訪客版 HTML）
 * 格式：<a href="/in/{slug}"><img alt="Click here to view {Name}’s profile"> <h3>{Name}</h3>
 */
async function parseLinkedInEmployees(
  html: string
): Promise<Array<{ title: string; snippet?: string; url?: string; source: string }>> {
  const items: Array<{ title: string; snippet?: string; url?: string; source: string }> = []
  const start = html.indexOf('employees-at')
  const section = start >= 0 ? html.slice(start, start + 30000) : html

  const linkRe = /href="https:\/\/www\.linkedin\.com\/in\/([^"?]+)(?:\?[^"]*)?"/g
  const altRe = /alt="Click here to view\s+([^"]+)"/g

  const links: string[] = []
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(section)) !== null) links.push(m[1])

  const names: string[] = []
  while ((m = altRe.exec(section)) !== null) {
    names.push(
      m[1]
        .replace(/\u2019?s profile/i, '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '')
        .trim()
    )
  }

  for (let i = 0; i < Math.min(links.length, names.length); i++) {
    const name = names[i]
    if (!name || name.length < 2) continue
    if (items.some((it) => it.title === name)) continue
    items.push({
      title: name,
      url: `https://www.linkedin.com/in/${links[i]}`,
      source: 'LinkedIn employees',
    })
  }

  // 公司頁的員工卡只有名字沒有職稱 — llmExtractPeople 拒絕沒職稱的人。
  // 抓個人檔案頁（訪客模式），<title> 就是 headline：「Name - 職稱 | LinkedIn」。
  // 並行 2 個、10 秒逾時 — 失敗就保留「名字無職稱」，不阻塞整體流程。
  const CONCURRENCY = 2
  let next = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      const it = items[next++]
      try {
        const res = await fetch(it.url!, {
          headers: { 'user-agent': BROWSER_UA },
          signal: AbortSignal.timeout(10_000),
          redirect: 'follow',
        })
        if (!res.ok) continue
        const html = await res.text()
        const titleMatch = html.match(/<title>([^<]*)<\/title>/)
        if (!titleMatch) continue
        const t = titleMatch[1].replace(/\s*\|\s*LinkedIn\s*$/i, '').trim()
        const dash = t.indexOf(' - ')
        if (dash > 0) {
          const headline = t.slice(dash + 3).trim()
          if (headline) it.title = `${it.title} — ${headline}`
        }
      } catch {}
    }
  })
  await Promise.all(workers)

  return items
}

/**
 * Google News RSS（免費、免金鑰、無速率限制）— 網域錨定查詢
 * 標題常含「Eric Zhu」這種創辦人全名（TechCrunch 等），url 是 Google
 * 轉址 — 對後續 LinkedIn 回填沒用，但 LLM 萃取需要標題文字即可。
 */
async function discoverGoogleNews(
  companyName: string,
  domain: string
): Promise<Array<{ title: string; snippet?: string; url?: string; source: string }>> {
  const items: Array<{ title: string; snippet?: string; url?: string; source: string }> = []
  const queries = [
    `"${domain}"`,
    `"${companyName}" "${domain}"`,
    `"${companyName}" CEO OR founder OR "Co-Founder"`,
    `"${companyName}" "VP of Sales" OR CMO OR COO OR "Chief Revenue" OR "Chief Marketing"`,
  ]
  for (const q of queries) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`
    const res = await fetch(url, {
      headers: { 'user-agent': BROWSER_UA },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) continue
    const xml = await res.text()
    const itemRe = /<item>([\s\S]*?)<\/item>/g
    let m: RegExpExecArray | null
    while ((m = itemRe.exec(xml)) !== null) {
      const block = m[1]
      const title = (block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/&amp;/g, '&')
        .trim()
      const link = (block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '').trim()
      const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .trim()
      if (!title) continue
      // 兩個查詢（domain / company+domain）常回同一批文章 — 去重省 LLM token
      if (items.some((i) => i.title === title)) continue
      items.push({ title, snippet: source, url: link, source: 'Google News' })
    }
  }

  // 新聞標題常只有人名沒有公司（"Eric Zhu's startup..."）— 業務消歧需要
  // 正文（TechCrunch 內文才有 "started building Aviato"）。用 Jina Reader
  // 抓正文前段當 snippet（並行 2、失敗跳過 — 不阻塞整體流程）。
  const ENRICH_LIMIT = 8
  const toEnrich = items.slice(0, ENRICH_LIMIT).filter((it) => it.url)
  let enrichIdx = 0
  const enrichWorkers = Array.from({ length: 2 }, async () => {
    while (enrichIdx < toEnrich.length) {
      const it = toEnrich[enrichIdx++]
      try {
        const page = await fetchPageWithFallback(it.url!, {
          ...globalProviderConfig,
          pageReaderProviderOrder: 'jina',
        })
        if (!page?.text) continue
        // Jina Reader 回傳：Title / URL Source / Published Time / Markdown Content 標頭
        // （標頭間有空行 — 用 Markdown Content 錨點切，別用逐行 ^ 正則）
        const mcIdx = page.text.indexOf('Markdown Content:')
        let body = mcIdx >= 0 ? page.text.slice(mcIdx + 'Markdown Content:'.length) : page.text
        body = body.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
        if (body.length > 60) {
          // 新聞頁開頭是導覽/cookie 橫幅等 boilerplate — 內文要往後找。
          // 錨點：公司名第一次出現（TechCrunch 內文 "started building Aviato"），
          // 沒有就退而求其次用標題片段，再沒有就跳過前 1500 字元。
          const companyIdx = body.toLowerCase().indexOf(companyName.toLowerCase())
          const titleAnchor = it.title.replace(/[^A-Za-z0-9'\s-]/g, '').slice(0, 40).trim()
          const titleIdx = titleAnchor ? body.indexOf(titleAnchor) : -1
          const anchorIdx = companyIdx >= 0 ? companyIdx : titleIdx >= 0 ? titleIdx : 1500
          const start = Math.max(0, anchorIdx - 120)
          it.snippet = body.slice(start, start + 500)
        }
      } catch {}
    }
  })
  await Promise.all(enrichWorkers)

  return items.slice(0, 15)
}

async function findPeopleWithAI(params: {
  companyName: string
  domain: string
  website: string
  /** 官網首頁文字 — 業務消歧的 ground truth（aviato.co vs aviator.co） */
  companyContext?: string
  /** 官網挖到的個人信箱 — 可反推公司 email 格式 + 直接比對姓名 */
  observedEmails?: string[]
}): Promise<DecisionMaker[]> {
  const { companyName, domain, website, companyContext, observedEmails = [] } = params
  const buyerContext = classifyBuyerContext(companyContext)

  // 7 組搜尋策略（漸進放寬；含 CMO/行銷 — 用戶要多元角色）
  // 依買方情境加掛對應職位查詢：devtools 公司找 CTO/工程主管，
  // sales_tools 公司找 SDR/業務，smb 找 CEO/Founder。
  const contextSearches: Array<{ query: string; label: string }> = []
  if (buyerContext === 'devtools') {
    contextSearches.push(
      { query: `"${companyName}" CTO OR "Chief Technology Officer" OR "Head of Engineering" OR "VP Engineering" site:linkedin.com`, label: 'CTO/Engineering LinkedIn' },
      { query: `"${companyName}" "tech lead" OR "technical lead" OR "engineering director" site:linkedin.com`, label: 'Tech Lead LinkedIn' },
    )
  } else if (buyerContext === 'sales_tools') {
    contextSearches.push(
      { query: `"${companyName}" SDR OR BDR OR "Account Executive" OR "Sales Development" site:linkedin.com`, label: 'SDR/BDR LinkedIn' },
    )
  } else if (buyerContext === 'smb') {
    contextSearches.push(
      { query: `"${companyName}" CEO OR Founder OR Owner site:linkedin.com`, label: 'CEO/Founder LinkedIn' },
    )
  }
  const searches = [
    // 0. 網域錨定 — 新聞/PR 報導會同時出現網域與真實創辦人，
    //    是同名公司泥沼中最不可模糊的證據（aviato.co 案例：
    //    LinkedIn「CEO at Aviato」有三家同名公司，TechCrunch 報導只有一家）
    { query: `"${domain}" founder OR CEO leadership`, label: 'Domain-anchored news' },
    ...contextSearches,
    { query: `"${companyName}" "VP of Sales" OR "VP Sales" OR "Vice President of Sales" site:linkedin.com`, label: 'VP Sales LinkedIn' },
    { query: `"${companyName}" CEO OR founder OR "Co-Founder" site:linkedin.com`, label: 'CEO LinkedIn' },
    { query: `"${companyName}" "Sales Director" OR "Director of Sales" OR "Head of Sales" site:linkedin.com`, label: 'Sales Director LinkedIn' },
    { query: `"${companyName}" "Chief Marketing Officer" OR CMO OR "Head of Marketing" OR "VP Marketing" site:linkedin.com`, label: 'CMO/Marketing LinkedIn' },
    { query: `"${companyName}" "Chief Revenue Officer" OR CRO OR COO "Chief Operating Officer" site:linkedin.com`, label: 'C-level LinkedIn' },
    { query: `"${companyName}" leadership team about founders executives`, label: 'Leadership page' },
  ]

  // ===== 階段 1：搜集原始結果（title + snippet + url）=====
  // 先跑自有資料源（LinkedIn 公司頁員工 + Google News + 官網團隊頁）—
  // 免費、免金鑰、無速率限制。結果不足才退回搜尋 API。
  let raw: Array<{ title: string; snippet?: string; url?: string; source: string }> = []
  try {
    raw = await discoverOwnSources({ companyName, domain, website, companyContext })
  } catch (e) {
    console.warn('discoverOwnSources failed:', e instanceof Error ? e.message : e)
  }
  if (raw.length < 3) {
    for (const s of searches) {
      try {
        const results = await searchCompanies(s.query, 5)
        for (const r of results) {
          if (!r?.name) continue
          raw.push({ title: r.name, snippet: r.snippet, url: r.url, source: s.label })
        }
      } catch (e) {
        console.error(`search "${s.label}" failed:`, e)
      }
      await new Promise((r) => setTimeout(r, 600))
    }
  }
  if (raw.length === 0) return []

  // ===== 階段 2：LLM 結構化萃取（主要路徑）=====
  let people: Array<{ name: string; title: string; linkedin?: string; source: string }> = []
  const llmPeople = await llmExtractPeople(raw, companyName, domain, companyContext, buyerContext)
  if (llmPeople.length > 0) {
    people = llmPeople
  } else {
    // 備援：正則萃取（品質差但不需要 LLM 額度）
    people = regexExtractPeople(raw, companyContext, companyName)
  }

  // 去重（同名同 title）
  const seen = new Set<string>()
  const unique = people.filter((p) => {
    const key = `${p.name}|${p.title}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) {
    return []
  }

  // 組合成 DecisionMaker
  // 先掃描原始文字（搜尋結果 + 官網文字）裡真實出現的 email — 比格式預測可靠
  const rawEmails = scanEmailsFromRaw(raw, companyContext, domain)
  const decisionMakers: DecisionMaker[] = []
  for (const person of unique.slice(0, 10)) {
    const rank = rankTitle(person.title, buyerContext)
    if (rank.priority === 99) continue  // 跳過 SDR/AE

    // 從姓名與網域預測 email 格式
    const nameParts = person.name.split(' ')
    const firstName = nameParts[0] ?? ''
    const lastName = nameParts.slice(1).join(' ') ?? ''
    const candidates = buildEmailCandidates(
      firstName,
      lastName,
      domain,
      rawEmails,
      observedEmails,
      buyerContext === 'smb'
    )

    decisionMakers.push({
      name: person.name,
      title: person.title,
      seniority: rank.seniority,
      email: candidates.email,
      emailAlternates: candidates.emailAlternates,
      linkedin: person.linkedin,
      confidence: candidates.confidence,
      email_source: candidates.source,
      verified: candidates.source === 'website',
      priority: rank.priority,
      reason: `${rank.reason}${candidates.email ? `（${candidates.source === 'website' ? '原始文字中出現' : '格式預測'}，${candidates.confidence === 'high' ? '已驗證' : '未驗證'}）` : '（未找到 email）'}`,
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

  // ===== Stage A：官網信箱探勘（免費、公司自己公布的 = verified）=====
  const mined = await mineWebsiteEmails(website)
  const usedPersonal = new Set<string>()

  let decisionMakers: DecisionMaker[] = []

  // 買方情境：官網文字推斷該公司業務類型，決定哪類職位優先
  const buyerContext = classifyBuyerContext(mined.homepageText)

  // Strategy 0: Use key_people from deep research (no API cost)
  if (existingKeyPeople && existingKeyPeople.length > 0) {
    for (const p of existingKeyPeople.slice(0, 8)) {
      const rank = rankTitle(p.title, buyerContext)
      if (rank.priority === 99) continue

      const nameParts = p.name.split(' ')
      const firstName = nameParts[0] ?? ''
      const lastName = nameParts.slice(1).join(' ') ?? ''

      // 官網挖到的個人信箱若比對得上這個人的姓名 → verified email
      const matched = mined.personal.find(
        (e) => !usedPersonal.has(e) && emailBelongsToPerson(e, firstName, lastName)
      )
      if (matched) {
        usedPersonal.add(matched)
        // 同一人其他可能信箱（其他官網信箱 + 格式預測）— ContactOut 級多候選
        const altRaw = mined.personal.filter((e) => e !== matched && emailBelongsToPerson(e, firstName, lastName))
        const altPredicted = reorderPredictionsByObservedFormat(
          predictEmailFormats(firstName, lastName, domain),
          mined.personal
        ).filter((e) => e !== matched)
        const emailAlternates = [...new Set([...altRaw, ...altPredicted])].slice(0, 5)
        decisionMakers.push({
          name: p.name,
          title: p.title,
          seniority: rank.seniority,
          email: matched,
          emailAlternates,
          linkedin: p.linkedin,
          confidence: 'high',
          email_source: 'website',
          verified: true,
          priority: rank.priority,
          reason: `${rank.reason} — email 直接取自官網（已驗證）`,
        })
        continue
      }

      const predictedEmails = reorderPredictionsByObservedFormat(
        predictEmailFormats(firstName, lastName, domain),
        mined.personal
      )
      decisionMakers.push({
        name: p.name,
        title: p.title,
        seniority: rank.seniority,
        email: predictedEmails[0],
        emailAlternates: predictedEmails.slice(1, 5),
        linkedin: p.linkedin,
        confidence: 'low',
        email_source: 'ai_predicted',
        verified: false,
        priority: rank.priority,
        reason: `${rank.reason}（格式預測，未驗證 — 建議先寄測試信）`,
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
    decisionMakers = await findPeopleWithAI({ companyName, domain, website, companyContext: mined.homepageText, observedEmails: mined.personal })
  }

  // 官網挖到、但對不上任何決策者的個人信箱 → 仍回報（verified，讓用戶自行判斷）
  for (const e of mined.personal) {
    if (usedPersonal.has(e)) continue
    if (decisionMakers.some((d) => d.email === e)) continue
    decisionMakers.push({
      name: e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      title: '（官網找到的聯絡信箱 — 人名待確認）',
      seniority: 'other',
      email: e,
      confidence: 'high',
      email_source: 'website',
      verified: true,
      priority: 4,
      reason: '信箱直接取自官網頁面（已驗證），但對應的決策者身份未知',
    })
  }

  // 排序：已驗證信箱最優先，再按優先級 1 > 2 > 3，有 email > 沒 email
  decisionMakers.sort((a, b) => {
    const aVerified = a.verified ? 0 : 1
    const bVerified = b.verified ? 0 : 1
    if (aVerified !== bVerified) return aVerified - bVerified
    if (a.priority !== b.priority) return a.priority - b.priority
    const aHasEmail = a.email ? 0 : 1
    const bHasEmail = b.email ? 0 : 1
    return aHasEmail - bHasEmail
  })

  // 取前 5 個
  const top = decisionMakers.slice(0, 5)

  // 格式推斷報告：官網信箱能看出公司命名慣例時回報
  const inferredPattern = mined.personal[0]?.includes('.')
    ? 'first.last@'
    : mined.personal.length > 0
      ? 'firstname@'
      : undefined

  return {
    success: true,
    result: {
      decisionMakers: top,
      companyEmailPattern: inferredPattern ? `${inferredPattern}${domain}` : `*@${domain}`,
      totalFound: decisionMakers.length,
      hasEmailCount: top.filter((d) => d.email).length,
      companyGenericEmails: mined.generic,
      verifiedEmailCount: top.filter((d) => d.verified).length,
    },
  }
}

