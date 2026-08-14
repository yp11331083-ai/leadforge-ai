// Check current tenant state — why does it show Agency plan but only 2000 credits?
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  console.log('=== Current tenant state ===')
  const { rows: tenants } = await client.query(`
    SELECT id, slug, plan, "creditBalance", "monthlyCreditAllowance",
           "stripeCustomerId", "stripeSubscriptionId", "stripePriceId",
           status, "billingCycleResetDate"
    FROM "Tenant"
  `)
  for (const t of tenants) {
    console.log(`  Tenant: ${t.slug}`)
    console.log(`    plan:                   ${t.plan}`)
    console.log(`    creditBalance:          ${t.creditBalance}`)
    console.log(`    monthlyCreditAllowance: ${t.monthlyCreditAllowance}`)
    console.log(`    stripeCustomerId:       ${t.stripeCustomerId ?? '(null)'}`)
    console.log(`    stripeSubscriptionId:   ${t.stripeSubscriptionId ?? '(null)'}`)
    console.log(`    stripePriceId:          ${t.stripePriceId ?? '(null)'}`)
    console.log(`    status:                 ${t.status}`)
    console.log(`    billingCycleResetDate:  ${t.billingCycleResetDate ?? '(null)'}`)
  }

  console.log('')
  console.log('=== Recent CreditLog entries (last 20) ===')
  const { rows: logs } = await client.query(`
    SELECT "tenantId", type, amount, "balanceAfter", description, "createdAt"
    FROM "CreditLog"
    ORDER BY "createdAt" DESC
    LIMIT 20
  `)
  for (const l of logs) {
    console.log(`  ${l.createdAt.toISOString()} | ${l.type} | ${l.amount} | balance=${l.balanceAfter} | ${l.description.slice(0, 80)}`)
  }

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
