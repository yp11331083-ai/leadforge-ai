import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: ZAI | null = null

export async function getAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

/**
 * 使用 page_reader 抓取網站內容，作為「Claygent」研究引擎
 */
export async function fetchWebsiteContent(url: string) {
  const zai = await getAI()
  try {
    const result = await zai.functions.invoke('page_reader', { url })
    return {
      title: result.data?.title ?? '',
      html: result.data?.html ?? '',
      url: result.data?.url ?? url,
      publishedTime: result.data?.publishedTime,
    }
  } catch (error) {
    console.error('fetchWebsiteContent error:', error)
    return null
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
  const zai = await getAI()
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

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: '你是專業的 B2B 業務研究分析師。擅長從企業公開資訊中推導出可執行的業務開發洞察。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.4,
  })

  const raw = completion.choices?.[0]?.message?.content ?? ''
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
  const zai = await getAI()
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

  const prompt = `你是頂級 B2B 冷郵件寫手，擅長根據深入的研究洞察撰寫高回覆率的個人化郵件。

## 收件人資訊
- 公司：${company}
- 聯絡人：${contactName || '（未知姓名，用通用稱呼）'}
- 職稱：${title || '（未知）'}
- 產業：${industry || '（未知）'}

## 研究洞察
- 核心業務：${businessSummary || '無'}
- 徵才訊號：${hiringSignals.join('、') || '無'}
- 核心痛點：${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n') || '無'}
- 採購訊號：${buyingSignals.join('、') || '無'}
- 建議切入點：${outreachAngle || '無'}

## 寄件人資訊
- 寄件人：${senderName}，${senderCompany}
- 產品/服務：${senderProduct}

## 撰寫要求
- ${langInstruction}
- 語氣風格：${toneMap[tone]}
- 郵件結構：
  1. **主旨**：50 字以內，引起好奇但不標題黨
  2. **開場白（Icebreaker）**：1-2 句，展現你對他們公司的具體理解（不要用「Hope you're well」這種爛開頭）
  3. **價值主張**：根據痛點，說明你的產品能如何幫助他們（要具體，不要空話）
  4. **社會證明**（可選）：簡短提及類似公司的成果
  5. **行動呼籲**：低摩擦的下一步（例如「週二下午 15 分鐘聊聊？」而非「請回信讓我演示」）
- 禁止事項：
  - 不要用「Dear」「Hi there」「Hope this email finds you well」
  - 不要超過 150 字（中文）/ 100 字（英文）
  - 不要用感嘆號過多
  - 不要承諾具體數字除非有依據

請用以下 JSON 格式回應（直接輸出純 JSON，不要 markdown）：
{
  "subject": "郵件主旨",
  "icebreaker": "開場白 1-2 句",
  "body": "完整郵件內容（不含主旨）",
  "cta": "行動呼籲一句話"
}`

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          '你是專業的 B2B 冷郵件寫手。你的郵件回覆率業界頂尖。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  })

  const raw = completion.choices?.[0]?.message?.content ?? ''
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

/**
 * 透過 web_search 搜尋潛在客戶公司
 */
export async function searchCompanies(query: string, num: number = 10) {
  const zai = await getAI()
  try {
    const results = await zai.functions.invoke('web_search', {
      query,
      num,
    })
    return results
  } catch (error) {
    console.error('searchCompanies error:', error)
    return []
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
  const zai = await getAI()
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

  const completion = await zai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          '你是頂級 B2B 商業情報分析師。你擅長從 LinkedIn、Crunchbase、徵才頁面、新聞等多源資料中拼湊出企業全貌。回應必須是純 JSON 格式。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  })

  const raw = completion.choices?.[0]?.message?.content ?? ''
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
