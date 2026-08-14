// Migration: rename all @forge.ai emails to @outrovo.com in Supabase DB
// Also clears any sessions (NextAuth uses JWT, so users will need to re-login)
import { Client } from 'pg'

const connectionString = 'postgresql://postgres.iysgbuwftibckbieafke:XpVv4SSJSA6lQwGN@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  console.log('=== Before ===')
  const { rows: before } = await client.query(`
    SELECT id, email, name, role, "tenantId"
    FROM "User"
    ORDER BY email
  `)
  for (const u of before) {
    console.log(`  ${u.email}  (${u.role})  tenant=${u.tenantId}`)
  }

  // Rename all @forge.ai → @outrovo.com
  const { rowCount } = await client.query(`
    UPDATE "User"
    SET email = REPLACE(email, '@forge.ai', '@outrovo.com')
    WHERE email LIKE '%@forge.ai'
  `)
  console.log(`\n✓ Renamed ${rowCount} user email(s) from @forge.ai → @outrovo.com`)

  console.log('\n=== After ===')
  const { rows: after } = await client.query(`
    SELECT id, email, name, role, "tenantId"
    FROM "User"
    ORDER BY email
  `)
  for (const u of after) {
    console.log(`  ${u.email}  (${u.role})  tenant=${u.tenantId}`)
  }

  // Note: NextAuth uses JWT strategy, so sessions are stored client-side in cookies.
  // There's no server-side session table to clear. The user's existing JWT will still
  // work (it contains the user ID, not the email), but the email field will be stale
  // until they re-login. The 5-minute JWT refresh we added in auth-options.ts will
  // pick up the new email on the next request after the refresh interval.

  console.log('\n=== Session note ===')
  console.log('NextAuth uses JWT strategy — sessions are stored in client-side cookies.')
  console.log('The user\'s current JWT still contains the old email.')
  console.log('Two options:')
  console.log('  1. Wait 5 minutes — JWT auto-refresh will pick up the new email')
  console.log('  2. Sign out + sign back in — gets a fresh JWT immediately')
  console.log('')

  await client.end()
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1) })
