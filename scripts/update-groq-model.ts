// Update EmailConfig to use the lighter Groq model (higher rate limits)
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  // Update groqModel to the lighter 8B model (higher rate limits: 500K TPD vs 100K TPD)
  await client.query(`
    UPDATE "EmailConfig"
    SET "groqModel" = 'llama-3.1-8b-instant'
    WHERE "groqModel" = 'llama-3.3-70b-versatile' OR "groqModel" IS NULL
  `)

  console.log('✓ Updated groqModel to llama-3.1-8b-instant (lighter, higher rate limit)')
  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
