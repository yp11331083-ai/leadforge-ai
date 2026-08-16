'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Loader2, AlertCircle, Crown, Users, Send } from 'lucide-react'
import { toast } from 'sonner'

// OAuth buttons only render when the matching provider is configured
// (mirrors the server-side provider registration in auth-options.ts)
const googleEnabled = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true'
const microsoftEnabled = process.env.NEXT_PUBLIC_OAUTH_MICROSOFT_ENABLED === 'true'
const oauthButtons = [googleEnabled && 'google', microsoftEnabled && 'azure-ad'].filter(Boolean)

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
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
      setError('Please enter your email and password')
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
      setError('Sign in failed: invalid email or password')
    } else if (result?.ok) {
      toast.success('Signed in successfully!')
      router.push(callbackUrl)
      router.refresh()
    }
  }

  const handleQuickLogin = (role: 'admin' | 'manager' | 'sdr') => {
    const accounts = {
      admin: { email: 'admin@outrovo.com', password: 'demo1234' },
      manager: { email: 'manager@outrovo.com', password: 'demo1234' },
      sdr: { email: 'sdr@outrovo.com', password: 'demo1234' },
    }
    const acc = accounts[role]
    setEmail(acc.email)
    setPassword(acc.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <img src="/logo.png" alt="Outrovo" className="h-14 w-14 rounded-2xl shadow-lg mx-auto mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Outrovo
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Cold Outreach & Lead Generation Platform
          </p>
        </div>

        {/* Login form */}
        <Card className="p-6 space-y-4 shadow-xl border-stone-200 bg-white/70">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Sign in to your account</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Enter your email and password to access your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-stone-700">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9 bg-stone-50 border-stone-200"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-stone-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-stone-50 border-stone-200"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-rose-50 p-2 text-xs text-rose-600">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-stone-900 hover:bg-stone-800 rounded-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Divider */}
          {oauthButtons.length > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">or continue with</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
          )}

          {/* Google OAuth */}
          {googleEnabled && (
            <Button
              variant="outline"
              onClick={() => signIn('google', { callbackUrl: '/' })}
              disabled={loading}
              className="w-full h-11 border-stone-200 bg-white hover:bg-stone-50 rounded-full"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
          )}

          {/* Microsoft OAuth */}
          {microsoftEnabled && (
            <Button
              variant="outline"
              onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
              disabled={loading}
              className="w-full h-11 border-stone-200 bg-white hover:bg-stone-50 rounded-full"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
                <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
                <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
                <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
              </svg>
              Continue with Microsoft
            </Button>
          )}

          {/* Demo accounts */}
          <div className="pt-3 border-t border-stone-200">
            <p className="text-[11px] text-stone-400 text-center mb-2">
              Demo accounts (click to fill)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleQuickLogin('admin')}
                className="text-[11px] p-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors"
              >
                <Crown className="h-3.5 w-3.5 mx-auto mb-1 text-amber-600" />
                <span className="font-medium text-stone-700">Admin</span>
                <p className="text-[10px] text-stone-400 mt-0.5">Full access</p>
              </button>
              <button
                onClick={() => handleQuickLogin('manager')}
                className="text-[11px] p-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors"
              >
                <Users className="h-3.5 w-3.5 mx-auto mb-1 text-violet-600" />
                <span className="font-medium text-stone-700">Manager</span>
                <p className="text-[10px] text-stone-400 mt-0.5">Team view</p>
              </button>
              <button
                onClick={() => handleQuickLogin('sdr')}
                className="text-[11px] p-2 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors"
              >
                <Send className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-600" />
                <span className="font-medium text-stone-700">SDR</span>
                <p className="text-[10px] text-stone-400 mt-0.5">Send emails</p>
              </button>
            </div>
            <p className="text-[10px] text-stone-400 text-center mt-2">
              Password for all: <code className="px-1 py-0.5 rounded bg-stone-100">demo1234</code>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-stone-400">
          Don't have an account?{' '}
          <a href="/signup" className="text-violet-600 hover:underline font-medium">
            Sign up free →
          </a>
        </p>
      </div>
    </div>
  )
}
