'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Rocket, Mail, Lock, Loader2, AlertCircle, Crown, Users, Send } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('請輸入 Email 與密碼')
      return
    }
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('登入失敗：Email 或密碼錯誤')
    } else if (result?.ok) {
      toast.success('登入成功！')
      router.push(callbackUrl)
      router.refresh()
    }
  }

  const handleQuickLogin = (role: 'admin' | 'manager' | 'sdr') => {
    const accounts = {
      admin: { email: 'admin@leadforge.ai', password: 'demo1234' },
      manager: { email: 'manager@leadforge.ai', password: 'demo1234' },
      sdr: { email: 'sdr@leadforge.ai', password: 'demo1234' },
    }
    const acc = accounts[role]
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg mb-3">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            LeadForge<span className="text-emerald-600 dark:text-emerald-400"> AI</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI Cold Outreach & Lead Generation Platform
          </p>
        </div>

        {/* Login form */}
        <Card className="p-6 space-y-4 shadow-xl">
          <div>
            <h2 className="text-lg font-semibold">登入你的帳號</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              輸入 Email 與密碼存取你的工作區
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">密碼</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登入中...
                </>
              ) : (
                '登入'
              )}
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="pt-3 border-t border-border/60">
            <p className="text-[11px] text-muted-foreground text-center mb-2">
              Demo 帳號（點擊快速填入）
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('admin')}
                className="text-[11px] p-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
              >
                <Crown className="h-3.5 w-3.5 mx-auto mb-1 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">Admin</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">管理員</p>
              </button>
              <button
                onClick={() => handleQuickLogin('manager')}
                className="text-[11px] p-2 rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/60 transition-colors"
              >
                <Users className="h-3.5 w-3.5 mx-auto mb-1 text-violet-600 dark:text-violet-400" />
                <span className="font-medium">Manager</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">業務主管</p>
              </button>
              <button
                onClick={() => handleQuickLogin('sdr')}
                className="text-[11px] p-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
              >
                <Send className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">SDR</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">業務員</p>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              密碼均為 <code className="px-1 py-0.5 rounded bg-muted">demo1234</code>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          還沒有帳號？{' '}
          <a href="#" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            聯繫銷售團隊
          </a>
        </p>
      </div>
    </div>
  )
}
