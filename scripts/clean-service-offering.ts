// Clean Chinese text from DB service offering + clear stale data
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  // Check current values
  const { rows: before } = await client.query(`
    SELECT "serviceName", "description", "targetIndustries", "targetCompanySize",
           "targetLocation", "keyBenefits", "idealCustomerSignals"
    FROM "ServiceOffering"
  `)
  console.log('=== Before ===')
  for (const r of before) {
    console.log('  serviceName:', r.servicename)
    console.log('  description:', (r.description || '').slice(0, 80))
    console.log('  targetIndustries:', r.targetindustries)
    console.log('  targetCompanySize:', r.targetcompanysize)
    console.log('  targetLocation:', r.targetlocation)
    console.log('  keyBenefits:', r.keybenefits)
    console.log('  idealCustomerSignals:', r.idealcustomersignals)
    console.log('')
  }

  // Clear all Chinese-containing fields — set to NULL so the form shows empty
  // (placeholders will show in English)
  await client.query(`
    UPDATE "ServiceOffering"
    SET
      "keyBenefits" = NULL,
      "idealCustomerSignals" = NULL,
      "targetIndustries" = NULL,
      "targetCompanySize" = NULL,
      "targetLocation" = NULL
    WHERE
      "keyBenefits" LIKE '%省%' OR
      "keyBenefits" LIKE '%業務%' OR
      "keyBenefits" LIKE '%提升%' OR
      "idealCustomerSignals" LIKE '%招募%' OR
      "idealCustomerSignals" LIKE '%融資%' OR
      "targetIndustries" LIKE '%SaaS%' OR
      "targetLocation" LIKE '%台%'
  `)

  // Also clear the serviceName and description if they contain Chinese
  await client.query(`
    UPDATE "ServiceOffering"
    SET "serviceName" = NULL, "description" = NULL
    WHERE "serviceName" = 'sgi' OR "description" LIKE '%sgi%'
  `)

  console.log('✓ Cleared all Chinese/stale values from ServiceOffering')
  console.log('  Form will now show empty fields with English placeholders')

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
