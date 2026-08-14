'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Target,
  Mail,
  Search,
  Calendar,
  Sparkles,
} from 'lucide-react'
import demoData from './demo-data.json'

interface DemoResult {
  company: string
  website: string
  industry: string
  fit_score: number
  pain_point: string
  email_hook: string
  why_they_need_it: string
}

interface DemoEntry {
  product: string
  result: DemoResult
}

const DEMOS = demoData as DemoEntry[]

const PAUSE_MS = 7000
const TYPE_SPEED = 50
const DELETE_SPEED = 28
const PAUSE_AFTER_TYPE = 600
const PAUSE_AFTER_DELETE = 400

type Phase = 'typing' | 'showing' | 'deleting'

export function LandingPage() {
  const [demoIdx, setDemoIdx] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [phase, setPhase] = useState<Phase>('typing')
  const [isHovered, setIsHovered] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const targetProduct = DEMOS[demoIdx]?.product ?? ''
  const currentResult = DEMOS[demoIdx]?.result

  // Typewriter — continues even when hovered (only 'showing' phase pauses)
  useEffect(() => {
    if (phase === 'typing') {
      if (typedText.length < targetProduct.length) {
        const timer = setTimeout(() => {
          setTypedText(targetProduct.slice(0, typedText.length + 1))
        }, TYPE_SPEED + Math.random() * 40)
        return () => clearTimeout(timer)
      } else {
        const timer = setTimeout(() => {
          setShowResult(true)
          setPhase('showing')
        }, PAUSE_AFTER_TYPE)
        return () => clearTimeout(timer)
      }
    }

    if (phase === 'deleting') {
      if (typedText.length > 0) {
        const timer = setTimeout(() => {
          setTypedText(typedText.slice(0, -1))
        }, DELETE_SPEED)
        return () => clearTimeout(timer)
      } else {
        const timer = setTimeout(() => {
          setDemoIdx((prev) => (prev + 1) % DEMOS.length)
          setPhase('typing')
        }, PAUSE_AFTER_DELETE)
        return () => clearTimeout(timer)
      }
    }

    // 'showing' phase — use a simple timeout, NOT affected by hover for advancing
    // BUT we use CSS animation-play-state for the visual progress bar pause
    if (phase === 'showing' && !isHovered) {
      const timer = setTimeout(() => {
        setShowResult(false)
        setPhase('deleting')
      }, PAUSE_MS)
      return () => clearTimeout(timer)
    }
  }, [phase, typedText, targetProduct, isHovered])

  return (
    <div className="min-h-screen text-stone-900">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-stone-200/60 bg-stone-50/80 backdrop-blur-lg">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Outrovo" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight">Outrovo</span>
          </div>
          <div className="flex items-center gap-1">
            <a href="/login" className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors">
              Sign in
            </a>
            <Button asChild size="sm" className="bg-stone-900 text-white hover:bg-stone-800 rounded-full">
              <a href="/signup">Start free</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero — warm stone background with gradient glow */}
      <section className="relative bg-stone-50">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-violet-200/30 via-fuchsia-100/20 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 pb-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] text-stone-900">
              Outrovo finds customers.
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                You close deals.
              </span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed">
              Outrovo searches the web, researches companies, and writes personalized
              cold emails — automatically.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" className="bg-stone-900 text-white hover:bg-stone-800 rounded-full text-base px-6 h-12">
                <a href="/signup">Start free — 30 credits <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <a href="#demo" className="px-6 py-3 text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-center">
                See it work ↓
              </a>
            </div>
          </div>

          {/* Live Demo */}
          <div
            id="demo"
            className="mt-20 max-w-4xl mx-auto scroll-mt-20"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="rounded-2xl border border-stone-200 bg-white/70 shadow-xl shadow-stone-300/30 overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-200/60 bg-stone-100/50">
                <div className="flex gap-2 group/dots">
                  {/* Close */}
                  <button className="relative h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: '#FF5F57',
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
                    }}
                  >
                    <svg className="h-2 w-2 opacity-0 group-hover/dots:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3L9 9M9 3L3 9" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  {/* Minimize */}
                  <button className="relative h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: '#FEBC2E',
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
                    }}
                  >
                    <svg className="h-2 w-2 opacity-0 group-hover/dots:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
                      <path d="M3 6H9" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  {/* Maximize */}
                  <button className="relative h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: '#28C840',
                      boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1)',
                    }}
                  >
                    <svg className="h-2 w-2 opacity-0 group-hover/dots:opacity-100 transition-opacity" viewBox="0 0 12 12" fill="none">
                      <path d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-stone-400 font-mono">outrovo.com/prospect</span>
                </div>
              </div>

              {/* Demo content — fixed min-height to prevent page scroll */}
              <div className="p-6 sm:p-8 min-h-[480px]">
                <div className="mb-6">
                  <label className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                    Describe your product
                  </label>
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-700 flex items-center min-h-[48px]">
                      <span className="truncate">{typedText}</span>
                      <span className={`inline-block w-0.5 h-4 ml-0.5 ${phase === 'typing' || phase === 'deleting' ? 'bg-violet-500 animate-pulse' : 'bg-transparent'}`} />
                    </div>
                    <div className="px-5 py-3 rounded-lg bg-stone-900 text-sm font-medium text-white flex items-center gap-2 whitespace-nowrap">
                      <Search className="h-4 w-4" /> Search
                    </div>
                  </div>
                </div>

                {/* Result */}
                <div className="space-y-4">
                  {showResult && currentResult ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-100">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-lg font-bold text-stone-700 shadow-sm">
                            {currentResult.company.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-900">{currentResult.company}</p>
                            <p className="text-xs text-stone-500">{currentResult.industry} · {currentResult.website}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider">Fit Score</p>
                          <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                            {currentResult.fit_score}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-stone-100/60 border border-stone-200/60">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Target className="h-3 w-3" /> Pain Point
                        </p>
                        <p className="text-sm text-stone-600 leading-relaxed">{currentResult.pain_point}</p>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> Email Opener
                        </p>
                        <p className="text-sm text-stone-700 italic leading-relaxed">"{currentResult.email_hook}"</p>
                      </div>

                      <div className="p-4 rounded-xl bg-stone-100/60 border border-stone-200/60">
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" /> Why They Need You
                        </p>
                        <p className="text-sm text-stone-600 leading-relaxed">{currentResult.why_they_need_it}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-16 bg-stone-100/60 rounded-lg animate-pulse" />
                      <div className="h-20 bg-stone-100/60 rounded-lg animate-pulse" />
                      <div className="h-16 bg-stone-100/60 rounded-lg animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Progress — CSS animation, GPU-accelerated, truly smooth */}
                <div className="mt-6 flex justify-center gap-1.5">
                  {DEMOS.map((_, i) => {
                    const isActive = i === demoIdx
                    const isPast = i < demoIdx
                    return (
                      <div
                        key={i}
                        className="relative h-1.5 rounded-full bg-stone-200 overflow-hidden transition-all duration-300"
                        style={{ width: isActive ? '32px' : '6px' }}
                      >
                        {isActive && showResult && (
                          <div
                            className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 origin-left"
                            style={{
                              transform: 'scaleX(0)',
                              animation: `progressFill ${PAUSE_MS}ms linear forwards`,
                              animationPlayState: isHovered ? 'paused' : 'running',
                            }}
                          />
                        )}
                        {isPast && (
                          <div className="absolute inset-0 bg-stone-400 rounded-full" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics — warm gray layer */}
      <section className="bg-stone-100/50 border-y border-stone-200/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
            {[
              { value: '~10s', label: 'per company researched', desc: 'Outrovo analyzes website, hiring signals, and pain points' },
              { value: '10', label: 'search strategies per run', desc: 'Diverse queries covering hiring, funding, industry, location, and more' },
              { value: '0', label: 'API keys to configure', desc: 'Platform-managed search, page reading, and writing' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-5xl font-bold text-violet-600">{m.value}</p>
                <p className="mt-2 text-sm font-medium text-stone-700">{m.label}</p>
                <p className="mt-2 text-xs text-stone-400 leading-relaxed max-w-[200px] mx-auto">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — clean white with shadow cards */}
      <section className="bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold tracking-tight text-stone-900">One platform. Everything you need.</h2>
            <p className="mt-3 text-stone-400">From finding companies to landing in their inbox.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: Search, title: 'Auto-Prospect', desc: 'Outrovo searches the web and finds companies that need your product — ranked by fit score. No manual research.' },
              { icon: Target, title: 'Deep Company Research', desc: 'Outrovo analyzes each company\'s website, hiring signals, and pain points. Outputs a structured report in seconds.' },
              { icon: Mail, title: 'Email Writer', desc: 'Generates personalized cold emails with spam-filtered subject lines and specific icebreakers. Under 125 words.' },
              { icon: Calendar, title: 'Smart Meeting Tracking', desc: 'When a prospect books a meeting via Cal.com, Outrovo auto-stops sending follow-ups. No more awkward duplicates.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:border-violet-200 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 border border-violet-100 mb-4">
                  <Icon className="h-5 w-5 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations — warm gray layer for rhythm */}
      <section className="bg-stone-100/50 border-y border-stone-200/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold tracking-tight text-stone-900">Built on infrastructure you trust</h2>
            <p className="mt-3 text-stone-400">Enterprise-grade integrations, live today.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { name: 'Stripe', desc: 'Payments' },
              { name: 'Smartlead', desc: 'Email warm-up' },
              { name: 'Cal.com', desc: 'Meeting tracking' },
              { name: 'Groq', desc: 'Inference engine' },
              { name: 'Gemini', desc: 'Fallback engine' },
            ].map((int) => (
              <div key={int.name} className="p-5 rounded-xl border border-stone-200 bg-white shadow-sm hover:shadow-md hover:border-violet-200 transition-all text-center">
                <p className="font-semibold text-sm text-stone-900">{int.name}</p>
                <p className="text-xs text-stone-400 mt-1">{int.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">
            Google Workspace & Microsoft 365 OAuth — coming soon
          </p>
        </div>
      </section>

      {/* CTA — violet gradient */}
      <section className="bg-stone-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
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
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-100 border-t border-stone-200/60 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Outrovo" className="h-5 w-5 rounded" />
            <span>© Outrovo 2026. All Rights Reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-stone-600 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-stone-600 transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
