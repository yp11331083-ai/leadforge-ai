// Generate 10 pre-cached demo results and save as static JSON.
// Run once, commit the output, then landing page rotates through these
// without any live API calls (no rate limit possible).
const fs = require('fs')
const path = require('path')

const DEMO_PRODUCTS = [
  'AI-powered CRM for real estate agents',
  'Automated invoicing tool for freelancers',
  'Cybersecurity compliance platform for fintech startups',
  'AI sales coaching software for SDR teams',
  'Automated job posting distribution tool for recruiters',
  'AI-powered content generation for marketing agencies',
  'Cloud cost optimization platform for AWS users',
  'Automated employee onboarding software for HR teams',
  'AI-powered customer support chatbot for e-commerce',
  'Automated social media scheduling tool for small businesses',
]

async function generateOne(product) {
  const prompt = [
    'You are a B2B sales research AI. A founder describes their product below.',
    'Generate a SAMPLE prospect analysis as if you found a real company that needs this product.',
    '',
    'Product description: ' + product,
    '',
    'Pick a REAL, well-known company that would plausibly need this product.',
    'Do NOT pick the founder\'s own company — pick a potential CUSTOMER.',
    '',
    'Respond in pure JSON (no markdown):',
    '{',
    '  "company": "Real Company Name",',
    '  "website": "real-website.com",',
    '  "industry": "Industry",',
    '  "fit_score": 85,',
    '  "pain_point": "One specific pain point this company has that the product solves",',
    '  "email_hook": "A personalized 1-sentence email opener that references something specific about this company",',
    '  "why_they_need_it": "One sentence explaining why they need this product"',
    '}',
    '',
    'The email_hook must be specific to the company (not generic).',
    'Respond in English.',
  ].join('\n')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a B2B sales research AI. Respond in pure JSON. Be specific and realistic.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error('Groq ' + res.status + ': ' + text.slice(0, 200))
  }

  const data = await res.json()
  let content = data.choices?.[0]?.message?.content ?? ''
  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    return {
      company: 'Sample Company',
      website: 'example.com',
      industry: 'Technology',
      fit_score: 75,
      pain_point: 'Unable to parse AI response',
      email_hook: 'Error generating hook',
      why_they_need_it: 'Please try again',
    }
  }
}

async function main() {
  require('dotenv').config()
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY not set')
    process.exit(1)
  }

  const results = []
  for (let i = 0; i < DEMO_PRODUCTS.length; i++) {
    const product = DEMO_PRODUCTS[i]
    console.log('Generating ' + (i + 1) + '/' + DEMO_PRODUCTS.length + ': ' + product)
    try {
      const result = await generateOne(product)
      results.push({ product, result })
      console.log('  → ' + result.company + ' (fit: ' + result.fit_score + ')')
    } catch (e) {
      console.error('  ✗ Failed:', e.message)
      results.push({
        product,
        result: {
          company: 'Sample Company',
          website: 'example.com',
          industry: 'Technology',
          fit_score: 70,
          pain_point: 'Manual research takes too long',
          email_hook: 'I noticed your team is growing fast.',
          why_they_need_it: 'This product saves research time.',
        }
      })
    }
    // Rate limit: wait 2s between calls
    await new Promise(r => setTimeout(r, 2000))
  }

  const outputPath = path.join(__dirname, '..', 'src', 'components', 'landing', 'demo-data.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log('')
  console.log('✓ Saved ' + results.length + ' demo results to:')
  console.log('  ' + outputPath)
}

main().catch(e => { console.error(e); process.exit(1) })
