// Fix the demo tenant's plan from 'pro' to 'growth' so the billing panel
// shows the right plan card. 'pro' was an old alias that's no longer in PLANS.
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  const { rows } = await client.query(`
    SELECT id, slug, plan, "creditBalance", "monthlyCreditAllowance"
    FROM "Tenant"
  `)
  console.log(`Found ${rows.length} tenants.`)

  for (const t of rows) {
    console.log(`  - ${t.slug}: plan=${t.plan} balance=${t.creditBalance} allowance=${t.monthlyCreditAllowance}`)

    // Map legacy plan names to canonical ones
    const planMap: Record<string, string> = {
      pro: 'growth',
      trial: 'freemium',
      enterprise: 'agency',
    }
    const newPlan = planMap[t.plan] ?? t.plan

    // Also update allowance to match new pricing
    const newAllowance: Record<string, number> = {
      freemium: 30,
      starter: 500,
      growth: 2000,
      agency: 8000,
    }
    const newAllowanceValue = newAllowance[newPlan] ?? 30

    if (newPlan !== t.plan || t.monthlyCreditAllowance !== newAllowanceValue) {
      await client.query(`
        UPDATE "Tenant"
        SET plan = $1, "monthlyCreditAllowance" = $2
        WHERE id = $3
      `, [newPlan, newAllowanceValue, t.id])
      console.log(`    ✓ Updated: plan=${t.plan}→${newPlan}, allowance=${t.monthlyCreditAllowance}→${newAllowanceValue}`)
    } else {
      console.log(`    - Already correct`)
    }
  }

  console.log('')
  console.log('Done.')
  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
