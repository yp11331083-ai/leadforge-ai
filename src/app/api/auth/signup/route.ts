import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, companyName } = await req.json()

    if (!email?.trim() || !password?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'aol.com', 'icloud.com']
    const emailDomain = email.split('@')[1]?.toLowerCase()
    if (!emailDomain || freeDomains.includes(emailDomain)) {
      return NextResponse.json({ error: 'Please use your work email. Free email providers are not allowed.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const slug = companyName
      ? companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
      : emailDomain.replace(/\./g, '-') + '-' + Math.random().toString(36).slice(2, 6)

    const tenant = await db.tenant.create({
      data: { name: companyName || `${name}'s Workspace`, slug, plan: 'freemium', status: 'active' },
    })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await db.user.create({
      data: { email: normalizedEmail, name: name.trim(), passwordHash, role: 'admin', tenantId: tenant.id },
    })

    await db.emailConfig.create({ data: { tenantId: tenant.id } })
    await db.serviceOffering.create({ data: { tenantId: tenant.id } })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: { email: user.email, name: user.name },
      tenant: { name: tenant.name, plan: tenant.plan },
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error.message ?? 'Signup failed' }, { status: 500 })
  }
}
