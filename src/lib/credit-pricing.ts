/**
 * Credit Pricing System
 * =====================
 *
 * Central definition of credit costs for every billable operation.
 * The platform makes money by selling monthly plans + add-on credit packs.
 * Users consume credits as they use AI features.
 *
 * Cost rationale (based on actual AI API costs + 10-50x margin):
 *
 *   Groq Llama 3.3 70B:  ~$0.59 / 1M input tokens, ~$0.79 / 1M output tokens
 *   Gemini 2.5 Flash:    ~$0.075 / 1M input, ~$0.30 / 1M output (free tier $0)
 *   Tavily search:       ~$0.01 / search (free tier 1000/mo)
 *   Jina page reader:    ~$0.01 / page (free tier)
 *   Hunter.io email:     ~$0.02 / verified email
 *
 * Each AI call uses ~2-4K tokens → $0.002-$0.005 actual cost per call.
 * We charge 1-5 credits per call with ~10-50x margin to cover:
 * - AI API costs
 * - Infrastructure (Vercel, Supabase, monitoring)
 * - Customer support, billing fees (Stripe 2.9% + $0.30 per transaction)
 * - Profit margin (target 60-70% gross margin)
 *
 * Plan pricing (monthly allowance + price):
 *
 *   Plan       Price   Credits   $/Credit   Notes
 *   ---------|--------|---------|----------|---------------------------
 *   Freemium  $0      30       —          3 auto-prospect runs (trial)
 *   Starter   $49     500      $0.098     Solo SDR / freelancer
 *   Growth    $149    2000     $0.075     Small sales team (5 seats)
 *   Agency    $399    8000     $0.050    Agency with multiple clients
 *
 * Add-on packs (one-time, never expire):
 *   100 credits: $9  ($0.090/credit)
 *   500 credits: $39 ($0.078/credit)
 *   2000 credits: $129 ($0.065/credit)
 */

/**
 * Credit costs for every operation that consumes credits.
 * Keep this as the SINGLE SOURCE OF TRUTH — both API routes and UI
 * should import from here so they always agree.
 */
export const CREDIT_COSTS = {
  /** AI Auto-Prospect: base cost + per-target-company cost.
   *  A run with targetCount=10 costs 5 + 10×2 = 25 credits.
   *  Covers: 1 AI query-gen + ~8 Tavily searches + N page-reads + N AI fit-evals. */
  AUTO_PROSPECT_BASE: 5,
  AUTO_PROSPECT_PER_TARGET: 2,

  /** AI Research basic mode.
   *  Covers: 1 page-read + 1 chat call. */
  RESEARCH_BASIC: 3,

  /** AI Research deep mode.
   *  Covers: 1 page-read + ~5 Tavily searches + ~5 page-reads + 1 deep chat call. */
  RESEARCH_DEEP: 8,

  /** AI cold email generation.
   *  Covers: 1 chat call with research context. */
  EMAIL_GENERATION: 2,

  /** AI Follow-up sequence (3 emails).
   *  Covers: 3 chat calls. */
  FOLLOWUP_SEQUENCE: 5,

  /** Email Enrichment (find decision-maker emails).
   *  Covers: 1 Hunter.io API call (we pay per email) + 1 chat call for ranking. */
  EMAIL_ENRICHMENT: 3,

  /** Send email (SMTP or Smartlead).
   *  Covers: infrastructure + bounce handling + open tracking. */
  SEND_EMAIL: 1,
} as const

/**
 * Calculate auto-prospect cost dynamically based on target count.
 */
export function autoProspectCost(targetCount: number): number {
  return CREDIT_COSTS.AUTO_PROSPECT_BASE + targetCount * CREDIT_COSTS.AUTO_PROSPECT_PER_TARGET
}

/**
 * Plan → monthly credit allowance mapping.
 * Used by Stripe webhook to grant credits after subscription payment.
 */
export const PLAN_CREDITS: Record<string, { credits: number; price: number; name: string }> = {
  freemium: { credits: 30,   price: 0,   name: 'Freemium' },
  starter:  { credits: 500,  price: 49,  name: 'Starter'  },
  growth:   { credits: 2000, price: 149, name: 'Growth'   },
  agency:   { credits: 8000, price: 399, name: 'Agency'   },
}

/**
 * Add-on credit packs (one-time purchase via Stripe).
 * Credits never expire.
 */
export const CREDIT_PACKS = [
  { id: 'pack_100',  credits: 100,  price: 9,   name: 'Starter Pack'    },
  { id: 'pack_500',  credits: 500,  price: 39,  name: 'Growth Pack'     },
  { id: 'pack_2000', credits: 2000, price: 129,  name: 'Agency Pack'     },
] as const

/**
 * Legacy: getPlanCredits (used by resetMonthlyCredits).
 * Now returns the new (lower) allowances — but tenants that already
 * have higher balances keep them; only monthly RESET uses the new number.
 */
export function getPlanCredits(plan: string): number {
  return PLAN_CREDITS[plan]?.credits ?? 30
}
