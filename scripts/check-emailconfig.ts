// Check all provider-related fields in EmailConfig
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT id, "tenantId",
           "tavilyApiKey",
           "jinaApiKey",
           "geminiApiKey",
           "geminiModel",
           "chatProviderOrder",
           "searchProviderOrder",
           "pageReaderProviderOrder"
    FROM "EmailConfig"
  `)

  console.log(`Found ${rows.length} EmailConfig rows:\n`)
  for (const r of rows) {
    console.log(`Tenant: ${r.tenantId}`)
    console.log(`  tavilyApiKey:           ${r.tavilyApiKey ? `"${r.tavilyApiKey.slice(0,15)}..." (len=${r.tavilyApiKey.length})` : 'NULL (will use platform env var)'}`)
    console.log(`  jinaApiKey:             ${r.jinaApiKey ? `"${r.jinaApiKey.slice(0,15)}..." (len=${r.jinaApiKey.length})` : 'NULL (will use platform env var)'}`)
    console.log(`  geminiApiKey:           ${r.geminiApiKey ? `"${r.geminiApiKey.slice(0,15)}..." (len=${r.geminiApiKey.length})` : 'NULL (will use platform env var)'}`)
    console.log(`  geminiModel:            ${r.geminiModel || 'NULL'}`)
    console.log(`  chatProviderOrder:      ${r.chatProviderOrder}`)
    console.log(`  searchProviderOrder:    ${r.searchProviderOrder}`)
    console.log(`  pageReaderProviderOrder: ${r.pageReaderProviderOrder}`)
    console.log('')
  }

  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
