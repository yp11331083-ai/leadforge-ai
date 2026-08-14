import { Client } from 'pg'

async function main() {
  const client = new Client({ connectionString: 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres' })
  await client.connect()

  // Get all columns from EmailConfig
  const { rows } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'EmailConfig'
    ORDER BY ordinal_position
  `)
  console.log('=== EmailConfig columns ===')
  for (const r of rows) {
    console.log('  ', r.column_name)
  }

  // Get actual data
  const { rows: data } = await client.query('SELECT * FROM "EmailConfig" LIMIT 1')
  if (data.length > 0) {
    const row = data[0]
    console.log('\n=== Data ===')
    console.log('chatProviderOrder:', row.chatProviderOrder)
    console.log('groqModel:', row.groqModel)
    console.log('groqApiKey:', row.groqApiKey ? 'SET (len=' + row.groqApiKey.length + ')' : 'NULL')
    console.log('geminiApiKey:', row.geminiApiKey ? 'SET' : 'NULL')
    console.log('tavilyApiKey:', row.tavilyApiKey ? 'SET' : 'NULL')
    console.log('jinaApiKey:', row.jinaApiKey ? 'SET' : 'NULL')
    console.log('searchProviderOrder:', row.searchProviderOrder)
    console.log('pageReaderProviderOrder:', row.pageReaderProviderOrder)
  }

  await client.end()
}
main().catch(console.error)
