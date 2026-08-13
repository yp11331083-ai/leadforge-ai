import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { tenant: true },
        })

        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          tenantSlug: user.tenant.slug,
          tenantPlan: user.tenant.plan,
        } as any
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.tenantId = (user as any).tenantId
        token.tenantName = (user as any).tenantName
        token.tenantSlug = (user as any).tenantSlug
        token.tenantPlan = (user as any).tenantPlan
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).tenantId = token.tenantId
        ;(session.user as any).tenantName = token.tenantName
        ;(session.user as any).tenantSlug = token.tenantSlug
        ;(session.user as any).tenantPlan = token.tenantPlan
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}

export type Role = 'admin' | 'sales_manager' | 'sdr'

export const ROLE_LABELS: Record<Role, string> = {
  admin: '管理員',
  sales_manager: '業務主管',
  sdr: '業務員',
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: '完整後台權限：名單、研究、設定、計費',
  sales_manager: '查看全團隊數據 + 業務前台',
  sdr: '只能看自己被分配的名單 + 業務前台',
}

export const ROLE_VIEW_ACCESS: Record<Role, {
  admin: boolean
  sales: boolean
  analytics: boolean
  billing: boolean
}> = {
  admin: { admin: true, sales: true, analytics: true, billing: true },
  sales_manager: { admin: false, sales: true, analytics: true, billing: false },
  sdr: { admin: false, sales: true, analytics: false, billing: false },
}
