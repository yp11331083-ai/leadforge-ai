// Update EmailConfig row in Supabase:
// 1. Update chatProviderOrder to put Groq first
// 2. Add groqModel column (set to 'llama-3.1-8b-instant')
//
// NOTE: This assumes the new groqApiKey/groqModel columns have been added by
// `bunx prisma db push --accept-data-loss` during the Vercel build. If the
// columns don't exist yet, this script will fail with a clear error.
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  // First check if groqApiKey/groqModel columns exist
  const { rows: cols } = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'EmailConfig'
      AND column_name IN ('groqApiKey', 'groqModel')
  `)

  if (cols.length < 2) {
    console.log(`⚠️  Groq columns not yet added (found ${cols.length}/2).`)
    console.log('   The columns will be created automatically when Vercel runs')
    console.log('   `bunx prisma db push --accept-data-loss` during the next build.')
    console.log('')
    console.log('   Re-run this script AFTER the Vercel build completes.')
    await client.end()
    return
  }

  // Find current EmailConfig rows
  const { rows } = await client.query(`
    SELECT id, "tenantId", "chatProviderOrder", "groqModel"
    FROM "EmailConfig"
  `)
  console.log(`Found ${rows.length} EmailConfig rows.`)

  for (const r of rows) {
    const oldOrder = r.chatProviderOrder
    // If order doesn't start with 'groq', prepend it
    const newOrder = (!oldOrder || !oldOrder.startsWith('groq'))
      ? 'groq,zai,gemini,openai,anthropic'
      : oldOrder

    const newModel = r.groqModel || 'llama-3.1-8b-instant'

    await client.query(`
      UPDATE "EmailConfig"
      SET "chatProviderOrder" = $1, "groqModel" = $2
      WHERE id = $3
    `, [newOrder, newModel, r.id])

    console.log(`✓ Updated tenant ${r.tenantId}:`)
    console.log(`    chatProviderOrder: ${oldOrder} → ${newOrder}`)
    console.log(`    groqModel:         ${r.groqModel || '(null)'} → ${newModel}`)
  }

  console.log('')
  console.log('Done.')
  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
