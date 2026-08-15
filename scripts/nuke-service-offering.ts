// NUKE all service offering data — completely clear the row
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  // Check before
  const { rows: before } = await client.query('SELECT * FROM "ServiceOffering"')
  console.log('=== BEFORE ===')
  console.log(JSON.stringify(before[0], null, 2))

  // NUKE everything to NULL
  await client.query(`
    UPDATE "ServiceOffering"
    SET
      "serviceName" = NULL,
      "description" = NULL,
      "targetIndustries" = NULL,
      "targetCompanySize" = NULL,
      "targetLocation" = NULL,
      "keyBenefits" = NULL,
      "idealCustomerSignals" = NULL
  `)

  // Check after
  const { rows: after } = await client.query('SELECT * FROM "ServiceOffering"')
  console.log('\n=== AFTER ===')
  console.log(JSON.stringify(after[0], null, 2))

  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
