'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Sparkles,
  Zap,
  Target,
  Mail,
  Search,
  TrendingUp,
  Shield,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Calendar,
  CreditCard,
  Building2,
} from 'lucide-react'

interface DemoResult {
  company: string
  website: string
  industry: string
  fit_score: number
  pain_point: string
  email_hook: string
  why_they_need_it: string
}

export function LandingPage() {
  const [product, setProduct] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState('')

  const runDemo = async () => {
    if (!product.trim() || product.length < 5) {
      setError('Please describe your product in at least a few words.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/demo/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      })
      const data = await res.json()
      if (res.ok && data.result) {
        setResult(data.result)
      } else {
        setError(data.error ?? 'Demo failed — please try again.')
      }
    } catch (e: any) {
      setError('Network error — please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Outrovo" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold">Outrovo</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </a>
            <Button asChild size="sm">
              <a href="/signup">Get Started Free</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero + Interactive Demo */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-4 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
            <Sparkles className="mr-1 h-3 w-3" /> Founding Member Access — 50% off lifetime
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            AI finds your customers.
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              You close the deal.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Outrovo searches the web, researches companies, and writes personalized cold emails —
            all in one platform. No API keys, no setup. Just describe your product and watch it work.
          </p>
        </div>

        {/* Interactive Demo */}
        <div className="mt-12 max-w-2xl mx-auto">
          <Card className="p-6 shadow-xl border-violet-200 dark:border-violet-800">
            <div className="text-center mb-4">
              <p className="text-sm font-medium text-muted-foreground">
                Try it now — type your product below
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDemo()}
                placeholder="e.g. AI-powered CRM for real estate agents"
                className="flex-1"
                disabled={loading}
              />
              <Button
                onClick={runDemo}
                disabled={loading || !product.trim()}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <>Find a Customer <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            )}

            {/* Demo Result */}
            {result && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 border border-violet-200 dark:border-violet-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/60 dark:bg-violet-950/40 text-lg font-bold">
                      {result.company.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{result.company}</p>
                      <p className="text-xs text-muted-foreground">{result.industry} · {result.website}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase">Fit Score</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{result.fit_score}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" /> Pain Point
                  </p>
                  <p className="text-sm p-3 rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900">
                    {result.pain_point}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Personalized Email Opener
                  </p>
                  <p className="text-sm p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 italic">
                    "{result.email_hook}"
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Why They Need You
                  </p>
                  <p className="text-sm text-muted-foreground">{result.why_they_need_it}</p>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    ↑ This was generated in real-time by Outrovo's AI
                  </p>
                  <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700">
                    <a href="/signup">Get 30 Free Credits <ArrowRight className="ml-2 h-3 w-3" /></a>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* Hard Metrics */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Built for performance</h2>
          <p className="mt-2 text-muted-foreground">Real metrics from our engineering, not marketing fluff.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-950/50 mb-3">
              <Zap className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-3xl font-bold">~10 sec</p>
            <p className="text-sm text-muted-foreground mt-1">per company researched</p>
            <p className="text-xs text-muted-foreground mt-2 opacity-70">
              AI analyzes website, hiring signals, and pain points in real-time
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 mb-3">
              <Bot className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-3xl font-bold">5 AI providers</p>
            <p className="text-sm text-muted-foreground mt-1">with automatic failover</p>
            <p className="text-xs text-muted-foreground mt-2 opacity-70">
              Groq → Gemini → OpenAI → Anthropic → Z.ai. If one goes down, the next takes over.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 mb-3">
              <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-3xl font-bold">0 API keys</p>
            <p className="text-sm text-muted-foreground mt-1">needed to start</p>
            <p className="text-xs text-muted-foreground mt-2 opacity-70">
              Platform-managed AI, search, and page reading. Just sign up and go.
            </p>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Everything you need to find customers</h2>
          <p className="mt-2 text-muted-foreground">From search to send, all in one platform.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Search, title: 'AI Auto-Prospect', desc: 'AI searches the web and finds companies that need your product, ranked by fit score.' },
            { icon: Target, title: 'Deep Research', desc: 'AI analyzes each company\'s website, hiring signals, and pain points in seconds.' },
            { icon: Mail, title: 'AI Email Writer', desc: 'Generates personalized cold emails with spam-filtered subject lines and specific icebreakers.' },
            { icon: Calendar, title: 'Smart Meeting Tracking', desc: 'Auto-stops sending when a prospect books a meeting via Cal.com integration.' },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50 mb-3">
                <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-border/40">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold">Integrates with your stack</h2>
          <p className="mt-2 text-muted-foreground">Built on infrastructure you already trust.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-8">
          {[
            { name: 'Stripe', desc: 'Payment processing', status: 'Connected' },
            { name: 'Smartlead', desc: 'Email warm-up & sending', status: 'Connected' },
            { name: 'Cal.com', desc: 'Meeting tracking', status: 'Connected' },
            { name: 'Groq', desc: 'AI inference', status: 'Connected' },
            { name: 'Google Gemini', desc: 'AI fallback', status: 'Connected' },
          ].map((int) => (
            <div key={int.name} className="flex flex-col items-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/40 border border-border/60">
                <span className="text-xs font-bold text-center">{int.name}</span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-2.5 w-2.5" /> {int.status}
              </Badge>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Google Workspace & Microsoft 365 OAuth — coming soon
        </p>
      </section>

      {/* Founding Member CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 border-t border-border/40">
        <Card className="p-8 sm:p-12 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-0 shadow-2xl">
          <div className="text-center">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              <Sparkles className="mr-1 h-3 w-3" /> Founding Member Program
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Get 50% off lifetime pricing</h2>
            <p className="mt-4 text-lg opacity-90 max-w-xl mx-auto">
              We're building Outrovo with early users, not for them.
              Join now and lock in founding member pricing forever.
              Your feedback shapes the product.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-white/90">
                <a href="/signup">Claim 50% Off <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                <a href="/login">Sign In</a>
              </Button>
            </div>
            <p className="mt-4 text-sm opacity-80">
              30 free credits to start · No credit card required
            </p>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Outrovo" className="h-5 w-5 rounded" />
            <span>Outrovo — AI Cold Outreach & Lead Generation</span>
          </div>
          <span>© 2026 Outrovo</span>
        </div>
      </footer>
    </div>
  )
}
