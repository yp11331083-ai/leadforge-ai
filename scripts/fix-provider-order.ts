// Check and fix the chatProviderOrder in DB
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT "chatProviderOrder", "groqModel", "groqApiKey"
    FROM "EmailConfig"
  `)

  console.log('=== Current DB state ===')
  for (const r of rows) {
    console.log('  chatProviderOrder:', r.chatProviderOrder)
    console.log('  groqModel:', r.groqModel)
    console.log('  groqApiKey set:', !!r.groqApiKey)
    console.log('')
  }

  // Fix: set chatProviderOrder to 'groq,gemini,openai,anthropic' (NO zai — zai doesn't work on Vercel)
  await client.query(`
    UPDATE "EmailConfig"
    SET "chatProviderOrder" = 'groq,gemini,openai,anthropic'
    WHERE "chatProviderOrder" IS NULL
       OR "chatProviderOrder" = ''
       OR "chatProviderOrder" LIKE '%zai%'
       OR "chatProviderOrder" != 'groq,gemini,openai,anthropic'
  `)

  console.log('✓ Fixed: removed Z.ai from chatProviderOrder')
  console.log('  Z.ai requires a .z-ai-config file which does not exist on Vercel.')
  console.log('  Now using: groq → gemini → openai → anthropic')

  // Also fix search and page reader orders — remove zai
  await client.query(`
    UPDATE "EmailConfig"
    SET "searchProviderOrder" = 'tavily'
    WHERE "searchProviderOrder" IS NULL OR "searchProviderOrder" LIKE '%zai%'
  `)
  await client.query(`
    UPDATE "EmailConfig"
    SET "pageReaderProviderOrder" = 'jina'
    WHERE "pageReaderProviderOrder" IS NULL OR "pageReaderProviderOrder" LIKE '%zai%'
  `)
  console.log('✓ Fixed search and page reader orders (removed Z.ai)')

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
