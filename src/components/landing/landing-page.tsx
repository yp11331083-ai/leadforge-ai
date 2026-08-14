'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Loader2,
  Target,
  Mail,
  Search,
  Calendar,
  Sparkles,
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

const DEMO_EXAMPLES = [
  'AI-powered CRM for real estate agents',
  'Automated invoicing tool for freelancers',
  'Cybersecurity compliance platform for fintech startups',
]

export function LandingPage() {
  const [product, setProduct] = useState(DEMO_EXAMPLES[0])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DemoResult | null>(null)
  const [error, setError] = useState('')
  const [hasAutoRun, setHasAutoRun] = useState(false)
  const [exampleIdx, setExampleIdx] = useState(0)

  const runDemo = useCallback(async (productDesc: string) => {
    if (!productDesc.trim() || productDesc.length < 5) return
    setError('')
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/demo/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productDesc }),
      })
      const data = await res.json()
      if (res.ok && data.result) {
        setResult(data.result)
      } else {
        setError(data.error ?? 'Demo failed — please try again.')
      }
    } catch {
      setError('Network error — please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-run demo immediately on load — no waiting for user
  useEffect(() => {
    if (hasAutoRun) return
    setHasAutoRun(true)
    runDemo(DEMO_EXAMPLES[0])
  }, [hasAutoRun, runDemo])

  // Cycle through examples every 15 seconds (only when user hasn't typed)
  useEffect(() => {
    if (loading) return
    if (product !== DEMO_EXAMPLES[exampleIdx]) return // user typed something
    const timer = setInterval(() => {
      setExampleIdx((prev) => {
        const next = (prev + 1) % DEMO_EXAMPLES.length
        setProduct(DEMO_EXAMPLES[next])
        runDemo(DEMO_EXAMPLES[next])
        return next
      })
    }, 15000)
    return () => clearInterval(timer)
  }, [exampleIdx, loading, product, runDemo])

  const handleManualRun = () => {
    runDemo(product)
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Outrovo" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">Outrovo</span>
          </div>
          <div className="flex items-center gap-1">
            <a href="/login" className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </a>
            <Button asChild size="sm" className="bg-slate-900 text-white hover:bg-slate-800 rounded-full">
              <a href="/signup">Start free</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16">
        {/* Subtle gradient backdrop */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-100/60 via-fuchsia-50/40 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="text-center max-w-3xl mx-auto">
          <p className="text-sm text-slate-500 mb-8">
            Now accepting <span className="font-semibold text-slate-900">founding members</span> — lock in 50% off, forever.
          </p>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] text-slate-900">
            AI finds customers.
            <br />
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
              You close deals.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Outrovo searches the web, researches companies, and writes personalized
            cold emails — automatically. No API keys. No setup.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-slate-900 text-white hover:bg-slate-800 rounded-full text-base px-6 h-12">
              <a href="/signup">Start free — 30 credits <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <a href="#demo" className="px-6 py-3 text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center">
              See it work ↓
            </a>
          </div>
        </div>

        {/* Live Demo */}
        <div id="demo" className="mt-20 max-w-4xl mx-auto scroll-mt-20">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-slate-200" />
                <div className="h-3 w-3 rounded-full bg-slate-200" />
                <div className="h-3 w-3 rounded-full bg-slate-200" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-slate-400 font-mono">outrovo.com/prospect</span>
              </div>
            </div>

            {/* Demo content */}
            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Describe your product
                </label>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700 flex items-center min-h-[48px]">
                    {loading ? (
                      <span className="text-slate-400 flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
                      </span>
                    ) : (
                      <span className="truncate">{product}</span>
                    )}
                  </div>
                  <div className="px-5 py-3 rounded-lg bg-slate-900 text-sm font-medium text-white flex items-center gap-2 whitespace-nowrap">
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Working</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Auto-demo</>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Rotating through live examples — sign up to use your own product description
                </p>
              </div>

              {/* Result area — no empty state, always shows something */}
              {loading && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-20 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                </div>
              )}

              {result && !loading && (
                <div className="space-y-4">
                  {/* Company card */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-lg font-bold text-slate-700 shadow-sm">
                        {result.company.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{result.company}</p>
                        <p className="text-xs text-slate-500">{result.industry} · {result.website}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fit Score</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                        {result.fit_score}
                      </p>
                    </div>
                  </div>

                  {/* Pain point */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Target className="h-3 w-3" /> Pain Point
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">{result.pain_point}</p>
                  </div>

                  {/* Email hook */}
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> Email Opener
                    </p>
                    <p className="text-sm text-slate-700 italic leading-relaxed">"{result.email_hook}"</p>
                  </div>

                  {/* Why they need it */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> Why They Need You
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">{result.why_they_need_it}</p>
                  </div>

                  <p className="text-center text-xs text-slate-400 pt-2">
                    ↑ Generated in real-time. Try your own product above.
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {[
            { value: '~10s', label: 'per company researched', desc: 'AI analyzes website, hiring signals, and pain points' },
            { value: '5', label: 'AI providers with failover', desc: 'Groq → Gemini → OpenAI → Anthropic — always available' },
            { value: '0', label: 'API keys to configure', desc: 'Platform-managed AI, search, and page reading' },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-5xl font-bold text-slate-900">{m.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">{m.label}</p>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-[200px] mx-auto">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-slate-100">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">One platform. Everything you need.</h2>
          <p className="mt-3 text-slate-400">From finding companies to landing in their inbox.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Search, title: 'AI Auto-Prospect', desc: 'AI searches the web and finds companies that need your product — ranked by fit score. No manual research.' },
            { icon: Target, title: 'Deep Company Research', desc: 'AI analyzes each company\'s website, hiring signals, and pain points. Outputs a structured report in seconds.' },
            { icon: Mail, title: 'AI Email Writer', desc: 'Generates personalized cold emails with spam-filtered subject lines and specific icebreakers. Under 125 words.' },
            { icon: Calendar, title: 'Smart Meeting Tracking', desc: 'When a prospect books a meeting via Cal.com, Outrovo auto-stops sending follow-ups. No more awkward duplicates.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 border border-violet-100 mb-4">
                <Icon className="h-5 w-5 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-slate-100">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight text-slate-900">Built on infrastructure you trust</h2>
          <p className="mt-3 text-slate-400">Enterprise-grade integrations, live today.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { name: 'Stripe', desc: 'Payments' },
            { name: 'Smartlead', desc: 'Email warm-up' },
            { name: 'Cal.com', desc: 'Meeting tracking' },
            { name: 'Groq', desc: 'AI inference' },
            { name: 'Gemini', desc: 'AI fallback' },
          ].map((int) => (
            <div key={int.name} className="p-5 rounded-xl border border-slate-100 bg-white text-center hover:border-slate-200 transition-colors">
              <p className="font-semibold text-sm text-slate-900">{int.name}</p>
              <p className="text-xs text-slate-400 mt-1">{int.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-400 mt-8">
          Google Workspace & Microsoft 365 OAuth — coming soon
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-slate-100">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-violet-600 to-fuchsia-600 p-12 sm:p-16 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">Get 50% off lifetime.</h2>
          <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
            We're building Outrovo with early users, not for them. Join now,
            lock in founding member pricing forever, and shape the product.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-white text-violet-700 hover:bg-white/90 rounded-full text-base px-8 h-12">
              <a href="/signup">Claim founding access <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-white/60">30 free credits to start · No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Outrovo" className="h-5 w-5 rounded" />
            <span>© Outrovo 2026. All Rights Reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
