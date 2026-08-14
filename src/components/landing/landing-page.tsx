'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sparkles,
  Zap,
  Target,
  Mail,
  Search,
  Shield,
  ArrowRight,
  Calendar,
  Loader2,
  CheckCircle2,
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
        // Typewriter effect for the result
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

  // Auto-run demo on first load
  useEffect(() => {
    if (hasAutoRun) return
    setHasAutoRun(true)
    // Slight delay so the page animation finishes first
    const timer = setTimeout(() => runDemo(DEMO_EXAMPLES[0]), 1200)
    return () => clearTimeout(timer)
  }, [hasAutoRun, runDemo])

  // Cycle through examples every 15 seconds (only when not loading and user hasn't typed)
  useEffect(() => {
    if (loading || product !== DEMO_EXAMPLES[exampleIdx]) return
    const timer = setInterval(() => {
      const nextIdx = (exampleIdx + 1) % DEMO_EXAMPLES.length
      setExampleIdx(nextIdx)
      setProduct(DEMO_EXAMPLES[nextIdx])
      runDemo(DEMO_EXAMPLES[nextIdx])
    }, 15000)
    return () => clearInterval(timer)
  }, [exampleIdx, loading, product, runDemo])

  const handleManualRun = () => {
    // Stop the auto-cycling by setting product to something that doesn't match
    runDemo(product)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      {/* Background gradient effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 blur-[120px] rounded-full" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-gradient-to-br from-emerald-600/10 to-teal-600/10 blur-[100px] rounded-full" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#0a0a0f]/80">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Outrovo" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">Outrovo</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/login" className="px-3 py-1.5 text-sm text-white/60 hover:text-white transition-colors">
              Sign in
            </a>
            <Button asChild size="sm" className="bg-white text-black hover:bg-white/90 rounded-full">
              <a href="/signup">Start free</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors mb-8"
          >
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Founding members get 50% off lifetime
            <ArrowRight className="h-3 w-3" />
          </a>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            AI finds customers.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
              You close deals.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed">
            Outrovo searches the web, researches companies, and writes personalized
            cold emails — automatically. No API keys. No setup.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-white text-black hover:bg-white/90 rounded-full text-base px-6">
              <a href="/signup">Start free — 30 credits <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <a href="#demo" className="px-6 py-3 text-sm text-white/60 hover:text-white transition-colors flex items-center justify-center">
              See it work ↓
            </a>
          </div>
        </div>

        {/* Live Demo — looks like a real product screenshot */}
        <div id="demo" className="mt-20 max-w-4xl mx-auto scroll-mt-20">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm shadow-2xl overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-white/10" />
                <div className="h-3 w-3 rounded-full bg-white/10" />
                <div className="h-3 w-3 rounded-full bg-white/10" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-white/30 font-mono">outrovo.com/prospect</span>
              </div>
            </div>

            {/* Demo content */}
            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <label className="text-xs font-medium text-white/40 uppercase tracking-wider">
                  Describe your product
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleManualRun()
                    }}
                    placeholder="e.g. AI-powered CRM for real estate agents"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                    disabled={loading}
                  />
                  <button
                    onClick={handleManualRun}
                    disabled={loading || !product.trim()}
                    className="px-5 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-medium hover:from-violet-500 hover:to-fuchsia-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing</>
                    ) : (
                      <>Find customer <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              </div>

              {/* Result area */}
              {loading && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-16 bg-white/5 rounded-lg" />
                  <div className="h-20 bg-white/5 rounded-lg" />
                  <div className="h-16 bg-white/5 rounded-lg" />
                </div>
              )}

              {result && !loading && (
                <div className="space-y-4">
                  {/* Company card */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 border border-violet-500/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-lg font-bold">
                        {result.company.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{result.company}</p>
                        <p className="text-xs text-white/40">{result.industry} · {result.website}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Fit Score</p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        {result.fit_score}
                      </p>
                    </div>
                  </div>

                  {/* Pain point */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Target className="h-3 w-3" /> Pain Point
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed">{result.pain_point}</p>
                  </div>

                  {/* Email hook */}
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-xs font-medium text-emerald-400/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> Email Opener
                    </p>
                    <p className="text-sm text-white/80 italic leading-relaxed">"{result.email_hook}"</p>
                  </div>

                  {/* Why they need it */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> Why They Need You
                    </p>
                    <p className="text-sm text-white/70 leading-relaxed">{result.why_they_need_it}</p>
                  </div>

                  <p className="text-center text-xs text-white/30 pt-2">
                    ↑ Generated in real-time. Try your own product above.
                  </p>
                </div>
              )}

              {error && !loading && (
                <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-sm text-rose-300">
                  {error}
                </div>
              )}

              {!result && !loading && !error && (
                <div className="py-12 text-center">
                  <p className="text-sm text-white/30">Type your product and click "Find customer"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden">
          {[
            { value: '~10s', label: 'per company researched', desc: 'AI analyzes website, hiring signals, and pain points' },
            { value: '5', label: 'AI providers with failover', desc: 'Groq → Gemini → OpenAI → Anthropic — always available' },
            { value: '0', label: 'API keys to configure', desc: 'Platform-managed AI, search, and page reading' },
          ].map((m) => (
            <div key={m.label} className="p-8 bg-[#0a0a0f] text-center">
              <p className="text-4xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">{m.value}</p>
              <p className="mt-2 text-sm font-medium text-white/80">{m.label}</p>
              <p className="mt-2 text-xs text-white/40 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight">One platform. Everything you need.</h2>
          <p className="mt-3 text-white/40">From finding companies to landing in their inbox.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden">
          {[
            { icon: Search, title: 'AI Auto-Prospect', desc: 'AI searches the web and finds companies that need your product — ranked by fit score. No manual research.' },
            { icon: Target, title: 'Deep Company Research', desc: 'AI analyzes each company\'s website, hiring signals, and pain points. Outputs a structured report in seconds.' },
            { icon: Mail, title: 'AI Email Writer', desc: 'Generates personalized cold emails with spam-filtered subject lines and specific icebreakers. Under 125 words.' },
            { icon: Calendar, title: 'Smart Meeting Tracking', desc: 'When a prospect books a meeting via Cal.com, Outrovo auto-stops sending follow-ups. No more awkward duplicates.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-8 bg-[#0a0a0f] hover:bg-white/[0.02] transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10 mb-4">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-white/5">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold tracking-tight">Built on infrastructure you trust</h2>
          <p className="mt-3 text-white/40">Enterprise-grade integrations, live today.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { name: 'Stripe', desc: 'Payments', live: true },
            { name: 'Smartlead', desc: 'Email warm-up', live: true },
            { name: 'Cal.com', desc: 'Meeting tracking', live: true },
            { name: 'Groq', desc: 'AI inference', live: true },
            { name: 'Gemini', desc: 'AI fallback', live: true },
          ].map((int) => (
            <div key={int.name} className="p-5 rounded-xl border border-white/10 bg-white/[0.02] text-center hover:border-white/20 transition-colors">
              <p className="font-semibold text-sm">{int.name}</p>
              <p className="text-xs text-white/40 mt-1">{int.desc}</p>
              <div className="mt-3 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-white/30 mt-8">
          Google Workspace & Microsoft 365 OAuth — coming soon
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 border-t border-white/5">
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent p-12 sm:p-16 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0f]/50 pointer-events-none" />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">Get 50% off lifetime.</h2>
            <p className="mt-4 text-lg text-white/50 max-w-xl mx-auto">
              We're building Outrovo with early users, not for them. Join now,
              lock in founding member pricing forever, and shape the product.
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="bg-white text-black hover:bg-white/90 rounded-full text-base px-8 h-12">
                <a href="/signup">Claim founding access <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            </div>
            <p className="mt-4 text-sm text-white/40">30 free credits to start · No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between text-xs text-white/30">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Outrovo" className="h-5 w-5 rounded" />
            <span>Outrovo</span>
          </div>
          <span>© 2026 Outrovo. All rights reserved.</span>
        </div>
      </footer>
    </div>
  )
}
