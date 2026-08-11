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
