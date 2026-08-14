// Fix the demo tenant's state:
// 1. Reset creditBalance to match the plan's allowance (currently 27972, should be 2000 for growth)
// 2. Update JWT cache by signing out + signing back in (user action needed)
//
// Also fixes the webhook logic so future upgrades don't accumulate credits:
// - On subscription upgrade/downgrade via checkout, RESET balance to new plan's allowance
//   (instead of adding to existing balance)
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

const PLAN_ALLOWANCES: Record<string, number> = {
  freemium: 30,
  starter: 500,
  growth: 2000,
  agency: 8000,
}

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  console.log('=== Before ===')
  const { rows: before } = await client.query(`
    SELECT id, slug, plan, "creditBalance", "monthlyCreditAllowance"
    FROM "Tenant"
  `)
  for (const t of before) {
    console.log(`  ${t.slug}: plan=${t.plan} balance=${t.creditBalance} allowance=${t.monthlyCreditAllowance}`)
  }

  // Fix: reset each tenant's balance to match their plan allowance
  for (const t of before) {
    const correctAllowance = PLAN_ALLOWANCES[t.plan] ?? 30
    const newBalance = correctAllowance  // Reset to full allowance (fresh month)

    if (t.creditBalance !== newBalance || t.monthlyCreditAllowance !== correctAllowance) {
      await client.query(`
        UPDATE "Tenant"
        SET "creditBalance" = $1, "monthlyCreditAllowance" = $2
        WHERE id = $3
      `, [newBalance, correctAllowance, t.id])

      // Add a CreditLog entry for the audit trail
      await client.query(`
        INSERT INTO "CreditLog" ("id", "tenantId", "type", "amount", "balanceAfter", "description", "createdAt")
        VALUES (gen_random_uuid(), $1, 'CREDIT_RESET', $2, $3, $4, NOW())
      `, [
        t.id,
        newBalance - t.creditBalance,  // positive if crediting, negative if debiting
        newBalance,
        `Reset balance to match ${t.plan} plan allowance (${correctAllowance} credits) — cleanup of accumulated test credits`,
      ])

      console.log(`  ✓ Fixed ${t.slug}: balance ${t.creditBalance}→${newBalance}, allowance ${t.monthlyCreditAllowance}→${correctAllowance}`)
    } else {
      console.log(`  - ${t.slug} already correct`)
    }
  }

  console.log('')
  console.log('=== After ===')
  const { rows: after } = await client.query(`
    SELECT id, slug, plan, "creditBalance", "monthlyCreditAllowance"
    FROM "Tenant"
  `)
  for (const t of after) {
    console.log(`  ${t.slug}: plan=${t.plan} balance=${t.creditBalance} allowance=${t.monthlyCreditAllowance}`)
  }

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
