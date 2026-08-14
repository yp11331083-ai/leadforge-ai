// Update EmailConfig rows in Supabase directly via pg
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  console.log('Connecting to Supabase...')
  await client.connect()
  console.log('Connected.')

  // Find all EmailConfig rows
  const { rows } = await client.query(`
    SELECT id, "tenantId", "chatProviderOrder", "geminiModel"
    FROM "EmailConfig"
  `)
  console.log(`Found ${rows.length} EmailConfig rows:`)
  for (const r of rows) {
    console.log(`  - tenantId=${r.tenantId} chatProviderOrder=${r.chatProviderOrder} geminiModel=${r.geminiModel}`)
  }
  console.log('')

  // Update each one
  for (const r of rows) {
    const oldOrder = r.chatProviderOrder
    const oldModel = r.geminiModel

    // Only update if it's the old default OR null
    const newOrder = (!oldOrder || oldOrder === 'zai,openai,anthropic,gemini')
      ? 'zai,gemini,openai,anthropic'
      : oldOrder

    // Only update gemini model if it's an old/deprecated default OR null
    const deprecatedModels = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-001', 'gemini-1.5-flash']
    const newModel = (!oldModel || deprecatedModels.includes(oldModel))
      ? 'gemini-2.5-flash'
      : oldModel

    if (newOrder !== oldOrder || newModel !== oldModel) {
      await client.query(`
        UPDATE "EmailConfig"
        SET "chatProviderOrder" = $1, "geminiModel" = $2
        WHERE id = $3
      `, [newOrder, newModel, r.id])
      console.log(`✓ Updated tenantId=${r.tenantId}:`)
      console.log(`    chatProviderOrder: ${oldOrder} → ${newOrder}`)
      console.log(`    geminiModel:       ${oldModel} → ${newModel}`)
    } else {
      console.log(`- Skipped tenantId=${r.tenantId} (already up to date)`)
    }
  }

  console.log('')
  console.log('Done.')
  await client.end()
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
