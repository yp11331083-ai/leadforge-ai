'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Loader2, AlertCircle, User, Building2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// OAuth buttons only render when the matching provider is configured
// (mirrors the server-side provider registration in auth-options.ts)
const googleEnabled = process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === 'true'
const microsoftEnabled = process.env.NEXT_PUBLIC_OAUTH_MICROSOFT_ENABLED === 'true'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all required fields')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(true)
        toast.success('Account created! Signing you in...')

        setTimeout(async () => {
          const result = await signIn('credentials', {
            email: form.email,
            password: form.password,
            redirect: false,
          })
          if (result?.ok) {
            router.push('/')
            router.refresh()
          } else {
            router.push('/login')
          }
        }, 1500)
      } else {
        setError(data.error ?? 'Signup failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <Card className="p-8 max-w-md text-center space-y-4 shadow-xl border-stone-200 bg-white/70">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 border border-violet-100 mx-auto">
            <CheckCircle2 className="h-7 w-7 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Welcome to Outrovo!</h2>
            <p className="text-sm text-stone-500 mt-1">
              Your account is ready. You get <b>30 free credits</b> to start.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in...
          </div>
        </Card>
      </div>
    )
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

        {/* Signup form */}
        <Card className="p-6 space-y-4 shadow-xl border-stone-200 bg-white/70">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Create your account</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Use your work email to get 30 free credits — no credit card required
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-stone-700">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith"
                  className="pl-9 bg-stone-50 border-stone-200"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-stone-700">Work Email *</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@yourcompany.com"
                  className="pl-9 bg-stone-50 border-stone-200"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-stone-700">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 6 characters"
                  className="pl-9 bg-stone-50 border-stone-200"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-stone-700">Company Name (optional)</Label>
              <div className="relative">
                <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  id="company"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  placeholder="Acme Inc."
                  className="pl-9 bg-stone-50 border-stone-200"
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
                  Creating account...
                </>
              ) : (
                'Create Account — Get 30 Free Credits'
              )}
            </Button>
          </form>

          {/* Divider */}
          {(googleEnabled || microsoftEnabled) && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400">or sign up with</span>
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
              Sign up with Google
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
              Sign up with Microsoft
            </Button>
          )}

          {/* Work email policy hint */}
          <p className="text-[11px] text-stone-400 text-center leading-relaxed">
            請使用工作信箱註冊（Gmail / Yahoo 等免費信箱無法通過 Email 註冊）。
            {(googleEnabled || microsoftEnabled) && ' 使用 Google Workspace 或 Microsoft 365 公司帳號快速註冊也可以。'}
          </p>

          <div className="pt-3 border-t border-stone-200 text-center">
            <p className="text-xs text-stone-400">
              Already have an account?{' '}
              <Link href="/login" className="text-violet-600 hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
