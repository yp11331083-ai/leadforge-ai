import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Terms of Service — Outrovo',
  description: 'The terms and conditions for using Outrovo.',
}

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: August 14, 2026</p>

        <div className="mt-12 prose prose-slate max-w-none">
          <p className="text-slate-600 leading-relaxed">
            These Terms of Service ("Terms") govern your use of Outrovo (the "Service"), operated
            by Outrovo ("we", "us", "our"). By creating an account or using the Service, you agree
            to these Terms.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">1. Description of Service</h2>
          <p className="text-slate-600 leading-relaxed">
            Outrovo is an AI-powered B2B cold outreach platform that provides:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li>AI auto-prospecting — searches the web for companies matching your criteria</li>
            <li>AI company research — analyzes websites and generates structured reports</li>
            <li>AI cold email generation — writes personalized emails under 125 words</li>
            <li>Email enrichment — finds decision-maker email addresses</li>
            <li>Email sending via SMTP, Smartlead, or OAuth (coming soon)</li>
            <li>Meeting tracking via Cal.com integration</li>
            <li>Billing via Stripe with credit-based usage</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">2. Accounts</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>You must provide a valid email address to create an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must be at least 18 years old to use the Service</li>
            <li>One account per organization (tenant). Additional seats available on paid plans</li>
            <li>You are responsible for all activity that occurs under your account</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">3. Credits and Billing</h2>
          <p className="text-slate-600 leading-relaxed">
            The Service uses a credit-based system. Each AI operation consumes credits:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li><strong>Auto-Prospect</strong>: 5 + (target count × 2) credits per run</li>
            <li><strong>Research (basic)</strong>: 3 credits per company</li>
            <li><strong>Research (deep)</strong>: 8 credits per company</li>
            <li><strong>Email Generation</strong>: 2 credits per email</li>
            <li><strong>Email Enrichment</strong>: 3 credits per lookup</li>
            <li><strong>Send Email</strong>: 1 credit per email sent</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Credits are granted based on your subscription plan and reset monthly. Unused credits
            do not roll over to the next month. One-time credit pack purchases do not expire.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            If an AI operation fails, credits are automatically refunded to your account.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">4. Subscription Plans</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li><strong>Freemium</strong> ($0/mo): 30 credits, 1 seat, basic features</li>
            <li><strong>Starter</strong> ($49/mo): 500 credits, 1 seat, full features</li>
            <li><strong>Growth</strong> ($149/mo): 2,000 credits, 5 seats, analytics</li>
            <li><strong>Agency</strong> ($399/mo): 8,000 credits, 3+ seats, white-label</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            <strong>Founding Member Discount</strong>: The first 100 paying customers receive 50%
            off their subscription for the lifetime of their account. This discount is locked in
            as long as the subscription remains active.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            You can upgrade, downgrade, or cancel your subscription at any time via the billing
            portal. Downgrades take effect at the end of the current billing cycle.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">5. Acceptable Use</h2>
          <p className="text-slate-600 leading-relaxed">You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li>Send unsolicited spam — comply with CAN-SPAM, GDPR, and local email laws</li>
            <li>Use the Service to target protected groups (race, religion, gender, etc.)</li>
            <li>Scrape or export data at scale for resale</li>
            <li>Share your account credentials with users outside your organization</li>
            <li>Use the Service to send illegal, defamatory, or harmful content</li>
            <li>Attempt to reverse-engineer, decompile, or hack the Service</li>
            <li>Use the Service to send more than your plan's daily email limit</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">6. AI-Generated Content</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>AI-generated content (research, emails) is provided "as is" — you should review it before sending</li>
            <li>You are responsible for the accuracy and compliance of emails you send</li>
            <li>We do not guarantee specific reply rates or deliverability rates</li>
            <li>AI may occasionally produce inaccurate or outdated information — always verify before sending</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">7. Email Deliverability</h2>
          <p className="text-slate-600 leading-relaxed">
            Outrovo provides tools to help with email deliverability (SMTP configuration,
            Smartlead integration, spam-filtered email generation). However, we do not guarantee
            inbox placement. Deliverability depends on factors outside our control, including:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li>Your sender domain reputation</li>
            <li>Email content and subject line</li>
            <li>Recipient's spam filter configuration</li>
            <li>Your email service provider's policies</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">8. Data Ownership</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>You own all leads, research, and email content you create</li>
            <li>We own the Outrovo platform, AI prompts, and infrastructure</li>
            <li>You grant us a license to process your data solely to provide the Service</li>
            <li>We do not use your private data to train AI models</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">9. Service Availability</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>We target 99.5% uptime but do not guarantee uninterrupted service</li>
            <li>We are not liable for outages caused by third-party providers (Groq, Gemini, Stripe, etc.)</li>
            <li>We may schedule maintenance windows with advance notice</li>
            <li>AI features depend on external providers — if all 5 AI providers are down, AI features may be temporarily unavailable</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">10. Cancellation and Refunds</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>You can cancel your subscription at any time via the billing portal</li>
            <li>Cancellation takes effect at the end of the current billing cycle</li>
            <li>Monthly subscriptions are non-refundable once charged</li>
            <li>Annual subscriptions may be refunded on a prorated basis within 30 days</li>
            <li>Credit pack purchases are non-refundable but never expire</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">11. Limitation of Liability</h2>
          <p className="text-slate-600 leading-relaxed">
            To the maximum extent permitted by law, Outrovo shall not be liable for:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600 mt-3">
            <li>Indirect, incidental, or consequential damages</li>
            <li>Loss of profits, data, or business opportunities</li>
            <li>Damages from email deliverability issues or AI inaccuracies</li>
            <li>Damages exceeding the amount you paid in the previous 12 months</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">12. Changes to Terms</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-600">
            <li>We may update these Terms at any time</li>
            <li>Material changes will be notified via email at least 14 days before taking effect</li>
            <li>Continued use after changes take effect constitutes acceptance</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-10 mb-3">13. Contact</h2>
          <p className="text-slate-600 leading-relaxed">
            For questions about these Terms, contact us at:{' '}
            <a href="mailto:support@outrovo.com" className="text-violet-600 hover:underline">support@outrovo.com</a>
          </p>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-100 flex items-center justify-between">
          <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-900">← Privacy Policy</Link>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/">Back to Outrovo</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
