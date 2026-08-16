import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// OAuth providers are only registered when their credentials exist —
// otherwise NextAuth's signIn() throws "unsupported provider" and the
// buttons would break for deployments without keys.
const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
const microsoftEnabled = !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET)
const OAUTH_PROVIDERS = ['google', 'azure-ad']

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

    ...(googleEnabled
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),

    ...(microsoftEnabled
      ? [AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID || 'common', // 'common' = 工作帳 + 個人帳都接受
        })]
      : []),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 天
  },
  callbacks: {
    /**
     * OAuth 快速註冊/登入：Google/Microsoft 帳號第一次登入時自動建立
     * User + Tenant（對齊 /api/auth/signup 的流程），既有用戶直接登入。
     * 回填完整 tenant 資訊後，既有的 jwt/session callbacks 與下游 API
     * 完全不用改。
     */
    async signIn({ user, account }) {
      if (!account || !OAUTH_PROVIDERS.includes(account.provider)) return true

      const email = user.email?.toLowerCase().trim()
      if (!email) return false

      let dbUser = await db.user.findUnique({
        where: { email },
        include: { tenant: true },
      })

      if (!dbUser) {
        // 第一次 OAuth 登入 = 自動註冊。工作信箱由帳號來源保證：
        // Google Workspace / M365 帳號本身就是公司信箱
        const emailDomain = email.split('@')[1] ?? 'workspace'
        const slug = `${emailDomain.replace(/\./g, '-')}-${Math.random().toString(36).slice(2, 6)}`
        const tenant = await db.tenant.create({
          data: { name: `${user.name ?? email.split('@')[0]}'s Workspace`, slug, plan: 'freemium', status: 'active' },
        })
        dbUser = await db.user.create({
          data: {
            email,
            name: user.name ?? email.split('@')[0],
            // OAuth 用戶沒有密碼 — 存一個隨機不可登入的雜湊
            passwordHash: await bcrypt.hash(Math.random().toString(36) + Date.now(), 10),
            role: 'admin',
            tenantId: tenant.id,
          },
          include: { tenant: true },
        })
        await db.emailConfig.create({ data: { tenantId: tenant.id } })
        await db.serviceOffering.create({ data: { tenantId: tenant.id } })
      }

      // 把 DB 的完整資訊回填到 user 物件 — jwt callback 會複製這些欄位
      ;(user as any).id = dbUser.id
      ;(user as any).role = dbUser.role
      ;(user as any).tenantId = dbUser.tenantId
      ;(user as any).tenantName = dbUser.tenant.name
      ;(user as any).tenantSlug = dbUser.tenant.slug
      ;(user as any).tenantPlan = dbUser.tenant.plan
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role
        token.tenantId = (user as any).tenantId
        token.tenantName = (user as any).tenantName
        token.tenantSlug = (user as any).tenantSlug
        token.tenantPlan = (user as any).tenantPlan
        token.lastTenantSync = Date.now()
      }

      // Refresh tenant info from DB every 5 minutes (so plan changes via Stripe
      // webhook show up without requiring the user to sign out + sign back in)
      const lastSync = (token.lastTenantSync as number) ?? 0
      const fiveMinutes = 5 * 60 * 1000
      if (token.tenantId && Date.now() - lastSync > fiveMinutes) {
        try {
          const freshTenant = await db.tenant.findUnique({
            where: { id: token.tenantId as string },
            select: { plan: true, name: true, slug: true, status: true },
          })
          if (freshTenant) {
            token.tenantPlan = freshTenant.plan
            token.tenantName = freshTenant.name
            token.tenantSlug = freshTenant.slug
            token.lastTenantSync = Date.now()
          }
        } catch (e) {
          // DB query failed — keep the cached values
        }
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
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sdr: 'Sales Rep',
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
