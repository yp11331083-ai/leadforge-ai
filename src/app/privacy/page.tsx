import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Privacy Policy — Outrovo',
  description: 'How Outrovo collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Outrovo" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">Outrovo</span>
          </Link>
          <Button asChild size="sm" className="bg-slate-900 text-white hover:bg-slate-800 rounded-full">
            <Link href="/signup">Start free</Link>
          </Button>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: August 14, 2026</p>

        <div className="mt-12 prose prose-slate max-w-none">
          <p className="text-slate-600 leading-relaxed">
            Outrovo ("we", "us", "our") operates the AI-powered B2B cold outreach platform at
            outrovo.com (the "Service"). This Privacy Policy explains what data we collect, why we
            collect it, and how we use it.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">1. Data We Collect</h2>

          <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Account Data</h3>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>Email address and password (bcrypt-hashed)</li>
            <li>Name and role (admin, sales manager, or sales rep)</li>
            <li>Tenant (organization) name and slug</li>
          </ul>

          <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Usage Data</h3>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>Leads you create (company name, website, contact info, research results)</li>
            <li>AI-generated content (research reports, cold emails, follow-up sequences)</li>
            <li>Email sending logs and open/click tracking events</li>
            <li>Credit balance and transaction history</li>
          </ul>

          <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Configuration Data</h3>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>SMTP settings (host, port, credentials — stored in your tenant's encrypted config)</li>
            <li>Smartlead API key (if you choose to connect it)</li>
            <li>Cal.com OAuth tokens (if you connect your calendar)</li>
            <li>Optional BYOK API keys (OpenAI, Anthropic — stored encrypted, never displayed again)</li>
          </ul>

          <h3 className="text-base font-semibold text-slate-800 mt-6 mb-2">Billing Data</h3>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>Stripe customer ID and subscription status</li>
            <li>Payment method is handled entirely by Stripe — we never see or store your card number</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">2. How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>To provide the Service — AI research, email generation, prospecting, sending</li>
            <li>To process payments and manage your subscription via Stripe</li>
            <li>To track email opens and clicks (for analytics you can see)</li>
            <li>To improve our AI prompts and product features</li>
            <li>To send you service-related notifications (payment receipts, security alerts)</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">3. Data We Do NOT Collect</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>We do <strong>not</strong> track your browsing on other websites</li>
            <li>We do <strong>not</strong> sell your data to third parties</li>
            <li>We do <strong>not</strong> train AI models on your private lead data</li>
            <li>We do <strong>not</strong> share your leads with other tenants</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">4. AI Processing</h2>
          <p className="text-slate-600 leading-relaxed">
            When you use AI features (auto-prospect, research, email generation), your service
            description and company website content are sent to our AI providers:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li><strong>Groq</strong> (primary) — Llama 3.3 70B inference</li>
            <li><strong>Google Gemini</strong> (fallback) — Gemini 2.5 Flash</li>
            <li><strong>OpenAI / Anthropic</strong> — only if you provide your own API keys (BYOK)</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Search results come from <strong>Tavily</strong>, and website content is fetched by
            <strong> Jina Reader</strong>. These providers may temporarily process your queries to
            return results, but do not retain them.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">5. Data Storage</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>Primary database: <strong>Supabase</strong> (PostgreSQL, hosted in AWS Singapore)</li>
            <li>Application hosting: <strong>Vercel</strong> (global edge network)</li>
            <li>All data is encrypted in transit (TLS 1.3) and at rest</li>
            <li>Each tenant's data is isolated — other tenants cannot access your data</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">6. Email Tracking</h2>
          <p className="text-slate-600 leading-relaxed">
            When you send a cold email through Outrovo, we embed a tracking pixel (1x1 image) and
            rewrite links to track opens and clicks. This data is visible only to you in your
            analytics dashboard. We do not share this data with third parties.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">7. Your Rights</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li><strong>Access</strong>: You can view all your data in the platform</li>
            <li><strong>Export</strong>: Contact us to export your leads and data</li>
            <li><strong>Delete</strong>: You can delete your account at any time — all your data will be permanently removed within 30 days</li>
            <li><strong>Opt-out</strong>: You can disable email tracking in your settings</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">8. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>Active accounts: data is retained while your account is active</li>
            <li>Cancelled accounts: data is retained for 30 days, then permanently deleted</li>
            <li>Credit logs: retained for 7 years for financial audit compliance</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">9. Security</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>All passwords are bcrypt-hashed (never stored in plaintext)</li>
            <li>API keys and OAuth tokens are encrypted at rest</li>
            <li>Database access is restricted to authenticated application servers only</li>
            <li>We do not store credit card numbers — Stripe handles all payment processing</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">10. Contact</h2>
          <p className="text-slate-600 leading-relaxed">
            For privacy questions or data requests, contact us at:{' '}
            <a href="mailto:support@outrovo.com" className="text-violet-600 hover:underline">support@outrovo.com</a>
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
          <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-900">Terms of Service →</Link>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/">Back to Outrovo</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
