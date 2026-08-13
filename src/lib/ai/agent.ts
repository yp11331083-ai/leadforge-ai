import ZAI from 'z-ai-web-dev-sdk'
import {
  chatWithFallback,
  searchWithFallback,
  fetchPageWithFallback,
  type ChatMessage,
  type ProviderConfig,
  type SearchResultItem,
  type PageContent,
} from './providers'

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

  const prompt = `你是 B2B 潛在客戶研究的頂級分析師（類似 Clay 平台的 Claygent）。

請根據以下資訊，深度分析「${company}」這家公司，並用**繁體中文**輸出結構化的研究報告。

公司網站：${website}

網站內容摘要：
${websiteContent.slice(0, 8000)}

${extraContext ? `額外背景資訊：${extraContext}` : ''}

請從以下五個維度分析，每個維度都要有具體洞察：

1. **核心業務**：這家公司主要做什麼？產品/服務、目標客群、商業模式
2. **徵才訊號**：他們最近有沒有在招募什麼關鍵職位？（特別關注：銷售、行銷、客戶成功、產品等成長導向職位）這暗示了什麼樣的成長痛點？
3. **核心痛點**（3-5 點，每點 1-2 句）：根據他們的業務型態與徵才動態，推測他們最可能面臨的痛點。要具體、可操作，不要講廢話。
4. **採購意圖訊號**：他們有沒有釋出任何可能在採購相關工具/服務的訊號？（例如：招募數據分析師 → 可能在強化數據基礎建設）
5. **開發切入點**：作為 B2B 業務開發，跟他們聯繫時最有共鳴的切入點是什麼？

請用以下 JSON 格式回應（不要有 markdown code block 標記，直接輸出純 JSON）：

{
  "business_summary": "一段話描述核心業務",
  "hiring_signals": ["訊號1", "訊號2"],
  "pain_points": ["痛點1", "痛點2", "痛點3"],
  "buying_signals": ["訊號1", "訊號2"],
  "outreach_angle": "建議的切入點"
}`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: '你是專業的 B2B 業務研究分析師。擅長從企業公開資訊中推導出可執行的業務開發洞察。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  }, globalProviderConfig)

  const raw = chatResult.content
  return parseResearchResult(raw)
}

function parseResearchResult(raw: string) {
  // 嘗試剝離 markdown code block
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  try {
    const parsed = JSON.parse(cleaned)
    return {
      success: true,
      data: parsed,
      raw,
    }
  } catch {
    // JSON 解析失敗，回傳原始內容
    return {
      success: false,
      data: null,
      raw,
    }
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
  fit_score: number // 0-100
  why_they_need_it: string
  suggested_angle: string
  key_signals: string[]
  confidence: 'high' | 'medium' | 'low'
  website_title?: string
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

  const prompt = `你是頂級 B2B 潛在客戶開發專家。

我經營的服務/產品如下：

**服務名稱**：${serviceName}
**詳細描述**：${description}
${targetIndustries ? `**目標產業**：${targetIndustries}` : ''}
${targetCompanySize ? `**目標公司規模**：${targetCompanySize}` : ''}
${targetLocation ? `**目標地區**：${targetLocation}` : ''}
${idealCustomerSignals ? `**理想客戶訊號**：${idealCustomerSignals}` : ''}

請幫我設計 8 組**用於 Google 搜尋的查詢詞**，目標是找出「最可能需要我服務」的企業。

查詢策略要多元，包含：
1. **徵才訊號類**：搜尋正在招募與我服務相關職位的公司（例如 "hiring sales operations manager"）
2. **融資/成長訊號類**：最近融資、擴編的公司（例如 "Series A SaaS 2024"）
3. **產業 + 痛點類**：特定產業 + 我服務解決的痛點（例如 "logistics companies manual data entry problem"）
4. **技術堆疊類**：使用特定技術堆疊的公司（例如 "companies using Salesforce looking for automation"）
5. **地區 + 產業類**：特定地區的目標產業公司
6. **規模 + 產業類**：特定規模的目標公司
7. **競爭對手客戶類**：使用競爭對手產品的公司
8. **行為訊號類**：近期發布特定內容/參加特定活動的公司

每組查詢詞要：
- 英文（Google 搜尋效果較好）
- 具體、可執行
- 包含 site: 限定或進階搜尋運算子（如 site:linkedin.com/company、site:crunchbase.com）
- 不要太寬泛（避免 "best SaaS companies"）

請輸出純 JSON 陣列（不要 markdown code block）：
["query 1", "query 2", ..., "query 8"]`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: '你是頂級 B2B 潛在客戶開發專家。回應必須是純 JSON 陣列。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
  }, globalProviderConfig)

  const raw = chatResult.content
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }
  try {
    const queries = JSON.parse(cleaned) as string[]
    return { success: true, queries, raw }
  } catch {
    return { success: false, queries: [], raw }
  }
}

