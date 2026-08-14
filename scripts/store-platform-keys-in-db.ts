import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  // Store the platform API keys directly in the DB so they're always available
  // (the code does config?.groqApiKey ?? process.env.GROQ_API_KEY — if both are
  // missing, the provider fails. Storing in DB ensures it always works.)
  await client.query(`
    UPDATE "EmailConfig"
    SET
      "groqApiKey" = $1,
      "groqModel" = 'llama-3.1-8b-instant',
      "chatProviderOrder" = 'groq,gemini,openai,anthropic',
      "geminiApiKey" = $2,
      "geminiModel" = 'gemini-2.5-flash',
      "tavilyApiKey" = $3,
      "searchProviderOrder" = 'tavily',
      "jinaApiKey" = $4,
      "pageReaderProviderOrder" = 'jina'
  `, [
    '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',
    'AQ.Ab8RN6LgyOkf8W0FjGSH2UkAVhYZai3V8taC312WegqCLvoALw',
    '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',
    'jina_b1d00230734a4e4b9d6fdc03ea4c7614v5fYdahQNZjvtzm6nWq3Wkor8_6I',
  ])

  // Verify
  const { rows } = await client.query(`
    SELECT "groqApiKey" IS NOT NULL as has_groq,
           "geminiApiKey" IS NOT NULL as has_gemini,
           "tavilyApiKey" IS NOT NULL as has_tavily,
           "jinaApiKey" IS NOT NULL as has_jina,
           "chatProviderOrder", "groqModel"
    FROM "EmailConfig"
  `)
  for (const r of rows) {
    console.log('groqApiKey:', r.has_groq ? 'SET ✓' : 'NULL ✗')
    console.log('geminiApiKey:', r.has_gemini ? 'SET ✓' : 'NULL ✗')
    console.log('tavilyApiKey:', r.has_tavily ? 'SET ✓' : 'NULL ✗')
    console.log('jinaApiKey:', r.has_jina ? 'SET ✓' : 'NULL ✗')
    console.log('chatProviderOrder:', r.chatproviderorder)
    console.log('groqModel:', r.groqmodel)
  }

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
