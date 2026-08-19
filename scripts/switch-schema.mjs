#!/usr/bin/env node
// Cross-platform schema switcher: copies the requested Prisma schema over
// schema.prisma so `prisma generate` produces the right client.
//   node scripts/switch-schema.mjs sqlite|postgres
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const target = process.argv[2]
if (target !== 'sqlite' && target !== 'postgres') {
  console.error('Usage: node scripts/switch-schema.mjs sqlite|postgres')
  process.exit(1)
}

const src = resolve('prisma', `schema.${target}.prisma`)
const dst = resolve('prisma', 'schema.prisma')
if (!existsSync(src)) {
  console.error(`Schema not found: ${src}`)
  process.exit(1)
}
copyFileSync(src, dst)
console.log(`✓ Prisma schema switched to ${target} (schema.prisma)`)