/**
 * 步驟 2：從搜尋結果中萃取公司 URL（過濾掉非公司頁面）
 */
export function extractCompanyUrls(
  searchResults: Array<{ url?: string; name?: string; host_name?: string }>
): Array<{ url: string; name: string }> {
  const companies: Array<{ url: string; name: string }> = []
  const seen = new Set<string>()

  for (const r of searchResults) {
    if (!r?.url) continue
    const url = r.url

    // 排除明顯非公司頁面的 URL
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
    ]
    if (excludePatterns.some((p) => p.test(url))) continue

    try {
      const host = new URL(url).hostname.replace(/^www\./, '')

      // LinkedIn 公司頁
      if (/linkedin\.com\/company\//.test(url)) {
        const name = r.name ?? url.split('/').pop() ?? host
        const key = `li:${url}`
        if (!seen.has(key)) {
          seen.add(key)
          companies.push({ url, name })
        }
        continue
      }

      // Crunchbase 公司頁
      if (/crunchbase\.com\/organization\//.test(url)) {
        const name = r.name ?? url.split('/').pop() ?? host
        const key = `cb:${url}`
        if (!seen.has(key)) {
          seen.add(key)
          companies.push({ url, name })
        }
        continue
      }

      // Y Combinator 公司頁
      if (/ycombinator\.com\/companies\//.test(url)) {
        const name = r.name ?? url.split('/').pop() ?? host
        const key = `yc:${url}`
        if (!seen.has(key)) {
          seen.add(key)
          companies.push({ url, name })
        }
        continue
      }

      // 一般公司官網首頁（不是子頁面）
      // 只接受根目錄或主頁
      const path = new URL(url).pathname
      const isRootOrMain = path === '/' || path === '' || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)

      // 排除常見非公司網域
      const nonCompanyDomains = [
        'store.sony.com.tw', 'scale.com',
      ]
      if (nonCompanyDomains.includes(host)) continue

      // 看起來像公司官網首頁
      if (isRootOrMain && !/\.gov|\.edu|\.mil/i.test(host)) {
        const key = `web:${host}`
        if (!seen.has(key)) {
          seen.add(key)
          companies.push({ url, name: r.name ?? host })
        }
      }
    } catch {
      continue
    }
  }

  return companies
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
}): Promise<{
  success: boolean
  data: ProspectCandidate | null
  raw: string
}> {
  const zai = await getAI().catch(() => null as any)
  const { serviceName, description, keyBenefits, idealCustomerSignals, companyUrl, companyName, websiteContent } = params

  const prompt = `你是頂級 B2B 業務分析師，擅長判斷一家公司是否需要某個服務。

## 我的服務

**服務名稱**：${serviceName}
**服務描述**：${description}
${keyBenefits ? `**核心價值**：${keyBenefits}` : ''}
${idealCustomerSignals ? `**理想客戶訊號**：${idealCustomerSignals}` : ''}

## 候選公司

**公司名稱**：${companyName}
**公司網站**：${companyUrl}

**網站內容**：
${websiteContent.slice(0, 5000)}

## 任務

請評估這家公司是否需要我的服務。從以下維度判斷：

1. **業務型態契合度**：他們做的事是否會用到我的服務？
2. **規模契合度**：他們的規模是否符合我的目標客戶？
3. **訊號強度**：網站/徵才/產品訊息是否暗示他們有我服務能解決的痛點？
4. **採購能力**：他們看起來有預算採購嗎？
5. **接觸可能性**：是否有公開聯絡資訊？

## 輸出格式

請輸出純 JSON（不要 markdown）：

{
  "company": "${companyName}",
  "website": "${companyUrl}",
  "industry": "推斷的產業",
  "fit_score": 75,  // 0-100，整數
  "why_they_need_it": "2-3 句具體說明為什麼他們需要我的服務，要點出他們的具體痛點與我的服務如何對應",
  "suggested_angle": "建議的開發切入點（1 句）",
  "key_signals": ["訊號1", "訊號2", "訊號3"],
  "confidence": "high"  // high / medium / low
}

注意：
- fit_score 要客觀，不要全部都給 80+。真的不適合就給低分。
- why_they_need_it 要具體，不要寫「他們可能需要自動化」這種廢話。
- 如果查不到足夠資訊判斷，confidence 給 low，fit_score 給 30 以下。
- 行業別用中文，例如 "SaaS 軟體"、"電商"、"製造業"。`

  const chatResult = await chatWithFallback({
    messages: [
      {
        role: 'system',
        content: '你是頂級 B2B 業務分析師。你客觀評估公司契合度，不會盲目給高分。回應必須是純 JSON 格式。',
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
 * 主函式：自動開發潛在客戶
 * 1. AI 生成搜尋查詢詞
 * 2. web_search 找候選公司
 * 3. 萃取公司 URL
 * 4. page_reader 抓每家公司網站
 * 5. AI 評估契合度
 * 6. 依分數排序回傳 top N
 */
export async function autoProspect(params: {
  serviceName: string
  description: string
  targetIndustries?: string
  targetCompanySize?: string
  targetLocation?: string
  keyBenefits?: string
  idealCustomerSignals?: string
  targetCount?: number // 預設 10
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
    onProgress,
  } = params

  // 步驟 1：AI 生成搜尋查詢詞
  onProgress?.('生成搜尋策略', 'AI 正在設計精準搜尋查詢...')
  const queryResult = await generateSearchQueries({
    serviceName,
    description,
    targetIndustries,
    targetCompanySize,
    targetLocation,
    idealCustomerSignals,
  })

  if (!queryResult.success || queryResult.queries.length === 0) {
    return { success: false, result: null, error: 'AI 無法生成搜尋策略' }
  }

  onProgress?.('搜尋候選公司', `使用 ${queryResult.queries.length} 組查詢詞搜尋...`)

  // 步驟 2：循序執行 web_search（避免 429）
  const allSearchResults: Array<{ url?: string; name?: string; host_name?: string }> = []
  for (const q of queryResult.queries) {
    try {
      const results = await searchCompanies(q, 5)
      allSearchResults.push(...results)
      onProgress?.('搜尋候選公司', `已搜尋 ${allSearchResults.length} 個結果...`)
    } catch (e) {
      console.error(`search failed for "${q}":`, e)
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  // 步驟 3：萃取公司 URL
  const candidates = extractCompanyUrls(allSearchResults)
  onProgress?.('篩選候選公司', `從 ${allSearchResults.length} 個結果中萃取出 ${candidates.length} 家公司`)

  if (candidates.length === 0) {
    return {
      success: false,
      result: null,
      error: '搜尋結果中找不到符合的公司網址，請調整服務描述再試一次',
    }
  }

  // 取前 N*2 家做評估（確保最終能篩出 N 家）
  const toEvaluate = candidates.slice(0, Math.max(targetCount * 2, 15))
  onProgress?.('AI 分析契合度', `正在評估 ${toEvaluate.length} 家候選公司...`)

  // 步驟 4 + 5：循序抓網站 + AI 評估
  const evaluated: ProspectCandidate[] = []
  for (let i = 0; i < toEvaluate.length; i++) {
    const c = toEvaluate[i]
    onProgress?.('AI 分析契合度', `(${i + 1}/${toEvaluate.length}) ${c.name}`)

    try {
      // 抓網站內容
      const websiteData = await fetchWebsiteContent(c.url)
      const websiteText = websiteData ? htmlToText(websiteData.html).slice(0, 6000) : ''

      // AI 評估契合度
      const fitResult = await evaluateProspectFit({
        serviceName,
        description,
        keyBenefits,
        idealCustomerSignals,
        companyUrl: c.url,
        companyName: c.name,
        websiteContent: websiteText || `(無法抓取網站內容，僅依 URL 判斷：${c.url})`,
      })

      if (fitResult.success && fitResult.data) {
        evaluated.push({
          ...fitResult.data,
          website_title: websiteData?.title,
        })
      }
    } catch (e) {
      console.error(`evaluate ${c.name} failed:`, e)
    }

    // 小延遲
    await new Promise((r) => setTimeout(r, 200))

    // 已經收集到足夠的高分候選就停止
    const highConfCount = evaluated.filter((e) => e.fit_score >= 60).length
    if (highConfCount >= targetCount && i >= targetCount) break
  }

  // 步驟 6：依 fit_score 排序，取 top N
  evaluated.sort((a, b) => b.fit_score - a.fit_score)
  const top = evaluated.slice(0, targetCount)

  onProgress?.('完成', `已篩選出 ${top.length} 家最契合的潛在客戶`)

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

