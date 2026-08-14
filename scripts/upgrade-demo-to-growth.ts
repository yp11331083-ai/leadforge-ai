// Manually upgrade the demo tenant to Growth plan + grant 2000 credits.
// Useful for testing — bypasses Stripe Checkout.
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT id, slug, plan, "creditBalance", "monthlyCreditAllowance"
    FROM "Tenant"
    ORDER BY slug
  `)
  console.log(`Found ${rows.length} tenants.`)

  for (const t of rows) {
    console.log(`\n  Tenant: ${t.slug}`)
    console.log(`    Before: plan=${t.plan} balance=${t.creditBalance} allowance=${t.monthlyCreditAllowance}`)

    // Upgrade to Growth: 2000 credits, $149/mo plan
    const newPlan = 'growth'
    const newAllowance = 2000
    const newBalance = 2000  // reset to full allowance (or could top-up)

    await client.query(`
      UPDATE "Tenant"
      SET plan = $1, "monthlyCreditAllowance" = $2, "creditBalance" = $3,
          status = 'active',
          "billingCycleResetDate" = NOW() + INTERVAL '30 days'
      WHERE id = $4
    `, [newPlan, newAllowance, newBalance, t.id])

    // Add a CreditLog entry so the audit trail is clean
    await client.query(`
      INSERT INTO "CreditLog" ("id", "tenantId", "type", "amount", "balanceAfter", "description", "createdAt")
      VALUES (gen_random_uuid(), $1, 'CREDIT_RESET', $2, $3, $4, NOW())
    `, [t.id, newBalance, newBalance, `Manual upgrade to ${newPlan} plan (2000 credits)`])

    console.log(`    After:  plan=${newPlan} balance=${newBalance} allowance=${newAllowance}`)
  }

  console.log('\nDone.')
  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
